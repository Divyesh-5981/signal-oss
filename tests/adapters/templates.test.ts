import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import * as core from '@actions/core'
import { loadRepoContext } from '../../src/adapters/github/templates.js'

vi.mock('@actions/core', () => ({
  warning: vi.fn(),
  info: vi.fn(),
}))

const FIXTURES = join(__dirname, '..', 'fixtures', 'templates')
const b64 = (filename: string): string =>
  Buffer.from(readFileSync(join(FIXTURES, filename), 'utf-8')).toString('base64')

// Mock factory: maps path → response (data + status) or throws { status }
type Resp = { data: unknown } | { throw: { status?: number; message?: string } }
function makeOctokit(routes: Record<string, Resp>) {
  const getContent = vi.fn().mockImplementation(({ path }: { path: string }) => {
    const r = routes[path]
    if (!r) return Promise.reject(Object.assign(new Error('not found'), { status: 404 }))
    if ('throw' in r) return Promise.reject(Object.assign(new Error(r.throw.message ?? 'err'), r.throw))
    return Promise.resolve(r)
  })
  const octokit = { rest: { repos: { getContent } } } as unknown as Parameters<typeof loadRepoContext>[0]
  return { octokit, getContent }
}

function makeFileListing(files: Array<{ name: string; path: string; type?: string }>) {
  return files.map((f) => ({ name: f.name, path: f.path, type: f.type ?? 'file' }))
}

function makeFileContent(contentB64: string) {
  return { name: '', path: '', type: 'file', content: contentB64 }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('loadRepoContext', () => {
  it('Test 1: directory 404 → empty RepoContext, does not throw, warning called', async () => {
    const { octokit } = makeOctokit({
      '.github/ISSUE_TEMPLATE': { throw: { status: 404, message: 'Not Found' } },
    })
    const result = await loadRepoContext(octokit, 'o', 'r', 'main')
    expect(result).toEqual({
      hasIssueForms: false,
      hasMdTemplates: false,
      hasContributing: false,
      templates: [],
    })
    expect(vi.mocked(core.warning)).toHaveBeenCalledOnce()
  })

  it('Test 2: single .yml with required fields → hasIssueForms=true, correct fields', async () => {
    const { octokit } = makeOctokit({
      '.github/ISSUE_TEMPLATE': {
        data: makeFileListing([{ name: 'bug_report.yml', path: '.github/ISSUE_TEMPLATE/bug_report.yml' }]),
      },
      '.github/ISSUE_TEMPLATE/bug_report.yml': {
        data: makeFileContent(b64('vue-bug_report.yml')),
      },
    })
    const result = await loadRepoContext(octokit, 'o', 'r', 'main')
    expect(result.hasIssueForms).toBe(true)
    expect(result.templates).toHaveLength(1)
    expect(result.templates[0].filename).toBe('bug_report.yml')
    expect(result.templates[0].type).toBe('form')
    expect(result.templates[0].fields).toBeInstanceOf(Array)
    expect(result.templates[0].fields.length).toBeGreaterThan(0)
    // Should include required fields, exclude markdown type and non-required fields
    expect(result.templates[0].fields).toContain('Vue version')
    expect(result.templates[0].fields).toContain('Link to minimal reproduction')
    expect(result.templates[0].fields).toContain('Steps to reproduce')
    // 'Any additional comments?' has required: false — must NOT be included
    expect(result.templates[0].fields).not.toContain('Any additional comments?')
  })

  it('Test 3: config.yml is skipped — getContent called exactly twice (dir + bug_report.yml)', async () => {
    const { octokit, getContent } = makeOctokit({
      '.github/ISSUE_TEMPLATE': {
        data: makeFileListing([
          { name: 'config.yml', path: '.github/ISSUE_TEMPLATE/config.yml' },
          { name: 'bug_report.yml', path: '.github/ISSUE_TEMPLATE/bug_report.yml' },
        ]),
      },
      '.github/ISSUE_TEMPLATE/bug_report.yml': {
        data: makeFileContent(b64('vue-bug_report.yml')),
      },
    })
    const result = await loadRepoContext(octokit, 'o', 'r', 'main')
    // getContent called twice: once for dir listing, once for bug_report.yml (config.yml NOT fetched)
    expect(getContent).toHaveBeenCalledTimes(2)
    expect(result.templates).toHaveLength(1)
    expect(result.templates[0].filename).toBe('bug_report.yml')
  })

  it('Test 4: malformed YAML → fields=[], no exception', async () => {
    const { octokit } = makeOctokit({
      '.github/ISSUE_TEMPLATE': {
        data: makeFileListing([{ name: 'malformed.yml', path: '.github/ISSUE_TEMPLATE/malformed.yml' }]),
      },
      '.github/ISSUE_TEMPLATE/malformed.yml': {
        data: makeFileContent(b64('malformed.yml')),
      },
    })
    const result = await loadRepoContext(octokit, 'o', 'r', 'main')
    // Either the malformed file is omitted or its fields is []
    const malformedTemplate = result.templates.find((t) => t.filename === 'malformed.yml')
    const fields = malformedTemplate?.fields ?? []
    expect(fields).toEqual([])
  })

  it('Test 5: .md template H3 extraction → type=md, only H3 headings in fields', async () => {
    const { octokit } = makeOctokit({
      '.github/ISSUE_TEMPLATE': {
        data: makeFileListing([{ name: 'bug_report.md', path: '.github/ISSUE_TEMPLATE/bug_report.md' }]),
      },
      '.github/ISSUE_TEMPLATE/bug_report.md': {
        data: makeFileContent(b64('rust-bug_report.md')),
      },
    })
    const result = await loadRepoContext(octokit, 'o', 'r', 'main')
    expect(result.hasMdTemplates).toBe(true)
    expect(result.templates).toHaveLength(1)
    expect(result.templates[0].type).toBe('md')
    // H3 headings from the fixture: Meta, Steps to Reproduce, Expected Behavior
    expect(result.templates[0].fields).toContain('Meta')
    expect(result.templates[0].fields).toContain('Steps to Reproduce')
    expect(result.templates[0].fields).toContain('Expected Behavior')
    // H1 'Bug Report' and H2 'Code' and H4 'Backtrace' must NOT be in fields
    expect(result.templates[0].fields).not.toContain('Bug Report')
    expect(result.templates[0].fields).not.toContain('Code')
    expect(result.templates[0].fields).not.toContain('Backtrace')
  })

  it("Test 6: required: 'true' string coercion — both boolean true and string 'true' included", async () => {
    const { octokit } = makeOctokit({
      '.github/ISSUE_TEMPLATE': {
        data: makeFileListing([{ name: 'vscode_bug.yml', path: '.github/ISSUE_TEMPLATE/vscode_bug.yml' }]),
      },
      '.github/ISSUE_TEMPLATE/vscode_bug.yml': {
        data: makeFileContent(b64('vscode-bug_report.yml')),
      },
    })
    const result = await loadRepoContext(octokit, 'o', 'r', 'main')
    expect(result.templates[0].fields).toContain('VS Code Version')     // required: 'true' (string)
    expect(result.templates[0].fields).toContain('Steps to Reproduce')  // required: true (boolean)
  })

  it('Test 7: type: markdown body elements are skipped (no label from them)', async () => {
    const { octokit } = makeOctokit({
      '.github/ISSUE_TEMPLATE': {
        data: makeFileListing([{ name: 'bug_report.yml', path: '.github/ISSUE_TEMPLATE/bug_report.yml' }]),
      },
      '.github/ISSUE_TEMPLATE/bug_report.yml': {
        data: makeFileContent(b64('vue-bug_report.yml')),
      },
    })
    const result = await loadRepoContext(octokit, 'o', 'r', 'main')
    // The markdown element in vue-bug_report.yml has value: 'Thanks for reporting a bug.'
    // That text must not appear in fields
    expect(result.templates[0].fields).not.toContain('Thanks for reporting a bug.')
    // Ensure only properly required input/textarea elements are included
    expect(result.templates[0].fields.length).toBe(3) // version, link, steps
  })

  it('Test 8: network error on one file fetch → that file omitted, others survive, warning called', async () => {
    const { octokit } = makeOctokit({
      '.github/ISSUE_TEMPLATE': {
        data: makeFileListing([
          { name: 'ok.yml', path: '.github/ISSUE_TEMPLATE/ok.yml' },
          { name: 'fail.yml', path: '.github/ISSUE_TEMPLATE/fail.yml' },
        ]),
      },
      '.github/ISSUE_TEMPLATE/ok.yml': {
        data: makeFileContent(b64('vue-bug_report.yml')),
      },
      '.github/ISSUE_TEMPLATE/fail.yml': { throw: { message: 'ECONNRESET' } },
    })
    const result = await loadRepoContext(octokit, 'o', 'r', 'main')
    expect(result.templates).toHaveLength(1)
    expect(result.templates[0].filename).toBe('ok.yml')
    expect(vi.mocked(core.warning)).toHaveBeenCalled()
  })

  it('Test 9: base64 with embedded newlines decodes correctly', async () => {
    // Manually construct base64 with embedded newlines (like GitHub API returns)
    const rawYaml = `name: Bug\ndescription: Test\nbody:\n  - type: input\n    id: v\n    attributes:\n      label: Version\n    validations:\n      required: true\n`
    const rawB64 = Buffer.from(rawYaml).toString('base64')
    // Inject newlines every ~8 chars as GitHub API does
    const b64WithNewlines = rawB64.replace(/(.{8})/g, '$1\n')
    const { octokit } = makeOctokit({
      '.github/ISSUE_TEMPLATE': {
        data: makeFileListing([{ name: 'embedded.yml', path: '.github/ISSUE_TEMPLATE/embedded.yml' }]),
      },
      '.github/ISSUE_TEMPLATE/embedded.yml': {
        data: { name: 'embedded.yml', path: '.github/ISSUE_TEMPLATE/embedded.yml', type: 'file', content: b64WithNewlines },
      },
    })
    const result = await loadRepoContext(octokit, 'o', 'r', 'main')
    expect(result.templates).toHaveLength(1)
    expect(result.templates[0].fields).toContain('Version')
  })

  it('Test 10: mixed directory (.yml + .md) → hasIssueForms=true && hasMdTemplates=true', async () => {
    const { octokit } = makeOctokit({
      '.github/ISSUE_TEMPLATE': {
        data: makeFileListing([
          { name: 'bug_report.yml', path: '.github/ISSUE_TEMPLATE/bug_report.yml' },
          { name: 'bug_report.md', path: '.github/ISSUE_TEMPLATE/bug_report.md' },
        ]),
      },
      '.github/ISSUE_TEMPLATE/bug_report.yml': {
        data: makeFileContent(b64('vue-bug_report.yml')),
      },
      '.github/ISSUE_TEMPLATE/bug_report.md': {
        data: makeFileContent(b64('rust-bug_report.md')),
      },
    })
    const result = await loadRepoContext(octokit, 'o', 'r', 'main')
    expect(result.hasIssueForms).toBe(true)
    expect(result.hasMdTemplates).toBe(true)
    expect(result.templates).toHaveLength(2)
  })
})

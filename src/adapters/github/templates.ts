// src/adapters/github/templates.ts
// Phase 2 (CHECK-03 / CHECK-04): loads .github/ISSUE_TEMPLATE/ via Octokit, parses
// issue forms (YAML) and markdown templates into typed ParsedTemplate[].
// D-01..D-04: getContent on default branch, never throws, core.warning + fallthrough on any error.

import * as core from '@actions/core'
import type * as github from '@actions/github'
import type { Heading } from 'mdast'
import { toString as mdastToString } from 'mdast-util-to-string'
import remarkParse from 'remark-parse'
import { unified } from 'unified'
import { visit } from 'unist-util-visit'
import { parse as parseYaml } from 'yaml'
import type { ParsedTemplate, RepoContext } from '../../core/types.js'

type OctokitInstance = ReturnType<typeof github.getOctokit>

const EMPTY_CONTEXT: RepoContext = {
  hasIssueForms: false,
  hasMdTemplates: false,
  hasContributing: false,
  templates: [],
}

export async function loadRepoContext(
  octokit: OctokitInstance,
  owner: string,
  repo: string,
  defaultBranch: string,
): Promise<RepoContext> {
  // 1. Directory listing
  let listing: Array<{ name: string; path: string; type: string }>
  try {
    const { data } = await octokit.rest.repos.getContent({
      owner,
      repo,
      path: '.github/ISSUE_TEMPLATE',
      ref: defaultBranch,
    })
    if (!Array.isArray(data)) {
      core.warning('Expected .github/ISSUE_TEMPLATE directory listing but got file response')
      return EMPTY_CONTEXT
    }
    listing = data as typeof listing
  } catch (err: unknown) {
    core.warning(`Could not list .github/ISSUE_TEMPLATE: ${(err as Error).message}`)
    return EMPTY_CONTEXT
  }

  // 2. Filter to parseable templates; skip config.yml / config.yaml (Pitfall 2 / T-02-07, CR-02)
  const SKIP_NAMES = new Set(['config.yml', 'config.yaml'])
  const templateFiles = listing.filter(
    (f) =>
      f.type === 'file' &&
      (f.name.endsWith('.yml') || f.name.endsWith('.yaml') || f.name.endsWith('.md')) &&
      !SKIP_NAMES.has(f.name.toLowerCase()),
  )

  // 3. Per-file fetch + parse
  const templates: ParsedTemplate[] = []
  for (const file of templateFiles) {
    try {
      const { data: fileData } = await octokit.rest.repos.getContent({
        owner,
        repo,
        path: file.path,
        ref: defaultBranch,
      })
      if (
        Array.isArray(fileData) ||
        typeof (fileData as { content?: unknown }).content !== 'string'
      ) {
        core.warning(`Template ${file.name} returned unexpected shape; skipping`)
        continue
      }
      // Base64 decode: strip embedded newlines first (GitHub API splits base64 with \n)
      const raw = Buffer.from(
        (fileData as { content: string }).content.replace(/\n/g, ''),
        'base64',
      ).toString('utf-8')

      if (file.name.endsWith('.md')) {
        templates.push({ filename: file.name, type: 'md', fields: parseMdTemplate(raw) })
      } else {
        templates.push({ filename: file.name, type: 'form', fields: parseIssueFormFields(raw) })
      }
    } catch (err: unknown) {
      core.warning(`Could not fetch template ${file.name}: ${(err as Error).message}`)
    }
  }

  // hasContributing: always false in Phase 2; Phase 4 will implement CONTRIBUTING.md fetch
  core.debug('hasContributing: stubbed false (Phase 4 will implement)')
  return {
    hasIssueForms: templates.some((t) => t.type === 'form'),
    hasMdTemplates: templates.some((t) => t.type === 'md'),
    hasContributing: false,
    templates,
  }
}

function parseIssueFormFields(rawYaml: string): string[] {
  try {
    const doc = parseYaml(rawYaml) as { body?: unknown } | null
    const body = doc?.body
    if (!Array.isArray(body)) return []
    return body
      .filter(
        (f): f is Record<string, unknown> =>
          typeof f === 'object' && f !== null && (f as Record<string, unknown>).type !== 'markdown',
      )
      .filter((f) => {
        const v = f.validations as Record<string, unknown> | undefined
        // Pitfall 3: loose equality covers both boolean true and string 'true'
        return v !== undefined && (v.required === true || v.required === 'true')
      })
      .map((f) => {
        const attrs = f.attributes as Record<string, unknown> | undefined
        return String(attrs?.label ?? '').trim()
      })
      .filter((s) => s.length > 0)
  } catch {
    return []
  }
}

function parseMdTemplate(rawMd: string): string[] {
  try {
    const tree = unified().use(remarkParse).parse(rawMd)
    const headings: string[] = []
    visit(tree, 'heading', (node: Heading) => {
      if (node.depth === 3) {
        headings.push(mdastToString(node).trim())
      }
    })
    return headings.filter((s) => s.length > 0)
  } catch {
    return []
  }
}

---
phase: 02-action-hardening-repo-awareness
plan: 02
type: execute
wave: 2
depends_on: ["02-01"]
files_modified:
  - src/adapters/github/templates.ts
  - tests/adapters/templates.test.ts
  - tests/fixtures/templates/vue-bug_report.yml
  - tests/fixtures/templates/vscode-bug_report.yml
  - tests/fixtures/templates/rust-bug_report.md
  - tests/fixtures/templates/config.yml
  - tests/fixtures/templates/malformed.yml
autonomous: true
requirements: [CHECK-03, CHECK-04]
tags: [adapter, octokit, yaml-parser, markdown-parser, templates]

must_haves:
  truths:
    - "`loadRepoContext(octokit, owner, repo, defaultBranch)` returns a `RepoContext` with `templates: ParsedTemplate[]` populated from `.github/ISSUE_TEMPLATE/`"
    - "When the directory does not exist (404), the function returns `{ hasIssueForms: false, hasMdTemplates: false, hasContributing: false, templates: [] }` and does NOT throw"
    - "When the directory exists, `.yml`/`.yaml` files are parsed as issue forms; `.md` files are parsed as markdown templates"
    - "`config.yml` (chooser config) is skipped without being parsed"
    - "Malformed YAML in any template file is caught — function continues and that file's `fields` is `[]` (or the file is omitted entirely)"
    - "Only YAML fields with `validations.required` truthy (both boolean `true` and string `'true'`) are included in `fields[]`"
    - "Only H3 (`### Header`) headings are extracted from markdown templates"
    - "Base64 file content with embedded newlines decodes correctly to UTF-8"
    - "`hasIssueForms` is `true` iff at least one `ParsedTemplate` has `type === 'form'`"
    - "`hasMdTemplates` is `true` iff at least one `ParsedTemplate` has `type === 'md'`"
    - "Function never throws — all Octokit errors caught and converted to `core.warning()` + fallthrough"
  artifacts:
    - path: "src/adapters/github/templates.ts"
      provides: "loadRepoContext(), parseIssueFormFields(), parseMdTemplate()"
      exports: ["loadRepoContext"]
      min_lines: 80
    - path: "tests/adapters/templates.test.ts"
      provides: "Unit tests for all four error/success branches"
      min_lines: 100
    - path: "tests/fixtures/templates/vue-bug_report.yml"
      provides: "Real-world issue form fixture (vue/core style)"
    - path: "tests/fixtures/templates/rust-bug_report.md"
      provides: "Real-world markdown template fixture (rust-lang/rust style)"
  key_links:
    - from: "src/adapters/github/templates.ts"
      to: "src/core/types.ts"
      via: "import type { ParsedTemplate, RepoContext } from '../../core/types.js'"
      pattern: "import type \\{ ParsedTemplate"
    - from: "src/adapters/github/templates.ts"
      to: "octokit.rest.repos.getContent"
      via: "directory listing + per-file fetch"
      pattern: "octokit\\.rest\\.repos\\.getContent"
    - from: "src/adapters/github/templates.ts"
      to: "yaml"
      via: "parse() call with try/catch"
      pattern: "from 'yaml'"
    - from: "src/adapters/github/templates.ts"
      to: "remark-parse"
      via: "unified().use(remarkParse).parse()"
      pattern: "remark-parse"
---

<objective>
Build the templates adapter — the one function that turns "this repo's `.github/ISSUE_TEMPLATE/` directory" into a typed `RepoContext` that Tier 1 and Tier 2 strategies consume. Delivers CHECK-03 (Tier 1 YAML parser) and CHECK-04 (Tier 2 markdown parser) at the *parsing* layer; Plan 04 builds the strategies that use the output.

Purpose: This is the single point where untrusted remote files (template YAML/markdown from any consumer's repo) cross the trust boundary into our pure core. All Octokit calls, base64 decoding, YAML parsing, and AST walking are contained here. The hero-output invariant (D-03 in CONTEXT.md) is enforced: this function NEVER throws — any failure becomes `core.warning()` + a safe empty fallback.

Output: `src/adapters/github/templates.ts` (loadRepoContext + two private parsers), comprehensive test file with mocked Octokit, and 5 real-world fixture files covering the success path, the chooser-config skip case, the malformed-YAML resilience case, and one markdown template.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/02-action-hardening-repo-awareness/02-CONTEXT.md
@.planning/phases/02-action-hardening-repo-awareness/02-RESEARCH.md
@.planning/phases/02-action-hardening-repo-awareness/02-PATTERNS.md
@.planning/phases/02-action-hardening-repo-awareness/02-01-foundations-SUMMARY.md
@src/core/types.ts
@src/adapters/github/io.ts
@tests/adapters/github.test.ts

<interfaces>
<!-- Types this plan consumes (from Plan 01) -->
```typescript
// src/core/types.ts (already updated by Plan 01)
export interface ParsedTemplate {
  filename: string
  type: 'form' | 'md'
  fields: string[]
}
export interface RepoContext {
  hasIssueForms: boolean
  hasMdTemplates: boolean
  hasContributing: boolean
  templates: ParsedTemplate[]
}
```

<!-- Contract this plan produces -->
```typescript
// src/adapters/github/templates.ts (new file)
export async function loadRepoContext(
  octokit: OctokitInstance,
  owner: string,
  repo: string,
  defaultBranch: string,
): Promise<RepoContext>
```

<!-- Pattern reference from src/adapters/github/io.ts (existing) -->
type OctokitInstance = ReturnType<typeof github.getOctokit>
// io.ts pattern: destructure { data } from octokit.rest.* calls
// THIS plan inverts io.ts error pattern: wrap every Octokit call in try/catch with core.warning fallback
```

<!-- Octokit getContent response shape (polymorphic — Pitfall 1) -->
```typescript
// Directory: data is Array<{ name, path, type: 'file' | 'dir', ... }>
// File:      data is { name, path, type: 'file', content: string /* base64, may contain \n */, ... }
// Test with Array.isArray(data) to distinguish
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Author fixture corpus + write failing test suite for `loadRepoContext`</name>
  <read_first>
    - tests/adapters/github.test.ts (mock factory pattern lines 5-15 — copy this approach)
    - .planning/phases/02-action-hardening-repo-awareness/02-RESEARCH.md (Pattern 1: getContent directory + file fetch shapes; Pattern 2: tolerant YAML parsing; Pattern 3: H3 extraction; Pitfall 1: polymorphic getContent; Pitfall 2: skip config.yml; Pitfall 3: string `'true'` coercion)
    - .planning/phases/02-action-hardening-repo-awareness/02-PATTERNS.md (templates.ts analog section + Test File Patterns)
  </read_first>
  <behavior>
    Tests MUST fail at this point (the implementation file does not yet exist). Each test below describes a single observable outcome of `loadRepoContext`:

    - Test 1 (`directory 404 → empty RepoContext`): When `octokit.rest.repos.getContent` for the `.github/ISSUE_TEMPLATE` path rejects with `{ status: 404 }`, `loadRepoContext` resolves to `{ hasIssueForms: false, hasMdTemplates: false, hasContributing: false, templates: [] }`. No exception bubbles. `core.warning` is called once.
    - Test 2 (`single .yml with required fields → hasIssueForms=true`): Mock returns a 1-item directory listing for `bug_report.yml`, then returns the file content (base64-encoded fixture `vue-bug_report.yml`). Result: `hasIssueForms === true`, `templates.length === 1`, `templates[0].filename === 'bug_report.yml'`, `templates[0].type === 'form'`, `templates[0].fields` is a non-empty `string[]` containing the human label of every `validations.required: true` field (and excluding `type: markdown` entries and non-required fields).
    - Test 3 (`config.yml skipped`): Directory listing contains `config.yml` and `bug_report.yml`. The mock for `getContent` of `config.yml` MUST NOT be called (assertion: `getContent` called exactly twice total — once for dir listing, once for `bug_report.yml`). Result has exactly one entry in `templates`.
    - Test 4 (`malformed YAML → fields=[]`): Directory listing contains `malformed.yml`. File content is `:::not-yaml:::`. Result: `templates.length === 1`, `templates[0].fields` is `[]`. No exception. (Or the malformed file is omitted; both behaviors are acceptable — assert via union: `templates.find(t => t.filename === 'malformed.yml')?.fields ?? []` equals `[]`.)
    - Test 5 (`.md template H3 extraction`): Directory listing contains `bug_report.md`. File content (base64-encoded `rust-bug_report.md` fixture) has H1, H2, H3, H4 headings. Result: `templates[0].type === 'md'`, `fields` contains the H3 heading texts in order, excluding H1/H2/H4. `hasMdTemplates === true`.
    - Test 6 (`required: 'true'` string coercion): Fixture YAML where one field has `required: true` and another has `required: 'true'` (quoted string). Both must appear in `fields[]` (loose equality per Pitfall 3).
    - Test 7 (`type: markdown skipped`): Fixture YAML with one `type: markdown` body element (rendered help text, no validation) and one `type: input` with `required: true`. Result: `fields` contains only the input's label, NOT the markdown element's text.
    - Test 8 (`getContent network error mid-fetch → that file omitted, others survive`): Directory listing returns 2 files; first file fetch resolves OK, second rejects with `Error('ECONNRESET')`. Result: `templates.length === 1` (only the successful one), `core.warning` called for the failed file, function does not throw.
    - Test 9 (`base64 with embedded newlines decodes`): File content field is split across newlines (`'bmFt\nZTog\nQnVn\n'` style). Result: parses correctly to `{ name: 'Bug' }` after `replace(/\n/g,'')` strip.
    - Test 10 (`hasIssueForms/hasMdTemplates correctly toggle`): A mixed directory with one `.yml` and one `.md` yields `hasIssueForms === true && hasMdTemplates === true`.
  </behavior>
  <action>
    Step A — create fixture files under `tests/fixtures/templates/`:

    1. `tests/fixtures/templates/vue-bug_report.yml` — realistic vue/core-style issue form. Exact content:
    ```yaml
    name: Bug Report
    description: File a bug report
    body:
      - type: markdown
        attributes:
          value: Thanks for reporting a bug.
      - type: input
        id: version
        attributes:
          label: Vue version
        validations:
          required: true
      - type: input
        id: link
        attributes:
          label: Link to minimal reproduction
        validations:
          required: true
      - type: textarea
        id: steps
        attributes:
          label: Steps to reproduce
        validations:
          required: true
      - type: textarea
        id: optional
        attributes:
          label: Any additional comments?
        validations:
          required: false
    ```

    2. `tests/fixtures/templates/vscode-bug_report.yml` — fixture using the string-quoted `required: 'true'` variant (Pitfall 3 coverage):
    ```yaml
    name: VS Code Bug
    description: Report a bug
    body:
      - type: input
        id: version
        attributes:
          label: VS Code Version
        validations:
          required: 'true'
      - type: textarea
        id: repro
        attributes:
          label: Steps to Reproduce
        validations:
          required: true
    ```

    3. `tests/fixtures/templates/rust-bug_report.md` — markdown template with mixed heading depths:
    ```markdown
    ---
    name: Bug Report
    about: Report a bug
    labels: C-bug
    ---

    # Bug Report

    Thanks for filing a bug.

    ## Code

    ```rust
    fn main() { /* example */ }
    ```

    ### Meta

    `rustc --version --verbose`:

    ### Steps to Reproduce

    1. ...

    ### Expected Behavior

    The compiler should...

    #### Backtrace

    Optional backtrace section.
    ```

    4. `tests/fixtures/templates/config.yml` — chooser config (must be skipped):
    ```yaml
    blank_issues_enabled: false
    contact_links:
      - name: Discord
        url: https://discord.example
        about: Chat with us
    ```

    5. `tests/fixtures/templates/malformed.yml` — intentionally broken YAML:
    ```
    : : : not-yaml : : :
      [[[ invalid
    ```

    Step B — create `tests/adapters/templates.test.ts`. Use Vitest 3.x syntax (same as `tests/adapters/github.test.ts`). Mock structure:

    ```typescript
    import { describe, it, expect, vi, beforeEach } from 'vitest'
    import { readFileSync } from 'node:fs'
    import { join } from 'node:path'
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
    ```

    Implement all 10 test cases from `<behavior>`. Each test constructs `routes`, calls `loadRepoContext(octokit, 'o', 'r', 'main')`, and asserts the documented outcome. Tests for `core.warning` calls use `import * as core from '@actions/core'` plus `expect(vi.mocked(core.warning)).toHaveBeenCalled()`.

    Step C — run `npm test -- tests/adapters/templates.test.ts`. Confirm tests fail with "Cannot find module '../../src/adapters/github/templates.js'" or similar (the file does not yet exist). This is the RED phase.

    Do NOT create `src/adapters/github/templates.ts` in this task. Task 2 implements it.
  </action>
  <verify>
    <automated>npm test -- --run tests/adapters/templates.test.ts 2&gt;&amp;1 | grep -E "(Cannot find module|FAIL|failed)" &amp;&amp; echo "RED-OK"</automated>
  </verify>
  <acceptance_criteria>
    - `tests/fixtures/templates/vue-bug_report.yml` exists and contains the line `required: true`
    - `tests/fixtures/templates/vscode-bug_report.yml` exists and contains the line `required: 'true'` (quoted string variant)
    - `tests/fixtures/templates/rust-bug_report.md` exists and contains at least 3 lines starting with `### ` (H3 headings)
    - `tests/fixtures/templates/config.yml` exists and contains `blank_issues_enabled: false`
    - `tests/fixtures/templates/malformed.yml` exists and contains the substring `not-yaml`
    - `tests/adapters/templates.test.ts` exists and contains at least 10 `it(` blocks (verifiable with `grep -c "it(" tests/adapters/templates.test.ts` ≥ 10)
    - `tests/adapters/templates.test.ts` references each fixture filename at least once
    - `npm test -- --run tests/adapters/templates.test.ts` exits non-zero (RED — module does not exist yet)
    - Existing 96 tests still pass: `npm test -- --run --exclude='**/templates.test.ts'` reports `96 passed`
  </acceptance_criteria>
  <done>
    Five fixture files committed, comprehensive test file exists with 10+ failing tests, and the failure mode is "module not found" (proving the test names downstream functionality that does not exist yet). RED phase complete.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Implement `loadRepoContext` and private parsers in `src/adapters/github/templates.ts`</name>
  <read_first>
    - src/adapters/github/io.ts (analog file — copy `OctokitInstance` alias and imports pattern, but invert error behavior to catch+warn+fallthrough)
    - src/core/types.ts (confirm `ParsedTemplate` and `RepoContext` shape from Plan 01)
    - .planning/phases/02-action-hardening-repo-awareness/02-RESEARCH.md (Code Examples section: full `loadRepoContext` implementation; Pattern 2 + Pattern 3 parser snippets)
    - tests/adapters/templates.test.ts (this is the spec — implementation must make every test pass)
    - tests/fixtures/templates/*.yml + *.md (the input data the parsers must handle)
  </read_first>
  <behavior>
    GREEN phase: implement `loadRepoContext` and its private helpers `parseIssueFormFields(rawYaml: string): string[]` and `parseMdTemplate(rawMd: string): string[]`. After this task, all 10 tests from Task 1 pass. Existing 96 tests still pass.

    Concrete behaviors the implementation must produce:
    - `parseIssueFormFields('')` returns `[]`
    - `parseIssueFormFields(':::not-yaml:::')` returns `[]` (catches the `yaml.parse` throw)
    - `parseIssueFormFields(rawYaml)` walks `doc.body`, filters out `type === 'markdown'` entries, includes entries where `validations.required == true` (loose equality covers boolean `true` AND string `'true'`), extracts `attributes.label`, filters out empty strings, preserves template order
    - `parseMdTemplate(rawMd)` returns the plain-text content of every `heading` node with `depth === 3`, in document order, using `mdast-util-to-string`
    - `loadRepoContext` calls `octokit.rest.repos.getContent` once for the directory listing (path = `.github/ISSUE_TEMPLATE`, ref = defaultBranch); on rejection returns the empty `RepoContext`; on resolve checks `Array.isArray(data)` (Pitfall 1) and falls back to empty if not
    - For each file entry where `type === 'file'` AND filename ends in `.yml`/`.yaml`/`.md` AND filename lowercase ≠ `config.yml`: call `getContent` again with the file's `path`, decode `content` via `Buffer.from(content.replace(/\n/g,''), 'base64').toString('utf-8')`, then call the appropriate parser. Append `{ filename, type: 'form'|'md', fields }` to the templates list.
    - Each per-file fetch wrapped in try/catch with `core.warning(...)` on failure (test 8 — partial-failure resilience)
    - Final return: `{ hasIssueForms: templates.some(t => t.type==='form'), hasMdTemplates: templates.some(t => t.type==='md'), hasContributing: false, templates }`
  </behavior>
  <action>
    Create `src/adapters/github/templates.ts`. Use this exact skeleton (imports + signatures); body details are derived from the test expectations and the RESEARCH.md Code Examples section.

    ```typescript
    // src/adapters/github/templates.ts
    // Phase 2 (CHECK-03 / CHECK-04): loads .github/ISSUE_TEMPLATE/ via Octokit, parses
    // issue forms (YAML) and markdown templates into typed ParsedTemplate[].
    // D-01..D-04: getContent on default branch, never throws, core.warning + fallthrough on any error.

    import * as core from '@actions/core'
    import type * as github from '@actions/github'
    import { parse as parseYaml } from 'yaml'
    import { unified } from 'unified'
    import remarkParse from 'remark-parse'
    import { toString as mdastToString } from 'mdast-util-to-string'
    import { visit } from 'unist-util-visit'
    import type { Heading } from 'mdast'
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
          owner, repo, path: '.github/ISSUE_TEMPLATE', ref: defaultBranch,
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

      // 2. Filter to parseable templates; skip config.yml (Pitfall 2)
      const templateFiles = listing.filter(
        (f) =>
          f.type === 'file' &&
          (f.name.endsWith('.yml') || f.name.endsWith('.yaml') || f.name.endsWith('.md')) &&
          f.name.toLowerCase() !== 'config.yml',
      )

      // 3. Per-file fetch + parse
      const templates: ParsedTemplate[] = []
      for (const file of templateFiles) {
        try {
          const { data: fileData } = await octokit.rest.repos.getContent({
            owner, repo, path: file.path, ref: defaultBranch,
          })
          if (Array.isArray(fileData) || typeof (fileData as { content?: unknown }).content !== 'string') {
            core.warning(`Template ${file.name} returned unexpected shape; skipping`)
            continue
          }
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
            return v?.required == true // eslint-disable-line eqeqeq
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
    ```

    NOTES on the `// eslint-disable-line eqeqeq` comment: Biome 2.x is the linter (not ESLint), and the loose-equality `== true` is intentional per Pitfall 3. If Biome flags it, use `validations?.required === true || validations?.required === 'true'` (explicit form) instead. Pick whichever passes `npm run lint` cleanly.

    After implementation, run:
    1. `npm test -- --run tests/adapters/templates.test.ts` — expect all tests green
    2. `npm test -- --run` — expect total `96 + N passed` (where N = test count from Task 1)
    3. `npm run build` — TypeScript must compile
    4. `npm run lint` — no errors
  </action>
  <verify>
    <automated>npm test -- --run tests/adapters/templates.test.ts &amp;&amp; npm run build &amp;&amp; npm run lint</automated>
  </verify>
  <acceptance_criteria>
    - `src/adapters/github/templates.ts` exists; `grep -c "export async function loadRepoContext" src/adapters/github/templates.ts` returns 1
    - `grep "from 'yaml'" src/adapters/github/templates.ts` matches exactly once
    - `grep "remark-parse" src/adapters/github/templates.ts` matches at least once
    - `grep "config.yml" src/adapters/github/templates.ts` matches at least once (filter logic present)
    - `grep "Array.isArray" src/adapters/github/templates.ts` matches at least once (Pitfall 1 guard)
    - `grep "core.warning" src/adapters/github/templates.ts` matches at least 3 times (one per error path: dir-listing, file-shape, per-file fetch)
    - `grep -v "^//" src/adapters/github/templates.ts | grep -c "throw " | tr -d '[:space:]'` returns `0` — no `throw` statements in the production code path (errors only via core.warning + fallthrough; exceptions are caught, not thrown)
    - `grep -E "(=== true|== true|=== 'true')" src/adapters/github/templates.ts` matches at least once (Pitfall 3 `required` coercion)
    - `npm test -- --run tests/adapters/templates.test.ts` exits 0; output shows all 10+ tests pass
    - `npm test -- --run` reports at least 96 + 10 = 106 tests passing
    - `npm run build` exits 0
    - `npm run lint` exits 0
  </acceptance_criteria>
  <done>
    `src/adapters/github/templates.ts` implements `loadRepoContext` plus YAML and markdown parsers. All 10 tests from Task 1 pass. Existing 96 tests still pass. Type-check and lint clean. The adapter contract is now usable by Plan 05 (main.ts wiring) and the strategies in Plan 04.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| consumer repo `.github/ISSUE_TEMPLATE/*` → adapter | Untrusted content authored by any GitHub user with push access to the consumer repo. YAML and Markdown flow into `parseIssueFormFields` and `parseMdTemplate`. |
| GitHub API (octokit) → adapter | Trusted transport, but response payloads are derived from the consumer repo (above) so the content is still untrusted. |
| adapter → core (RepoContext) | Adapter emits a typed `ParsedTemplate[]`; downstream core is purely functional and treats `fields[]` as opaque strings. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-02-05 | Tampering | Malformed YAML in `.github/ISSUE_TEMPLATE/*.yml` | mitigate | `parseIssueFormFields` wraps `yaml.parse` in `try { ... } catch { return [] }` (Task 2 acceptance criterion grep-verified). Test 4 in Task 1 covers this with the `malformed.yml` fixture — function does not throw, that template gets `fields=[]`, other templates in the directory still parse. |
| T-02-06 | Denial of Service | Oversized template file content consumes memory | accept | GitHub itself caps file content delivery via the Contents API at ~1MB per file. Phase 2 corpus (10 popular repos) max template size observed is < 10KB. No explicit byte cap needed; if it becomes an issue in soak, Plan 05's `max-body-bytes` input is the wider knob. |
| T-02-07 | Tampering | `config.yml` parsed as a template (chooser config → garbage fields) | mitigate | Explicit filename filter `f.name.toLowerCase() !== 'config.yml'` (Task 2 acceptance criterion grep-verified). Test 3 in Task 1 asserts `getContent` is never invoked for `config.yml`. |
| T-02-08 | Information Disclosure | Error message from Octokit contains repo path or auth hints | accept | Error messages are surfaced via `core.warning()` to the workflow log (already visible to the consumer who installed the Action). Phase 4 LLM-06 covers `core.setSecret(apiKey)` for the LLM path; this phase has no secrets to redact. |
| T-02-09 | Elevation of Privilege | Template field label contains HTML or `@mentions` injected via the adapter into the posted comment | mitigate | Template field labels appear in the comment body only through `${label.toLowerCase()}` interpolation inside `'Could you share the X?'` text. GitHub Issues renders comments as Markdown — bare `@mentions` would resolve, and HTML tags would render. **This plan does not sanitize**; sanitization is added in Plan 04 (strategies) where field labels become checklist items. Recorded here for traceability. |
| T-02-10 | Tampering | Polymorphic `getContent` returns a single-file object instead of an array (Pitfall 1) | mitigate | `Array.isArray(data)` guard immediately after the directory listing call (Task 2 acceptance criterion grep-verified). On false, function logs a warning and returns the empty `RepoContext`. |
</threat_model>

<verification>
- `npm test -- --run tests/adapters/templates.test.ts` → all 10+ tests pass
- `npm test -- --run` → at least 106 tests pass (96 + 10 from this plan)
- `npm run build` → TypeScript compiles
- `npm run lint` → no errors
- Manual smoke (Plan 05 will repeat this in a real sandbox): the function loads vue/core templates without throwing
</verification>

<success_criteria>
- `src/adapters/github/templates.ts` exports `loadRepoContext` with the documented signature
- The function never throws — all Octokit and parser errors caught and surfaced via `core.warning()`
- `config.yml` is unconditionally skipped before any parse
- Issue-form YAML: only `validations.required` truthy (boolean `true` AND string `'true'`) fields contribute to `fields[]`; `type: markdown` entries excluded; empty labels filtered
- Markdown templates: only H3 headings (`depth === 3`) become `fields[]` entries
- 5 fixture files exist under `tests/fixtures/templates/`
- 10+ unit tests in `tests/adapters/templates.test.ts`, all passing
- Pitfalls 1, 2, 3, 8 from RESEARCH.md are demonstrably handled (test cases prove the behavior)
</success_criteria>

<output>
After completion, create `.planning/phases/02-action-hardening-repo-awareness/02-02-templates-adapter-SUMMARY.md`.
</output>

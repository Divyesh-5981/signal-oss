# Phase 2: Action Hardening + Repo-Awareness - Research

**Researched:** 2026-05-14
**Domain:** GitHub Action hardening, GitHub Issues label API, Octokit getContent, YAML/Markdown template parsing, `core.summary()`, checklist strategy chain extension
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Load `.github/ISSUE_TEMPLATE/` files via `octokit.rest.repos.getContent` API — no `actions/checkout` needed.
- **D-02:** Template-fetching code lives in `src/adapters/github/templates.ts` (new file alongside `io.ts`). Pure fetch+parse, no business logic.
- **D-03:** On any template API failure: silent fallthrough — `core.warning()` + `RepoContext` gets `hasIssueForms=false, hasMdTemplates=false`. Never throws. Hero output always posts.
- **D-04:** Fetch template files from the repo's **default branch**, not the triggering commit SHA.
- **D-05:** Multi-template selection by filename type-match (case-insensitive substring): bug → `*bug_report*`, feature → `*feature_request*`, question → `*question*`. If no filename matches, fall through to union of all templates' required fields as last resort before Tier 4.
- **D-06:** `IssueFormStrategy.applies()` returns `false` when the matched template has zero `required: true` fields.
- **D-07:** Tier 2: parse **H3 headings only** (`### Header`) as field labels.
- **D-08:** Max 5 checklist items from Tier 1 or Tier 2 (top 5 by template order).
- **D-09:** Rich `core.summary()` report: issue title/number, detected type, signals table (7 signals with ✓/✗), score badge, tier used, template count, label action, comment URL.
- **D-10:** `dry-run` active: full rich report plus dry-run banner at top.
- **D-11:** Early exit (bot-loop guard or `signal-oss-ignore`): one-line exit reason only to `core.summary()`.
- **D-12:** Default label color: `#e4e669` (yellow). Default description: `"Waiting for more information from the issue author"`.
- **D-13:** If label already exists: silent succeed — apply as-is, do NOT overwrite maintainer's color/description.
- **D-14:** On re-run: always re-apply label if checklist has any items (unconditional, no state tracking).

### Claude's Discretion

- `src/adapters/github/labels.ts` — new file for label management; implementation structure is Claude's call.
- Exact action input defaults for `max-body-bytes` (suggest 10000), `gray-zone-low` (4), `gray-zone-high` (6).
- Exact `core.summary()` Markdown formatting — follow GitHub Actions summary spec, pick what renders cleanest.
- Exact filename-to-type mapping heuristics beyond the three listed in D-05 (e.g., `general.yml`, `support.yml`).

### Deferred Ideas (OUT OF SCOPE)

- Tier 3: CONTRIBUTING.md → LLM extraction (Phase 4)
- LLM adjudicator (Phase 4)
- Pagination for comment listing (Phase 3/4 if needed)
- `issues.edited` trigger (Phase 3 evaluation)
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ACT-06 | Label management: auto-create `needs-info` label (color + description) if missing; apply when checklist has any items; remove when checklist becomes empty on re-run | Octokit `repos.createLabel` + `issues.addLabels` + `issues.removeLabel` — all verified in installed node_modules |
| ACT-07 | Action inputs: `dry-run`, `enable-comments`, `enable-labels`, `label-name`, `model`, `gray-zone-low`, `gray-zone-high`, `max-body-bytes` with zero-config defaults | `core.getInput` + `core.getBooleanInput` APIs verified; `action.yml` inputs section confirmed |
| ACT-08 | Skip-label opt-out: if issue carries `signal-oss-ignore` label at trigger time, exit cleanly with one-line summary | Logic runs on `issue.labels` already in event payload; no extra API call needed; happens before template loading |
| ACT-09 | `core.summary()` workflow-run UI report: input issue, signals, score, posted comment URL | `@actions/core` 3.0.1 `summary` singleton verified in installed package — addRaw/addTable/addEOL/write() chain confirmed |
| ACT-10 | Cold-start budget: <10s p50 from event to comment posted | Phase 1 already meets this; Phase 2 adds template API calls (2-5 Octokit requests) which are fast network I/O, not compute |
| CHECK-03 | Tier 1 (Issue Forms YAML): tolerant parser of `.github/ISSUE_TEMPLATE/*.yml`, extracts `required: true` fields, graceful fallthrough on parse error | `yaml` 2.9.0 (latest) not yet installed; must be added to `package.json`; parse pattern documented below |
| CHECK-04 | Tier 2 (Markdown Templates): parse `.github/ISSUE_TEMPLATE/*.md` H3 headings as field labels | `unified` 11 + `remark-parse` 11 already installed; H3 heading traversal pattern documented below |
| CHECK-06 | Meta-nudge: appended to comment when no `.github/ISSUE_TEMPLATE/` exists, soft tip tone | Already partially implemented in Phase 1 `format/markdown.ts` (META_NUDGE constant); Phase 2 must make it conditional on `repoContext.hasIssueForms === false && repoContext.hasMdTemplates === false` |
</phase_requirements>

---

## Summary

Phase 2 extends the Action skeleton from Phase 1 in three distinct layers: (1) hardening the action entrypoint with inputs, label management, skip-label opt-out, and a `core.summary()` report; (2) implementing the Tier 1 + Tier 2 checklist strategies that make the checklist repo-aware; and (3) wiring the template adapter that fetches `.github/ISSUE_TEMPLATE/` files via Octokit. The hexagonal architecture from Phase 1 is already correctly shaped for all three layers — new code drops cleanly into the existing adapter and strategy chain extension points.

The most technically risky element is the tolerant YAML parser for issue forms. Real-world repos use non-standard extensions, `config.yml` chooser files, mixed `.yml`+`.md` directories, and encoding edge cases. The parser must be written defensively — best-effort field extraction only, skip unknown keys, catch-and-fallthrough on any error. The `yaml` 2.9.0 package is not yet installed and must be added as a production dependency.

The label management surface is straightforward Octokit API calls. The key pattern is try-get-label first; if 404, create-label; on any error, `core.warning()` and continue (label failure must never block the hero comment). The `core.summary()` report uses the installed `@actions/core` 3.0.1 summary singleton, which buffers markdown and writes to `$GITHUB_STEP_SUMMARY` at the end of the run.

**Primary recommendation:** Implement in five plans: (1) action inputs + `action.yml`; (2) template adapter (`templates.ts`) with Octokit fetch; (3) Tier 1 `IssueFormStrategy`; (4) Tier 2 `TemplateMdStrategy`; (5) label management (`labels.ts`) + `core.summary()` + main.ts wiring. Each plan produces passing tests and a bundled `dist/`.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Read action inputs (`dry-run`, `enable-labels`, etc.) | Action Runtime (`src/action/main.ts`) | — | `@actions/core` inputs only exist in GitHub Actions runner context |
| Skip-label opt-out check | Action Runtime (`src/action/main.ts`) | — | Reads `issue.labels` from event payload before any I/O; earliest possible exit |
| Fetch `.github/ISSUE_TEMPLATE/` directory listing | GitHub Adapter (`src/adapters/github/templates.ts`) | — | Octokit call; must stay out of `src/core/` |
| Decode + parse issue form YAML | GitHub Adapter (`src/adapters/github/templates.ts`) | — | Base64 decode is I/O-adjacent; parsing happens in adapter, output is typed DTO |
| Decode + parse markdown templates | GitHub Adapter (`src/adapters/github/templates.ts`) | — | Same pattern as YAML; remark-parse runs in adapter layer |
| Build typed `ParsedTemplate[]` from raw files | GitHub Adapter (`src/adapters/github/templates.ts`) | — | Adapter's output is a typed DTO; pure core strategies consume it |
| `IssueFormStrategy` (Tier 1 checklist) | Core (`src/core/checklist/strategies/issue-form.ts`) | — | Pure function; receives typed `ParsedTemplate[]` in `RepoContext.templates` |
| `TemplateMdStrategy` (Tier 2 checklist) | Core (`src/core/checklist/strategies/template-md.ts`) | — | Pure function; same typed DTO |
| Label auto-create / apply / remove | GitHub Adapter (`src/adapters/github/labels.ts`) | — | Octokit calls; side effects; never in `src/core/` |
| `core.summary()` report | Action Runtime (`src/action/main.ts`) | — | Writes to `$GITHUB_STEP_SUMMARY`; runner-specific side effect |
| Meta-nudge conditional rendering | Core (`src/core/format/markdown.ts`) | — | Currently always shown; Phase 2 gates it on `RepoContext` flags |

---

## Standard Stack

### Core (already installed)

| Library | Version | Purpose | Status |
|---------|---------|---------|--------|
| `@actions/core` | 3.0.1 | `getInput`, `getBooleanInput`, `setFailed`, `warning`, `summary` | Installed [VERIFIED: node_modules] |
| `@actions/github` | 9.1.1 | `getOctokit` → Octokit client; `context.repo`, `context.payload` | Installed [VERIFIED: node_modules] |
| `unified` + `remark-parse` + `remark-gfm` | 11.x / 11.x / 4.x | Markdown AST for Tier 2 H3-heading extraction | Installed [VERIFIED: node_modules] |
| `mdast-util-to-string` | 4.x | Extract text from mdast heading nodes | Installed [VERIFIED: node_modules] |
| `unist-util-visit` | 5.1.0 | Traverse mdast tree for heading nodes | Installed [VERIFIED: node_modules] |
| `zod` | 4.4.3 | Validate parsed template DTOs | Installed [VERIFIED: node_modules] |

### Needs Installation

| Library | Version | Purpose | Why Needed |
|---------|---------|---------|-----------|
| `yaml` | **2.9.0** (latest) | Parse `.github/ISSUE_TEMPLATE/*.yml` issue forms | YAML parser for Tier 1; NOT yet in node_modules [VERIFIED: npm view yaml version → 2.9.0] |

**Installation command:**
```bash
npm install yaml
```

### Octokit REST Endpoints Verified

All confirmed present in `node_modules/@octokit/plugin-rest-endpoint-methods/dist-src/generated/endpoints.js` [VERIFIED: grep]:

| Endpoint | Use |
|----------|-----|
| `octokit.rest.repos.getContent({ owner, repo, path, ref? })` | List directory or fetch file content (returns base64-encoded `content` field for files) |
| `octokit.rest.repos.getLabel({ owner, repo, name })` | Check if label exists; throws 404 if missing |
| `octokit.rest.repos.createLabel({ owner, repo, name, color, description })` | Create label with defaults; color must be hex without `#` |
| `octokit.rest.issues.addLabels({ owner, repo, issue_number, labels: string[] })` | Apply labels to issue |
| `octokit.rest.issues.removeLabel({ owner, repo, issue_number, name })` | Remove one label from issue |

### `@actions/core` Summary API (verified)

The `summary` export is a singleton with a fluent builder API [VERIFIED: node_modules/@actions/core/lib/summary.js]:
```typescript
import * as core from '@actions/core'

// Build then flush
core.summary
  .addRaw('## Signal-OSS Report\n', true)
  .addTable([...])    // HTML table rows
  .addRaw('...')
await core.summary.write()  // writes to $GITHUB_STEP_SUMMARY
```

Key methods: `addRaw(text, addEOL?)`, `addTable(rows)`, `addList(items)`, `addDetails(label, content)`, `write()` (async, flushes buffer). `write()` throws if `$GITHUB_STEP_SUMMARY` env var is absent (safe to catch and `core.warning()`).

### `@actions/core` Input API

```typescript
core.getInput('label-name')           // string, empty string if not set
core.getBooleanInput('dry-run')       // boolean, throws on non-boolean string
core.getInput('gray-zone-low')        // string — parse to number with parseInt/parseFloat
```

Use `{ required: false }` options on all inputs since all have defaults. [VERIFIED: node_modules/@actions/core/lib/core.js]

---

## Architecture Patterns

### System Architecture Diagram

```
GitHub webhook: issues.opened / issues.reopened
         │
         ▼
┌─────────────────────────────────────────────┐
│ src/action/main.ts                           │
│  1. bot-loop guard (Phase 1)                 │
│  2. parse event payload                      │
│  3. read Action inputs (ACT-07) ←─── NEW    │
│  4. skip-label check (ACT-08)    ←─── NEW    │
│  5. loadRepoContext() via adapter ←─── NEW   │
│  6. score(issue, repoContext)                 │
│  7. format(scored)                            │
│  8. postOrUpdateComment()         (Phase 1)   │
│  9. manageLabel()                ←─── NEW    │
│ 10. writeSummary()               ←─── NEW    │
└─────────────────────────────────────────────┘
         │
         │ step 5
         ▼
┌─────────────────────────────────────────────┐
│ src/adapters/github/templates.ts             │
│  octokit.rest.repos.getContent(dir listing) │
│  → for each .yml / .md file:                 │
│      getContent(file) → base64 decode       │
│      parseIssueForm() OR parseMdTemplate()  │
│  → returns ParsedTemplate[]                  │
│  → on any error: core.warning(), return []  │
└─────────────────────────────────────────────┘
         │ ParsedTemplate[]
         │ RepoContext{hasIssueForms, hasMdTemplates, templates}
         ▼
┌─────────────────────────────────────────────┐
│ src/core/ (pure — no Octokit)               │
│  generateChecklist(signals, type, ctx):      │
│    IssueFormStrategy   ←─── NEW (Tier 1)   │
│    TemplateMdStrategy  ←─── NEW (Tier 2)   │
│    BaselineStrategy         (Tier 4)        │
└─────────────────────────────────────────────┘
         │
         │ step 9
         ▼
┌─────────────────────────────────────────────┐
│ src/adapters/github/labels.ts               │
│  ensureLabel() → getLabel or createLabel    │
│  applyOrRemoveLabel() → addLabels or        │
│                          removeLabel        │
│  → on any error: core.warning(), continue  │
└─────────────────────────────────────────────┘
```

### Recommended Project Structure (additions only)

```
src/
├── adapters/github/
│   ├── io.ts              # (Phase 1) postOrUpdateComment
│   ├── templates.ts       # NEW: loadRepoContext() — directory listing + file fetching
│   └── labels.ts          # NEW: ensureLabel(), applyLabel(), removeLabel()
├── core/checklist/strategies/
│   ├── baseline.ts        # (Phase 1) Tier 4
│   ├── issue-form.ts      # NEW: Tier 1 — IssueFormStrategy
│   └── template-md.ts     # NEW: Tier 2 — TemplateMdStrategy
tests/
├── adapters/
│   ├── github.test.ts     # (Phase 1)
│   ├── templates.test.ts  # NEW: mocked Octokit getContent; real fixture YAMLs/MDs
│   └── labels.test.ts     # NEW: mocked Octokit getLabel/createLabel/addLabels/removeLabel
├── core/
│   ├── checklist.test.ts  # (Phase 1) — add IssueFormStrategy + TemplateMdStrategy tests
│   └── format.test.ts     # (Phase 1) — add meta-nudge conditional test
tests/fixtures/
└── templates/             # NEW: real issue form YAMLs + MD templates from 10 popular repos
```

### Pattern 1: `octokit.rest.repos.getContent` — Directory Listing + File Fetch

**What:** `getContent` with a directory path returns an array; with a file path returns a single object with base64-encoded `content`.

**When to use:** Loading remote files from a repo without `actions/checkout`.

```typescript
// Source: Octokit REST API (verified in node_modules endpoint spec)
// Step 1: list directory
const { data: listing } = await octokit.rest.repos.getContent({
  owner, repo,
  path: '.github/ISSUE_TEMPLATE',
  ref: defaultBranch,   // D-04: use default branch
})
// listing is Array<{ name: string; type: 'file' | 'dir'; path: string }>

// Step 2: fetch individual file
const { data: fileData } = await octokit.rest.repos.getContent({
  owner, repo,
  path: '.github/ISSUE_TEMPLATE/bug_report.yml',
  ref: defaultBranch,
})
// fileData.content is base64-encoded string
const rawYaml = Buffer.from(fileData.content, 'base64').toString('utf-8')
```

**Notes:**
- `getContent` on a non-existent path throws with status 404 — catch this as the "no templates" signal
- `getContent` on a directory returns `Array` (check `Array.isArray(data)`)
- `fileData.content` may contain newlines (`\n`) in the base64 string — strip them before `Buffer.from`
- `config.yml` in the template directory is a chooser config, not a template — **skip it** (D-03 from CONTEXT, Pitfall 8)

### Pattern 2: Tolerant Issue Form YAML Parsing (Tier 1)

**What:** Parse GitHub issue form YAML defensively — extract `required: true` fields only, ignore unknown keys.

**GitHub Issue Form Schema** [CITED: https://docs.github.com/en/communities/using-templates-to-encourage-useful-issues-and-pull-requests/syntax-for-issue-forms]:
```yaml
name: Bug Report
description: File a bug report
body:
  - type: input
    id: repro
    attributes:
      label: Reproduction steps
    validations:
      required: true
  - type: textarea
    id: version
    attributes:
      label: Version
    validations:
      required: false
  - type: dropdown
    ...
  - type: checkboxes
    ...
  - type: markdown      # no label, no validations — skip
    ...
```

**Extraction logic:**
```typescript
// Source: [VERIFIED: GitHub issue form schema docs]
import { parse } from 'yaml'

function parseIssueForm(rawYaml: string): string[] {
  try {
    const doc = parse(rawYaml)  // yaml 2.x: returns JS object; throws on syntax error
    const body = doc?.body
    if (!Array.isArray(body)) return []
    return body
      .filter((field: unknown) => {
        if (typeof field !== 'object' || field === null) return false
        const f = field as Record<string, unknown>
        // Skip 'markdown' type (no label, no validations)
        if (f.type === 'markdown') return false
        // Only required fields
        const validations = f.validations as Record<string, unknown> | undefined
        return validations?.required === true
      })
      .map((field: unknown) => {
        const f = field as Record<string, unknown>
        const attrs = f.attributes as Record<string, unknown> | undefined
        return String(attrs?.label ?? '')
      })
      .filter(Boolean)
  } catch {
    return []   // tolerant: any parse error → return empty
  }
}
```

**Key defensive rules:**
1. Wrap entire parse in try/catch — YAML syntax errors must not propagate
2. Check `doc?.body` exists and is an array before walking
3. Skip `type: markdown` elements — they have no `validations.required`
4. Check `validations?.required === true` (not just truthy — some templates use `required: 'true'`... treat string 'true' as false for strictness, OR coerce: `validations?.required == true`)
5. Extract `attributes.label` — this is the human-readable field name
6. Filter out empty labels after extraction
7. Skip `config.yml` before parsing (check `name.toLowerCase() === 'config.yml'`)

### Pattern 3: Markdown Template H3 Heading Extraction (Tier 2)

**What:** Parse `.github/ISSUE_TEMPLATE/*.md` files using remark, extract H3 headings as field labels.

```typescript
// Source: [VERIFIED: remark-parse installed in node_modules]
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import { toString as mdastToString } from 'mdast-util-to-string'
import { visit } from 'unist-util-visit'
import type { Heading } from 'mdast'

function parseMdTemplate(rawMd: string): string[] {
  const tree = unified().use(remarkParse).parse(rawMd)
  const headings: string[] = []
  visit(tree, 'heading', (node: Heading) => {
    if (node.depth === 3) {  // D-07: H3 only
      headings.push(mdastToString(node))
    }
  })
  return headings
}
```

**Notes:**
- `.md` templates often have YAML frontmatter (`---\nname: Bug Report\n---`). `remark-parse` does NOT strip YAML frontmatter by default — the frontmatter renders as a paragraph. This is fine for H3 extraction since frontmatter contains no H3 headings.
- H3 headings in real repos: `### Steps to Reproduce`, `### Expected Behavior`, `### Actual Behavior`, `### Version`, `### Environment`
- `mdast-util-to-string` correctly flattens inline nodes (bold, italic, code in headings) to plain text

### Pattern 4: `IssueFormStrategy` (Tier 1)

```typescript
// src/core/checklist/strategies/issue-form.ts
import type { ChecklistItem, ChecklistStrategy, IssueType, RepoContext, Signals } from '../../types.js'
import type { ParsedTemplate } from '../../types.js'  // new type

export class IssueFormStrategy implements ChecklistStrategy {
  name = 'issue-form'

  applies(ctx: RepoContext): boolean {
    return ctx.hasIssueForms && (ctx.templates as ParsedTemplate[]).some(t => t.type === 'form' && t.fields.length > 0)
  }

  generate(type: IssueType, signals: Signals): ChecklistItem[] {
    // ...select template by filename type-match (D-05)
    // ...filter fields already satisfied by signals
    // ...return top 5 (D-08)
  }
}
```

**Template selection (D-05):**
```typescript
function selectTemplate(type: IssueType, templates: ParsedTemplate[]): ParsedTemplate | null {
  const typePattern: Record<IssueType, string> = {
    bug: 'bug_report',
    feature: 'feature_request',
    question: 'question',
  }
  const pattern = typePattern[type]
  const match = templates.find(t => t.filename.toLowerCase().includes(pattern))
  if (match) return match
  // D-05 fallback: union of all templates' required fields
  // Merge all form templates' fields (deduplicated)
  const allFields = [...new Set(templates.flatMap(t => t.fields))]
  return allFields.length > 0 ? { filename: '_union', type: 'form', fields: allFields } : null
}
```

### Pattern 5: Label Management (`labels.ts`)

```typescript
// src/adapters/github/labels.ts — new file
// ACT-06: create if missing (silent succeed if exists), apply when items>0, remove when items===0

async function ensureLabel(
  octokit: OctokitInstance,
  owner: string, repo: string,
  name: string, color: string, description: string
): Promise<void> {
  try {
    await octokit.rest.repos.getLabel({ owner, repo, name })
    // D-13: exists → silent succeed, do NOT overwrite
  } catch (err: unknown) {
    const status = (err as { status?: number }).status
    if (status === 404) {
      try {
        await octokit.rest.repos.createLabel({
          owner, repo, name,
          color: color.replace('#', ''),   // GitHub API: no '#' prefix
          description,
        })
      } catch (createErr: unknown) {
        core.warning(`Could not create label "${name}": ${(createErr as Error).message}`)
      }
    } else {
      core.warning(`Could not check label "${name}": ${(err as Error).message}`)
    }
  }
}

async function applyLabel(
  octokit: OctokitInstance,
  owner: string, repo: string,
  issueNumber: number, name: string
): Promise<'applied' | 'skipped'> {
  try {
    await octokit.rest.issues.addLabels({ owner, repo, issue_number: issueNumber, labels: [name] })
    return 'applied'
  } catch (err: unknown) {
    core.warning(`Could not apply label "${name}": ${(err as Error).message}`)
    return 'skipped'
  }
}

async function removeLabel(
  octokit: OctokitInstance,
  owner: string, repo: string,
  issueNumber: number, name: string
): Promise<'removed' | 'skipped'> {
  try {
    await octokit.rest.issues.removeLabel({ owner, repo, issue_number: issueNumber, name })
    return 'removed'
  } catch (err: unknown) {
    // 404 means label wasn't on the issue — silent succeed
    const status = (err as { status?: number }).status
    if (status !== 404) {
      core.warning(`Could not remove label "${name}": ${(err as Error).message}`)
    }
    return 'skipped'
  }
}
```

**Label action result type (for `core.summary()` report):**
```typescript
type LabelAction = 'applied' | 'removed' | 'skipped' | 'disabled' | 'dry-run'
```

### Pattern 6: `action.yml` Inputs Definition

```yaml
inputs:
  github-token:
    description: 'GitHub token (defaults to GITHUB_TOKEN)'
    required: false
    default: ${{ github.token }}
  dry-run:
    description: 'If true, skip posting comment and applying labels'
    required: false
    default: 'false'
  enable-comments:
    description: 'If false, skip posting the checklist comment'
    required: false
    default: 'true'
  enable-labels:
    description: 'If false, skip label management'
    required: false
    default: 'true'
  label-name:
    description: 'Name of the label to apply when checklist has items'
    required: false
    default: 'needs-info'
  model:
    description: 'LLM model identifier (used in Phase 4)'
    required: false
    default: ''
  gray-zone-low:
    description: 'Lower bound of gray zone (inclusive)'
    required: false
    default: '4'
  gray-zone-high:
    description: 'Upper bound of gray zone (inclusive)'
    required: false
    default: '6'
  max-body-bytes:
    description: 'Maximum issue body bytes to analyze (truncated before scoring)'
    required: false
    default: '10000'
```

**Reading in main.ts:**
```typescript
const dryRun = core.getBooleanInput('dry-run')          // boolean
const enableComments = core.getBooleanInput('enable-comments')
const enableLabels = core.getBooleanInput('enable-labels')
const labelName = core.getInput('label-name') || 'needs-info'
const grayZoneLow = parseInt(core.getInput('gray-zone-low') || '4', 10)
const grayZoneHigh = parseInt(core.getInput('gray-zone-high') || '6', 10)
const maxBodyBytes = parseInt(core.getInput('max-body-bytes') || '10000', 10)
```

**Note:** `core.getBooleanInput` throws on non-boolean strings — the defaults `'true'`/`'false'` are safe. Custom input values from users are their responsibility. [VERIFIED: node_modules/@actions/core/lib/core.js]

### Pattern 7: `core.summary()` Report

```typescript
// ACT-09: write after all operations complete
async function writeSummary(data: SummaryData): Promise<void> {
  try {
    const signalsRows = [
      [{ data: 'Signal', header: true }, { data: 'Detected', header: true }],
      ['Code block', data.signals.hasCodeBlock ? '✓' : '✗'],
      ['Stack trace', data.signals.hasStackTrace ? '✓' : '✗'],
      ['Version mention', data.signals.hasVersionMention ? '✓' : '✗'],
      ['Repro keywords', data.signals.hasReproKeywords ? '✓' : '✗'],
      ['Expected/actual', data.signals.hasExpectedActual ? '✓' : '✗'],
      ['Minimal example', data.signals.hasMinimalExample ? '✓' : '✗'],
      ['Image only', data.signals.hasImageOnly ? '✓' : '✗'],
    ]
    core.summary
      .addRaw(`## Signal-OSS: #${data.issueNumber} ${data.issueTitle}\n`, true)
      .addRaw(`**Type:** ${data.issueType} | **Score:** ${data.score}/10 | **Tier:** ${data.tierUsed}\n`, true)
      .addTable(signalsRows)
      .addRaw(`**Label action:** ${data.labelAction}\n`, true)
      .addRaw(data.commentUrl ? `**Comment:** ${data.commentUrl}\n` : '', true)
    await core.summary.write()
  } catch (err: unknown) {
    // $GITHUB_STEP_SUMMARY not set (e.g., local-action testing) — log and continue
    core.warning(`Could not write summary: ${(err as Error).message}`)
  }
}
```

### Pattern 8: Meta-Nudge Conditional

The Phase 1 `format/markdown.ts` always appends `META_NUDGE`. Phase 2 makes it conditional on `repoContext`:

```typescript
// Current (Phase 1): always shows META_NUDGE
// Phase 2: only show when no templates found (CHECK-06)

export function format(scored: ScoredIssue, repoContext: RepoContext): string {
  // ...
  const showMetaNudge = !repoContext.hasIssueForms && !repoContext.hasMdTemplates
  const sections = [intro, checklist, badge, showMetaNudge ? META_NUDGE : '', closing, MARKER]
    .filter(s => s.length > 0)
  return sections.join('\n\n')
}
```

**Note:** `format()` signature changes — requires updating all call sites and tests.

### Anti-Patterns to Avoid

- **Parsing YAML in `src/core/`:** YAML parsing is I/O-adjacent (file bytes → JS objects). Do it in `src/adapters/github/templates.ts`. Core strategies receive already-parsed `ParsedTemplate[]`.
- **Strict YAML schema validation that throws:** Use a try/catch with best-effort extraction. Never use a zod schema that throws on unknown fields — real-world issue forms have many undocumented fields.
- **Overwriting existing label color/description (D-13):** `getLabel` returning 200 means it exists; call `addLabels` directly without touching `createLabel`. Respect maintainer customization.
- **Label failure blocking comment:** Label is a secondary output. Always post the comment first, then attempt label in a try/catch.
- **`core.summary.write()` without try/catch:** `$GITHUB_STEP_SUMMARY` is not set in `@github/local-action` testing — catch and `core.warning()`.
- **Passing `color: '#e4e669'` to `createLabel`:** GitHub API expects the hex color WITHOUT the `#` prefix (e.g., `'e4e669'`). [ASSUMED: common API behavior; verified by endpoint spec pattern]
- **Fetching templates on every run without caching:** Acceptable for v1 (1 directory listing + ~3 file fetches = ~4 API calls per run; within GITHUB_TOKEN rate limits). Do not over-engineer a cache.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| YAML parsing | Custom regex for `required: true` | `yaml` 2.x `parse()` | Handles multi-line values, anchors, quoted strings; regex breaks on any YAML nesting |
| Markdown AST walk | Custom H3 regex (`/^### (.+)/m`) | `remark-parse` + `unist-util-visit` | Regex breaks on code blocks containing `###`, inline formatting in headings, CRLF line endings |
| Base64 decode of Octokit file content | `atob()` or manual | `Buffer.from(content.replace(/\n/g,''), 'base64').toString('utf-8')` | `atob()` not available in Node; Buffer is the right primitive |
| Label existence check + create | Custom label cache | `try getLabel → catch 404 → createLabel` | One round-trip pattern; handles race conditions (two workflow runs) gracefully via 422 on duplicate create |
| `core.summary()` Markdown | Custom file write to `$GITHUB_STEP_SUMMARY` | `@actions/core` summary singleton | Path resolution, encoding, append vs overwrite all handled; API is fluent and tested |

**Key insight:** In this phase, the "don't hand-roll" list is primarily about parser robustness. Real-world GitHub repos have years of accumulated template cruft — any custom parser will fail on at least one popular repo. Libraries absorb that complexity.

---

## Common Pitfalls

### Pitfall 1: `getContent` returns different shapes for files vs directories

**What goes wrong:** Calling `getContent` on `.github/ISSUE_TEMPLATE` returns an array (directory listing). Calling it on a specific file path returns a single object. Code that always destructures as a single object crashes on the directory call.

**Why it happens:** The API is polymorphic — same endpoint, different response shape.

**How to avoid:**
```typescript
const { data } = await octokit.rest.repos.getContent({ owner, repo, path: '.github/ISSUE_TEMPLATE' })
if (!Array.isArray(data)) {
  core.warning('Expected directory listing but got file object; falling through')
  return { hasIssueForms: false, hasMdTemplates: false, templates: [] }
}
```

**Warning signs:** `data.name` exists (single file response) instead of `data[0].name` (array).

### Pitfall 2: `config.yml` mis-parsed as a template

**What goes wrong:** `.github/ISSUE_TEMPLATE/config.yml` contains a chooser config (external links, blank_issues_enabled) — NOT a template body. Parsing it as a template returns garbage or crashes.

**Why it happens:** `getContent` directory listing returns all `.yml` files including `config.yml`.

**How to avoid:** Filter before parsing:
```typescript
const templateFiles = listing.filter(f =>
  f.type === 'file' &&
  (f.name.endsWith('.yml') || f.name.endsWith('.yaml') || f.name.endsWith('.md')) &&
  f.name.toLowerCase() !== 'config.yml'
)
```
[CITED: Pitfall 8 in .planning/research/PITFALLS.md]

### Pitfall 3: YAML `required: 'true'` (string) vs `required: true` (boolean)

**What goes wrong:** Some real-world templates (especially those authored on Windows or old editors) have `required: 'true'` as a quoted string. Strict `=== true` check misses these fields.

**Why it happens:** YAML spec allows both; GitHub's parser is lenient; human editors sometimes quote boolean values.

**How to avoid:** Use loose comparison: `validations?.required == true` (coerces `'true'` string to true). OR explicitly handle both: `validations?.required === true || validations?.required === 'true'`.

**Warning signs:** Parser reports zero required fields on a template that visually shows many required fields.

### Pitfall 4: `format()` signature change breaks all callers and tests

**What goes wrong:** `format(scored)` → `format(scored, repoContext)` is a breaking change to a function called in `main.ts` and tested in `tests/core/format.test.ts`. Forgetting to update either causes TypeScript compile errors or test failures.

**Why it happens:** Incremental feature addition changes existing signatures.

**How to avoid:** Update ALL call sites in the same commit: `src/action/main.ts`, `tests/core/format.test.ts`. TypeScript strict mode will catch it at compile time before bundling.

### Pitfall 5: `core.summary.write()` silently fails in local testing

**What goes wrong:** `@github/local-action` does not set `$GITHUB_STEP_SUMMARY` — the summary API throws `"Unable to find environment variable for $GITHUB_STEP_SUMMARY"`. If not caught, it propagates as an unhandled rejection and the Action exits with `setFailed`.

**Why it happens:** The environment variable is only set by the GitHub Actions runner.

**How to avoid:** Wrap the entire `writeSummary()` call in try/catch; use `core.warning()` on failure.

### Pitfall 6: `IssueFormStrategy` in `STRATEGIES` array before `BaselineStrategy` but `applies()` returns false — no fallthrough

**What goes wrong:** If `IssueFormStrategy.applies()` returns `true` but `generate()` returns an empty array, the chain does NOT fall through to Tier 4 — it returns an empty checklist. The `first-applies-wins` logic in `generator.ts` stops at the first `applies() === true`.

**Why it happens:** D-06 specifies `applies()` returns `false` when zero required fields — but implementors may accidentally return `true` and let `generate()` return `[]`.

**How to avoid:** D-06 contract: `applies()` must check that the matched template has `fields.length > 0`. If the template lookup returns no fields, `applies()` returns `false`, which causes the chain to continue to the next strategy. Add a unit test: `IssueFormStrategy with zero-field template → applies() === false`.

### Pitfall 7: `removeLabel` throws 404 when label wasn't applied

**What goes wrong:** On re-run where checklist is now empty (score improved), attempt to `removeLabel` on an issue that never had the label applied (e.g., maintainer manually removed it). Octokit throws 404.

**Why it happens:** `removeLabel` returns 404 if the label is not currently on the issue.

**How to avoid:** Treat 404 on `removeLabel` as a silent success (the desired end state — label is not present — is achieved):
```typescript
} catch (err) {
  if ((err as { status?: number }).status !== 404) {
    core.warning(`Could not remove label: ${(err as Error).message}`)
  }
  // 404: label wasn't on issue — desired state already achieved
}
```

### Pitfall 8: `yaml` package not yet installed (Wave 0 gap)

**What goes wrong:** `import { parse } from 'yaml'` fails at runtime because `yaml` is not in `package.json` or `node_modules`. Bundle will fail or produce a runtime error.

**Why it happens:** `yaml` is in CLAUDE.md as a recommended library but was not installed in Phase 1 (Phase 1 did not need it).

**How to avoid:** Wave 0 of the plan must include `npm install yaml` and committing the updated `package.json` + `package-lock.json`. [VERIFIED: `npm list yaml` returns empty in current node_modules]

---

## Code Examples

### Loading RepoContext from GitHub API

```typescript
// src/adapters/github/templates.ts
// Source: Octokit endpoint spec + CONTEXT.md D-01..D-04

import * as core from '@actions/core'
import type * as github from '@actions/github'
import { parse } from 'yaml'
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import { toString as mdastToString } from 'mdast-util-to-string'
import { visit } from 'unist-util-visit'
import type { Heading } from 'mdast'
import type { RepoContext } from '../../core/types.js'

type OctokitInstance = ReturnType<typeof github.getOctokit>

export interface ParsedTemplate {
  filename: string
  type: 'form' | 'md'
  fields: string[]   // human-readable required field labels
}

export async function loadRepoContext(
  octokit: OctokitInstance,
  owner: string,
  repo: string,
  defaultBranch: string,
): Promise<RepoContext> {
  let listing: Array<{ name: string; type: string; path: string }> = []
  try {
    const { data } = await octokit.rest.repos.getContent({
      owner, repo, path: '.github/ISSUE_TEMPLATE', ref: defaultBranch,
    })
    if (Array.isArray(data)) {
      listing = data as typeof listing
    }
  } catch (err: unknown) {
    core.warning(`Could not list .github/ISSUE_TEMPLATE: ${(err as Error).message}`)
    return { hasIssueForms: false, hasMdTemplates: false, hasContributing: false, templates: [] }
  }

  const templateFiles = listing.filter(f =>
    f.type === 'file' &&
    (f.name.endsWith('.yml') || f.name.endsWith('.yaml') || f.name.endsWith('.md')) &&
    f.name.toLowerCase() !== 'config.yml'
  )

  const templates: ParsedTemplate[] = []
  for (const file of templateFiles) {
    try {
      const { data: fileData } = await octokit.rest.repos.getContent({
        owner, repo, path: file.path, ref: defaultBranch,
      })
      if (Array.isArray(fileData) || !('content' in fileData)) continue
      const raw = Buffer.from((fileData as { content: string }).content.replace(/\n/g, ''), 'base64').toString('utf-8')

      if (file.name.endsWith('.md')) {
        const fields = parseMdTemplate(raw)
        templates.push({ filename: file.name, type: 'md', fields })
      } else {
        const fields = parseIssueFormFields(raw)
        templates.push({ filename: file.name, type: 'form', fields })
      }
    } catch (err: unknown) {
      core.warning(`Could not fetch template ${file.name}: ${(err as Error).message}`)
    }
  }

  return {
    hasIssueForms: templates.some(t => t.type === 'form'),
    hasMdTemplates: templates.some(t => t.type === 'md'),
    hasContributing: false,  // Phase 4
    templates,
  }
}

function parseIssueFormFields(rawYaml: string): string[] {
  try {
    const doc = parse(rawYaml) as Record<string, unknown>
    const body = doc?.body
    if (!Array.isArray(body)) return []
    return (body as unknown[])
      .filter((f): f is Record<string, unknown> =>
        typeof f === 'object' && f !== null && (f as Record<string, unknown>).type !== 'markdown'
      )
      .filter(f => {
        const v = f.validations as Record<string, unknown> | undefined
        return v?.required == true
      })
      .map(f => {
        const attrs = f.attributes as Record<string, unknown> | undefined
        return String(attrs?.label ?? '')
      })
      .filter(Boolean)
  } catch {
    return []
  }
}

function parseMdTemplate(rawMd: string): string[] {
  const tree = unified().use(remarkParse).parse(rawMd)
  const headings: string[] = []
  visit(tree, 'heading', (node: Heading) => {
    if (node.depth === 3) headings.push(mdastToString(node))
  })
  return headings
}
```

### `IssueFormStrategy` — Tier 1

```typescript
// src/core/checklist/strategies/issue-form.ts
import type { ChecklistItem, ChecklistStrategy, IssueType, RepoContext, Signals } from '../../types.js'
import type { ParsedTemplate } from '../../../adapters/github/templates.js'  // import type only

// NOTE: IssueFormStrategy MUST NOT import from adapters at runtime.
// ParsedTemplate type is imported as a type-only import.
// The strategy receives typed data via RepoContext.templates (cast at runtime).

const TYPE_KEYWORDS: Record<IssueType, string> = {
  bug: 'bug_report',
  feature: 'feature_request',
  question: 'question',
}

export class IssueFormStrategy implements ChecklistStrategy {
  name = 'issue-form'

  applies(ctx: RepoContext): boolean {
    if (!ctx.hasIssueForms) return false
    const templates = ctx.templates as ParsedTemplate[]
    return templates.some(t => t.type === 'form' && t.fields.length > 0)
  }

  generate(type: IssueType, signals: Signals, ctx: RepoContext): ChecklistItem[] {
    const templates = ctx.templates as ParsedTemplate[]
    const formTemplates = templates.filter(t => t.type === 'form')

    // D-05: match by filename
    const keyword = TYPE_KEYWORDS[type]
    const matched = formTemplates.find(t => t.filename.toLowerCase().includes(keyword))
    const fields = matched?.fields ?? [...new Set(formTemplates.flatMap(t => t.fields))]

    // Filter already-satisfied, cap at 5 (D-08)
    return fields
      .map(label => ({ text: `Could you share the ${label.toLowerCase()}?` }))
      .slice(0, 5)
  }
}
```

**Note:** `ChecklistStrategy.generate()` currently has signature `generate(type, signals)`. Phase 2 strategies need `ctx` for template lookup. Two options: (a) add `ctx` as optional third param to `generate(type, signals, ctx?)`, or (b) pass templates in the constructor. Option (a) is backward-compatible with `BaselineStrategy`. [ASSUMED — verify actual call site in generator.ts]

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| `actions/checkout` to read templates | `octokit.rest.repos.getContent` via REST API | No checkout needed; `contents: read` already granted |
| `js-yaml` for YAML parsing | `yaml` 2.x (eemeli) | Better TS types; YAML 1.2 compliant; official CLAUDE.md recommendation |
| Core summary via raw `echo >> $GITHUB_STEP_SUMMARY` | `@actions/core` 3.x `summary` singleton | Fluent builder API; handles file path resolution |
| Hardcoded label creation always | Try-get-first → create-if-404 | Respects existing maintainer customization (D-13) |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | GitHub API `createLabel` requires `color` without `#` prefix | Pattern 5 (Label Management) | `createLabel` call returns 422 Unprocessable Entity; label not created; low severity (label apply silently fails, hero comment still posts) |
| A2 | `core.getBooleanInput` throws on invalid (non-boolean) string input | Pattern 6 (action.yml Inputs) | Input parsing error causes Action to fail at startup; medium severity — mitigate by using `getInput` + manual parse for inputs that might receive arbitrary strings |
| A3 | `IssueFormStrategy.generate()` needs access to `ctx` for template data | Pattern 4 / Code Examples | If generate() signature must stay `(type, signals)` only, template data must move to strategy constructor; medium refactor |
| A4 | `format()` signature change to add `repoContext` is backwards-compatible in the bundled ESM build | Pattern 8 (Meta-Nudge) | Optional param `repoContext?` is safe; required param breaks existing test mocks |
| A5 | `@github/local-action` local testing environment does not set `$GITHUB_STEP_SUMMARY` | Pattern 7 (core.summary) | If it does set it, the try/catch is harmless (minor); no risk either way |

---

## Open Questions

1. **`ChecklistStrategy.generate()` signature — needs `ctx` parameter?**
   - What we know: Current interface is `generate(type: IssueType, signals: Signals): ChecklistItem[]` — no `ctx`
   - What's unclear: `IssueFormStrategy` needs `ctx.templates` to select the right template; either add `ctx` as optional 3rd param OR pass templates via constructor
   - Recommendation: Add optional `ctx?: RepoContext` as third param. `BaselineStrategy` ignores it (backward-compatible). `generator.ts` passes `ctx` in all `generate()` calls. This is a minimal, clean extension.

2. **`ParsedTemplate` type location — adapters or core?**
   - What we know: Strategies in `src/core/` are pure; they must not import from `src/adapters/`
   - What's unclear: `ParsedTemplate` is produced in the adapter but consumed in core strategies
   - Recommendation: Move `ParsedTemplate` type into `src/core/types.ts` (alongside other DTOs). The adapter imports from core; core imports from core. No circular dependency.

3. **`payload.repository.default_branch` availability**
   - What we know: D-04 requires fetching templates from the default branch
   - What's unclear: Whether `github.context.payload.repository.default_branch` is always present in `issues.opened` events
   - Recommendation: Access `(github.context.payload.repository as { default_branch?: string })?.default_branch ?? 'main'` with a `'main'` fallback. [ASSUMED]

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js 24 | Action runtime | ✓ | 24.x (engines.node in package.json) | — |
| `yaml` npm package | CHECK-03 (Tier 1 YAML parser) | ✗ | — (not installed) | Wave 0: `npm install yaml` |
| `unified` + `remark-parse` | CHECK-04 (Tier 2 MD parser) | ✓ | 11.x | — |
| `@actions/core` summary API | ACT-09 | ✓ | 3.0.1 | `core.warning()` if `$GITHUB_STEP_SUMMARY` absent |
| Octokit `repos.getContent` | Template loading | ✓ | In @octokit/plugin-rest-endpoint-methods | — |
| Octokit `repos.createLabel` | ACT-06 | ✓ | In @octokit/plugin-rest-endpoint-methods | — |
| Octokit `issues.addLabels` | ACT-06 | ✓ | In @octokit/plugin-rest-endpoint-methods | — |
| Octokit `issues.removeLabel` | ACT-06 | ✓ | In @octokit/plugin-rest-endpoint-methods | — |

**Missing dependencies with no fallback:**
- `yaml` package must be installed in Wave 0 before any Tier 1 implementation

**Missing dependencies with fallback:**
- None (all other dependencies are available)

---

## Validation Architecture

> `workflow.nyquist_validation` is `false` in `.planning/config.json` — this section is SKIPPED.

---

## Security Domain

> `security_enforcement: true` in `.planning/config.json`.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | N/A — uses GITHUB_TOKEN (runner-provided) |
| V3 Session Management | No | N/A — stateless Action |
| V4 Access Control | Partial | Skip-label check (`signal-oss-ignore`) is the only ACL; reads from `issue.labels` in trusted event payload |
| V5 Input Validation | Yes | `core.getBooleanInput` validates booleans; numeric inputs use `parseInt` with fallback defaults; template YAML parsed defensively (try/catch, best-effort) |
| V6 Cryptography | No | No cryptographic operations in this phase |

### Known Threat Patterns for this Phase

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Malformed YAML in `.github/ISSUE_TEMPLATE/*.yml` (injection via template authoring) | Tampering | `try { parse(yaml) } catch { return [] }` — parser errors never propagate; content treated as data not instructions |
| Label name injection (e.g., maintainer configures `label-name: "needs-info\",\"admin"`) | Tampering | `octokit.rest.issues.addLabels` sends the label name as a JSON string value — properly encoded by Octokit client; no string concatenation |
| Template file content containing `@mentions` or HTML | Elevation | Template field labels are used only as checklist item text inside the posted comment; `format()` function does no HTML rendering of template content; markdown checklist items are plain text |
| Oversized template files consuming memory | Denial of Service | Template files are typically < 10KB; no explicit size limit needed for v1 (GitHub itself enforces template file size limits) |
| `signal-oss-ignore` label spoofing | Tampering | The label is read from `payload.issue.labels` which comes from the trusted GitHub webhook payload — not user-submitted body content |

---

## Project Constraints (from CLAUDE.md)

The following directives from `./CLAUDE.md` constrain all Phase 2 implementation:

1. **Hexagonal invariant:** `src/core/` must stay pure — zero Octokit, zero fs, zero LLM SDK imports. All I/O in `src/adapters/`.
2. **Stack locked:** Use `yaml` 2.x (eemeli), `unified` + `remark-parse`, `zod` 4.x, `@actions/core` 3.x, `@actions/github` 9.x. No alternatives.
3. **No `actions/checkout`:** Templates loaded via `octokit.rest.repos.getContent` only.
4. **Bundle committed:** After each plan, `npm run bundle` must succeed and `dist/index.js` committed. The Action is not installable without it.
5. **Vitest 3.x for tests:** All new tests in `tests/` directory, same format as Phase 1 tests.
6. **Biome 2.x formatting:** `npm run format` before bundle. No ESLint/Prettier.
7. **Hero output invariant:** The checklist comment MUST post even if label management or summary writing fails. Label and summary are secondary outputs.
8. **TypeScript strict:** No `any` without explicit justification; all new interfaces in `src/core/types.ts`.
9. **Tone style guide:** No "Required:" / "Must:" / "Invalid:" in any static string. Use "Could you share..." framing.

---

## Sources

### Primary (HIGH confidence)
- `node_modules/@octokit/plugin-rest-endpoint-methods/dist-src/generated/endpoints.js` — verified `createLabel`, `addLabels`, `removeLabel`, `getContent`, `getLabel` endpoint specs [VERIFIED: grep]
- `node_modules/@actions/core/lib/summary.js` — verified `summary` singleton API: `addRaw`, `addTable`, `write`, `addDetails` [VERIFIED: file read]
- `node_modules/@actions/core/lib/core.js` — verified `getInput`, `getBooleanInput` signatures [VERIFIED: grep]
- `src/adapters/github/io.ts` — existing idempotent comment pattern (MARKER, find-update, create) [VERIFIED: file read]
- `src/core/checklist/generator.ts` — STRATEGIES array extension point [VERIFIED: file read]
- `src/core/types.ts` — ChecklistStrategy interface, RepoContext with `templates: unknown[]` [VERIFIED: file read]
- `src/core/format/markdown.ts` — META_NUDGE currently always shown; MARKER confirmed [VERIFIED: file read]
- `package.json` — confirmed `yaml` NOT in dependencies; `unified`, `remark-parse`, `zod` ARE installed [VERIFIED: npm list + node_modules ls]

### Secondary (MEDIUM confidence)
- `.planning/research/PITFALLS.md` Pitfall 8 — real-world YAML parser edge cases (config.yml, BOM, non-standard fields) [CITED]
- `.planning/research/ARCHITECTURE.md` — hexagonal invariant, strategy chain pattern, adapter boundaries [CITED]
- `CLAUDE.md` §Technology Stack — locked library choices with rationale [CITED]

### Tertiary (LOW confidence — verify before implementing)
- GitHub Issues API behavior: `createLabel` requires `color` without `#` prefix [ASSUMED — A1]
- `payload.repository.default_branch` availability in all issues events [ASSUMED — A3]

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries verified in node_modules or npm registry
- Architecture: HIGH — directly extends Phase 1 patterns with documented extension points
- API surface (Octokit): HIGH — verified in installed endpoint spec
- YAML parse pattern: HIGH — `yaml` 2.x is well-documented; defensive pattern is standard
- Pitfalls: HIGH — pitfalls 1-7 directly verified against code; pitfall about `#` in color is ASSUMED

**Research date:** 2026-05-14
**Valid until:** 2026-06-14 (stable stack; Octokit endpoints do not change)

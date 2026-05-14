# Phase 2: Action Hardening + Repo-Awareness - Pattern Map

**Mapped:** 2026-05-14
**Files analyzed:** 10 (4 new, 6 modified)
**Analogs found:** 10 / 10

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/adapters/github/templates.ts` (NEW) | adapter | request-response | `src/adapters/github/io.ts` | role-match |
| `src/adapters/github/labels.ts` (NEW) | adapter | request-response | `src/adapters/github/io.ts` | role-match |
| `src/core/checklist/strategies/issue-form.ts` (NEW) | strategy / service | transform | `src/core/checklist/strategies/baseline.ts` | exact |
| `src/core/checklist/strategies/template-md.ts` (NEW) | strategy / service | transform | `src/core/checklist/strategies/baseline.ts` | exact |
| `src/core/types.ts` (MODIFY) | model | — | self | — |
| `src/core/checklist/generator.ts` (MODIFY) | orchestrator | transform | self | — |
| `src/action/main.ts` (MODIFY) | entrypoint | request-response | self | — |
| `action.yml` (MODIFY) | config | — | self | — |
| `src/core/format/markdown.ts` (MODIFY) | utility | transform | self | — |
| `tests/adapters/templates.test.ts` (NEW) | test | — | `tests/adapters/github.test.ts` | exact |
| `tests/adapters/labels.test.ts` (NEW) | test | — | `tests/adapters/github.test.ts` | exact |

---

## Pattern Assignments

### `src/adapters/github/templates.ts` (NEW — adapter, request-response)

**Analog:** `src/adapters/github/io.ts`

**Imports pattern** (`src/adapters/github/io.ts` lines 1-8):
```typescript
// src/adapters/github/io.ts
import type * as github from '@actions/github'
import { MARKER } from '../../core/format/markdown.js'

type OctokitInstance = ReturnType<typeof github.getOctokit>
```

For `templates.ts`, extend with additional parsing imports:
```typescript
import * as core from '@actions/core'
import type * as github from '@actions/github'
import { parse } from 'yaml'
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import { toString as mdastToString } from 'mdast-util-to-string'
import { visit } from 'unist-util-visit'
import type { Heading } from 'mdast'
import type { RepoContext, ParsedTemplate } from '../../core/types.js'

type OctokitInstance = ReturnType<typeof github.getOctokit>
```

**Octokit call pattern** (`src/adapters/github/io.ts` lines 17-24):
```typescript
// Pattern: direct octokit.rest.* call; destructure { data }; no try/catch at call site
// (io.ts lets errors propagate; templates.ts uses core.warning + fallthrough instead)
const { data: comments } = await octokit.rest.issues.listComments({
  owner,
  repo,
  issue_number: issueNumber,
  per_page: 100,
})
```

**Adapter function signature pattern** (`src/adapters/github/io.ts` lines 10-16):
```typescript
// Pattern: async function, octokit as first param, typed return, exported named function
export async function postOrUpdateComment(
  octokit: OctokitInstance,
  owner: string,
  repo: string,
  issueNumber: number,
  body: string,
): Promise<{ commentId: number; action: 'created' | 'updated' }> {
```

Apply to `templates.ts`:
```typescript
export async function loadRepoContext(
  octokit: OctokitInstance,
  owner: string,
  repo: string,
  defaultBranch: string,
): Promise<RepoContext> {
```

**Error resilience pattern** — `io.ts` does NOT wrap in try/catch (errors bubble). `templates.ts` MUST differ: use `core.warning()` + silent fallthrough. See RESEARCH.md Pattern 1 and D-03.

**Key implementation rules:**
- `Buffer.from(content.replace(/\n/g, ''), 'base64').toString('utf-8')` to decode file content (strip embedded newlines from base64 before decode)
- Filter `config.yml` before parsing: `f.name.toLowerCase() !== 'config.yml'`
- Check `Array.isArray(data)` after directory `getContent` (polymorphic response shape — Pitfall 1)
- Skip `type: 'markdown'` elements in YAML body; only collect `validations?.required == true` (loose equality for string `'true'` — Pitfall 3)
- All parse functions return `string[]` (field labels); catch-and-return-empty at every boundary
- `ParsedTemplate` type lives in `src/core/types.ts` (not adapters) to avoid circular import when strategies import it

---

### `src/adapters/github/labels.ts` (NEW — adapter, request-response)

**Analog:** `src/adapters/github/io.ts`

**Imports pattern**:
```typescript
import * as core from '@actions/core'
import type * as github from '@actions/github'

type OctokitInstance = ReturnType<typeof github.getOctokit>
```

**Try-get-first pattern** (derived from io.ts `existing` lookup + RESEARCH.md Pattern 5):
```typescript
// Pattern: check-then-act; treat 404 as expected branch not error
async function ensureLabel(
  octokit: OctokitInstance,
  owner: string, repo: string,
  name: string, color: string, description: string,
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
          color: color.replace('#', ''),  // GitHub API: no '#' prefix
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
```

**Error wrapping pattern** (applied to all label operations — label must NEVER block hero comment):
```typescript
// Pattern: try/catch on every Octokit call; core.warning on failure; return status string
async function applyLabel(...): Promise<'applied' | 'skipped'> {
  try {
    await octokit.rest.issues.addLabels({ owner, repo, issue_number: issueNumber, labels: [name] })
    return 'applied'
  } catch (err: unknown) {
    core.warning(`Could not apply label "${name}": ${(err as Error).message}`)
    return 'skipped'
  }
}
```

**404-is-success pattern** (removeLabel — Pitfall 7):
```typescript
} catch (err: unknown) {
  if ((err as { status?: number }).status !== 404) {
    core.warning(`Could not remove label: ${(err as Error).message}`)
  }
  return 'skipped'  // 404 = desired state already achieved
}
```

**Exported LabelAction type** (consumed by main.ts for summary report):
```typescript
export type LabelAction = 'applied' | 'removed' | 'skipped' | 'disabled' | 'dry-run'
```

---

### `src/core/checklist/strategies/issue-form.ts` (NEW — strategy, transform)

**Analog:** `src/core/checklist/strategies/baseline.ts` (lines 1-28)

**Full analog** (`src/core/checklist/strategies/baseline.ts`):
```typescript
// Tier 4: Universal Baseline Strategy. Always applies (last in chain).
import type {
  ChecklistItem,
  ChecklistStrategy,
  IssueType,
  RepoContext,
  Signals,
} from '../../types.js'
import { BASELINE_ITEMS } from '../baselines.js'

export class BaselineStrategy implements ChecklistStrategy {
  name = 'baseline'

  applies(_ctx: RepoContext): boolean {
    return true
  }

  generate(type: IssueType, signals: Signals): ChecklistItem[] {
    const items = BASELINE_ITEMS[type]
    return items.filter((item) => {
      if (!item.signalKey) return true
      return signals[item.signalKey] === false
    })
  }
}
```

**Apply to `issue-form.ts`** — copy class structure exactly; change:
- `name = 'issue-form'`
- `applies()` returns `ctx.hasIssueForms && templates.some(t => t.type === 'form' && t.fields.length > 0)` (D-06: false when zero required fields)
- `generate()` signature: add optional `ctx?: RepoContext` as third param (backward-compatible with generator.ts call site which passes `ctx`)
- Import `ParsedTemplate` from `../../types.js` (type-only import — NO adapter import in core)
- Do NOT import from `src/adapters/` — adapters import from core, not the reverse

**Template selection pattern** (D-05):
```typescript
const TYPE_KEYWORDS: Record<IssueType, string> = {
  bug: 'bug_report',
  feature: 'feature_request',
  question: 'question',
}

function selectTemplate(type: IssueType, templates: ParsedTemplate[]): string[] {
  const keyword = TYPE_KEYWORDS[type]
  const formTemplates = templates.filter(t => t.type === 'form')
  const matched = formTemplates.find(t => t.filename.toLowerCase().includes(keyword))
  if (matched) return matched.fields
  // D-05 fallback: union of all form templates' required fields
  return [...new Set(formTemplates.flatMap(t => t.fields))]
}
```

**Checklist item framing** — copy tone from `src/core/checklist/baselines.ts`:
```typescript
// 'Could you share...' framing (CORE-06)
// items.map(label => ({ text: `Could you share the ${label.toLowerCase()}?` }))
// Cap at 5 with .slice(0, 5) (D-08)
```

---

### `src/core/checklist/strategies/template-md.ts` (NEW — strategy, transform)

**Analog:** `src/core/checklist/strategies/baseline.ts` (same class structure)

**Key differences from `issue-form.ts`:**
- `name = 'template-md'`
- `applies()` checks `ctx.hasMdTemplates` and `templates.some(t => t.type === 'md' && t.fields.length > 0)`
- `generate()` selects `templates.filter(t => t.type === 'md')` — same filename type-match (D-05)
- Fields are H3 heading strings (already extracted by adapter); same `'Could you share...'` framing and `.slice(0, 5)` cap

**Class structure** (copy from baseline.ts with above changes):
```typescript
export class TemplateMdStrategy implements ChecklistStrategy {
  name = 'template-md'

  applies(ctx: RepoContext): boolean {
    if (!ctx.hasMdTemplates) return false
    const templates = ctx.templates as ParsedTemplate[]
    return templates.some(t => t.type === 'md' && t.fields.length > 0)
  }

  generate(type: IssueType, signals: Signals, ctx?: RepoContext): ChecklistItem[] {
    if (!ctx) return []
    const templates = ctx.templates as ParsedTemplate[]
    const fields = selectTemplate(type, templates.filter(t => t.type === 'md'))
    return fields
      .map(label => ({ text: `Could you share the ${label.toLowerCase()}?` }))
      .slice(0, 5)
  }
}
```

---

### `src/core/types.ts` (MODIFY)

**Current file:** `src/core/types.ts` lines 1-51

**Changes needed:**

1. Add `ParsedTemplate` interface (replaces `templates: unknown[]` in `RepoContext`):
```typescript
// New type — produced by adapter, consumed by core strategies (type-only)
export interface ParsedTemplate {
  filename: string
  type: 'form' | 'md'
  fields: string[]   // human-readable required field labels in template order
}
```

2. Update `RepoContext.templates` field type:
```typescript
// Before:
templates: unknown[]
// After:
templates: ParsedTemplate[]
```

3. Update `ChecklistStrategy.generate()` signature to accept optional `ctx`:
```typescript
// Before:
generate(type: IssueType, signals: Signals): ChecklistItem[]
// After:
generate(type: IssueType, signals: Signals, ctx?: RepoContext): ChecklistItem[]
```

**Constraint:** `BaselineStrategy.generate()` ignores `ctx` — the `ctx?` optional param is backward-compatible. No callers break. All existing tests stay green.

---

### `src/core/checklist/generator.ts` (MODIFY)

**Current file:** `src/core/checklist/generator.ts` lines 1-25

**Changes:**

1. Import and prepend new strategies:
```typescript
// Before:
import { BaselineStrategy } from './strategies/baseline.js'

const STRATEGIES: ChecklistStrategy[] = [
  // Phase 2 prepends: IssueFormStrategy, TemplateMdStrategy
  new BaselineStrategy(),
]
```
```typescript
// After:
import { IssueFormStrategy } from './strategies/issue-form.js'
import { TemplateMdStrategy } from './strategies/template-md.js'
import { BaselineStrategy } from './strategies/baseline.js'

const STRATEGIES: ChecklistStrategy[] = [
  new IssueFormStrategy(),  // Tier 1
  new TemplateMdStrategy(), // Tier 2
  new BaselineStrategy(),   // Tier 4 — always applies, must be last
]
```

2. Pass `ctx` to `generate()` call (line 20):
```typescript
// Before:
return { items: s.generate(type, signals), tierUsed: s.name }
// After:
return { items: s.generate(type, signals, ctx), tierUsed: s.name }
```

**Constraint:** `STRATEGIES` order is load-bearing — `IssueFormStrategy` before `TemplateMdStrategy` before `BaselineStrategy`. `BaselineStrategy.applies()` always returns `true`, so it must stay last or the chain short-circuits.

---

### `src/action/main.ts` (MODIFY)

**Current file:** `src/action/main.ts` lines 1-63

**Pattern: existing imports block** (lines 1-11):
```typescript
import * as core from '@actions/core'
import * as github from '@actions/github'
import { postOrUpdateComment } from '../adapters/github/io.js'
import { format } from '../core/format/markdown.js'
import { score } from '../core/index.js'
import type { Issue, RepoContext } from '../core/types.js'
```

**Pattern: bot-loop guard** (lines 13-17) — copy verbatim, keep as first check:
```typescript
if (github.context.actor === 'github-actions[bot]') {
  core.info('Skipping — triggered by github-actions[bot] actor (bot-loop guard).')
  return
}
```

**Pattern: payload extraction** (lines 19-35) — copy verbatim for `issue` construction.

**New: read inputs** — insert after payload extraction, before template loading:
```typescript
// ACT-07: read all inputs with defaults (core.getBooleanInput throws on non-boolean)
const dryRun = core.getBooleanInput('dry-run')
const enableComments = core.getBooleanInput('enable-comments')
const enableLabels = core.getBooleanInput('enable-labels')
const labelName = core.getInput('label-name') || 'needs-info'
const grayZoneLow = parseInt(core.getInput('gray-zone-low') || '4', 10)
const grayZoneHigh = parseInt(core.getInput('gray-zone-high') || '6', 10)
const maxBodyBytes = parseInt(core.getInput('max-body-bytes') || '10000', 10)
```

**New: skip-label check** (ACT-08) — insert after inputs, before any I/O (earliest possible exit):
```typescript
if (issue.labels.includes('signal-oss-ignore')) {
  core.info('Skipping — signal-oss-ignore label present.')
  try {
    await core.summary.addRaw('Skipped — reason: signal-oss-ignore label present').write()
  } catch { /* $GITHUB_STEP_SUMMARY absent in local testing */ }
  return
}
```

**Replace stub** (lines 37-43) with real template loading:
```typescript
// Phase 1 stub:
const repoContext: RepoContext = {
  hasIssueForms: false, hasMdTemplates: false, hasContributing: false, templates: [],
}
// Phase 2 replacement:
const defaultBranch =
  (github.context.payload.repository as { default_branch?: string })?.default_branch ?? 'main'
const repoContext = await loadRepoContext(octokit, owner, repo, defaultBranch)
```

**Pattern: token + octokit setup** (lines 48-53) — copy verbatim, move earlier (before loadRepoContext):
```typescript
const token = core.getInput('github-token') || process.env.GITHUB_TOKEN
if (!token) {
  throw new Error('Missing GITHUB_TOKEN — set GITHUB_TOKEN env or github-token input.')
}
const octokit = github.getOctokit(token)
const { owner, repo } = github.context.repo
```

**New: label management** — after `postOrUpdateComment`, before summary:
```typescript
let labelAction: LabelAction = 'disabled'
if (enableLabels && !dryRun) {
  await ensureLabel(octokit, owner, repo, labelName, '#e4e669', 'Waiting for more information from the issue author')
  if (scored.items.length > 0) {
    labelAction = await applyLabel(octokit, owner, repo, issueNumber, labelName)
  } else {
    labelAction = await removeLabel(octokit, owner, repo, issueNumber, labelName)
  }
} else if (dryRun) {
  labelAction = 'dry-run'
}
```

**New: summary** — last operation, wrapped in try/catch:
```typescript
try {
  await writeSummary({ ... })
} catch (err: unknown) {
  core.warning(`Summary write failed: ${(err as Error).message}`)
}
```

**Dry-run gating** — wrap `postOrUpdateComment` and label calls:
```typescript
if (!dryRun && enableComments) {
  result = await postOrUpdateComment(octokit, owner, repo, issueNumber, body)
}
```

---

### `action.yml` (MODIFY)

**Current file:** `action.yml` lines 1-13 (no inputs section)

**Pattern: add inputs block** — insert before `runs:`:
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

**Preserve unchanged:** `name`, `description`, `author`, `runs`, `branding` blocks.

---

### `src/core/format/markdown.ts` (MODIFY)

**Current file:** `src/core/format/markdown.ts` lines 1-33

**Changes needed:**

1. Update `format()` signature to accept `repoContext`:
```typescript
// Before (line 18):
export function format(scored: ScoredIssue): string {
// After:
import type { RepoContext, ScoredIssue } from '../types.js'
export function format(scored: ScoredIssue, repoContext?: RepoContext): string {
```

2. Gate `META_NUDGE` on template absence (CHECK-06):
```typescript
// Before (line 28):
const sections = [intro, checklist, badge, META_NUDGE, closing, MARKER].filter(
  (s) => s.length > 0,
)
// After:
const showMetaNudge = !repoContext?.hasIssueForms && !repoContext?.hasMdTemplates
const sections = [intro, checklist, badge, showMetaNudge ? META_NUDGE : '', closing, MARKER].filter(
  (s) => s.length > 0,
)
```

**Critical:** `repoContext?` optional keeps it backward-compatible with existing tests. When `repoContext` is `undefined` (old callers), `!undefined?.hasIssueForms === true` → nudge still shows. Existing `format.test.ts` tests pass without change.

**Update call sites:** `src/action/main.ts` (line 46) must pass `repoContext`:
```typescript
// Before:
const body = format(scored)
// After:
const body = format(scored, repoContext)
```

---

## Test File Patterns

### `tests/adapters/templates.test.ts` (NEW)

**Analog:** `tests/adapters/github.test.ts` (full file)

**Mock factory pattern** (lines 5-15 of `tests/adapters/github.test.ts`):
```typescript
// Pattern: inline factory function returning named vi.fn() mocks + cast octokit
function makeOctokit(comments: Array<{ id: number; body?: string }>) {
  const listComments = vi.fn().mockResolvedValue({ data: comments })
  const createComment = vi.fn().mockResolvedValue({ data: { id: 9999 } })
  const updateComment = vi.fn().mockResolvedValue({ data: {} })
  const octokit = {
    rest: {
      issues: { listComments, createComment, updateComment },
    },
  } as unknown as Parameters<typeof postOrUpdateComment>[0]
  return { octokit, listComments, createComment, updateComment }
}
```

Apply to `templates.test.ts`:
```typescript
function makeOctokit(getContentImpl: (params: unknown) => unknown) {
  const getContent = vi.fn().mockImplementation(getContentImpl)
  const octokit = {
    rest: { repos: { getContent } },
  } as unknown as Parameters<typeof loadRepoContext>[0]
  return { octokit, getContent }
}
```

**Test structure pattern** (describe/it blocks from `tests/adapters/github.test.ts`):
```typescript
import { describe, it, expect, vi } from 'vitest'
import { loadRepoContext } from '../../src/adapters/github/templates.js'

describe('loadRepoContext — 404 on ISSUE_TEMPLATE dir', () => {
  it('returns hasIssueForms=false, hasMdTemplates=false, templates=[]', async () => { ... })
})
describe('loadRepoContext — .yml template with required fields', () => {
  it('returns hasIssueForms=true and correct fields extracted', async () => { ... })
})
describe('loadRepoContext — config.yml skipped', () => {
  it('config.yml not parsed as template', async () => { ... })
})
```

**Error propagation test pattern** (lines 92-104 of `tests/adapters/github.test.ts`):
```typescript
// Pattern for templates: errors should NOT bubble (unlike io.ts) — test they produce fallthrough
it('getContent network error → returns empty RepoContext (no throw)', async () => {
  const { octokit } = makeOctokit(() => { throw new Error('network') })
  const result = await loadRepoContext(octokit, 'o', 'r', 'main')
  expect(result.hasIssueForms).toBe(false)
  expect(result.templates).toEqual([])
})
```

### `tests/adapters/labels.test.ts` (NEW)

**Analog:** `tests/adapters/github.test.ts`

**Mock factory for label endpoints:**
```typescript
function makeLabelOctokit(overrides: {
  getLabel?: () => unknown
  createLabel?: () => unknown
  addLabels?: () => unknown
  removeLabel?: () => unknown
}) {
  const repos = {
    getLabel: vi.fn().mockImplementation(overrides.getLabel ?? (() => ({ data: {} }))),
    createLabel: vi.fn().mockImplementation(overrides.createLabel ?? (() => ({ data: {} }))),
  }
  const issues = {
    addLabels: vi.fn().mockImplementation(overrides.addLabels ?? (() => ({ data: {} }))),
    removeLabel: vi.fn().mockImplementation(overrides.removeLabel ?? (() => ({ data: {} }))),
  }
  return { octokit: { rest: { repos, issues } } as unknown as OctokitInstance, repos, issues }
}
```

---

## Shared Patterns

### Error Resilience (adapters only — NOT core)
**Source:** `src/adapters/github/io.ts` — note `io.ts` lets errors propagate; `templates.ts` and `labels.ts` use the inverse pattern
**Apply to:** `templates.ts`, `labels.ts`
```typescript
// Adapter-layer pattern for Phase 2 files: catch, warn, continue
try {
  // Octokit call
} catch (err: unknown) {
  core.warning(`<operation> failed: ${(err as Error).message}`)
  // return safe fallback value
}
```

### OctokitInstance Type Alias
**Source:** `src/adapters/github/io.ts` line 8
**Apply to:** `templates.ts`, `labels.ts`
```typescript
type OctokitInstance = ReturnType<typeof github.getOctokit>
```

### Strategy Class Structure
**Source:** `src/core/checklist/strategies/baseline.ts` lines 13-28
**Apply to:** `issue-form.ts`, `template-md.ts`
```typescript
export class XxxStrategy implements ChecklistStrategy {
  name = 'xxx'
  applies(_ctx: RepoContext): boolean { ... }
  generate(type: IssueType, signals: Signals, ctx?: RepoContext): ChecklistItem[] { ... }
}
```

### Tone Style Guide
**Source:** `src/core/checklist/baselines.ts` lines 9-43
**Apply to:** all checklist item text in `issue-form.ts`, `template-md.ts`
```typescript
// Always: 'Could you share...' framing. Never: 'Required:', 'Must:', 'Invalid:', 'Missing:'
{ text: `Could you share the ${label.toLowerCase()}?` }
```

### `.js` Extension on Imports
**Source:** all existing source files (e.g., `io.ts` line 6: `'../../core/format/markdown.js'`)
**Apply to:** all new files
```typescript
// All local imports use .js extension (TypeScript module resolution: bundler/nodenext)
import { foo } from './bar.js'
```

### Test Mock Hoisting
**Source:** `tests/action/main.test.ts` lines 4-46
**Apply to:** `tests/adapters/templates.test.ts`, `tests/adapters/labels.test.ts`
```typescript
// vi.mock() calls are hoisted by Vitest — declare at module top, not inside describe()
const mockGetContent = vi.fn()
vi.mock('@actions/core', () => ({ warning: vi.fn(), info: vi.fn() }))
```

### `core.warning()` Import in Tests
**Source:** `tests/action/main.test.ts` lines 28-38
**Apply to:** Any test that needs to assert `core.warning()` was called:
```typescript
vi.mock('@actions/core', () => ({
  info: mockInfo,
  setFailed: mockSetFailed,
  getInput: mockGetInput,
  warning: vi.fn(),
  getBooleanInput: vi.fn().mockReturnValue(false),
  summary: { addRaw: vi.fn().mockReturnThis(), write: vi.fn().mockResolvedValue(undefined) },
}))
```

---

## No Analog Found

All files have analogs. No files require RESEARCH.md patterns as primary source.

---

## Metadata

**Analog search scope:** `src/adapters/github/`, `src/core/checklist/strategies/`, `src/core/format/`, `src/action/`, `tests/adapters/`, `tests/core/`, `tests/action/`
**Files scanned:** 11 source files + 9 test files
**Pattern extraction date:** 2026-05-14

**Critical implementation constraint from `src/core/types.ts`:**
`ChecklistStrategy.generate()` currently has signature `generate(type: IssueType, signals: Signals): ChecklistItem[]` (line 50). Phase 2 must extend this to `generate(type: IssueType, signals: Signals, ctx?: RepoContext): ChecklistItem[]` — optional param ensures `BaselineStrategy` compiles without change and all existing tests pass.

**Critical `format()` constraint from `tests/core/format.test.ts`:**
Line 22 calls `format(makeScored({...}))` with one argument. The `repoContext?` optional param in Phase 2 keeps these tests green. When `repoContext` is absent, `!undefined?.hasIssueForms` evaluates to `true` → `META_NUDGE` still renders → all existing assertions on `**Tip:**` pass.

# Phase 3: Benchmark + Heuristic Tuning - Pattern Map

**Mapped:** 2026-05-15
**Files analyzed:** 8 new/modified files
**Analogs found:** 7 / 8

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `scripts/benchmark.ts` | utility (CLI entry) | batch | `src/action/main.ts` | role-partial (both are orchestrators; main.ts is Action runtime, benchmark.ts is CLI) |
| `src/bench/scraper.ts` | service | batch + request-response | `src/adapters/github/io.ts` | role-match (both make Octokit calls with pagination) |
| `src/bench/replay.ts` | service | batch + transform | `tests/core/score-pipeline.test.ts` | role-match (both call `score()` in a loop with EMPTY_CTX) |
| `src/bench/metrics.ts` | utility | transform | `src/core/score/compute.ts` | role-match (both are pure math functions over typed inputs) |
| `src/bench/types.ts` | model (DTOs) | — | `src/core/types.ts` | exact (same DTO pattern: plain interfaces, `as const` for enums) |
| `bench/fixtures/{repo}/{number}.json` | config (data) | file-I/O | `tests/fixtures/events/issues-opened.json` | role-match (both are GitHub API payload fixtures) |
| `bench/fixtures/split.json` | config (data) | file-I/O | `tests/fixtures/events/issues-opened.json` | partial (both are JSON data files read by scripts) |
| `src/core/score/weights.ts` | config (constants) | — | self | exact (in-place edit; file already exists) |

---

## Pattern Assignments

### `scripts/benchmark.ts` (CLI entry, batch)

**Analog:** `src/action/main.ts` (lines 1–126)

**Imports pattern** — how the project wires core, adapters, and node stdlib together (from `src/action/main.ts` lines 7–17):
```typescript
import * as core from '@actions/core'
import * as github from '@actions/github'
import { postOrUpdateComment } from '../adapters/github/io.js'
import { score } from '../core/index.js'
import type { Issue } from '../core/types.js'
```

For `scripts/benchmark.ts`, substitute Action toolkit imports with `node:util` stdlib:
```typescript
import { parseArgs } from 'node:util'
import { scrape } from '../src/bench/scraper.js'
import { replay } from '../src/bench/replay.js'
import { renderReport } from '../src/bench/metrics.js'
```

**Orchestrator pattern** — thin entry point delegates all logic to sub-modules (`src/action/main.ts` lines 18–126 structure):
```typescript
export async function run(): Promise<void> {
  // 1. Parse inputs early — fail fast on missing required values
  // 2. Guard clauses / early exits before any I/O
  // 3. Delegate to sub-modules (no business logic inline)
  // 4. Log final summary
}
```

For benchmark, this maps to:
```typescript
const { values } = parseArgs({ options: { mode, repos, limit, 'no-llm': noLlm, split, token } })
const token = values.token ?? process.env['GITHUB_TOKEN'] ?? ''
if (!token && values.mode === 'scrape') { console.error('GITHUB_TOKEN required for scrape'); process.exit(1) }
// delegate: scrape() | replay() | renderReport()
```

**Error handling pattern** — `src/action/main.ts` does NOT wrap in try/catch (throws propagate to `src/action/index.ts`). For the benchmark CLI script, use process-level handling:
```typescript
// scripts/benchmark.ts bottom
run().catch((err) => { console.error(err); process.exit(1) })
```

---

### `src/bench/scraper.ts` (service, batch + request-response)

**Analog:** `src/adapters/github/io.ts` (lines 1–49) and `src/adapters/github/templates.ts` (lines 1–100)

**Imports pattern** — how project does Octokit (from `src/adapters/github/io.ts` lines 1–8):
```typescript
// src/adapters/github/io.ts lines 1-8
// ACT-05: comment idempotency. Find-existing-by-marker → update OR create.
// Adapters layer: Octokit lives here. NEVER imported by src/core/.

import type * as github from '@actions/github'
import { MARKER } from '../../core/format/markdown.js'

type OctokitInstance = ReturnType<typeof github.getOctokit>
```

For the benchmark scraper, use standalone `@octokit/rest` (NOT `@actions/github` — benchmark is a CLI script, not an Action runtime):
```typescript
// src/bench/scraper.ts
import { Octokit } from '@octokit/rest'
import { throttling } from '@octokit/plugin-throttling'
import pLimit from 'p-limit'
import type { BenchmarkFixture, SplitManifest } from './types.js'
```

**Pagination pattern** — how `src/adapters/github/io.ts` paginates (lines 20–25):
```typescript
const comments = await octokit.paginate(octokit.rest.issues.listComments, {
  owner,
  repo,
  issue_number: issueNumber,
  per_page: 100,
})
```

For scraper, use `paginate.iterator` for memory-efficient early exit (different from `octokit.paginate` which collects all pages):
```typescript
for await (const response of octokit.paginate.iterator(
  octokit.rest.issues.listForRepo,
  { owner, repo, state: 'closed', per_page: 100 }
)) {
  for (const issue of response.data) {
    if (collected.length >= maxIssues) break
    if (issue.pull_request != null) continue  // skip PRs — critical pitfall
    collected.push(issue)
  }
  if (collected.length >= maxIssues) break
}
```

**Error handling in adapter** — `src/adapters/github/templates.ts` uses try/catch per item with `core.warning` (lines 44–48, 86–89):
```typescript
} catch (err: unknown) {
  core.warning(`Could not list .github/ISSUE_TEMPLATE: ${(err as Error).message}`)
  return EMPTY_CONTEXT
}
```

For scraper (no `@actions/core`), substitute with `console.warn`:
```typescript
} catch (err: unknown) {
  console.warn(`[scraper] ${owner}/${repo}: ${(err as Error).message}`)
  return []
}
```

**Skip-if-exists cache pattern** — no direct analog exists in codebase; implement as:
```typescript
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
if (!existsSync(fixturePath)) {
  writeFileSync(fixturePath, JSON.stringify(fixture, null, 2), 'utf-8')
}
```

---

### `src/bench/replay.ts` (service, batch + transform)

**Analog:** `tests/core/score-pipeline.test.ts` (lines 1–80)

**How to call score() with minimal context** — canonical pattern (`tests/core/score-pipeline.test.ts` lines 6–8):
```typescript
const EMPTY_CTX: RepoContext = {
  hasIssueForms: false, hasMdTemplates: false, hasContributing: false, templates: [],
}
```

This is the `BENCH_REPO_CTX` constant for the replay harness. Copy this verbatim — the test already validates this path.

**Issue DTO construction from raw payload** — `src/action/main.ts` lines 32–43:
```typescript
const issue: Issue = {
  title: typeof payload.issue.title === 'string' ? payload.issue.title : '',
  body: typeof payload.issue.body === 'string' ? payload.issue.body : '',
  labels: Array.isArray(payload.issue.labels)
    ? payload.issue.labels
        .map((l: { name?: string } | string) =>
          typeof l === 'string' ? l : typeof l?.name === 'string' ? l.name : '',
        )
        .filter((s: string) => s.length > 0)
    : [],
}
```

The replay harness must apply the same defensive mapping when converting `BenchmarkFixture` to `Issue` DTO. The fixture stores `labels: string[]` already (computed at scrape time), so the mapping is simpler — but the `title`/`body` null-guards still apply.

**score() call pattern** — `tests/core/score-pipeline.test.ts` line 13 and `src/action/main.ts` line 85:
```typescript
// Tests:
const r = score(issue, EMPTY_CTX, null)

// Production action:
const scored = score(issue, repoContext, null)
```

For replay: `const result = score(toIssueDTO(fixture), BENCH_REPO_CTX, null)` — synchronous, no await needed.

**Import path convention** — `tests/core/score-pipeline.test.ts` lines 2–4:
```typescript
import { score } from '../../src/core/index.js'
import { GRAY_ZONE_HIGH, GRAY_ZONE_LOW } from '../../src/core/score/weights.js'
import type { Issue, RepoContext } from '../../src/core/types.js'
```

From `src/bench/replay.ts`, paths become `../core/index.js`, `../core/score/weights.js`, `../core/types.js`.

---

### `src/bench/metrics.ts` (utility, transform)

**Analog:** `src/core/score/compute.ts` (lines 1–15)

**Pure function module pattern** — `src/core/score/compute.ts` lines 1–15:
```typescript
// src/core/score/compute.ts
// CORE-04: weighted-sum heuristic score 0-10.

import type { Signals } from '../types.js'
import { GRAY_ZONE_HIGH, GRAY_ZONE_LOW, MAX_SCORE, WEIGHTS } from './weights.js'

export function computeScore(signals: Signals): { score: number; isGrayZone: boolean } {
  let raw = 0
  for (const [key, weight] of Object.entries(WEIGHTS) as Array<[keyof Signals, number]>) {
    if (signals[key]) raw += weight
  }
  const score = Math.max(0, Math.min(MAX_SCORE, Math.round(raw)))
  const isGrayZone = score >= GRAY_ZONE_LOW && score <= GRAY_ZONE_HIGH
  return { score, isGrayZone }
}
```

Apply the same pattern: one function per exported concern, typed inputs/outputs, no I/O, no side effects. File-level comment stating invariant.

**Iterating over typed keys pattern** — `src/core/score/compute.ts` line 9:
```typescript
for (const [key, weight] of Object.entries(WEIGHTS) as Array<[keyof Signals, number]>) {
```

For `printSignalAnalysis`, iterate signal keys the same way:
```typescript
for (const key of Object.keys(WEIGHTS) as Array<keyof Signals>) {
```

---

### `src/bench/types.ts` (model/DTOs)

**Analog:** `src/core/types.ts` (lines 1–59)

**DTO pattern** — `src/core/types.ts` lines 1–59 (plain interfaces, no classes, no runtime validation in types file):
```typescript
export interface Issue {
  title: string
  body: string
  labels: string[]
}

export interface ScoredIssue {
  score: number
  missing: string[]
  signals: Signals
  issueType: IssueType
  isGrayZone: boolean
  items: ChecklistItem[]
  tierUsed: string
}
```

For `src/bench/types.ts`, apply same pattern: plain `interface` declarations, group related types, use `import type` for cross-module references:
```typescript
import type { Signals, IssueType } from '../core/types.js'

export interface BenchmarkFixture {
  repo: string       // 'microsoft/vscode'
  number: number
  title: string
  body: string
  labels: string[]
  isSlop: boolean    // ground truth, frozen at scrape time
  closedAt: string   // ISO 8601
  htmlUrl: string    // for κ-audit review
}

export interface SplitManifest {
  seed: number
  trainFraction: number
  createdAt: string
  train: string[]    // fixture file paths relative to bench/fixtures/
  test: string[]
}
```

**Type comment conventions** — `src/core/types.ts` uses phase-scoped comments (`// Phase 2 (CHECK-03...)`, `// Phase 1 DTOs — locked`). Follow same convention for bench types:
```typescript
// Phase 3 DTOs — benchmark harness only. Never imported by src/action/ or src/adapters/.
```

---

### `bench/fixtures/{repo}/{number}.json` (data fixture)

**Analog:** `tests/fixtures/events/issues-opened.json` (lines 1–19)

**Fixture shape** — `tests/fixtures/events/issues-opened.json`:
```json
{
  "action": "opened",
  "issue": {
    "number": 1,
    "title": "App crashes on login",
    "body": "I get an error when I click the login button. Please fix.",
    "state": "open",
    "labels": [],
    "user": { "login": "Divyesh-5981", "type": "User", "id": 1 }
  }
}
```

Benchmark fixture JSON stores the `BenchmarkFixture` DTO shape (flatter than raw GitHub payload — computed at scrape time):
```json
{
  "repo": "microsoft/vscode",
  "number": 182345,
  "title": "Extension host crashes on startup",
  "body": "...",
  "labels": ["invalid"],
  "isSlop": true,
  "closedAt": "2025-11-01T14:22:00Z",
  "htmlUrl": "https://github.com/microsoft/vscode/issues/182345"
}
```

**Key difference from tests/fixtures/:** Benchmark fixtures are pre-processed (ground truth baked in); test fixtures are raw webhook payloads. Do NOT nest under `issue:` key — the replay harness reads `BenchmarkFixture` directly.

---

### `src/core/score/weights.ts` (config/constants — in-place edit)

**This is the only existing file modified in Phase 3.**

**Current state** (lines 1–19):
```typescript
// src/core/score/weights.ts
export const WEIGHTS = {
  hasCodeBlock: 1.5,
  hasStackTrace: 2.0,
  hasVersionMention: 1.5,
  hasReproKeywords: 1.5,
  hasExpectedActual: 1.5,
  hasMinimalExample: 2.0,
  hasImageOnly: -1.0,
} as const

export const GRAY_ZONE_LOW = 4
export const GRAY_ZONE_HIGH = 6
export const MAX_SCORE = 10
```

**Tuning pattern:** Edit ONLY the numeric values in `WEIGHTS`, `GRAY_ZONE_LOW`, `GRAY_ZONE_HIGH`. The `as const` assertion and export structure must not change — `compute.ts` iterates `Object.entries(WEIGHTS)` and the test suite asserts `GRAY_ZONE_LOW === 4` and `GRAY_ZONE_HIGH === 6` (those tests must be updated if the gray zone changes).

**Affected tests that assert on weight constants** — `tests/core/score.test.ts` lines 45–49:
```typescript
it('GRAY_ZONE_LOW=4, GRAY_ZONE_HIGH=6 (D-13)', () => {
  expect(GRAY_ZONE_LOW).toBe(4)
  expect(GRAY_ZONE_HIGH).toBe(6)
})
```

This test documents the current values. After tuning, update the assertion comment (not the assertion itself) if values change — or remove the hardcoded expectation and replace with range checks.

---

### `tests/bench/metrics.test.ts` (test)

**Analog:** `tests/core/score.test.ts` and `tests/core/heuristics.test.ts`

**Test file structure** — `tests/core/score.test.ts` lines 1–6:
```typescript
import { describe, it, expect } from 'vitest'
import { computeScore } from '../../src/core/score/compute.js'
import { GRAY_ZONE_HIGH, GRAY_ZONE_LOW, MAX_SCORE } from '../../src/core/score/weights.js'
import type { Signals } from '../../src/core/types.js'
```

**Fixture helper pattern** — `tests/core/heuristics.test.ts` lines 8–15:
```typescript
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

function fixture(name: string): string {
  return readFileSync(join(__dirname, '..', 'fixtures', 'issues', name), 'utf8')
}
```

For bench tests, substitute `bench/fixtures/` path. For pure math tests (Wilson CI, Cohen's κ), no fixture loading needed — test with inline values.

**Pure function test pattern** — `tests/core/score.test.ts` lines 12–14 (known-input → known-output):
```typescript
it('all-false signals → score 0', () => {
  const r = computeScore(ZERO)
  expect(r.score).toBe(0)
```

Apply same pattern to `wilsonCI`, `cohensKappa`, `findOptimalThreshold` — deterministic inputs, exact expected outputs verified against the RESEARCH.md formula examples.

---

## Shared Patterns

### ESM `.js` Extension in Imports
**Source:** Every file in `src/`
**Apply to:** All new `src/bench/*.ts` files
```typescript
// Correct — TypeScript NodeNext requires .js extensions on relative imports
import { score } from '../core/index.js'
import type { BenchmarkFixture } from './types.js'
// Wrong — will fail at runtime
import { score } from '../core/index'
```

### File-Level Invariant Comment
**Source:** `src/core/index.ts` lines 1–4, `src/adapters/github/io.ts` lines 1–3
```typescript
// src/core/index.ts
// CORE-01: pure score() entrypoint. Real pipeline (no longer Plan 02 stub).
// PHASE 1: llm parameter is accepted but always passed null. Phase 4 wires it.
// CRITICAL: This file MUST NOT import from @octokit, @actions, fs, https, or any LLM SDK.
```

Apply same pattern to bench files. For `src/bench/scraper.ts`:
```typescript
// src/bench/scraper.ts
// BENCH-01: Octokit scraper. I/O shell — calls @octokit/rest, writes to bench/fixtures/.
// CRITICAL: This file MUST NOT import from @actions/core or @actions/github (not Action runtime).
```

### Type-Safe Unknown Error Narrowing
**Source:** `src/adapters/github/templates.ts` lines 44–47 and 86–89
```typescript
} catch (err: unknown) {
  core.warning(`Could not list .github/ISSUE_TEMPLATE: ${(err as Error).message}`)
  return EMPTY_CONTEXT
}
```

Apply to all try/catch in scraper. Replace `core.warning` with `console.warn` since benchmark is not an Action.

### `import type` for Interface-Only Imports
**Source:** `src/core/index.ts` lines 9–11, `src/core/heuristics/extractor.ts` lines 10–11
```typescript
import type { LLMPort } from './llm/port.js'
import type { Issue, RepoContext, ScoredIssue } from './types.js'
```

Apply to all DTO imports in bench modules — `import type { BenchmarkFixture }` not `import { BenchmarkFixture }`.

### Vitest Import Order
**Source:** `tests/core/score.test.ts` line 1, `tests/core/heuristics.test.ts` line 1
```typescript
import { describe, it, expect } from 'vitest'
```

Always first import in test files. Biome lint enforces import ordering — vitest must precede node stdlib and project imports.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `bench/REPORT.md` | output (markdown report) | file-I/O write | No existing file-generation scripts in codebase. RESEARCH.md §Code Examples has the markdown template structure to use directly. |

---

## Metadata

**Analog search scope:** `src/**/*.ts`, `tests/**/*.ts`, `tests/fixtures/**/*`, `package.json`
**Files scanned:** 19 source files, 15 test files, 5 fixture files
**Pattern extraction date:** 2026-05-15

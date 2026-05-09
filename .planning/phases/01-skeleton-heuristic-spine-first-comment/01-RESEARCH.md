# Phase 1: Skeleton + Heuristic Spine + First Comment — Research

**Researched:** 2026-05-09
**Domain:** GitHub Actions TypeScript Action bootstrap, remark/unified AST parsing, Vitest, Biome, Rollup bundling, Octokit comment idempotency
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Bootstrap from `actions/typescript-action` (official GitHub template). Not `int128/typescript-action` or manual init.
- **D-02:** Swap Jest→Vitest and ESLint+Prettier→Biome immediately in the **first commit** — before writing any source code. Avoids mid-sprint migration.
- **D-03:** `tsconfig` module resolution: **NodeNext / Node16**. Required for ESM-only deps (`unified` 11, `remark-parse` 11). ncc handles the ESM→CJS transpile transparently.
- **D-04:** Commit `dist/` (ncc-bundled output) to the repo from Phase 1. Required for the Action to be installable without a build step on the consumer side. ACT-01.
- **D-05:** Tier-4 baseline: **3–4 items per issue type** (bug / feature / question). Tight and scannable; high-signal.
- **D-06:** Item framing: **question framing** ("Could you share…" style). No "Required:" / "Must:" / "Invalid" language. Matches CORE-06 tone guide. Passes the read-aloud test.
- **D-07:** Comment structure (top to bottom): intro → checklist → score badge → meta-nudge stub → closing.
- **D-08:** Meta-nudge stub copy (Phase 1 version): *"Tip: adding an issue template to `.github/ISSUE_TEMPLATE/` helps reporters include the right information upfront."*
- **D-09:** **Always post** a comment, even for high-quality issues.
- **D-10:** **All 7 CORE-02 signals** are implemented in Phase 1: code blocks, stack-trace pattern, version/env mention, repro keywords, expected-vs-actual structure, minimal-example presence, screenshot/image-only flag.
- **D-11:** Heuristic extractor: **mdast AST walk via `remark-parse`**. Not regex/string matching.
- **D-12:** Signals DTO: **boolean presence flags only** in Phase 1.
- **D-13:** Initial **gray-zone band: score 4–6**. Exported from `src/core/score/weights.ts`.
- **D-14:** Per-signal weights: **typed constants in `src/core/score/weights.ts`** — not exposed as action inputs.
- **D-15:** Two-layer E2E: `@github/local-action` + push to throwaway sandbox repo.
- **D-16:** Sandbox: a **new throwaway repo** under the developer's GitHub account.
- **D-17:** Phase 1 soak = **single successful comment run**.

### Claude's Discretion
- Exact per-signal weights (initial values in `weights.ts` before benchmark tuning) — implementer picks reasonable starting values.
- Exact bug/feature/question checklist item text beyond the framing style (D-06) and count (D-05).
- tsconfig strict settings beyond module resolution.

### Deferred Ideas (OUT OF SCOPE)
- Repo-awareness (Tier 1/2 template parsing, Octokit.getContent for `.github/ISSUE_TEMPLATE/`) → Phase 2
- Idempotency hardening (24h soak test, `issues.edited` trigger) → Phase 2
- Label management → Phase 2
- Action inputs (`dry-run`, `enable-comments`, etc.) → Phase 2
- Span/offset metadata in Signals DTO → Phase 2
- LLM adjudicator wiring → Phase 4
- Benchmark harness → Phase 3
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CORE-01 | Pure `score(issue, repoContext, llm?)` entrypoint returning `{ score, missing, signals, issueType, isGrayZone }` with zero side effects inside `src/core/` | Hexagonal pattern; ports-and-adapters layout; pure function design |
| CORE-02 | Heuristics extractor walking mdast AST for 7 signals: code blocks, stack-trace, version/env, repro keywords, expected-vs-actual, minimal-example, screenshot/image-only | remark-parse 11 + unist-util-visit 5.x AST walk; mdast node types documented below |
| CORE-03 | Issue-type classifier (bug/feature/question): labels first → title patterns → body keyword weighting | Pure TypeScript; no external deps needed; precedence chain |
| CORE-04 | Weighted-sum heuristic score 0–10 with `weights.ts` constants; `isGrayZone` flag for band 4–6 | Simple arithmetic; `weights.ts` pattern documented below |
| CORE-05 | Output formatter: markdown comment with checklist front-and-center, score badge, meta-nudge | Template literal construction; no extra dep needed |
| CORE-06 | Tone style guide: question framing, no "Required:"/"Must:"/"Invalid" | Static copy reviewed against read-aloud test |
| CHECK-01 | Strategy-chain interface: `{ applies(repoContext): boolean, generate(issueType, signals): ChecklistItem[] }`; first-applies-wins | Interface pattern; chain array documented below |
| CHECK-02 | Tier 4 (Universal Baseline): bug/feature/question-specific checklists; always returns non-empty list | Baseline content per type documented below |
| ACT-01 | Single-file `dist/index.js` via Rollup (template default); `dist/` committed; `action.yml` declares `using: 'node24'` | Template uses Rollup 4.x, not ncc — critical discovery; `dist/` not gitignored by default |
| ACT-02 | Workflow YAML scoped to `on: issues: types: [opened, reopened]` only | Verified against GitHub Actions docs |
| ACT-03 | Explicit `permissions:` block (`issues: write`, `contents: read`); `GITHUB_TOKEN` only | Verified against GitHub Actions docs; per-job minimum-grant pattern |
| ACT-04 | Bot-loop guard: early return when `github.actor === 'github-actions[bot]'` | GITHUB_TOKEN bot identity; `context.actor` field documented |
| ACT-05 | Comment idempotency via `<!-- signal-oss:v1 -->` marker; find-existing → update-in-place | Octokit `issues.listComments` + `issues.updateComment`; exact call sequence documented below |
</phase_requirements>

---

## Summary

Phase 1 bootstraps a greenfield GitHub Action from the `actions/typescript-action` template and delivers the entire heuristic scoring spine end-to-end. The hero output — a Tier-4 baseline missing-info checklist comment — must post on any repo by the end of this phase. The architecture is hexagonal: `src/core/` stays pure (no I/O), `src/adapters/github/` owns Octokit calls, and `src/action/main.ts` is a thin 30-line orchestrator.

**Critical bundler discovery:** The current `actions/typescript-action` template (as of 2026-05) uses **Rollup 4.x** (not `@vercel/ncc`) and outputs **ESM format** (`format: 'es'`). The project's `package.json` already has `"type": "module"`. This resolves the ESM-only dep issue for unified/remark-parse — since the bundle output is ESM, ESM-only packages bundle without shims. However, `action.yml` must declare `using: 'node24'` (the template now defaults to this). The `tsconfig.json` in the current template already uses `"module": "NodeNext"` and `"moduleResolution": "NodeNext"`, so D-03 is pre-satisfied.

The two mandatory first-commit swaps (D-02) are: remove Jest → install Vitest 3.x; remove ESLint+Prettier → install Biome 2.x. Both are well-understood and straightforward. The Vitest config requires `environment: 'node'` and mock patterns for `@actions/core` and `@actions/github` are documented.

**Primary recommendation:** Follow the template's Rollup-based build path (not ncc), output ESM to `dist/index.js`, commit `dist/`, and proceed directly to implementing DTOs + heuristics + score + format + GitHub I/O adapter in that order.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Issue body parsing (AST) | API/Backend Logic (`src/core/heuristics/`) | — | Pure in-process computation; no I/O |
| Issue-type classification | API/Backend Logic (`src/core/classifier/`) | — | Pure function on labels + title + signals |
| Score computation | API/Backend Logic (`src/core/score/`) | — | Deterministic math; no I/O |
| Checklist generation (Tier 4) | API/Backend Logic (`src/core/checklist/`) | — | Pure function on signals + type |
| Comment formatting | API/Backend Logic (`src/core/format/`) | — | Pure template rendering |
| GitHub event dispatch | Action Entry (`src/action/main.ts`) | — | Reads `GITHUB_EVENT_PATH`; calls core; writes via adapter |
| Comment post/update | GitHub I/O Adapter (`src/adapters/github/io.ts`) | — | Octokit side-effect zone; isolated from core |
| Repo-context loading | Stub in Phase 1 (`src/action/main.ts`) | — | Deferred to Phase 2; Phase 1 uses empty/stub RepoContext |
| Build/bundle | Rollup (`rollup.config.ts`) | — | Template-provided; no changes needed for Phase 1 |
| Local testing | `@github/local-action` | sandbox push | Two-layer E2E per D-15 |

---

## Standard Stack

### Core (verified against npm registry, 2026-05-09)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@actions/core` | 3.0.1 | Inputs, outputs, masking, logging, summary | Template default; `GITHUB_TOKEN` masking, `core.setFailed`, `core.info`, `core.debug` |
| `@actions/github` | 9.1.1 | Pre-authenticated Octokit + event context | Wraps `@octokit/rest`; injects `GITHUB_TOKEN` auth; exposes `context.payload.issue`, `context.repo`, `context.actor` |
| `unified` | 11.0.5 | Markdown processing pipeline | ESM-only; remark-parse plugin host |
| `remark-parse` | 11.0.0 | Parse markdown body → mdast | Structural AST for heuristics — required by D-11 |
| `remark-gfm` | 4.0.1 | GFM extensions (tables, task lists, strikethrough) | Issue bodies use GFM; needed to detect ~~image-only~~ edge cases |
| `unist-util-visit` | 5.1.0 | AST traversal helper | Walk mdast nodes by type; standard remark ecosystem tool |
| `mdast-util-to-string` | 4.0.0 | Flatten mdast node → plain text | Extract heading text for repro keyword detection |
| `zod` | 4.4.3 | Schema validation for DTOs + LLM JSON (Phase 4) | Phase 1: validate issue payload shape; Phase 4: LLM output |
| TypeScript | 6.0.3 | Language | Template-mandated; strict types on GH payload |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `rollup` | 4.60.3 | Bundle TS → single `dist/index.js` (ESM) | Template default; run via `npm run package` |
| `@rollup/plugin-typescript` | bundled with template | TS transpilation in Rollup | Already in template |
| `@rollup/plugin-node-resolve` | bundled | Resolve node_modules in bundle | Already in template |
| `@rollup/plugin-commonjs` | bundled | CJS→ESM shim for any CJS deps | Already in template; needed if any dep is CJS-only |
| `vitest` | 4.1.5 | Test runner | Replaces Jest per D-02 |
| `@biomejs/biome` | 2.4.14 | Lint + format | Replaces ESLint+Prettier per D-02 |
| `@github/local-action` | latest | Local E2E without pushing | First layer of D-15; see local testing section |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Rollup (template default) | `@vercel/ncc` (CLAUDE.md recommendation) | **Use Rollup** — it's already in the template; ncc would require removing Rollup and reconfiguring. The template now outputs ESM which handles ESM-only deps natively. ncc still works but adds unnecessary migration cost. |
| `unist-util-visit` | Manual tree walk | `unist-util-visit` is 3 lines vs 20; handles nested traversal automatically |
| `remark-gfm` | No GFM plugin | Without GFM, fenced code blocks in GFM syntax may not parse as `code` nodes |

**Installation (after cloning template, before any source code):**

```bash
# Remove Jest + ESLint + Prettier (template defaults)
npm uninstall jest @types/jest ts-jest jest-circus eslint prettier \
  @typescript-eslint/eslint-plugin @typescript-eslint/parser

# Install Vitest
npm install --save-dev vitest@4

# Install Biome
npm install --save-dev @biomejs/biome@2

# Install remark/unified pipeline
npm install unified remark-parse remark-gfm unist-util-visit mdast-util-to-string

# zod (production dep — used in both core and Phase 4 LLM validation)
npm install zod

# Remove jest.config.js, create vitest.config.ts
# Remove .eslintrc.*, .prettierrc, create biome.json
```

**Version verification:** All versions confirmed against npm registry on 2026-05-09. [VERIFIED: npm registry]

---

## Architecture Patterns

### System Architecture Diagram

```
GitHub webhook: issues.opened / issues.reopened
        │
        ▼
src/action/main.ts  (entry; reads GITHUB_EVENT_PATH)
        │
        ├── bot-loop guard: context.actor === 'github-actions[bot]' → exit
        │
        ├── parse event payload → Issue DTO
        │
        ├── stub RepoContext (Phase 1: { hasIssueForms: false, hasMdTemplates: false, hasContributing: false })
        │
        ▼
src/core/index.ts  score(issue, repoContext, llm=null)   ← PURE, zero I/O
        │
        ├── extractSignals(issue)   ← remark-parse AST walk
        │       └── returns Signals DTO (7 boolean flags)
        │
        ├── classifyType(issue, signals)  ← labels → title regex → body keywords
        │       └── returns IssueType enum: 'bug' | 'feature' | 'question'
        │
        ├── generateChecklist(signals, issueType, repoContext)  ← strategy chain
        │       └── Phase 1: only BaselineStrategy.applies() → true
        │           returns ChecklistItem[] (3–4 items, filtered by signals)
        │
        ├── computeScore(signals, issueType, checklist)
        │       └── weighted sum 0–10; isGrayZone if 4 ≤ score ≤ 6
        │
        └── returns ScoredIssue DTO
        │
        ▼
src/core/format/markdown.ts  format(scoredIssue)
        │   → intro text
        │   → checklist items
        │   → score badge
        │   → meta-nudge stub (always shown in Phase 1: no templates detected)
        │   → closing line
        │   → <!-- signal-oss:v1 --> HTML marker
        │
        ▼
src/adapters/github/io.ts  postOrUpdateComment(octokit, repo, issueNumber, body)
        │   1. octokit.rest.issues.listComments(...)
        │   2. find existing comment containing '<!-- signal-oss:v1 -->'
        │   3a. if found: octokit.rest.issues.updateComment(commentId, body)
        │   3b. if not:   octokit.rest.issues.createComment(body)
        │
        ▼
GitHub Issue: comment posted / updated
```

### Recommended Project Structure

```
signal-oss/
├── action.yml                         # using: 'node24'; no inputs in Phase 1
├── package.json                       # "type": "module"; vitest + biome dev deps
├── tsconfig.json                      # module: NodeNext, moduleResolution: NodeNext
├── rollup.config.ts                   # template default; output: dist/index.js, format: 'es'
├── vitest.config.ts                   # environment: 'node', globals: true
├── biome.json                         # linter + formatter config
├── dist/
│   └── index.js                       # COMMITTED; produced by npm run package
├── src/
│   ├── core/
│   │   ├── types.ts                   # ALL DTOs: Issue, Signals, IssueType, RepoContext, ChecklistItem, ScoredIssue
│   │   ├── index.ts                   # score() entrypoint
│   │   ├── heuristics/
│   │   │   └── extractor.ts           # extractSignals(issue) → Signals
│   │   ├── classifier/
│   │   │   └── issue-type.ts          # classifyType(issue, signals) → IssueType
│   │   ├── checklist/
│   │   │   ├── generator.ts           # strategy chain runner
│   │   │   ├── strategies/
│   │   │   │   └── baseline.ts        # Tier 4: always applies
│   │   │   └── baselines.ts           # per-type item lists
│   │   ├── score/
│   │   │   ├── compute.ts             # computeScore() → { score, isGrayZone }
│   │   │   └── weights.ts             # WEIGHTS const + GRAY_ZONE_LOW/HIGH
│   │   └── format/
│   │       └── markdown.ts            # format(scoredIssue) → string
│   ├── adapters/
│   │   └── github/
│   │       └── io.ts                  # postOrUpdateComment(); Octokit only here
│   └── action/
│       └── main.ts                    # 30-line orchestrator; calls score() + format() + io
├── tests/
│   ├── core/
│   │   ├── heuristics.test.ts
│   │   ├── classifier.test.ts
│   │   ├── checklist.test.ts
│   │   ├── score.test.ts
│   │   └── format.test.ts
│   └── fixtures/
│       └── issues/                    # real-issue body snippets for unit tests
└── .github/
    └── workflows/
        └── triage.yml                 # the Action workflow
```

### Pattern 1: remark-parse AST Walk for Heuristics

**What:** Parse the issue body with `unified().use(remarkParse).parse(body)`, then walk the resulting mdast with `unist-util-visit` to detect structural features.

**When to use:** Any structural feature detection (code presence, headings, images). Never use regex on raw markdown for these — raw markdown is ambiguous (backticks in prose ≠ code block).

**Relevant mdast node types:**

| Signal | mdast node type | Detection logic |
|--------|-----------------|-----------------|
| Code blocks present | `code` | Any `code` node (fenced or indented) |
| Stack trace | `code` | `code.lang` is `null`/`''` AND `code.value` matches `/\s+at\s+\S+\s*\(|Error:/` |
| Version/env mention | `text` in any block | Text value matches `/\bv?\d+\.\d+(\.\d+)?/i` or `/\bnode|npm|python|ruby/i` |
| Repro keywords | `heading` | Heading text (via `toString(node)`) matches `/repro|steps to|expected|actual/i` |
| Expected-vs-actual | `heading` | Two headings where combined text matches both "expected" and "actual" |
| Minimal example | `code` with lang | `code.lang` matches `/html|css|js|ts|python|ruby|go|rust|…/` |
| Screenshot/image-only | `image` | Body has `image` nodes but NO `code` nodes |

```typescript
// Source: https://github.com/remarkjs/remark [VERIFIED: Context7]
import remarkParse from 'remark-parse'
import { unified } from 'unified'
import { visit } from 'unist-util-visit'
import { toString } from 'mdast-util-to-string'

export function extractSignals(issue: Issue): Signals {
  const tree = unified().use(remarkParse).parse(issue.body ?? '')

  let hasCodeBlock = false
  let hasStackTrace = false
  let hasVersionMention = false
  let hasReproKeywords = false
  let hasExpectedActual = false
  let hasMinimalExample = false
  let hasImageOnly = false

  const headingTexts: string[] = []
  let codeCount = 0
  let imageCount = 0

  visit(tree, 'code', (node) => {
    codeCount++
    hasCodeBlock = true
    if (!node.lang && /at\s+\S+\s*\(|Error:/i.test(node.value)) {
      hasStackTrace = true
    }
    if (node.lang && node.lang.length > 0) {
      hasMinimalExample = true
    }
  })

  visit(tree, 'image', () => { imageCount++ })

  visit(tree, 'heading', (node) => {
    const text = toString(node).toLowerCase()
    headingTexts.push(text)
    if (/repro|steps to|to reproduce/i.test(text)) hasReproKeywords = true
  })

  // expected-vs-actual: need both "expected" and "actual" in headings
  const headingBlob = headingTexts.join(' ')
  if (/expected/i.test(headingBlob) && /actual/i.test(headingBlob)) {
    hasExpectedActual = true
  }

  // version: scan all text nodes for version-like patterns
  visit(tree, 'text', (node) => {
    if (/v?\d+\.\d+(\.\d+)?|node\s+\d|\bnpm\b|\bpython\b/i.test(node.value)) {
      hasVersionMention = true
    }
  })

  // image-only: images present, no code at all
  hasImageOnly = imageCount > 0 && codeCount === 0

  return {
    hasCodeBlock, hasStackTrace, hasVersionMention,
    hasReproKeywords, hasExpectedActual, hasMinimalExample, hasImageOnly
  }
}
```

### Pattern 2: Strategy Chain Interface

**What:** The checklist generator runs an ordered array of strategy objects. First one whose `applies()` returns true wins.

**When to use:** Any "fallback ladder" decision — avoids if/else chains that can't be independently tested.

```typescript
// Source: ARCHITECTURE.md — verified against design [VERIFIED: .planning/research/ARCHITECTURE.md]
export interface ChecklistStrategy {
  name: string
  applies(ctx: RepoContext): boolean
  generate(type: IssueType, signals: Signals): ChecklistItem[]
}

// Phase 1: only BaselineStrategy in the chain
const strategies: ChecklistStrategy[] = [
  new BaselineStrategy(),
]

export function generateChecklist(
  signals: Signals,
  type: IssueType,
  ctx: RepoContext,
): { items: ChecklistItem[]; tierUsed: string } {
  for (const s of strategies) {
    if (s.applies(ctx)) {
      return { items: s.generate(type, signals), tierUsed: s.name }
    }
  }
  // Unreachable if BaselineStrategy.applies() always returns true
  throw new Error('No strategy applied — BaselineStrategy must always apply')
}
```

### Pattern 3: Weighted Score Computation

**What:** Sum signal weights; clamp to 0–10; flag gray zone.

```typescript
// src/core/score/weights.ts
export const WEIGHTS = {
  hasCodeBlock:        1.5,
  hasStackTrace:       2.0,
  hasVersionMention:   1.5,
  hasReproKeywords:    1.5,
  hasExpectedActual:   1.5,
  hasMinimalExample:   2.0,
  hasImageOnly:       -1.0,  // negative: screenshot without context = low quality
} as const

export const GRAY_ZONE_LOW  = 4
export const GRAY_ZONE_HIGH = 6
export const MAX_SCORE      = 10

// src/core/score/compute.ts
export function computeScore(signals: Signals): { score: number; isGrayZone: boolean } {
  const raw = Object.entries(WEIGHTS).reduce((sum, [key, weight]) => {
    return sum + (signals[key as keyof Signals] ? weight : 0)
  }, 0)
  const score = Math.max(0, Math.min(MAX_SCORE, Math.round(raw)))
  return { score, isGrayZone: score >= GRAY_ZONE_LOW && score <= GRAY_ZONE_HIGH }
}
```

> Initial weights above are Claude's discretion (see Locked Decisions). Tune against benchmark in Phase 3.

### Pattern 4: Comment Idempotency — Find-then-Create-or-Update

**What:** Before posting, list all comments on the issue, find one containing `<!-- signal-oss:v1 -->`, and update it. If not found, create.

**Key Octokit calls:** [VERIFIED: Octokit REST docs]

```typescript
// src/adapters/github/io.ts
import * as github from '@actions/github'

const MARKER = '<!-- signal-oss:v1 -->'

export async function postOrUpdateComment(
  octokit: ReturnType<typeof github.getOctokit>,
  owner: string,
  repo: string,
  issueNumber: number,
  body: string,
): Promise<void> {
  // Step 1: list existing comments (paginate if issue is busy — unlikely for new issue)
  const { data: comments } = await octokit.rest.issues.listComments({
    owner, repo, issue_number: issueNumber,
    per_page: 100,
  })

  // Step 2: find existing signal-oss comment
  const existing = comments.find(c => c.body?.includes(MARKER))

  if (existing) {
    // Step 3a: update in-place
    await octokit.rest.issues.updateComment({
      owner, repo,
      comment_id: existing.id,
      body,
    })
  } else {
    // Step 3b: create new
    await octokit.rest.issues.createComment({
      owner, repo,
      issue_number: issueNumber,
      body,
    })
  }
}
```

**Note on pagination:** For new issues, 100 comments is sufficient. Phase 2 can add pagination if needed.

### Pattern 5: Comment Format — D-07 Structure

```typescript
// src/core/format/markdown.ts
export function format(scored: ScoredIssue): string {
  const { items, score, issueType } = scored

  const intro = items.length > 0
    ? `Thanks for opening this issue! To help us investigate, a few things seem to be missing:`
    : `This issue looks well-formed — no missing info detected.`

  const checklist = items.length > 0
    ? items.map(i => `- [ ] ${i.text}`).join('\n')
    : ''

  const badge = `**Actionability score:** ${score}/10`

  // Phase 1: meta-nudge always shown (no template detection yet)
  const metaNudge = `> **Tip:** adding an issue template to \`.github/ISSUE_TEMPLATE/\` helps reporters include the right information upfront.`

  const closing = items.length > 0
    ? `Once these are added, we'll take another look. Thanks for helping make this actionable!`
    : ``

  const marker = `<!-- signal-oss:v1 -->`

  return [intro, checklist, badge, metaNudge, closing, marker]
    .filter(Boolean)
    .join('\n\n')
}
```

**Tone check:** "Thanks for opening," "To help us investigate," "Could you share" — no "Required:", no "Must:", no "Invalid." [VERIFIED: CONTEXT.md D-06]

### Pattern 6: action.yml — Minimal Phase 1 Shape

```yaml
# action.yml
name: Signal-OSS Issue Triage
description: Scores GitHub issues for actionability and posts a missing-info checklist
author: signal-oss

# No inputs in Phase 1 — added in Phase 2

runs:
  using: 'node24'
  main: 'dist/index.js'
```

> No `inputs:` block in Phase 1 per CONTEXT.md (action inputs deferred to Phase 2 / ACT-07).
> The template already has `using: 'node24'` — just rename the action and drop the sample input. [VERIFIED: GitHub Actions docs, template]

### Pattern 7: Workflow YAML — Minimum Viable

```yaml
# .github/workflows/triage.yml  (in the SANDBOX repo, not the action repo)
name: Signal-OSS Issue Triage

on:
  issues:
    types: [opened, reopened]

permissions:
  contents: read
  issues: write

jobs:
  triage:
    runs-on: ubuntu-latest
    # Bot-loop guard at job level
    if: github.actor != 'github-actions[bot]'
    steps:
      - name: Triage issue
        uses: OWNER/signal-oss@main  # pin to SHA in production
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

> `permissions:` at workflow root sets default; job-level `if:` guard is the bot-loop prevention.
> `env: GITHUB_TOKEN` is passed explicitly to the Action (required — `@actions/github` reads it from env).
> [VERIFIED: GitHub Actions docs — issues event trigger and permissions]

### Pattern 8: main.ts — Orchestrator

```typescript
// src/action/main.ts
import * as core from '@actions/core'
import * as github from '@actions/github'
import { score } from '../core/index.js'
import { format } from '../core/format/markdown.js'
import { postOrUpdateComment } from '../adapters/github/io.js'

async function run(): Promise<void> {
  // Bot-loop guard (belt-and-suspenders beyond the workflow if: condition)
  if (github.context.actor === 'github-actions[bot]') {
    core.info('Bot actor detected — skipping to prevent loop')
    return
  }

  const payload = github.context.payload
  if (!payload.issue) {
    core.info('Not an issue event — skipping')
    return
  }

  const issue = {
    title:  payload.issue.title as string,
    body:   payload.issue.body ?? '',
    labels: (payload.issue.labels ?? []).map((l: { name: string }) => l.name),
  }

  // Phase 1: stub repo context (no template loading yet)
  const repoContext = {
    hasIssueForms:   false,
    hasMdTemplates:  false,
    hasContributing: false,
    templates:       [],
  }

  const scored = score(issue, repoContext, null)
  const body   = format(scored)

  const token  = core.getInput('github-token') || process.env.GITHUB_TOKEN!
  const octokit = github.getOctokit(token)
  const { owner, repo } = github.context.repo

  await postOrUpdateComment(octokit, owner, repo, payload.issue.number, body)
  core.info(`Signal-OSS comment posted for issue #${payload.issue.number} (score: ${scored.score})`)
}

run().catch(core.setFailed)
```

> `.js` extensions on imports are required when `moduleResolution: NodeNext`. [VERIFIED: TypeScript docs]

### Pattern 9: Vitest Config for GitHub Actions Project

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/**/*.test.ts'],
    exclude: ['dist/**'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/action/main.ts'],  // integration; tested via local-action
    },
  },
})
```

**Mocking `@actions/core` and `@actions/github`:**

```typescript
// tests/core/heuristics.test.ts — no mocks needed (pure functions)
import { describe, it, expect } from 'vitest'
import { extractSignals } from '../../src/core/heuristics/extractor.js'

describe('extractSignals', () => {
  it('detects fenced code block', () => {
    const signals = extractSignals({ title: 't', body: '```js\nfoo()\n```', labels: [] })
    expect(signals.hasCodeBlock).toBe(true)
  })
})

// tests/adapters/github.test.ts — mock @actions/github
import { vi, describe, it, expect, beforeEach } from 'vitest'

vi.mock('@actions/github', () => ({
  context: {
    actor: 'test-user',
    repo: { owner: 'owner', repo: 'repo' },
    payload: { issue: { number: 1, title: 'test', body: '', labels: [] } },
  },
  getOctokit: vi.fn(() => ({
    rest: {
      issues: {
        listComments: vi.fn().mockResolvedValue({ data: [] }),
        createComment: vi.fn().mockResolvedValue({}),
        updateComment: vi.fn().mockResolvedValue({}),
      },
    },
  })),
}))

vi.mock('@actions/core', () => ({
  getInput: vi.fn(),
  info: vi.fn(),
  debug: vi.fn(),
  setFailed: vi.fn(),
}))
```

> `vi.mock` is hoisted; works with ESM imports. [VERIFIED: Context7/vitest]

### Pattern 10: Biome Config (minimal)

```json
// biome.json
{
  "$schema": "https://biomejs.dev/schemas/2.0.0/schema.json",
  "vcs": { "enabled": true, "clientKind": "git", "useIgnoreFile": true },
  "files": { "ignoreUnknown": false },
  "formatter": { "enabled": true, "indentStyle": "space", "indentWidth": 2 },
  "organizeImports": { "enabled": true },
  "linter": {
    "enabled": true,
    "rules": { "recommended": true }
  },
  "javascript": { "formatter": { "quoteStyle": "single" } }
}
```

### Pattern 11: Template Bootstrap — Step-by-Step

**What the template gives you:**
- `src/index.ts` (sample action with `core.getInput('milliseconds')`)
- `action.yml` (using: node24, input: milliseconds)
- `rollup.config.ts` (Rollup ESM bundle → `dist/index.js`)
- `jest.config.js` + `__tests__/` + Jest as devDep
- `.eslintrc.cjs` + Prettier + related devDeps
- `tsconfig.json` (already NodeNext module resolution)
- `dist/` committed (NOT in .gitignore)
- `.github/workflows/ci.yml` (runs tests + lint on PR)

**Immediate changes in the first commit (D-01 + D-02):**

1. `npm uninstall jest @types/jest ts-jest eslint prettier` and related plugins
2. `npm install --save-dev vitest@4 @biomejs/biome@2`
3. Delete `jest.config.js`, `__tests__/`, `.eslintrc.cjs`, `.prettierrc`
4. Create `vitest.config.ts` (Pattern 9 above)
5. `npx @biomejs/biome init` → creates `biome.json`, then adjust to Pattern 10
6. Update `package.json` scripts:
   ```json
   "scripts": {
     "build": "tsc",
     "package": "rollup --config rollup.config.ts --configPlugin typescript",
     "bundle": "npm run format && npm run package",
     "test": "vitest run",
     "test:watch": "vitest",
     "coverage": "vitest run --coverage",
     "lint": "biome check src",
     "format": "biome format --write src",
     "all": "npm run format && npm run lint && npm run test && npm run coverage && npm run package",
     "local-action": "npx @github/local-action run . src/action/main.ts .env"
   }
   ```
7. Rename `src/index.ts` → `src/action/main.ts`, create `src/core/` directory structure
8. Update `rollup.config.ts` input: `'src/action/main.ts'`
9. Rebuild `dist/`: `npm run package`

**Critical:** `.gitignore` does NOT exclude `dist/` in the template. Verify `dist/` is committed. [VERIFIED: template .gitignore]

### Pattern 12: @github/local-action E2E Testing

**Installation and run:**

```bash
# No global install needed
npx @github/local-action run . src/action/main.ts .env
```

**`.env` file format (inputs as INPUT_* env vars + GitHub context):**

```bash
# .env  (not committed — add to .gitignore)
GITHUB_TOKEN=ghp_yourtoken
GITHUB_EVENT_NAME=issues
GITHUB_REPOSITORY=owner/repo
GITHUB_ACTOR=test-user

# Simulated issue payload — local-action reads GITHUB_EVENT_PATH
# Point to a fixture JSON file:
GITHUB_EVENT_PATH=./tests/fixtures/events/issues-opened.json
```

**Fixture event.json (`tests/fixtures/events/issues-opened.json`):**

```json
{
  "action": "opened",
  "issue": {
    "number": 42,
    "title": "App crashes on login",
    "body": "I get an error when I click login. Please fix.",
    "labels": [],
    "user": { "login": "test-user", "type": "User" }
  },
  "repository": {
    "owner": { "login": "owner" },
    "name": "repo",
    "full_name": "owner/repo"
  },
  "sender": { "login": "test-user", "type": "User" }
}
```

> Note: `@github/local-action` supports TypeScript source directly (no pre-compilation needed) and works with Node 22/24. It does NOT support pre-compiled `dist/index.js` — run it against `src/action/main.ts`. [VERIFIED: @github/local-action README]

### Anti-Patterns to Avoid

- **Importing Octokit or `fs` inside `src/core/`:** Breaks the hexagonal invariant; benchmark can never replay offline. Core must stay pure.
- **Using `pull_request_target` anywhere in v1:** Security pitfall; use `on: issues:` only.
- **Using a PAT instead of `GITHUB_TOKEN`:** PAT triggers downstream workflows → bot loop.
- **`vi.mock` outside a test file's top-level scope:** Vitest hoists `vi.mock` but only from test file top level. Put mock factories at file top.
- **Dynamic `import()` with ncc:** Not relevant since we're using Rollup, but noted for completeness.
- **Skipping `.js` extensions on imports:** NodeNext requires explicit `.js` on TS source imports. TypeScript resolves `.ts` files when you write `.js`. [VERIFIED: TypeScript docs]

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Markdown parsing | Regex-based code-block detection | `unified + remark-parse` | Backticks in prose, indented code blocks, nested content all break regex |
| mdast traversal | Recursive visitor | `unist-util-visit` | Handles all node types, nested structures, skip/remove signals |
| Heading text extraction | `node.children[0].value` | `mdast-util-to-string(node)` | Headings can have nested emphasis, links — `.children[0].value` misses them |
| Octokit type safety | `fetch()` with manual headers | `@actions/github` | Auth injection, GHES support, typed responses, rate-limit awareness |
| Module mocking in tests | Manual dependency injection for tests | `vi.mock()` | vi.mock is the standard; DI adds interface boilerplate |
| JSON schema from zod | `zod-to-json-schema` package | `z.toJSONSchema()` (zod 4 native) | Redundant in zod 4 |

**Key insight:** The AST walk is the most tempting hand-roll. The body `"```\nsome code\n```"` looks like regex-parseable. The edge cases are: indented code blocks (4-space), code inside blockquotes, code in nested list items. remark handles all of them; regex doesn't.

---

## Runtime State Inventory

**This is a greenfield project — no rename/migration involved.** No existing runtime state.

SKIPPED — not applicable for Phase 1 (greenfield build from template).

---

## Common Pitfalls

### Pitfall 1: Template Uses Rollup (not ncc) — CLAUDE.md says ncc

**What goes wrong:** CLAUDE.md recommends `@vercel/ncc 0.38.x`. The current `actions/typescript-action` template (as of 2026-05) uses **Rollup 4.x** and outputs ESM. Switching to ncc requires removing Rollup, changing the build script, and reconfiguring — costs ~45 minutes.

**Why it happens:** CLAUDE.md was written based on research that identified ncc as standard. The template migrated to Rollup (with ESM output) between the research date and now.

**How to avoid:** Use Rollup as-is from the template. It handles ESM-only deps (unified/remark-parse) natively since the output is ESM. Only switch to ncc if you encounter a bundling failure that Rollup can't handle (unlikely for this dep set).

**Warning signs:** If `npm run package` fails with ESM-related errors, check `rollup.config.ts` output format. It should be `format: 'es'`.

### Pitfall 2: Missing `.js` Extensions on Imports with NodeNext

**What goes wrong:** `import { score } from '../core/index'` fails at runtime. NodeNext requires explicit `.js` extensions.

**Why it happens:** TypeScript convention previously allowed extension-less imports. NodeNext strict resolution requires `.js`.

**How to avoid:** Always write `.js` even though the file is `.ts`. TypeScript resolves correctly. [VERIFIED: TypeScript docs]

```typescript
// WRONG
import { score } from '../core/index'
// RIGHT
import { score } from '../core/index.js'
```

### Pitfall 3: Bot-Loop If `github.actor` Check Is Only in Workflow YAML

**What goes wrong:** If the workflow is re-triggered (e.g., by reopened), and the `if:` condition is misconfigured, the Action runs twice and posts two comments.

**Why it happens:** Belt-and-suspenders is important for a bot. One guard in workflow YAML, one inside `main.ts`.

**How to avoid:** Two guards: (1) workflow-level `if: github.actor != 'github-actions[bot]'`, (2) `if (github.context.actor === 'github-actions[bot]') return` at the top of `main.ts`. The idempotency marker (ACT-05) is a third safety net — worst case, it updates in-place rather than creating a duplicate.

### Pitfall 4: Forgetting to Rebuild `dist/` After Code Changes

**What goes wrong:** Push to sandbox repo, Action runs old bundled code, test fails mysteriously.

**Why it happens:** `dist/` is committed but not auto-rebuilt.

**How to avoid:** Always run `npm run package` before committing. Add to the `bundle` script. Consider a pre-commit hook: `biome check src && vitest run && rollup --config`.

### Pitfall 5: `@github/local-action` Runs Source, not `dist/`

**What goes wrong:** `npx @github/local-action run . dist/index.js .env` → fails because local-action doesn't support pre-compiled dist.

**Why it happens:** local-action runs TypeScript source directly via a bundled TS runtime.

**How to avoid:** Always point local-action at `src/action/main.ts`, not `dist/index.js`. [VERIFIED: @github/local-action README]

### Pitfall 6: `unist-util-visit` Not Walking Into All Node Types

**What goes wrong:** `visit(tree, 'code', cb)` misses code blocks inside blockquotes or nested lists.

**Why it happens:** `unist-util-visit` does walk into all children recursively by default — this is NOT actually a problem. But if you call `.children` manually, you miss nested nodes.

**How to avoid:** Always use `visit()`, never manually traverse `.children`. visit is depth-first by default.

### Pitfall 7: Version/Env Detection False Positives

**What goes wrong:** "Please see version 2 of the docs" triggers `hasVersionMention = true` when it's not a version of the software.

**Why it happens:** Naive regex matches any `v\d+.\d+` pattern.

**How to avoid:** Combine: (1) the version pattern must be at word boundary, (2) look for context keywords (`node`, `npm`, `python`, `v\d+\.\d+\.\d+` — semver specificity), (3) weight slightly lower than code/stack signals since it's noisier. Initial weight 1.5 (Claude's discretion) is intentionally modest.

---

## Code Examples

### Full extractSignals Implementation Reference

```typescript
// Source: remark documentation [VERIFIED: Context7/remarkjs/remark]
// Pattern: parse once, visit multiple times (efficient)
import remarkParse from 'remark-parse'
import { unified } from 'unified'
import { visit } from 'unist-util-visit'
import { toString } from 'mdast-util-to-string'
import type { Root, Code, Heading, Image, Text } from 'mdast'

export function extractSignals(issue: Issue): Signals {
  const body = issue.body ?? ''
  const tree = unified().use(remarkParse).parse(body) as Root

  const state = {
    codeNodes: [] as Code[],
    headingTexts: [] as string[],
    imageCount: 0,
    textBlob: '',
  }

  visit(tree, 'code',    (n: Code)    => state.codeNodes.push(n))
  visit(tree, 'image',   ()           => state.imageCount++)
  visit(tree, 'heading', (n: Heading) => state.headingTexts.push(toString(n).toLowerCase()))
  visit(tree, 'text',    (n: Text)    => { state.textBlob += ' ' + n.value })

  const hasCodeBlock    = state.codeNodes.length > 0
  const hasStackTrace   = state.codeNodes.some(n =>
    !n.lang && /\s+at\s+[\w.<>]+\s*\(|^Error:/m.test(n.value))
  const hasMinimalExample = state.codeNodes.some(n => n.lang && n.lang.length > 0)
  const hasVersionMention = /\bv?\d+\.\d+\.\d+\b|\bnode\s*v?\d|\bnpm\s+v?\d|\bpython\s+\d/i.test(state.textBlob)
  const hasReproKeywords  = state.headingTexts.some(t => /repro|steps to|to reproduce/i.test(t))
  const hasExpectedActual = state.headingTexts.some(t => /expected/i.test(t)) &&
                            state.headingTexts.some(t => /actual/i.test(t))
  const hasImageOnly      = state.imageCount > 0 && state.codeNodes.length === 0

  return { hasCodeBlock, hasStackTrace, hasVersionMention, hasReproKeywords,
           hasExpectedActual, hasMinimalExample, hasImageOnly }
}
```

### Tier-4 Baseline Checklist Content

```typescript
// src/core/checklist/baselines.ts
// Note: exact text is Claude's discretion (D-05, D-06); these are reasonable starting values
export const BASELINE_ITEMS: Record<IssueType, readonly string[]> = {
  bug: [
    'Could you share the steps to reproduce the issue?',
    'Could you share the version of the library/tool you\'re using?',
    'Could you share any error messages or stack traces?',
    'Could you provide a minimal reproduction (a small code snippet or repo)?',
  ],
  feature: [
    'Could you describe the problem this feature would solve?',
    'Could you share example code showing how you\'d expect to use it?',
    'Could you describe any alternatives you\'ve considered?',
  ],
  question: [
    'Could you share what you\'ve already tried?',
    'Could you share the relevant version or environment details?',
    'Could you provide a minimal example that shows your setup?',
  ],
}
```

**Filtering logic:** Remove items that are already satisfied by `Signals`. E.g., if `signals.hasStackTrace === true`, remove the "error messages or stack traces" item. Keeps the checklist tight (D-05: 3–4 items).

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `@vercel/ncc` for bundling | Rollup 4.x (ESM output) in official template | ~2024-2025 template update | ESM-only deps (unified/remark) now bundle without shimming |
| `using: 'node20'` | `using: 'node24'` | Sep 2025 GitHub changelog | Node 20 → EOL Apr 2026; node24 is now the default for new actions |
| Jest + ESLint + Prettier in template | Jest + ESLint + Prettier (still in template — swap required) | Not changed yet | Manual swap to Vitest + Biome required per D-02 |
| `zod-to-json-schema` package | `z.toJSONSchema()` (built into zod 4) | zod 4.0 | Removes one dependency |
| `moduleResolution: node` | `moduleResolution: NodeNext` | TypeScript 4.7+ | Required for ESM-only packages |

**Template currently ships (as of 2026-05):**
- Jest 30 (still there — swap needed)
- ESLint 10 + Prettier (still there — swap needed)
- TypeScript 5.9.3
- Rollup 4.x (was ncc in older versions — already switched)
- `type: "module"` in package.json (ESM project by default)

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The current `actions/typescript-action` template uses Rollup (not ncc) and outputs ESM | Standard Stack, Pattern 11 | If template reverted to ncc, Rollup config section would need to be replaced with ncc install. Low risk — confirmed via direct fetch of template files. |
| A2 | `@github/local-action` runs TypeScript source directly (not compiled dist) | Common Pitfalls, Pattern 12 | If local-action requires dist, change the local-action command. Confirmed from README. |
| A3 | `dist/` is not in `.gitignore` in the template | Pattern 11 | If gitignored, must manually remove that entry; Action won't install without `dist/` committed. Confirmed from direct .gitignore fetch. |
| A4 | Initial per-signal weights (1.5/2.0) are reasonable starting values | Pattern 3 | If precision is poor in Phase 3 benchmark, adjust weights in `weights.ts`. These are explicitly Claude's discretion and will be tuned. |
| A5 | `remark-gfm` version 4.0.1 works with `remark-parse` 11.0.0 + `unified` 11.0.5 | Standard Stack | Version mismatch would cause AST parsing failures. Confirmed same semver major; ecosystem is aligned. |

---

## Open Questions

1. **Rollup vs. ncc: cold-start difference?**
   - What we know: Rollup outputs ESM; ncc outputs CJS. Both commit `dist/index.js`. Both load in <1s for a JS Action. Node 24 supports ESM natively.
   - What's unclear: Whether `using: 'node24'` with ESM output (`format: 'es'`) has any edge case vs. CJS. No known issues found.
   - Recommendation: Proceed with Rollup (template default). If cold-start tests exceed 10s p50, investigate.

2. **`@github/local-action` token behavior**
   - What we know: local-action emulates the GitHub toolkit. The `.env` file provides `GITHUB_TOKEN`.
   - What's unclear: Whether `octokit.rest.issues.createComment` actually hits the GitHub API in local-action mode (it likely does, using the real token).
   - Recommendation: Use a real token pointing to the sandbox repo for the local-action test. This is a live API test, not a dry-run.

3. **Image detection: `image` vs `html` node for `<img>` tags**
   - What we know: remark-parse produces `image` nodes for `![alt](url)` syntax.
   - What's unclear: GitHub issues also support `<img>` HTML. remark-parse produces `html` nodes for raw HTML.
   - Recommendation: For Phase 1, detect `image` nodes only (covers the common case). Phase 2 can add `html` node scan for `<img>` if the signal is noisy.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Action runtime | ✓ | (runner provides 24) | — |
| npm | Package install | ✓ | Bundled with Node | — |
| GitHub account + PAT | Sandbox repo creation | ✓ (developer has one) | — | — |
| `@github/local-action` | Local E2E testing | ✓ (via npx) | Latest | Push to sandbox only |

**Missing dependencies with no fallback:** None.

---

## Validation Architecture

> `nyquist_validation` is set to `false` in `.planning/config.json`. Formal Validation Architecture section is skipped.
> Informal coverage targets follow.

### Test Coverage per Component

| Component | Test File | Coverage Target | What It Tests |
|-----------|-----------|-----------------|---------------|
| `extractSignals()` | `tests/core/heuristics.test.ts` | 100% of signal flags | Each of 7 signals: true when present, false when absent; edge cases (empty body, body with only image, body with code but no lang) |
| `classifyType()` | `tests/core/classifier.test.ts` | Happy path + 3 ambiguous cases | Label precedence; title regex patterns `[BUG]`/`feat:`/`how do I`; body keyword fallback; default → bug |
| `BaselineStrategy.generate()` | `tests/core/checklist.test.ts` | 3 issue types × signal filtering | Bug checklist omits stack-trace item when `hasStackTrace=true`; question checklist always ≥1 item |
| `computeScore()` | `tests/core/score.test.ts` | Score range 0–10; gray-zone flag | All-false signals → score 0; all-true signals → score ≤ 10; score 4–6 → isGrayZone true |
| `format()` | `tests/core/format.test.ts` | Output shape + tone | No "Required:"/"Must:"; marker present; intro present; checklist items present when items.length > 0 |
| `postOrUpdateComment()` | `tests/adapters/github.test.ts` | Create vs. update branch | When listComments returns empty → createComment called; when marker found → updateComment called |
| `main.ts` (integration) | Local-action run + sandbox push | E2E smoke | Comment appears on sandbox issue; no duplicate on second run |

### Quick run commands (per-task validation)

```bash
# Unit tests (all pure-core tests, <5s)
npx vitest run tests/core/

# Full suite
npx vitest run

# Lint + format check
npx @biomejs/biome check src
```

---

## Security Domain

> `security_enforcement: true` in config. ASVS Level 1 applies.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | No user auth in this Action |
| V3 Session Management | No | Stateless Action |
| V4 Access Control | Partially | Bot-loop guard prevents recursive self-triggering |
| V5 Input Validation | Yes | Issue payload is untrusted input; `issue.body` is parsed structurally (AST, not eval); truncate to `max-body-bytes` in Phase 2 |
| V6 Cryptography | No | No secrets in Phase 1 |

### Known Threat Patterns for this Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Bot infinite loop via `github-actions[bot]` actor | Denial of service | Actor guard in workflow YAML + `main.ts`; `GITHUB_TOKEN` (not PAT) prevents downstream re-trigger |
| Overly-broad `permissions:` | Elevation of privilege | Explicit `permissions: contents: read, issues: write` only |
| Malicious issue body causing code execution | Tampering | AST parsing (structural) never evals body; body is opaque string in format() |
| `pull_request_target` misuse | Tampering / info disclosure | Not used at all in v1; `on: issues:` only |

> Prompt injection (OWASP LLM01) is not a Phase 1 concern — no LLM in Phase 1. Addressed in Phase 4.

---

## Sources

### Primary (HIGH confidence)
- [Context7: `/remarkjs/remark`] — AST node types, `unified().use(remarkParse).parse()`, `visit()` patterns [VERIFIED: Context7]
- [Context7: `/vitest-dev/vitest`] — `vi.mock()`, `vitest.config.ts`, globals config [VERIFIED: Context7]
- [Context7: `/websites/github_en_actions`] — `action.yml` manifest, permissions, issues event trigger [VERIFIED: Context7]
- [actions/typescript-action template](https://github.com/actions/typescript-action) — `rollup.config.ts`, `tsconfig.json`, `package.json`, `.gitignore` [VERIFIED: direct file fetch]
- [npm registry] — package versions: unified@11.0.5, remark-parse@11.0.0, vitest@4.1.5, @biomejs/biome@2.4.14, zod@4.4.3, @actions/core@3.0.1, @actions/github@9.1.1 [VERIFIED: npm view]
- [@github/local-action README](https://github.com/github/local-action) — run command, env file format, TS source requirement [VERIFIED: direct fetch]
- [Octokit REST issues API](https://octokit.github.io/rest.js/v21/) — `listComments`, `createComment`, `updateComment` parameters [VERIFIED: direct fetch]

### Secondary (MEDIUM confidence)
- [ARCHITECTURE.md](.planning/research/ARCHITECTURE.md) — hexagonal layout, shared CORE pattern, strategy chain interface [CITED: .planning/research/ARCHITECTURE.md]
- [PITFALLS.md](.planning/research/PITFALLS.md) — bot-loop, permissions block, cold-start pitfalls [CITED: .planning/research/PITFALLS.md]
- CLAUDE.md — full technology stack decisions (ncc → superseded by Rollup discovery; all other decisions confirmed) [CITED: CLAUDE.md]

### Tertiary (LOW confidence)
- WebSearch: ncc ESM handling — no definitive community solution found for unified+ncc; Rollup path preferred [ASSUMED based on template discovery]

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — npm versions verified; template files fetched directly
- Bundler (Rollup vs. ncc): HIGH — confirmed from direct template file fetch; this is the most impactful discovery
- Architecture patterns: HIGH — derived from locked ARCHITECTURE.md + confirmed against GitHub Actions docs
- Heuristic signal detection (AST node types): HIGH — confirmed against Context7/remarkjs docs
- Pitfalls: HIGH — derived from verified PITFALLS.md + GitHub Actions security docs
- Initial weights: LOW (Claude's discretion) — will be tuned in Phase 3

**Research date:** 2026-05-09
**Valid until:** 2026-06-09 (stable ecosystem; npm package versions may drift but semver majors are stable)

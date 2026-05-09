---
phase: 01-skeleton-heuristic-spine-first-comment
type: walking-skeleton
created: 2026-05-09
---

# Walking Skeleton: Signal-OSS Phase 1

## What Is The Walking Skeleton?

The thinnest possible end-to-end slice that proves the entire pipeline wires together: **GitHub `issues.opened` event → `score()` core function → markdown comment → posted to issue via Octokit**.

The skeleton ships in **two stages within Phase 1**:

1. **Stage A (Plan 02 — DTO + Stub):** A `score()` stub that returns hardcoded values is wired all the way through `format()` and a stub `main.ts`. `npm run package` succeeds and produces `dist/index.js`. This proves the wiring works before any heuristics exist.
2. **Stage B (Plan 05 — Real Wiring):** The stub is replaced by the real heuristic pipeline (built in Plans 03 + 04). The Action posts a real Tier-4 baseline checklist comment on a sandbox repo issue.

By end of Phase 1, the skeleton is fleshed out: heuristics, classifier, checklist, score, format, and Octokit I/O are all real.

---

## The Slice (End State of Phase 1)

```
GitHub webhook: issues.opened
       │
       ▼
src/action/main.ts  (~30 lines)
  ├── if (github.context.actor === 'github-actions[bot]') return     ← bot-loop guard (ACT-04)
  ├── parse payload.issue → Issue DTO
  ├── stub RepoContext { hasIssueForms: false, hasMdTemplates: false, hasContributing: false, templates: [] }
  └── score(issue, repoContext, null)                                ← LLM = null (Phase 1)
       │
       ▼
src/core/index.ts  score(issue, repoContext, llm)   ← PURE, zero I/O
  ├── extractSignals(issue)        → Signals (7 booleans)
  ├── classifyType(issue, signals) → IssueType ('bug' | 'feature' | 'question')
  ├── generateChecklist(signals, type, ctx) → ChecklistItem[]   ← BaselineStrategy only
  ├── computeScore(signals)        → { score, isGrayZone }
  └── return ScoredIssue { score, missing, signals, issueType, isGrayZone, items }
       │
       ▼
src/core/format/markdown.ts  format(scored) → string
  ├── intro (D-07)
  ├── checklist items (front-and-center)
  ├── score badge
  ├── meta-nudge stub (D-08, always shown in Phase 1)
  ├── closing
  └── <!-- signal-oss:v1 --> marker
       │
       ▼
src/adapters/github/io.ts  postOrUpdateComment(...)
  ├── octokit.rest.issues.listComments
  ├── find comment containing '<!-- signal-oss:v1 -->'
  ├── if found → updateComment
  └── if not   → createComment
       │
       ▼
GitHub issue: comment posted
```

---

## Architectural Decisions (Locked for All Future Phases)

These are decisions made by Phase 1 that subsequent phases inherit without renegotiation.

### A1. Build & Bundle
- **Framework:** Bootstrap from `actions/typescript-action` (D-01)
- **Bundler:** **Rollup 4.x** (template default — NOT @vercel/ncc as CLAUDE.md originally stated)
- **Output:** ESM `dist/index.js` (`format: 'es'` in `rollup.config.ts`)
- **Why ESM:** unified/remark-parse are ESM-only; ESM output bundles them natively without shimming
- **Module resolution:** `NodeNext` in `tsconfig.json` (D-03 — already pre-set by template)
- **Import extensions:** all TS imports must use `.js` extensions (e.g., `import { score } from '../core/index.js'`) — NodeNext requirement
- **`dist/` is committed** (D-04, ACT-01) — required for installability without a build step

### A2. Test & Lint Toolchain
- **Test runner:** Vitest 4.x (D-02 — replaces template's Jest)
- **Linter/formatter:** Biome 2.x (D-02 — replaces template's ESLint+Prettier)
- **Test environment:** `node` (set in `vitest.config.ts`)
- **Mocking:** `vi.mock('@actions/core')` and `vi.mock('@actions/github')` at the top of each test file that touches them

### A3. Hexagonal Architecture (Ports & Adapters)
- **`src/core/`** — PURE: zero imports from `@octokit/*`, `@actions/*`, `fs`, `https`, `@anthropic-ai/sdk`, or `openai`. Verifiable by grep.
- **`src/adapters/`** — side-effect zone: Octokit + (Phase 4) LLM SDKs.
- **`src/action/main.ts`** — ~30-line orchestrator.
- **`src/bench/`** — (Phase 3+) calls the same `score()` from `src/core/`.
- **The `score()` entrypoint signature is locked:** `score(issue, repoContext, llm = null) → ScoredIssue`. Signature MUST NOT change in Phase 2+.

### A4. Action Runtime
- **Node version:** `using: 'node24'` in `action.yml`
- **Trigger scope (v1):** `on: issues: types: [opened, reopened]` ONLY. Never `pull_request_target`. Never `issue_comment` in v1.
- **Permissions:** explicit `{ contents: read, issues: write }` — minimum grant
- **Auth:** `GITHUB_TOKEN` ONLY — never PAT (PAT triggers downstream workflows → bot loop)
- **Bot-loop guards (belt-and-suspenders):** workflow-level `if: github.actor != 'github-actions[bot]'` AND `main.ts` early-return on same condition
- **Idempotency:** `<!-- signal-oss:v1 -->` HTML marker — find-existing-then-update (ACT-05)

### A5. Directory Layout
```
signal-oss/
├── action.yml                         # using: 'node24'; no inputs in Phase 1
├── package.json                       # "type": "module"
├── tsconfig.json                      # NodeNext module resolution
├── rollup.config.ts                   # template default; output: 'dist/index.js', format: 'es'
├── vitest.config.ts
├── biome.json
├── dist/index.js                      # COMMITTED
├── src/
│   ├── core/
│   │   ├── types.ts                   # ALL DTOs in one file
│   │   ├── index.ts                   # score() entrypoint
│   │   ├── llm/port.ts                # LLMPort interface (stubbed Phase 1, real Phase 4)
│   │   ├── heuristics/extractor.ts    # extractSignals()
│   │   ├── classifier/issue-type.ts   # classifyType()
│   │   ├── checklist/
│   │   │   ├── generator.ts           # strategy chain runner
│   │   │   ├── strategies/baseline.ts # Tier 4 (Phase 1)
│   │   │   └── baselines.ts           # BASELINE_ITEMS const
│   │   ├── score/
│   │   │   ├── compute.ts
│   │   │   └── weights.ts             # WEIGHTS, GRAY_ZONE_LOW/HIGH
│   │   └── format/markdown.ts         # format()
│   ├── adapters/
│   │   └── github/io.ts               # postOrUpdateComment()
│   └── action/
│       └── main.ts                    # orchestrator
├── tests/
│   ├── core/
│   │   ├── heuristics.test.ts
│   │   ├── classifier.test.ts
│   │   ├── checklist.test.ts
│   │   ├── score.test.ts
│   │   └── format.test.ts
│   ├── adapters/github.test.ts
│   └── fixtures/events/issues-opened.json
└── .github/workflows/
    └── triage.yml                     # the workflow (also placed in sandbox repo)
```

### A6. DTOs (Locked in `src/core/types.ts`)

```typescript
export interface Issue {
  title: string;
  body: string;
  labels: string[];
}

export interface Signals {
  hasCodeBlock: boolean;
  hasStackTrace: boolean;
  hasVersionMention: boolean;
  hasReproKeywords: boolean;
  hasExpectedActual: boolean;
  hasMinimalExample: boolean;
  hasImageOnly: boolean;
}

export type IssueType = 'bug' | 'feature' | 'question';

export interface RepoContext {
  hasIssueForms: boolean;
  hasMdTemplates: boolean;
  hasContributing: boolean;
  templates: unknown[];   // Phase 2 fleshes this out
}

export interface ChecklistItem {
  text: string;
  signalKey?: keyof Signals;   // optional: which signal would satisfy this
}

export interface ScoredIssue {
  score: number;            // 0–10 integer
  missing: string[];        // human-readable list of missing things
  signals: Signals;
  issueType: IssueType;
  isGrayZone: boolean;
  items: ChecklistItem[];   // checklist items rendered in the comment
  tierUsed: string;         // e.g., 'baseline' (Phase 1)
}

export interface LLMPort {
  adjudicate(req: { issue: Issue; signals: Signals; repoContext: RepoContext }): Promise<{ score: number; rationale: string; missing: string[] }>;
}
```

These DTOs are the load-bearing contract. **Phase 2+ may EXTEND them but MUST NOT BREAK them.**

---

## What's NOT in the Skeleton (Deferred)

- Repo-context loading (Tier 1/2 template parsing, Octokit.getContent) → Phase 2
- Idempotency hardening (24h soak, `issues.edited` trigger) → Phase 2
- Label management (`needs-info` auto-create/apply/remove) → Phase 2
- Action inputs (`dry-run`, `enable-comments`, etc.) → Phase 2
- Span/offset metadata in Signals DTO → Phase 2
- LLM adjudicator wiring → Phase 4
- Benchmark harness → Phase 3

---

## Hero Output Invariant

**The Tier-4 baseline checklist comment MUST post even if every other layer fails.**

This invariant is established in Phase 1 and held forever:
- LLM down? Comment posts (heuristics-only path).
- No issue templates? Comment posts (Tier 4 baseline always applies).
- High-quality issue? Comment posts ("This issue looks well-formed — no missing info detected.").

The hero output is the architectural floor.

---

*Walking Skeleton defined: 2026-05-09*

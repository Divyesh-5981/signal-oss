# Phase 3: Benchmark + Heuristic Tuning - Research

**Researched:** 2026-05-15
**Domain:** OSS Issue Scraping, Benchmark Harness, Precision/Recall Metrics, Heuristic Tuning
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Scrape `microsoft/vscode`, `facebook/react`, `rust-lang/rust` — 3 repos, 100–200 issues total
- **D-02:** Pre-approved fallback: 50 issues × 3 repos; same repos, only `--limit` flag changes — no code changes
- **D-03:** "Slop" proxy = any of `invalid`, `duplicate`, `wontfix`, `needs-info` labels present; all others = "actionable"
- **D-04:** Labeling rules frozen at scrape time; no post-scrape adjustments
- **D-05:** κ-audit on N=30 manual labels; Cohen's κ reported as transparency, not gated
- **D-06:** Deterministic seeded 70/30 split (seed=42), computed at scrape time, written alongside fixtures; 30% never inspected during tuning
- **D-07:** Manual tuning — replay prints per-signal confusion matrix on training split; developer edits `weights.ts` directly
- **D-08:** Tuning loop: `tsx scripts/benchmark.ts --no-llm --split train` → inspect → edit → repeat; final run `--split test`
- **D-09:** Scrape all closed issues; `classifyType()` assigns types at replay time
- **D-10:** `bench/REPORT.md` reports precision, recall, F1 per type + overall; 95% Wilson CIs when N≥30 per bucket; total N; threshold used
- **D-11:** Threshold = value that maximizes F1 on training split; applied unchanged to test split

### Claude's Discretion

- Exact `bench/fixtures/` directory layout (one JSON per issue vs. one file per repo)
- Concurrency limit for Octokit calls (suggest `p-limit(5)`)
- CSV vs. JSON intermediate format for replay pipeline
- Exact markdown table structure in `bench/REPORT.md`
- Which N=30 κ-audit issues to manually label (suggest: stratified sample, balanced slop/actionable)

### Deferred Ideas (OUT OF SCOPE)

- `--with-llm` mode actual implementation (Phase 4 wires it; Phase 3 accepts the flag and no-ops it)
- `issues.edited` trigger re-evaluation
- Pagination edge case in `io.ts`
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| BENCH-01 | Scraper harness — Octokit + `@octokit/plugin-throttling`; `--repos`/`--limit` flags; caches to `bench/fixtures/` | Octokit paginate + plugin-throttling wiring verified; `node:util.parseArgs` confirmed for CLI flags |
| BENCH-02 | Ground-truth proxy — label-presence at close time; slop = `invalid`/`duplicate`/`wontfix`/`needs-info` | GitHub REST API `issue.labels` field is current labels; used as close-time proxy (validated by κ-audit); no timeline-events parsing needed |
| BENCH-03 | 70/30 deterministic seeded split frozen at scrape time; held-out 30% never seen during tuning | Mulberry32 + Fisher-Yates seeded shuffle verified in Node 24; split persisted as JSON manifest alongside fixtures |
| BENCH-04 | Replay calls same `score()` from `src/core/`; supports `--no-llm` and `--with-llm` | `score(issue, repoContext, null)` call confirmed; `--with-llm` stubs as no-op in Phase 3 |
| BENCH-05 | Precision/recall/F1 per type + overall; 95% Wilson CIs; committed `bench/REPORT.md` | Wilson formula verified in Node 24; per-signal confusion matrix output design documented |
| BENCH-06 | κ-audit: N=30 manual labels; Cohen's κ between proxy and manual | Cohen's κ formula verified; no external library needed |
| BENCH-07 | Pre-approved fallback: 50 × 3 repos; harness shape unchanged | `--limit` flag via `node:util.parseArgs`; no code change required |
</phase_requirements>

---

## Summary

Phase 3 builds a three-component pipeline: (1) a scraper that pulls closed issues from the three target repos into `bench/fixtures/` via Octokit with rate-limit protection, (2) a replay harness that calls the production `score()` entrypoint against those fixtures and computes classification metrics, and (3) a manual tuning loop where per-signal confusion matrix output guides direct edits to `src/core/score/weights.ts`.

The central correctness invariant is the train/test contamination firewall. The 70/30 seeded split is computed once at scrape time, written as a manifest file alongside fixtures, and the 30% test indices are never consumed until the final reporting run. Git history is the audit trail: `weights.ts` commits must precede any `--split test` invocation. All math (Wilson CIs, Cohen's κ, F1-threshold search) is implementable in pure TypeScript with no external statistics library.

The ground-truth proxy deserves explicit attention: the GitHub REST API returns **current** labels on closed issues, not a snapshot from close time. For the three target repos (`microsoft/vscode`, `facebook/react`, `rust-lang/rust`), triage labels (`invalid`, `needs-info`, `duplicate`) are rarely removed after application — but this is an assumption, not a guarantee. The κ-audit is precisely the mechanism that validates this proxy quality empirically.

**Primary recommendation:** Single `scripts/benchmark.ts` entry point for scrape + replay + report; sub-commands via `--mode scrape|replay|report`; fixtures stored as `bench/fixtures/{owner}-{repo}/{number}.json`; split manifest at `bench/fixtures/split.json`.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Issue scraping | Script (`scripts/benchmark.ts`) | — | I/O shell; src/core stays pure |
| Ground-truth labeling | Script (at scrape time) | — | Baked into fixture JSON; not a runtime concern |
| Train/test split | Script (at scrape time) | — | Written to `bench/fixtures/split.json`; read-only at replay time |
| Heuristic scoring | `src/core/score()` | — | Production entrypoint; benchmark calls directly, no duplication |
| Issue type classification | `src/core/classifier/classifyType()` | — | Same production code; called at replay time |
| Metrics computation | Script (replay phase) | — | Pure math; no external stats lib |
| Report generation | Script (report phase) | — | Writes `bench/REPORT.md` as markdown |
| Weight tuning | Developer edits `src/core/score/weights.ts` | — | Manual; guided by per-signal confusion matrix |

---

## Standard Stack

### New Dependencies for Phase 3

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@octokit/rest` | **22.0.1** | GitHub REST API client for scraper | Includes Octokit core + paginate; standalone (not `@actions/github` which is only for Action runtime) |
| `@octokit/plugin-throttling` | **11.0.3** | Auto-backoff on primary and secondary rate limits | Required by BENCH-01; official Octokit plugin; peer-dep is `@octokit/core@^7.0.0` — satisfied by `@octokit/rest@22` |
| `p-limit` | **7.3.0** | Cap concurrent Octokit calls | ESM-only; CLAUDE.md recommended; prevents 5000/hr GitHub quota exhaustion |
| `tsx` | **4.22.0** | Run `scripts/benchmark.ts` directly via `tsx scripts/benchmark.ts` | No compile step; CLAUDE.md-blessed; handles NodeNext .js imports transparently |

**Version verification (confirmed via npm registry):** [VERIFIED: npm registry 2026-05-15]
- `@octokit/rest`: 22.0.1
- `@octokit/plugin-throttling`: 11.0.3 (peer: `@octokit/core@^7.0.0`)
- `@octokit/core`: 7.0.6 (transitive via `@octokit/rest`)
- `p-limit`: 7.3.0
- `tsx`: 4.22.0

### Existing Dependencies Already in `package.json`

| Library | Version | Role in Phase 3 |
|---------|---------|-----------------|
| `vitest` | ^4.1.5 | Unit tests for metrics functions (Wilson CI, κ, F1-threshold) |
| `zod` | ^4.4.3 | Validate fixture JSON schema at load time |
| `typescript` | ^5.9.0 | Already installed; `tsx` uses it |

### Not Needed (Explicit Exclusions)

| Excluded | Reason |
|----------|--------|
| `globby` | Node 24 has `fs.glob` (experimental but functional); simpler to use `fs.readdir` with manual filter for the fixture directory layout |
| Python stats libraries | All math implemented in TypeScript: no external stats lib needed |
| `simple-statistics` npm | Wilson CI and Cohen's κ are 5-line formulas; adding a dep for 10 lines of math is unnecessary |

**Installation:**
```bash
npm install --save-dev @octokit/rest @octokit/plugin-throttling p-limit tsx
```

Note: `@octokit/rest` and `@octokit/plugin-throttling` are dev-only — the benchmark script is never bundled into `dist/index.js`. [VERIFIED: package.json; benchmark is `scripts/`, not `src/action/`]

---

## Architecture Patterns

### System Architecture Diagram

```
CLI Entry
scripts/benchmark.ts --mode scrape --repos ... --limit N
       │
       ▼
┌─────────────────────────────────────────────────────┐
│  SCRAPER (src/bench/scraper.ts)                     │
│                                                      │
│  Octokit + @octokit/plugin-throttling               │
│  ┌─────────────────────────────────────────────┐    │
│  │  paginate(issues.listForRepo, {state:closed})│    │
│  │  → per_page:100, up to --limit total        │    │
│  └─────────────────────────────────────────────┘    │
│        │                                             │
│        ▼                                             │
│  p-limit(5) concurrent repo scrapes                 │
│        │                                             │
│        ▼                                             │
│  Ground-truth labeling (hasSlop label check)        │
│        │                                             │
│        ▼                                             │
│  Write bench/fixtures/{owner}-{repo}/{number}.json  │
│  Write bench/fixtures/split.json  (70/30 manifest)  │
└─────────────────────────────────────────────────────┘

CLI Entry
scripts/benchmark.ts --mode replay --no-llm --split train
       │
       ▼
┌─────────────────────────────────────────────────────┐
│  REPLAY HARNESS (src/bench/replay.ts)               │
│                                                      │
│  Load fixtures by split index from split.json       │
│        │                                             │
│        ▼                                             │
│  For each fixture:                                   │
│    issue = toIssueDTО(fixture)                      │
│    scored = score(issue, MINIMAL_REPO_CTX, null)    │  ← src/core/index.ts
│    predicted = scored.score <= threshold ? 1 : 0    │
│    ground_truth = fixture.isSlop ? 1 : 0            │
│        │                                             │
│        ▼                                             │
│  Accumulate confusion matrix                        │
└─────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────┐
│  METRICS + REPORT (src/bench/metrics.ts)            │
│                                                      │
│  findOptimalThreshold(trainPredictions)             │
│  → threshold that maximizes F1 on train split       │
│                                                      │
│  computeMetrics(predictions, threshold)             │
│  → {precision, recall, F1} per type + overall       │
│  → Wilson 95% CI on each proportion                 │
│                                                      │
│  computeKappa(proxyLabels, manualLabels)            │
│                                                      │
│  renderReport() → bench/REPORT.md                  │
└─────────────────────────────────────────────────────┘
```

### Recommended Project Structure

```
scripts/
└── benchmark.ts         # Entry point — delegates to src/bench/*

src/bench/
├── scraper.ts           # Octokit + throttling + caching logic
├── replay.ts            # Load fixtures, call score(), accumulate matrix
├── metrics.ts           # Wilson CI, Cohen's κ, F1-threshold search, report rendering
└── types.ts             # BenchmarkFixture, SplitManifest, ConfusionMatrix DTOs

bench/
├── fixtures/
│   ├── microsoft-vscode/  # {number}.json per issue
│   ├── facebook-react/
│   ├── rust-lang-rust/
│   └── split.json         # {train: number[], test: number[]} indexed into fixture list
└── REPORT.md              # Final committed output
```

**Rationale for `src/bench/` not `scripts/`:** Keeps logic testable with Vitest; the `scripts/benchmark.ts` entry point is thin (CLI parsing only). [ASSUMED — consistent with project hexagonal pattern but could go either way]

### Pattern 1: Octokit + plugin-throttling Setup

**What:** Compose `@octokit/rest` with `@octokit/plugin-throttling` using the `.plugin()` API.
**When to use:** Whenever making GitHub API calls in the benchmark scraper.

```typescript
// Source: @octokit/plugin-throttling README (github.com/octokit/plugin-throttling.js)
import { Octokit } from '@octokit/rest'
import { throttling } from '@octokit/plugin-throttling'

const ThrottledOctokit = Octokit.plugin(throttling)

export function createOctokit(token: string): InstanceType<typeof ThrottledOctokit> {
  return new ThrottledOctokit({
    auth: token,
    throttle: {
      onRateLimit: (retryAfter, options, octokit, retryCount) => {
        octokit.log.warn(`Rate limit hit: ${options.method} ${options.url}`)
        if (retryCount < 2) {
          octokit.log.info(`Retrying after ${retryAfter}s (attempt ${retryCount + 1})`)
          return true  // retry
        }
      },
      onSecondaryRateLimit: (retryAfter, options, octokit) => {
        // Secondary rate limit (80/min) — log but do not retry; p-limit handles spacing
        octokit.log.warn(`Secondary rate limit: ${options.method} ${options.url}`)
      },
    },
  })
}
```

[VERIFIED: @octokit/plugin-throttling README, confirmed via WebFetch 2026-05-15]

### Pattern 2: Paginated Issue Scrape with Limit

**What:** Fetch up to `--limit` closed issues using `octokit.paginate.iterator` for memory-efficient streaming with early exit.
**When to use:** Scraping phase.

```typescript
// Source: @octokit/rest Context7 docs — paginate iterator pattern
import pLimit from 'p-limit'

const limit = pLimit(5)  // max 5 concurrent repo scrapes

async function scrapeRepo(
  octokit: ThrottledOctokit,
  owner: string,
  repo: string,
  maxIssues: number
): Promise<RawIssue[]> {
  const collected: RawIssue[] = []

  for await (const response of octokit.paginate.iterator(
    octokit.rest.issues.listForRepo,
    { owner, repo, state: 'closed', per_page: 100 }
  )) {
    for (const issue of response.data) {
      if (collected.length >= maxIssues) break
      // Skip pull requests (they appear in issues endpoint too)
      if (issue.pull_request) continue
      collected.push(issue)
    }
    if (collected.length >= maxIssues) break
  }
  return collected
}
```

[VERIFIED: @octokit/rest Context7 docs confirmed paginate.iterator pattern 2026-05-15]

**Key pitfall:** The `GET /repos/{owner}/{repo}/issues` endpoint returns both issues AND pull requests when state=closed. Must filter `issue.pull_request !== undefined` to skip PRs. [VERIFIED: GitHub REST API docs]

### Pattern 3: Seeded 70/30 Split

**What:** Mulberry32 PRNG + Fisher-Yates shuffle for deterministic, reproducible split.
**When to use:** Once at scrape time; result written to `split.json`.

```typescript
// Source: verified in Node 24 REPL — no external library needed
function mulberry32(seed: number): () => number {
  return () => {
    seed = (seed + 0x6D2B79F5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function seededSplit(
  items: string[],  // fixture file paths
  seed: number = 42,
  trainFraction: number = 0.7
): { train: string[]; test: string[] } {
  const rng = mulberry32(seed)
  const shuffled = [...items]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!]
  }
  const trainN = Math.floor(shuffled.length * trainFraction)
  return { train: shuffled.slice(0, trainN), test: shuffled.slice(trainN) }
}
```

[VERIFIED: Node 24 REPL — Mulberry32 produces identical results across runs with same seed 2026-05-15]

### Pattern 4: Calling score() from Benchmark

**What:** Map raw GitHub issue JSON to the `Issue` DTO and call `score()` with a minimal `RepoContext`.
**When to use:** Replay phase.

```typescript
// Source: src/core/index.ts, src/core/types.ts — read directly from codebase
import { score } from '../core/index.js'
import type { Issue, RepoContext } from '../core/types.js'

// Minimal RepoContext for benchmark — no templates loaded from disk
const BENCH_REPO_CTX: RepoContext = {
  hasIssueForms: false,
  hasMdTemplates: false,
  hasContributing: false,
  templates: [],
}

function toIssueDTO(raw: RawGithubIssue): Issue {
  return {
    title: raw.title ?? '',
    body: raw.body ?? '',
    labels: (raw.labels ?? []).map((l) =>
      typeof l === 'string' ? l : (l.name ?? '')
    ),
  }
}

// In replay loop:
const dto = toIssueDTO(fixture.raw)
const result = score(dto, BENCH_REPO_CTX, null)  // null = heuristics-only
const predicted = result.score <= threshold ? 'slop' : 'actionable'
```

[VERIFIED: src/core/index.ts, src/core/types.ts read directly 2026-05-15]

**Important:** `score()` is synchronous and pure. No async needed. The `llm` parameter is `null` for `--no-llm` mode (Phase 3). The `void llm` line in `src/core/index.ts` confirms this is the intended Phase 3 path.

### Pattern 5: Wilson Confidence Interval

**What:** 95% CI on a proportion (precision or recall) where the count is the denominator.

```typescript
// Source: Wikipedia Binomial proportion confidence interval; verified in Node 24 REPL
export function wilsonCI(
  successes: number,
  n: number,
  z = 1.96  // 95% CI
): { lower: number; upper: number } {
  if (n === 0) return { lower: 0, upper: 0 }
  const p = successes / n
  const z2 = z * z
  const center = (p + z2 / (2 * n)) / (1 + z2 / n)
  const halfWidth =
    (z / (1 + z2 / n)) * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))
  return {
    lower: Math.max(0, center - halfWidth),
    upper: Math.min(1, center + halfWidth),
  }
}
// Example: wilsonCI(80, 100) → {lower: 0.7112, upper: 0.8666}
```

[VERIFIED: Node 24 REPL — result matches expected Wikipedia formula 2026-05-15]

**Apply to precision and recall separately:** Precision = TP / (TP + FP); Recall = TP / (TP + FN). Report `[lower, upper]` at 95% when N≥30.

### Pattern 6: Cohen's κ

**What:** Measure agreement between proxy labels and manual labels for κ-audit.

```typescript
// Source: Wikipedia Cohen's kappa; verified in Node 24 REPL
// confusion matrix: tp=both-slop, fp=proxy-slop-manual-actionable, fn=proxy-actionable-manual-slop, tn=both-actionable
export function cohensKappa(tp: number, fp: number, fn: number, tn: number): number {
  const n = tp + fp + fn + tn
  if (n === 0) return 0
  const po = (tp + tn) / n
  const pe =
    (((tp + fp) * (tp + fn)) + ((tn + fp) * (tn + fn))) / (n * n)
  return (po - pe) / (1 - pe)
}
// κ=1.0: perfect; κ≥0.8: strong; κ≥0.6: moderate; κ<0.4: poor
```

[VERIFIED: Node 24 REPL — formula produces correct results 2026-05-15]

### Pattern 7: F1-Optimal Threshold

**What:** Scan all candidate thresholds on training split; pick the one maximizing F1.

```typescript
// Source: verified in Node 24 REPL
export function findOptimalThreshold(
  predictions: Array<{ score: number; isSlop: boolean }>
): { threshold: number; f1: number } {
  // Try every integer 0-10 (score range) as candidate threshold
  const candidates = Array.from({ length: 11 }, (_, i) => i)
  let best = { threshold: 5, f1: 0 }

  for (const t of candidates) {
    let tp = 0, fp = 0, fn = 0
    for (const p of predictions) {
      const pred = p.score <= t
      if (pred && p.isSlop) tp++
      else if (pred && !p.isSlop) fp++
      else if (!pred && p.isSlop) fn++
    }
    const precision = tp + fp > 0 ? tp / (tp + fp) : 0
    const recall = tp + fn > 0 ? tp / (tp + fn) : 0
    const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0
    if (f1 > best.f1) best = { threshold: t, f1 }
  }
  return best
}
```

[VERIFIED: Node 24 REPL — scan finds threshold correctly 2026-05-15]

### Pattern 8: Per-Signal Confusion Matrix (Tuning Aid)

**What:** For each signal in `Signals`, compute TP rate when signal fires and issue is slop (to spot over/under-firers).

```typescript
// The tuning aid — not a stored metric, printed to stdout during --split train runs
export function printSignalAnalysis(
  fixtures: BenchmarkFixture[],
  threshold: number
): void {
  const signalKeys: (keyof Signals)[] = [
    'hasCodeBlock', 'hasStackTrace', 'hasVersionMention',
    'hasReproKeywords', 'hasExpectedActual', 'hasMinimalExample', 'hasImageOnly'
  ]
  for (const key of signalKeys) {
    const fires = fixtures.filter(f => f.signals[key])
    const firesOnSlop = fires.filter(f => f.isSlop)
    const firesOnActionable = fires.filter(f => !f.isSlop)
    console.log(`${key.padEnd(22)} fires=${fires.length} | on-slop=${firesOnSlop.length} | on-actionable=${firesOnActionable.length}`)
  }
}
```

### Pattern 9: CLI Flag Parsing

**What:** Node 24 stdlib `parseArgs` — no external library.
**When to use:** `scripts/benchmark.ts` top-level.

```typescript
// Source: Node 24 REPL — parseArgs confirmed available
import { parseArgs } from 'node:util'

const { values } = parseArgs({
  options: {
    mode:      { type: 'string', default: 'scrape' },   // 'scrape' | 'replay' | 'report'
    repos:     { type: 'string' },                       // 'owner/repo,owner/repo'
    limit:     { type: 'string', default: '200' },       // per-repo
    'no-llm':  { type: 'boolean', default: false },
    'with-llm':{ type: 'boolean', default: false },
    split:     { type: 'string', default: 'train' },     // 'train' | 'test' | 'all'
    token:     { type: 'string' },                       // GITHUB_TOKEN fallback
  },
  strict: true,
})
const token = values.token ?? process.env['GITHUB_TOKEN'] ?? ''
```

[VERIFIED: Node 24 REPL — parseArgs handles all required flags correctly 2026-05-15]

### Anti-Patterns to Avoid

- **Calling score() on test split before tuning is done:** The script must enforce `--split test` outputs a prominent warning if `weights.ts` was modified after split.json was written. [ASSUMED — git history is the real guard, but a warning is good UX]
- **Storing `split.json` indices as fixture-order-dependent integers:** Use fixture file paths as stable keys; index into a sorted array to get the split. Order must be deterministic before shuffling.
- **Ignoring pull requests in the issues endpoint:** `GET /repos/{owner}/{repo}/issues?state=closed` returns both issues and PRs. Skip when `issue.pull_request !== undefined`. [VERIFIED: GitHub REST API docs]
- **Using `@actions/github` in the benchmark script:** That wrapper is for Action runtime only. Use `@octokit/rest` standalone for scripts. [CITED: CLAUDE.md Technology Stack]
- **Hardcoding label checks as case-sensitive exact match:** The GitHub API returns label names verbatim. The target repos use lowercase (`invalid`, `needs-info`), but the match should be case-insensitive for robustness.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| GitHub API rate limit handling | Custom retry/sleep loops | `@octokit/plugin-throttling` | Handles both primary (5000/hr) and secondary (80/min) limits with correct backoff per GitHub best practices |
| Concurrent request throttling | Manual queue / setTimeout | `p-limit(5)` | Correct async concurrency; avoids hitting both rate limits simultaneously |
| TypeScript script running | `tsc` + `node` two-step | `tsx` | Zero config, handles NodeNext .js extensions, same output as production tsc |
| PRNG for seeded shuffle | Custom LCG | Mulberry32 (5 lines, no dep) | High-quality 32-bit PRNG; no library needed; fast and reproducible |
| Statistics library for CI/κ | `simple-statistics` npm | Wilson CI + κ formula inline | The formulas are 5-10 lines each; adding a library dep for 30 lines of math adds startup cost for no benefit |

**Key insight:** Every component in this phase is either a thin wrapper over a well-established API (`@octokit/rest`) or a small math formula that's safer to inline than to import. The risk is not in the math — it's in the Octokit/rate-limit plumbing.

---

## Common Pitfalls

### Pitfall 1: Test-Set Contamination (Pitfall 6 from Roadmap)
**What goes wrong:** Developer runs `--split test` to "check progress" during tuning, then adjusts weights based on what they see.
**Why it happens:** Convenient — the test split is right there in the fixture directory.
**How to avoid:** The CLI should refuse or loudly warn on `--split test` if the split.json was written after weights.ts was last modified (compare mtime). Better: document that `--split test` is to be run exactly once at the end. Git history is the audit trail.
**Warning signs:** Multiple commits modifying both `weights.ts` and containing references to test split metrics.

### Pitfall 2: PR Issues Leaking into Fixtures
**What goes wrong:** Closed PRs appear in the issues endpoint and get scraped as issues, corrupting the benchmark.
**Why it happens:** GitHub's `GET /repos/{owner}/{repo}/issues` endpoint returns PRs.
**How to avoid:** Filter `if (issue.pull_request != null) continue` in the scraper. [VERIFIED: GitHub REST API behavior]
**Warning signs:** Issues with titles like "feat: add X" or "fix: y" in fixtures.

### Pitfall 3: Secondary Rate Limit Exhaustion
**What goes wrong:** Fetching 200 issues × 3 repos = 600+ items, each requiring a separate request (100 per page = 6+ paginated calls). If all 3 repos are scraped concurrently with no concurrency cap, the 80/min secondary rate limit trips.
**Why it happens:** `p-limit(5)` limits concurrent scrapes but doesn't limit per-minute calls. `@octokit/plugin-throttling` handles the actual backoff.
**How to avoid:** Use `p-limit(5)` AND `@octokit/plugin-throttling`. The throttling plugin auto-backs off without losing progress.
**Warning signs:** `SecondaryRateLimit detected` in logs, requests failing after ~5 minutes of scraping.

### Pitfall 4: Fixture Staleness on Re-Run
**What goes wrong:** Re-running the scraper overwrites cached fixtures, changing the dataset under an already-computed split.
**Why it happens:** Simple file write with `fs.writeFile` overwrites existing files.
**How to avoid:** Skip-if-exists: check `fs.existsSync(fixturePath)` before writing. The scraper always re-reads from disk if the file exists. Re-scrape requires explicit `--force` flag or manual deletion of fixtures.
**Warning signs:** `split.json` train/test composition changes between runs.

### Pitfall 5: Label Name Case/Variant Mismatches
**What goes wrong:** microsoft/vscode uses `needs investigation` instead of `needs-info`; some repos use `wont fix` instead of `wontfix`. Ground truth silently has fewer slop labels than expected.
**Why it happens:** D-03 defines exact label names but repos aren't guaranteed to match exactly.
**How to avoid:** Check actual label distributions on the three target repos before hardcoding. Log label frequency stats in the scraper output. [ASSUMED — not verified against live repo label lists]
**Warning signs:** Ground truth slop ratio below 10% (suggests labels not matching).

### Pitfall 6: `RepoContext` Mismatch Between Benchmark and Production
**What goes wrong:** Benchmark passes `BENCH_REPO_CTX` (no templates) but production has templates. The benchmark measures a different code path than production.
**Why it happens:** The benchmark can't load templates from the actual repos (would require cloning).
**How to avoid:** Use a canonical `BENCH_REPO_CTX = {hasIssueForms: false, hasMdTemplates: false, hasContributing: false, templates: []}`. The checklist tier falls through to Tier 4 (universal baseline). Document this assumption in REPORT.md. This is acceptable: the benchmark measures the heuristic scoring, not template matching.
**Warning signs:** Non-deterministic scores on same issue at replay time.

### Pitfall 7: tsconfig `rootDir` Constraint
**What goes wrong:** `scripts/benchmark.ts` imports from `../src/core/` but `tsconfig.json` has `rootDir: './src'` — TypeScript compile errors if you try to compile `scripts/`.
**Why it happens:** Current tsconfig only covers `src/**/*`.
**How to avoid:** `tsx` bypasses tsconfig compilation entirely for script running. Do NOT add `scripts/` to `tsconfig.json` `include`. The benchmark script is always run via `tsx scripts/benchmark.ts`, never via `tsc`. [VERIFIED: tsx documentation confirms it handles this transparently]

---

## Code Examples

### Fixture JSON Schema

```typescript
// src/bench/types.ts
import type { Signals, IssueType } from '../core/types.js'

export interface BenchmarkFixture {
  // Identifiers
  repo: string          // 'microsoft/vscode'
  number: number        // GitHub issue number
  
  // Raw fields needed to reconstruct Issue DTO
  title: string
  body: string
  labels: string[]      // Current labels (proxy for at-close labels)
  
  // Ground truth (computed at scrape time, never changed)
  isSlop: boolean       // any of: invalid|duplicate|wontfix|needs-info label present
  
  // Metadata
  closedAt: string      // ISO 8601
  htmlUrl: string       // for manual κ-audit review
  
  // Populated at replay time (NOT stored in fixture)
  // signals?: Signals    -- NOT stored; recomputed each replay
}

export interface SplitManifest {
  seed: number          // 42
  trainFraction: number // 0.7
  createdAt: string     // ISO 8601 timestamp
  train: string[]       // fixture file paths (relative to bench/fixtures/)
  test: string[]        // fixture file paths (relative to bench/fixtures/)
}
```

### REPORT.md Structure (Markdown Template)

```markdown
# Signal-OSS Heuristics Benchmark Report

**Generated:** {ISO date}
**Mode:** heuristics-only (--no-llm)
**Repos:** microsoft/vscode, facebook/react, rust-lang/rust
**N (total):** {total} | **Train:** {trainN} | **Test:** {testN}
**Score→binary threshold:** {threshold} (F1-maximizing on training split)
**Seed:** 42 | **Split:** 70/30

## Overall Performance (Held-Out 30% Test Split)

| Metric | Value | 95% CI |
|--------|-------|--------|
| Precision | {p:.3f} | [{p_lo:.3f}, {p_hi:.3f}] |
| Recall    | {r:.3f} | [{r_lo:.3f}, {r_hi:.3f}] |
| F1        | {f1:.3f} | — |
| N         | {testN}  | |

## Per-Type Performance

| Issue Type | N | Precision | Recall | F1 | CI Note |
|------------|---|-----------|--------|----|---------|
| bug        | {n} | {p} | {r} | {f1} | {ci_note} |
| feature    | {n} | {p} | {r} | {f1} | {ci_note} |
| question   | {n} | {p} | {r} | {f1} | {ci_note} |

*CI reported when N≥30; "N<30, CI not reported" otherwise*

## κ-Audit (Ground-Truth Proxy Quality)

**Sample:** N=30 issues, stratified across 3 repos, balanced slop/actionable
**Method:** Manual review of GitHub issue HTML; labeled independently of proxy rules
**Cohen's κ:** {kappa:.3f}  ({interpretation})

| Agreement | Count | % |
|-----------|-------|----|
| Both proxy+manual = slop | {tp} | {tp_pct}% |
| Both proxy+manual = actionable | {tn} | {tn_pct}% |
| Proxy=slop, Manual=actionable | {fp} | {fp_pct}% |
| Proxy=actionable, Manual=slop | {fn} | {fn_pct}% |

## Training Split Signals (Tuning Reference)

| Signal | Weight | Fires | On-Slop | On-Actionable |
|--------|--------|-------|---------|---------------|
| hasCodeBlock | {w} | {n} | {s} | {a} |
| ... | | | | |

## Methodology Notes

- Ground-truth proxy: labels `invalid`, `duplicate`, `wontfix`, `needs-info` present on closed issue (current labels used as proxy for at-close labels; κ-audit validates quality)
- RepoContext: universal baseline (Tier 4) — no template data loaded for benchmark
- Score→binary: issue classified as "slop" when score ≤ threshold; threshold selected to maximize F1 on training split
- Issue type: assigned by `classifyType()` from `src/core/classifier/` (same production code)
```

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| `@octokit/rest` direct (manual rate limiting) | `@octokit/rest` + `@octokit/plugin-throttling` | Zero 403s; handles both primary and secondary limits automatically |
| `node-seed` or `seedrandom` npm | Mulberry32 inline (5 lines) | No dep; Node 24 stdlib is sufficient |
| `zod-to-json-schema` package | `z.toJSONSchema()` (zod 4 native) | One fewer dep; already in package.json |
| Timeline-events API for at-close labels | `issue.labels` current field as proxy | Dramatically simpler scraper; κ-audit validates accuracy |

**Deprecated/outdated patterns:**
- `@octokit/rest` v18 (uses `.request()` not `.paginate.iterator()`): current is v22 with async iterator pagination
- `seedrandom` npm: unnecessary now that Mulberry32 is a known-good 5-line PRNG
- jest (not vitest): tests for metrics module use Vitest, already in project

---

## Runtime State Inventory

> Not applicable — this is a greenfield phase adding new scripts and directories. No rename/migration involved.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js ≥24 | `tsx`, `parseArgs`, benchmark script | ✓ | v24.0.0 | — |
| `@octokit/rest` | BENCH-01 scraper | ✗ (not installed) | 22.0.1 available on npm | — (must install) |
| `@octokit/plugin-throttling` | BENCH-01 rate limiting | ✗ (not installed) | 11.0.3 available on npm | — (must install) |
| `p-limit` | BENCH-01 concurrency | ✗ (not installed) | 7.3.0 available on npm | — (must install) |
| `tsx` | Script runner | ✗ (not installed) | 4.22.0 available on npm | `npx tsx` one-off |
| `GITHUB_TOKEN` env var | Octokit auth (5000/hr vs 60/hr unauth) | ✗ (not set in current env) | — | Unauthenticated: 60/hr (too slow for 200 issues × 3 repos) |
| TypeScript | Already installed | ✓ | ^5.9.0 | — |
| Vitest | Metrics unit tests | ✓ | ^4.1.5 | — |

**Missing dependencies with no fallback:**
- `@octokit/rest`, `@octokit/plugin-throttling`, `p-limit`, `tsx` — must `npm install --save-dev` before any Wave 1 work
- `GITHUB_TOKEN` — must be set in environment before running scraper (document in README/script help text)

**Missing dependencies with fallback:**
- `tsx`: can use `npx tsx` without installing, but installing is cleaner for repeated use

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `microsoft/vscode`, `facebook/react`, `rust-lang/rust` use lowercase `invalid`, `duplicate`, `wontfix`, `needs-info` label names consistently | Common Pitfalls §5 | Ground truth slop rate unexpectedly low; need to add label variants |
| A2 | Triage labels (`invalid`, `needs-info`, `duplicate`) are rarely removed from closed issues in the three target repos | Ground-truth proxy | Proxy quality lower than expected; κ-audit would surface this |
| A3 | The src/bench/ directory structure (logic in src/bench/, entry in scripts/) is the right split | Architecture Patterns | Alternative: keep everything in scripts/; doesn't affect correctness, only testability |
| A4 | Per-signal confusion matrix printed to stdout is sufficient for manual tuning (no TUI or file output needed) | Pattern 8 | If stdout is insufficient, developer will want CSV — easy to add without design change |
| A5 | `--split test` run once at the end is enforceable by documentation + git history; no code-level guard required | Pitfall 1 | Test contamination risk; mtime comparison warning is a cheap safeguard |

---

## Open Questions

1. **Actual label names in target repos**
   - What we know: D-03 specifies `invalid`, `duplicate`, `wontfix`, `needs-info` as the slop labels
   - What's unclear: Actual label names on the three repos (e.g., vscode may use `*duplicate` or `needs more info`)
   - Recommendation: Log top-20 label frequencies during the first scrape run; adjust match set if needed (document any deviation from D-03 in REPORT.md)

2. **Expected slop rate**
   - What we know: These repos have strong triage hygiene (from D-01)
   - What's unclear: What fraction of closed issues will be labeled as slop — could be 20% or 60%
   - Recommendation: Log class distribution stats during scrape; if slop < 15% or > 75%, flag for review as it affects metric interpretation

3. **Vscode issues volume**
   - What we know: microsoft/vscode is a very high-volume repo
   - What's unclear: How many pages `octokit.paginate.iterator` will traverse before hitting `--limit 200`; whether the most recent 200 closed issues have sufficient type diversity
   - Recommendation: Sort by `sort: updated, direction: desc` (default) to get most recent; this gives good diversity of issue types

---

## Security Domain

> `security_enforcement: true`, `security_asvs_level: 1` in `.planning/config.json`

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | Partial | `GITHUB_TOKEN` via env var — never hardcoded; document in .env.example; no `core.setSecret` in scripts (not an Action context) |
| V3 Session Management | No | Not applicable — CLI script |
| V4 Access Control | No | Not applicable |
| V5 Input Validation | Yes | Fixture JSON validated with zod schema at load time before passing to `score()` |
| V6 Cryptography | No | Not applicable |

### Known Threat Patterns for Benchmark Scraper

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| `GITHUB_TOKEN` leaked in logs | Information Disclosure | Never log token value; use `octokit.log.warn` (logs request URL, not headers) |
| Issue body injection via score() | Tampering | Not a risk in Phase 3 — `score()` is pure heuristics, no LLM, no output to GitHub |
| Fixture file tampering | Tampering | `bench/fixtures/` is git-tracked; any modification is visible via `git diff` |
| `bench/fixtures/split.json` modification | Tampering | Same — git-tracked; modification after weight tuning would be detected in git history |

**Security note:** The benchmark script runs as a developer CLI tool, not as a GitHub Action. It does not post to GitHub, does not handle untrusted LLM output, and does not execute in the Action runtime. The primary security concern is `GITHUB_TOKEN` hygiene.

---

## Sources

### Primary (HIGH confidence)
- `src/core/index.ts` — confirmed `score(issue, repoContext, null)` signature; `void llm` confirms null path is Phase 3 intended use [VERIFIED: direct file read 2026-05-15]
- `src/core/score/weights.ts` — confirmed `WEIGHTS`, `GRAY_ZONE_LOW/HIGH` constants; score range 0–10 [VERIFIED: direct file read 2026-05-15]
- `src/core/types.ts` — confirmed `Issue`, `RepoContext`, `Signals`, `ScoredIssue` DTO shapes [VERIFIED: direct file read 2026-05-15]
- `package.json` — confirmed missing deps (`@octokit/rest`, `p-limit`, `tsx`, `@octokit/plugin-throttling`) [VERIFIED: direct file read 2026-05-15]
- npm registry — `@octokit/rest@22.0.1`, `@octokit/plugin-throttling@11.0.3`, `p-limit@7.3.0`, `tsx@4.22.0` [VERIFIED: npm view 2026-05-15]
- @octokit/plugin-throttling README — `onRateLimit`/`onSecondaryRateLimit` configuration pattern [VERIFIED: WebFetch raw GitHub 2026-05-15]
- @octokit/rest Context7 docs — `paginate.iterator` pattern for memory-efficient scraping [VERIFIED: ctx7 CLI 2026-05-15]
- p-limit Context7 docs — `pLimit(n)` concurrency wrapper pattern [VERIFIED: ctx7 CLI 2026-05-15]
- Node 24 REPL — `parseArgs`, Mulberry32 PRNG, Wilson CI formula, Cohen's κ formula, F1-threshold scan [VERIFIED: direct Node 24 execution 2026-05-15]
- `.planning/config.json` — `nyquist_validation: false` (validation section omitted per config) [VERIFIED: direct file read 2026-05-15]

### Secondary (MEDIUM confidence)
- GitHub REST API docs — `GET /repos/{owner}/{repo}/issues` returns current labels; PRs included in response [CITED: docs.github.com/rest/issues/issues]
- Wikipedia — Binomial proportion confidence interval (Wilson formula) [CITED: en.wikipedia.org/wiki/Binomial_proportion_confidence_interval]
- Wikipedia — Cohen's kappa formula [CITED: en.wikipedia.org/wiki/Cohen%27s_kappa]

### Tertiary (LOW confidence)
- Label hygiene assumption for vscode/react/rust — based on reputation; not verified against live API [ASSUMED]
- `src/bench/` vs `scripts/` directory structure recommendation [ASSUMED]

---

## Metadata

**Confidence breakdown:**
- Standard stack (new deps): HIGH — all versions verified via npm registry
- Architecture: HIGH — based on reading actual production code (`src/core/`)
- Metric formulas: HIGH — verified in Node 24 REPL
- Ground-truth proxy (labels at close time): MEDIUM — GitHub API docs confirm current labels are returned; assumption that triage labels are rarely removed post-close is validated by κ-audit design
- Label name variants in target repos: LOW — assumed exact match; first scrape will reveal actuals

**Research date:** 2026-05-15
**Valid until:** 2026-06-14 (30 days; stable ecosystem)

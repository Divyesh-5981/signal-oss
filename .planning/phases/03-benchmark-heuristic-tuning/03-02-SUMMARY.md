---
phase: 03-benchmark-heuristic-tuning
plan: 02
subsystem: benchmark
tags: [benchmark, scraper, octokit, throttling, fixtures, cli, p-limit, ground-truth]

# Dependency graph
requires:
  - phase: 03-01
    provides: "@octokit/rest, @octokit/plugin-throttling, p-limit, tsx installed; BenchmarkFixture + SplitManifest DTOs; seededSplit()"
  - phase: 01-scaffold
    provides: "TypeScript toolchain, src/core/types.ts"
provides:
  - "src/bench/scraper.ts: Octokit+throttling scraper with PR filter, skip-if-exists cache, D-03 ground-truth labeling, seededSplit manifest"
  - "scripts/benchmark.ts: CLI entry point; --mode scrape wired; --mode replay/report stubbed for Plan 03"
  - "bench/fixtures/ directory committed (populated at runtime by --mode scrape)"
affects:
  - 03-03-replay (replay harness reads bench/fixtures/ populated by this scraper)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Octokit.plugin(throttling) with inferred callback types — no explicit type annotation on throttle handler params"
    - "p-limit(5) for concurrent repo scrapes within scrape()"
    - "paginate.iterator loop with PR filter (pull_request != null) and early-exit at maxIssues"
    - "skip-if-exists: existsSync(fixturePath) before writeFileSync — idempotent re-runs"
    - "Dynamic import() for scraper in CLI — avoids top-level import issues with tsx"

key-files:
  created:
    - "src/bench/scraper.ts — createOctokit(), scrapeRepo(), scrape(); 197 lines"
    - "scripts/benchmark.ts — parseArgs CLI harness; --mode scrape/replay/report; 110 lines"
    - "bench/fixtures/.gitkeep — commits directory structure for runtime fixture output"
  modified: []

key-decisions:
  - "Throttling handler types inferred by TypeScript (not explicitly annotated) — LimitHandler from @octokit/plugin-throttling uses @octokit/core Octokit type, not the ThrottledOctokit intersection; explicit annotation caused TS2322"
  - "Dynamic import('../src/bench/scraper.js') in CLI — keeps scripts/benchmark.ts out of tsconfig include and avoids bundler cross-contamination"
  - "bench/fixtures/ populated at runtime only — .gitkeep tracks directory; actual .json files are git-ignored (untracked)"
  - "allPaths.sort() before seededSplit() — deterministic ordering before shuffling prevents fixture-order-dependent splits"

# Metrics
duration: 3min
completed: 2026-05-15
---

# Phase 3 Plan 02: Scraper + CLI Entry Point Summary

**Octokit+throttling scraper with D-03 ground-truth labeling, skip-if-exists cache, seeded 70/30 split manifest, and parseArgs CLI entry point wired for --mode scrape; --mode replay/report stubbed pending Plan 03**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-05-15T09:29:53Z
- **Completed:** 2026-05-15T09:32:32Z
- **Tasks:** 2
- **Files created:** 3

## Accomplishments

- Implemented `src/bench/scraper.ts` with Octokit+throttling, PR filter, D-03 slop labels, skip-if-exists cache, seededSplit manifest write
- Implemented `scripts/benchmark.ts` CLI with parseArgs for all 8 options (mode/repos/limit/no-llm/with-llm/split/token/seed)
- `--mode scrape` exits 1 with helpful GITHUB_TOKEN message when token not set
- Created `bench/fixtures/.gitkeep` to commit the directory structure
- 174/174 tests passing — zero regressions

## Task Commits

Each task was committed atomically:

1. **Task 1: Implement src/bench/scraper.ts** - `5bdd8f2` (feat)
2. **Task 2: Implement scripts/benchmark.ts + bench/fixtures/.gitkeep** - `7799920` (feat)

## Files Created

- `src/bench/scraper.ts` — createOctokit(), ScrapeOptions interface, scrape() async function
- `scripts/benchmark.ts` — parseArgs CLI harness, --mode scrape/replay/report routing
- `bench/fixtures/.gitkeep` — directory structure commit

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed TypeScript error in throttling callback types**
- **Found during:** Task 1 (TypeScript compile verification)
- **Issue:** Explicit type annotations on `onRateLimit`/`onSecondaryRateLimit` callbacks used `InstanceType<typeof ThrottledOctokit>` for the `octokit` param. TypeScript's `LimitHandler` type from `@octokit/plugin-throttling` uses `Octokit` from `@octokit/core` (not the ThrottledOctokit intersection), causing TS2322 incompatibility.
- **Fix:** Removed explicit type annotations on callback params — TypeScript infers them correctly from the `LimitHandler` signature
- **Files modified:** src/bench/scraper.ts
- **Commit:** 5bdd8f2

---

**Total deviations:** 1 auto-fixed (Rule 1 - Bug)
**Impact on plan:** Minimal — type annotation fix only; logic unchanged.

## Known Stubs

- `--mode replay` in `scripts/benchmark.ts` — dynamic imports `src/bench/replay.js` which does not exist yet; exits with informative error pending Plan 03-03
- `--mode report` in `scripts/benchmark.ts` — same stub; exits with informative error pending Plan 03-03
- `printSignalAnalysis()` in `src/bench/metrics.ts` (from Plan 01) — still a placeholder stub; requires ReplayResult from Plan 03-03

All stubs are intentional, documented, and will be resolved in Plan 03-03.

## Threat Surface

No new threat surface beyond what is documented in the plan's threat model (T-03-03 through T-03-06). GITHUB_TOKEN is never logged — passed only to Octokit `auth` option.

## Next Phase Readiness

- Plan 03-03 (replay + tuning + report) is now unblocked: scraper + fixtures dir ready, CLI stubs wired
- Running `tsx scripts/benchmark.ts --mode scrape` with a valid GITHUB_TOKEN will populate `bench/fixtures/` with up to 200 issues per repo and write `bench/fixtures/split.json`

---
*Phase: 03-benchmark-heuristic-tuning*
*Completed: 2026-05-15*

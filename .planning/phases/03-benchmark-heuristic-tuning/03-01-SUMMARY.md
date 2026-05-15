---
phase: 03-benchmark-heuristic-tuning
plan: 01
subsystem: testing
tags: [benchmark, metrics, statistics, wilson-ci, cohens-kappa, f1, octokit, tsx, p-limit]

# Dependency graph
requires:
  - phase: 01-scaffold
    provides: "TypeScript toolchain, Vitest test runner, src/core/types.ts with Signals interface"
  - phase: 02-templates-labels
    provides: "weights.ts with WEIGHTS constants for printSignalAnalysis signal keys"
provides:
  - "Phase 3 devDependencies: @octokit/rest, @octokit/plugin-throttling, p-limit, tsx"
  - "src/bench/types.ts: BenchmarkFixture, SplitManifest, ReplayResult, ConfusionMatrix DTOs"
  - "src/bench/metrics.ts: wilsonCI, cohensKappa, findOptimalThreshold, computePRF, seededSplit, printSignalAnalysis"
  - "tests/bench/metrics.test.ts: 17 unit tests verifying all math functions"
affects:
  - 03-02-scraper (uses @octokit/rest and BenchmarkFixture)
  - 03-03-replay (uses metrics.ts functions and SplitManifest)

# Tech tracking
tech-stack:
  added:
    - "@octokit/rest@22.0.1 — GitHub REST API client for scraper"
    - "@octokit/plugin-throttling@11.0.3 — auto-backoff on rate limits"
    - "p-limit@7.3.0 — concurrency cap for benchmark LLM calls"
    - "tsx@4.22.0 — zero-config TypeScript script runner"
  patterns:
    - "Pure math modules with no I/O — testable in isolation, no mocking needed"
    - "Mulberry32 PRNG + Fisher-Yates for deterministic seeded shuffle"
    - "Wilson CI for proportion confidence intervals (replaces naive p ± 1.96*SE)"
    - "toBeCloseTo for floating-point upper bounds in Wilson CI tests"

key-files:
  created:
    - "src/bench/types.ts — BenchmarkFixture (scrape-time frozen shape), SplitManifest, ReplayResult, ConfusionMatrix"
    - "src/bench/metrics.ts — wilsonCI, cohensKappa, findOptimalThreshold, computePRF, seededSplit, printSignalAnalysis"
    - "tests/bench/metrics.test.ts — 17 tests with known-input/known-output assertions"
  modified:
    - "package.json — 4 new devDependencies added"

key-decisions:
  - "wilsonCI uses exact Wilson score formula (not Wald interval) — better coverage near p=0/1"
  - "seededSplit uses Mulberry32 PRNG (not Math.random) for deterministic reproducibility across Node versions"
  - "printSignalAnalysis is a placeholder stub — real per-signal stats require ReplayResult from replay.ts (Plan 03)"
  - "BenchmarkFixture.isSlop frozen at scrape time per D-04 — never recomputed, prevents ground-truth contamination"
  - "toBeCloseTo(1, 10) used for wilsonCI(100,100) upper clamp test — floating point gives 0.9999999999999999"

patterns-established:
  - "Bench-only modules: src/bench/ imports from src/core/ but never imported by src/action/ or src/adapters/"
  - "All .js extensions in import paths (ESM convention)"
  - "Pure math: no @actions, no @octokit imports in metrics.ts"

requirements-completed:
  - BENCH-05
  - BENCH-06

# Metrics
duration: 12min
completed: 2026-05-15
---

# Phase 3 Plan 01: Benchmark DevDeps + Metrics Foundation Summary

**Wilson CI, Cohen's kappa, F1-threshold scan, and seeded shuffle implemented as pure-math TypeScript module with 17 passing unit tests; @octokit/rest + throttling + p-limit + tsx installed as devDependencies**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-05-15T09:15:00Z
- **Completed:** 2026-05-15T09:27:22Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Installed 4 Phase 3 devDependencies: @octokit/rest@22.0.1, @octokit/plugin-throttling@11.0.3, p-limit@7.3.0, tsx@4.22.0
- Created src/bench/types.ts with all 4 frozen DTOs: BenchmarkFixture, SplitManifest, ReplayResult, ConfusionMatrix
- Implemented src/bench/metrics.ts with 6 exported functions covering all Phase 3 math needs
- 174/174 tests passing (154 prior + 17 new + 3 pre-existing in other test files; no regressions)

## Task Commits

Each task was committed atomically:

1. **Task 1: Install devDependencies and create src/bench/types.ts** - `8fae62b` (feat)
2. **Task 2: Implement src/bench/metrics.ts and unit tests** - `63c8d0e` (feat)

## Files Created/Modified
- `package.json` - Added 4 devDependencies (@octokit/rest, @octokit/plugin-throttling, p-limit, tsx)
- `package-lock.json` - Updated lockfile after npm install
- `src/bench/types.ts` - BenchmarkFixture, SplitManifest, ReplayResult, ConfusionMatrix DTOs
- `src/bench/metrics.ts` - wilsonCI, cohensKappa, findOptimalThreshold, computePRF, seededSplit, printSignalAnalysis
- `tests/bench/metrics.test.ts` - 17 unit tests for all math functions

## Decisions Made
- Used `toBeCloseTo(1, 10)` for wilsonCI(100,100) upper bound test — floating point arithmetic returns 0.9999999999999999, not 1.0 exactly, even after `Math.min(1, ...)` clamp
- `printSignalAnalysis` is a placeholder stub that logs signal key names without per-fixture data — full signal stats require ReplayResult from the replay pipeline (Plan 03-03)
- `seededSplit` uses Mulberry32 PRNG for deterministic shuffle across Node versions (vs `Math.random()`)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed floating-point equality assertion in wilsonCI test**
- **Found during:** Task 2 (metrics unit tests)
- **Issue:** `wilsonCI(100, 100).upper` returns `0.9999999999999999` (not `1.0`) due to floating-point arithmetic — `Math.min(1, x)` where x = `0.9999999999999999 < 1` doesn't clamp
- **Fix:** Changed `expect(upper).toBe(1)` to `expect(upper).toBeCloseTo(1, 10)` in the test
- **Files modified:** tests/bench/metrics.test.ts
- **Verification:** All 17 tests pass after fix
- **Committed in:** 63c8d0e (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - Bug)
**Impact on plan:** Minimal — floating-point assertion fix only, no logic changes. Math functions correct.

## Issues Encountered
- Floating-point precision: `Math.min(1, 0.9999999999999999)` returns `0.9999999999999999` (not 1.0) because `0.9999999999999999 < 1` in IEEE 754. Fixed in test with `toBeCloseTo`.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Plan 03-02 (scraper) is now unblocked: @octokit/rest + p-limit installed, BenchmarkFixture DTO ready
- Plan 03-03 (replay + tuning) is now unblocked: metrics.ts functions available, SplitManifest DTO ready
- All 174 tests passing — clean baseline for Phase 3 continuation

---
*Phase: 03-benchmark-heuristic-tuning*
*Completed: 2026-05-15*

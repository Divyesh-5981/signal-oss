---
phase: 01-skeleton-heuristic-spine-first-comment
plan: 02
subsystem: core-types
tags: [dtos, types, scaffold, walking-skeleton, hexagonal]
dependency_graph:
  requires: [01-01-scaffold]
  provides: [src/core/types.ts, src/core/llm/port.ts, src/core/index.ts, src/action/main.ts, dist/index.js]
  affects: [01-03-heuristics, 01-04-score-pipeline, 01-05-main-wiring]
tech_stack:
  added: []
  patterns: [hexagonal-ports-and-adapters, walking-skeleton, tdd-red-green]
key_files:
  created:
    - src/core/types.ts
    - src/core/llm/port.ts
    - src/core/index.ts
    - src/action/main.ts
    - tests/core/types.test.ts
    - tests/core/score-stub.test.ts
    - dist/index.js
  modified:
    - rollup.config.ts
  deleted:
    - tests/smoke.test.ts
decisions:
  - "DTOs locked verbatim from SKELETON.md A6 — no improvisation, no extra fields"
  - "score() is synchronous (ScoredIssue, not Promise<ScoredIssue>) — Phase 4 async handled at adapter boundary"
  - "rollup.config.ts outDir set to 'dist' to satisfy @rollup/plugin-typescript path validation"
metrics:
  duration: "~5 minutes"
  completed: "2026-05-09"
  tasks_completed: 2
  files_created: 7
  files_modified: 1
  files_deleted: 1
  tests_passing: 11
---

# Phase 1 Plan 02: DTOs + Stub Summary

**One-liner:** Locked all Phase 1 DTOs (6 interfaces/types) and LLMPort interface, stubbed score() entrypoint with sync signature, and produced first successful Rollup bundle (dist/index.js, 971KB) — Walking Skeleton Stage A complete.

## What Was Built

### Task 1: Core Types + LLMPort + Type Tests
- `src/core/types.ts` — 6 locked DTOs (Issue, Signals, IssueType, RepoContext, ChecklistItem, ScoredIssue) copied verbatim from SKELETON.md A6
- `src/core/llm/port.ts` — LLMRequest, LLMVerdict, LLMPort interface (stub for Phase 4 implementation)
- `tests/core/types.test.ts` — 5 shape-verification tests all passing
- Deleted `tests/smoke.test.ts` (Plan 01 placeholder)

### Task 2: score() Stub + main.ts + First Build
- `src/core/index.ts` — stub score() with locked signature: `score(issue, repoContext, llm = null): ScoredIssue`
- `src/action/main.ts` — minimal orchestrator stub (Rollup input); imports score(), logs result, exits cleanly
- `tests/core/score-stub.test.ts` — 6 tests all passing
- `dist/index.js` — first Rollup bundle (971,768 bytes), Walking Skeleton Stage A proven

## Confirmed: DTO Shapes Match SKELETON.md A6 Verbatim

All 6 exported types in `src/core/types.ts` match SKELETON.md section A6 exactly:
- `export interface Issue` (3 fields: title, body, labels)
- `export interface Signals` (7 boolean fields)
- `export type IssueType = 'bug' | 'feature' | 'question'`
- `export interface RepoContext` (4 fields: hasIssueForms, hasMdTemplates, hasContributing, templates)
- `export interface ChecklistItem` (text, optional signalKey)
- `export interface ScoredIssue` (7 fields: score, missing, signals, issueType, isGrayZone, items, tierUsed)

## Confirmed: Hexagonal Invariant Holds

```
grep -rE "from '(@octokit|@actions|fs|https|@anthropic-ai/sdk|openai)" src/core/
# Result: 0 lines — HEXAGONAL OK
```

`src/core/` contains zero side-effecting imports. Only `src/action/main.ts` imports `@actions/core`.

## Bundle Size

`dist/index.js`: **971,768 bytes** (~950KB). This is expected — `@actions/core` pulls in several Node utility modules. No bundle bloat from our own code; the walk-skeleton has minimal source footprint.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed Rollup outDir path validation error**
- **Found during:** Task 2 — `npm run package`
- **Issue:** `@rollup/plugin-typescript` rejected the tsconfig.json `outDir: "./build"` because it was not inside the Rollup output directory (`dist/`)
- **Error:** `RollupError: Path of Typescript compiler option 'outDir' must be located inside the same directory as the Rollup 'file' option`
- **Fix:** Added `outDir: 'dist'` override in the `typescript()` plugin call in `rollup.config.ts`
- **Files modified:** `rollup.config.ts`
- **Commit:** `ff23165`

## Self-Check: PASSED

| Item | Status |
|------|--------|
| src/core/types.ts exists | FOUND |
| src/core/llm/port.ts exists | FOUND |
| src/core/index.ts exists | FOUND |
| src/action/main.ts exists | FOUND |
| tests/core/types.test.ts exists | FOUND |
| tests/core/score-stub.test.ts exists | FOUND |
| dist/index.js exists | FOUND |
| tests/smoke.test.ts deleted | CONFIRMED |
| commit 66d1d50 (Task 1) | FOUND |
| commit ff23165 (Task 2) | FOUND |
| 11/11 tests passing | CONFIRMED |
| Hexagonal invariant | CONFIRMED (0 violations) |

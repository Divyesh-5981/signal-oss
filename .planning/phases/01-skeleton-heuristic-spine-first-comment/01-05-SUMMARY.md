---
phase: 01-skeleton-heuristic-spine-first-comment
plan: "05"
subsystem: action-wiring
tags: [action, octokit, idempotency, e2e, github-workflow]
dependency_graph:
  requires: [01-04-checklist-score-format]
  provides: [action-runtime, github-io-adapter, workflow-yamls, dist-bundle]
  affects: [phase-02-repo-context, phase-05-demo]
tech_stack:
  added: ["@actions/github (OctokitInstance type)", "dist/index.js (full pipeline bundle)"]
  patterns: [find-then-update-idempotency, bot-loop-guard, thin-orchestrator]
key_files:
  created:
    - src/adapters/github/io.ts
    - tests/adapters/github.test.ts
    - src/action/main.ts
    - action.yml
    - .github/workflows/triage.yml
    - .github/workflows/ci.yml
    - tests/fixtures/events/issues-opened.json
    - tests/action/main.test.ts
    - dist/index.js
  modified:
    - src/core/heuristics/extractor.ts
    - src/core/index.ts
    - src/core/llm/port.ts
    - src/core/format/markdown.ts
    - src/core/checklist/baselines.ts
    - src/core/checklist/strategies/baseline.ts
    - src/core/classifier/issue-type.ts
    - src/core/score/weights.ts
decisions:
  - "OctokitInstance typed via ReturnType<typeof github.getOctokit> with import type (no runtime import)"
  - "updateComment result not assigned — void is implicit, commentId taken from existing.id"
  - "main.test.ts uses dynamic import + setTimeout(50ms) to let top-level run() promise settle"
  - "biome noShadowRestrictedNames: renamed toString import to mdastToString in extractor.ts"
metrics:
  duration: "~15 minutes"
  completed: "2026-05-09"
  tasks_completed: 2
  tasks_pending: 1
  files_created: 9
  files_modified: 8
  tests_passing: 96
---

# Phase 01 Plan 05: Action Wiring Summary

**One-liner:** Full GitHub Action runtime wired — Octokit I/O adapter with idempotency marker, main.ts orchestrator with bot-loop guard, action.yml + workflow YAMLs, and rebuilt dist/index.js bundle.

## Tasks Completed

| Task | Name | Commit | Status |
|------|------|--------|--------|
| 1 | GitHub I/O adapter with idempotency + tests | c3cf228 | Done |
| 2 | Replace main.ts + action.yml + workflows + fixture + dist rebuild | 070a17f | Done |
| 3 | Sandbox repo end-to-end verification | — | **Pending human verification** |

## Acceptance Criteria Status (Tasks 1-2)

- [x] `src/adapters/github/io.ts` exports `postOrUpdateComment` with `rest.issues.listComments/createComment/updateComment`
- [x] `src/adapters/github/io.ts` imports `MARKER` from `../../core/format/markdown.js`
- [x] `src/adapters/github/io.ts` uses `per_page: 100`
- [x] `tests/adapters/github.test.ts` has 9 tests (create, update, multi-marker, error-propagation branches)
- [x] `action.yml` exists with `using: 'node24'` and `main: 'dist/index.js'`
- [x] `src/action/main.ts` contains `github.context.actor === 'github-actions[bot]'`
- [x] `src/action/main.ts` imports `score`, `format`, `postOrUpdateComment`
- [x] `src/action/main.ts` does NOT contain Plan 02 stub string
- [x] `.github/workflows/triage.yml` has `types: [opened, reopened]`, `contents: read`, `issues: write`, bot-loop `if:`, `secrets.GITHUB_TOKEN`
- [x] `.github/workflows/triage.yml` has zero `pull_request_target` references
- [x] `.github/workflows/ci.yml` has `npm run package` and `git diff --exit-code dist/`
- [x] `tests/fixtures/events/issues-opened.json` is valid JSON with `"action": "opened"` and `"number": 42`
- [x] `tests/action/main.test.ts` has happy-path test verifying `<!-- signal-oss:v1 -->` in comment body
- [x] `npm run all` exits 0 (96 tests, lint clean, dist rebuilt)
- [x] `dist/index.js` exists and is a real bundle
- [x] Hexagonal invariant preserved: zero side-effecting imports in `src/core/`
- [x] Zero PAT references in `.github/workflows/`

## Task 3: Pending Human Verification

Task 3 is a `checkpoint:human-verify` that requires:
1. Deploying the action to a sandbox GitHub repo
2. Opening a low-quality issue to trigger the workflow
3. Verifying the Tier-4 baseline checklist comment appears correctly

See the plan file for the full 15-item verification checklist (Layer 1 local-action dry-run + Layer 2 live sandbox).

**Plan file:**
`F:\Hackathon ideas\signal-oss\.planning\phases\01-skeleton-heuristic-spine-first-comment\01-05-action-wiring-PLAN.md`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed `noShadowRestrictedNames` lint error in extractor.ts**
- **Found during:** Task 2 (`npm run all` lint step)
- **Issue:** Pre-existing `import { toString } from 'mdast-util-to-string'` shadows the global `toString` property — Biome 2.x treats this as an error
- **Fix:** Renamed import to `mdastToString`; updated the single call site on line 35
- **Files modified:** `src/core/heuristics/extractor.ts`
- **Commit:** 070a17f

**2. [Rule 3 - Blocking] Biome auto-fixed import ordering across src/core/ files**
- **Found during:** Task 2 (`npm run all` format step)
- **Issue:** Biome `organizeImports` reordered imports in 6 existing core files (alphabetical ordering)
- **Fix:** Applied via `biome check --write`; no logic changes, import-order only
- **Files modified:** `src/core/checklist/baselines.ts`, `src/core/checklist/strategies/baseline.ts`, `src/core/classifier/issue-type.ts`, `src/core/format/markdown.ts`, `src/core/index.ts`, `src/core/llm/port.ts`, `src/core/score/weights.ts`
- **Commit:** 070a17f

## Known Stubs

- `RepoContext` in `main.ts` is Phase 1 stub (all false, empty templates array). Phase 2 wires real template loading.
- `main.test.ts` only covers the happy path. Bot-actor and missing-issue branches verified at human checkpoint (Task 3). Phase 2 may export `run()` for cleaner unit isolation.

## Threat Surface Scan

No new threat surface introduced beyond what is already in the plan's threat register (T-05-01 through T-05-08). All STRIDE mitigations implemented as specified:
- T-05-01: Both bot-loop guards present (workflow `if:` + `main.ts` early-return)
- T-05-02: `format()` emits only static strings + score number (no issue body interpolated)
- T-05-04: `core.info` logs only commentId/score/type/tier/count (no token, no body)
- T-05-05: `[opened, reopened]` only trigger; idempotency marker prevents duplicates
- T-05-06: Explicit `{ contents: read, issues: write }` permissions block
- T-05-07: Zero `pull_request_target` references (verified by grep)

## Self-Check

Files exist: src/adapters/github/io.ts, tests/adapters/github.test.ts, src/action/main.ts, action.yml, .github/workflows/triage.yml, .github/workflows/ci.yml, tests/fixtures/events/issues-opened.json, tests/action/main.test.ts, dist/index.js — all confirmed created.

Commits: c3cf228, 070a17f — both present in git log.

## Self-Check: PASSED

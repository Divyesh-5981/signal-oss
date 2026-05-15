---
phase: 02-action-hardening-repo-awareness
plan: "03"
subsystem: adapter
tags: [adapter, octokit, labels, github-action, idempotent, tdd]

# Dependency graph
requires:
  - phase: 02-action-hardening-repo-awareness
    plan: "01"
    provides: "ParsedTemplate types, action.yml inputs"

provides:
  - ensureLabel() — idempotent label creation (D-13: get-first, never overwrite)
  - applyLabel() — adds label to issue, returns 'applied'|'skipped'
  - removeLabel() — removes label, 404=silent success (Pitfall 7), returns 'removed'|'skipped'
  - LabelAction type union ('applied'|'removed'|'skipped'|'disabled'|'dry-run')

affects:
  - 02-05-wiring (main.ts consumes all three functions + LabelAction)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Try-get-first pattern: ensureLabel calls getLabel, catches 404, creates only when missing"
    - "Typed error swallowing: every Octokit error path returns typed status + core.warning (never throws)"
    - "Pitfall 7 handling: 404 on removeLabel = desired state already achieved (silent success)"

key-files:
  created:
    - src/adapters/github/labels.ts
    - tests/adapters/labels.test.ts
  modified: []

key-decisions:
  - "Label endpoints are under octokit.rest.issues (not octokit.rest.repos as plan spec stated) — corrected from plan via Rule 1 auto-fix after build failed"
  - "No throw statements anywhere in labels.ts — label failure must never block the hero comment"
  - "LabelAction includes 'disabled' and 'dry-run' variants for Plan 05 wiring"

patterns-established:
  - "Idempotent label creation: getLabel → on 404 → createLabel; non-404 errors go to warning and bail"
  - "All label operations return typed status strings; callers never need try/catch"

requirements-completed: [ACT-06]

# Metrics
duration: 3min
completed: 2026-05-14
---

# Phase 2 Plan 03: Labels Adapter Summary

**Idempotent label management adapter implementing ensureLabel (D-13 no-overwrite), applyLabel, and removeLabel (Pitfall 7 silent-404) — all Octokit errors caught and surfaced as core.warning; label ops never block the hero comment**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-05-14T11:47:37Z
- **Completed:** 2026-05-14T11:50:33Z
- **Tasks:** 2 (TDD: RED → GREEN)
- **Files created:** 2

## Accomplishments

- Created `tests/adapters/labels.test.ts` with 11 tests covering all documented branches (RED phase)
- Created `src/adapters/github/labels.ts` with three idempotent label operations (GREEN phase)
- `ensureLabel`: try-get-first pattern; D-13 preserved — never overwrites existing label color/description
- `applyLabel`: wraps `addLabels`; returns `'applied'` on success, `'skipped'` + warning on any error
- `removeLabel`: Pitfall 7 honored — 404 is silent success (`'skipped'`, no warning); non-404 errors emit warning
- `LabelAction` type exported for Plan 05 wiring (`'applied' | 'removed' | 'skipped' | 'disabled' | 'dry-run'`)
- Color sanitization: `color.replace(/^#/, '')` strips leading `#` before passing to GitHub API

## TDD Gate Compliance

- RED commit `1010739`: `test(02-03): add failing tests for label adapter — 10 branches RED`
- GREEN commit `b845db6`: `feat(02-03): implement label adapter — ensureLabel, applyLabel, removeLabel (GREEN)`
- Both gates present in git log in correct order.

## Task Commits

1. **Task 1 (RED): Write failing test suite for label adapter** - `1010739`
2. **Task 2 (GREEN): Implement `src/adapters/github/labels.ts`** - `b845db6`

## Files Created/Modified

- `tests/adapters/labels.test.ts` — 11 tests: ensureLabel (4 branches), applyLabel (2), removeLabel (3), color strip (1), LabelAction type check (1)
- `src/adapters/github/labels.ts` — 92 lines; 3 exported async functions + 1 exported type; 0 `throw` statements; 5 `core.warning` call sites

## Decisions Made

- `octokit.rest.issues` namespace for all label endpoints: the plan spec referenced `octokit.rest.repos.getLabel/createLabel` but the actual Octokit types put all label management under `octokit.rest.issues` (confirmed via `@octokit/plugin-rest-endpoint-methods` type definitions). Both test and implementation corrected.
- No `throw` anywhere in the adapter: label operations are best-effort — the hero comment must post regardless.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Octokit endpoint namespace correction**
- **Found during:** Task 2 (build step)
- **Issue:** Plan spec stated label creation/lookup endpoints were at `octokit.rest.repos.getLabel` and `octokit.rest.repos.createLabel`. TypeScript build failed with TS2339 because these methods don't exist on `repos` — they live under `octokit.rest.issues`.
- **Fix:** Updated `src/adapters/github/labels.ts` to use `octokit.rest.issues.getLabel` and `octokit.rest.issues.createLabel`. Also updated the mock factory in `tests/adapters/labels.test.ts` to place both mocks under `issues` (single namespace instead of split `repos`/`issues`).
- **Files modified:** `src/adapters/github/labels.ts`, `tests/adapters/labels.test.ts`
- **Commit:** `b845db6`

## Known Stubs

None — the adapter is fully implemented. No placeholder return values or TODO comments.

## Threat Flags

None — no new network endpoints or trust boundaries introduced beyond those already in the plan's threat model (T-02-11 through T-02-15).

## Self-Check

- [x] `src/adapters/github/labels.ts` exists — FOUND
- [x] `tests/adapters/labels.test.ts` exists — FOUND
- [x] `git log --oneline | grep 1010739` — FOUND (RED commit)
- [x] `git log --oneline | grep b845db6` — FOUND (GREEN commit)
- [x] 107 tests pass (96 Phase 1 + 11 new) — PASSED
- [x] `npm run build` exits 0 — PASSED
- [x] `npm run lint` exits 0 — PASSED
- [x] No `throw` statements in `src/adapters/github/labels.ts` — VERIFIED (grep returns 0)
- [x] `status !== 404` appears twice (ensureLabel + removeLabel) — VERIFIED

## Self-Check: PASSED

---
*Phase: 02-action-hardening-repo-awareness*
*Completed: 2026-05-14*

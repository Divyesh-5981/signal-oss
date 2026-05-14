---
phase: 02-action-hardening-repo-awareness
plan: "05"
subsystem: action-orchestrator
tags: [github-action, orchestrator, core-summary, dry-run, sandbox-checkpoint, ACT-06, ACT-07, ACT-08, ACT-09]

requires:
  - phase: 02-action-hardening-repo-awareness
    plan: "02"
    provides: loadRepoContext adapter
  - phase: 02-action-hardening-repo-awareness
    plan: "03"
    provides: ensureLabel/applyLabel/removeLabel adapter
  - phase: 02-action-hardening-repo-awareness
    plan: "04"
    provides: IssueFormStrategy/TemplateMdStrategy + format(scored, repoContext)

provides:
  - src/action/summary.ts — writeSummary (D-09 rich report) + writeSkipSummary (D-11 one-liner)
  - src/action/main.ts — Phase 2 orchestrator with all 8 ACT-07 inputs, skip-label, real loadRepoContext, body truncation, label management, dry-run gating
  - dist/index.js — rebuilt bundle containing all Phase 2 modules (1748KB)

affects:
  - Sandbox E2E (Task 4 checkpoint — awaiting human verification)

tech-stack:
  added: []
  patterns:
    - TDD RED/GREEN for both summary.ts and main.ts rewrite
    - vi.hoisted() pattern for Vitest mock factories that need pre-import access
    - Fluent core.summary builder wrapped in try/catch for GITHUB_STEP_SUMMARY absence

key-files:
  created:
    - src/action/summary.ts
    - tests/action/summary.test.ts
  modified:
    - src/action/main.ts
    - tests/action/main.test.ts
    - dist/index.js
    - dist/index.js.map

key-decisions:
  - "summary.ts kept separate from main.ts to keep orchestrator readable (plan decision)"
  - "vi.hoisted() used for mock vars referenced in vi.mock() factories — avoids hoisting ReferenceError"
  - "Body truncation (T-02-21) applied before score() call — slice(0, maxBodyBytes)"
  - "commentUrl built from commentResult.commentId after hero comment posts"
  - "Label color '#e4e669', description 'Waiting for more information from the issue author' (D-12)"

duration: ~25min
completed: 2026-05-14
---

# Phase 2 Plan 05: Action Wiring Summary

**Phase 2 fully wired end-to-end: all 8 inputs, skip-label opt-out, real loadRepoContext, label management, dry-run gating, rich core.summary report, rebuilt bundle**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-05-14T17:35:00Z
- **Completed:** 2026-05-14T17:45:00Z
- **Tasks:** 3 complete (Task 4 is checkpoint:human-verify — awaiting)
- **Files created:** 2
- **Files modified:** 4

## Accomplishments

### Task 1: summary.ts
- Created `src/action/summary.ts` with `writeSummary` (D-09 rich report) and `writeSkipSummary` (D-11 one-liner)
- D-10 dry-run banner (`⚠️ **Dry-run mode**`) conditional on `dryRun=true`
- `$GITHUB_STEP_SUMMARY` absence handled via try/catch + `core.warning` (Pitfall 5)
- 9/9 tests passing (S1-S8 + S4b)
- TDD: RED `56314f6` → GREEN `095c710`

### Task 2: main.ts rewrite
- All 8 ACT-07 inputs consumed: `dry-run`, `enable-comments`, `enable-labels`, `label-name`, `model`, `gray-zone-low`, `gray-zone-high`, `max-body-bytes`
- ACT-08: `signal-oss-ignore` skip-label exits before any I/O, calls `writeSkipSummary`
- Phase 1 stub `repoContext` replaced with real `loadRepoContext(octokit, owner, repo, defaultBranch)`
- T-02-21: `issue.body` truncated to `maxBodyBytes` chars before `score()` (DoS mitigation)
- Hero comment gated on `!dryRun && enableComments` — always posts before label operations
- Label management: `ensureLabel` → `applyLabel` (items>0) or `removeLabel` (items=0)
- `commentUrl` built from `commentResult.commentId`; passed to `writeSummary`
- 10/10 new tests passing (M1-M9 + happy path); 154/154 total
- TDD: RED `dcb6365` → GREEN `72ace0c`

### Task 3: dist rebuild
- `npm run bundle` succeeded; 1748KB (Phase 1 was 1500KB — modest growth from yaml + new modules)
- All 9 symbols verified present: `loadRepoContext`, `ensureLabel`, `applyLabel`, `removeLabel`, `writeSummary`, `IssueFormStrategy`, `TemplateMdStrategy`, `signal-oss:v1`, `signal-oss-ignore`

## Task Commits

1. **test(02-05): add failing tests for summary.ts (RED)** — `56314f6`
2. **feat(02-05): implement summary.ts** — `095c710`
3. **test(02-05): add failing tests M1-M9 for main.ts rewrite (RED)** — `dcb6365`
4. **feat(02-05): rewrite main.ts as Phase 2 orchestrator** — `72ace0c`
5. **chore(02-05): rebuild dist/index.js with Phase 2 modules** — `c022f2b`

## Files Created/Modified

- `src/action/summary.ts` — 73 LOC; writeSummary + writeSkipSummary
- `tests/action/summary.test.ts` — 9 tests (S1-S8 + S4b)
- `src/action/main.ts` — Phase 2 orchestrator (~119 LOC)
- `tests/action/main.test.ts` — Expanded to 10 tests (happy path + M1-M9)
- `dist/index.js` + `dist/index.js.map` — rebuilt 1748KB bundle

## Deviations from Plan

**1. [Rule 1 - Bug] vi.hoisted() required for Vitest mock factories**
- **Found during:** Task 1 RED phase
- **Issue:** Top-level `const mockWarning = vi.fn()` cannot be referenced inside `vi.mock()` factory — Vitest hoists `vi.mock()` calls above `const` declarations, causing `ReferenceError: Cannot access before initialization`
- **Fix:** Rewrote test setup using `vi.hoisted()` to declare all mock variables before the hoisting boundary
- **Files modified:** `tests/action/summary.test.ts`, `tests/action/main.test.ts`

**2. [Rule 1 - Bug] Dry-run test string mismatch**
- **Found during:** Task 1 GREEN phase
- **Issue:** Test asserted `'⚠️ Dry-run mode'` but implementation renders `'⚠️ **Dry-run mode**'` (with bold markdown). `toContain` fails because `**` is between emoji and `Dry`.
- **Fix:** Test updated to assert `'Dry-run mode'` (substring that exists in both plain and bold variants)

**3. [Rule 1 - Bug] Biome lint: string concat + unsorted imports**
- **Found during:** Task 2 lint verification
- **Issue:** `summary.ts` used `+` string concat instead of template literals; `main.ts` had unsorted imports
- **Fix:** `npx @biomejs/biome check --write src` auto-fixed import order; manual template literal fix in `summary.ts`

## TDD Gate Compliance

- RED gate (summary): `56314f6` — `test(02-05): add failing tests for summary.ts (RED)`
- GREEN gate (summary): `095c710` — `feat(02-05): implement summary.ts with writeSummary and writeSkipSummary`
- RED gate (main): `dcb6365` — `test(02-05): add failing tests M1-M9 for main.ts rewrite (RED)`
- GREEN gate (main): `72ace0c` — `feat(02-05): rewrite main.ts as Phase 2 orchestrator + fix lint`
- All 4 gates present in git log.

## Known Stubs

None — all Phase 2 logic is fully implemented. Task 4 (sandbox E2E) verifies runtime behavior.

## Threat Flags

No new network endpoints or trust boundaries introduced. T-02-21 (body truncation) mitigation is implemented (`slice(0, maxBodyBytes)` verified in `main.ts`).

## Self-Check: PASSED

- `src/action/summary.ts`: FOUND
- `src/action/main.ts`: FOUND (updated)
- `tests/action/summary.test.ts`: FOUND
- `tests/action/main.test.ts`: FOUND (updated)
- `dist/index.js`: FOUND (1748KB)
- Commit `56314f6`: FOUND (test RED summary)
- Commit `095c710`: FOUND (feat GREEN summary)
- Commit `dcb6365`: FOUND (test RED main)
- Commit `72ace0c`: FOUND (feat GREEN main)
- Commit `c022f2b`: FOUND (chore dist rebuild)
- 154/154 tests passing
- Build: clean
- Lint: clean

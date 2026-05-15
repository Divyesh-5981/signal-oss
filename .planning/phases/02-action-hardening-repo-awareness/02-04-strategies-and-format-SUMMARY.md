---
phase: 02-action-hardening-repo-awareness
plan: "04"
subsystem: checklist-strategies
tags: [strategy-chain, tier-1, tier-2, meta-nudge, markdown-format, CHECK-03, CHECK-04, CHECK-06]

# Dependency graph
requires:
  - phase: 02-action-hardening-repo-awareness
    plan: "01"
    provides: ParsedTemplate type, RepoContext.templates typed, ChecklistStrategy.generate ctx? param

provides:
  - IssueFormStrategy (Tier 1) — filename-match + D-05 union fallback + D-08 5-item cap + @-sanitization
  - TemplateMdStrategy (Tier 2) — same logic for type='md' templates
  - generator.ts strategy chain: IssueFormStrategy → TemplateMdStrategy → BaselineStrategy (first-applies-wins)
  - format() updated with optional repoContext param and conditional META_NUDGE (CHECK-06)
  - main.ts call site updated to pass repoContext to format()

affects:
  - 02-05-action-wiring (will swap Phase 1 stub repoContext for real loadRepoContext output)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - First-applies-wins strategy chain with typed ctx propagation
    - @-mention sanitization via replace(/@/g, '(at)') in field label rendering
    - Conditional meta-nudge gating on repoContext absence (backwards-compatible via optional param)

key-files:
  created:
    - src/core/checklist/strategies/issue-form.ts
    - src/core/checklist/strategies/template-md.ts
  modified:
    - src/core/checklist/generator.ts
    - src/core/format/markdown.ts
    - src/action/main.ts
    - tests/core/checklist.test.ts
    - tests/core/format.test.ts

key-decisions:
  - "IssueFormStrategy and TemplateMdStrategy are pure core classes — no src/adapters/ imports (hexagonal invariant)"
  - "D-06 fallthrough: applies() returns false when no template has fields, letting chain continue to next strategy"
  - "D-08 cap: .slice(0, 5) in generate() limits output regardless of how many fields a template declares"
  - "META_NUDGE gated via optional repoContext param: undefined (legacy callers) = nudge shown; either flag true = nudge hidden"
  - "main.ts Phase 1 stub repoContext (hasIssueForms: false, hasMdTemplates: false) passes through harmlessly — meta-nudge still renders on no-template repos until Plan 05 wires the real adapter"

# Metrics
duration: ~4min
completed: 2026-05-14
---

# Phase 2 Plan 04: Strategies and Format Summary

**Tier 1 (IssueFormStrategy) and Tier 2 (TemplateMdStrategy) wired into the strategy chain; format() meta-nudge gated on absence of both template types (CHECK-06); @-mention sanitization in all field label rendering**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-05-14T11:47:42Z
- **Completed:** 2026-05-14T11:51:00Z
- **Tasks:** 2 (TDD: RED + GREEN)
- **Files created:** 2
- **Files modified:** 5

## Accomplishments

- Created `IssueFormStrategy` (Tier 1, CHECK-03): consumes `ParsedTemplate[]` where `type: 'form'`; filename-match selection (`bug_report`, `feature_request`, `question` keywords); D-05 deduplicated union fallback; D-08 5-item cap; `@`-mention sanitization
- Created `TemplateMdStrategy` (Tier 2, CHECK-04): identical selection logic for `type: 'md'` templates
- Updated `generator.ts`: IssueFormStrategy and TemplateMdStrategy prepended; `ctx` now passed to `generate()` call
- Updated `format/markdown.ts`: optional `repoContext?: RepoContext` second param; `showMetaNudge` conditional guards META_NUDGE (CHECK-06)
- Updated `main.ts`: `format(scored, repoContext)` call site updated; Phase 1 stub context passes through correctly until Plan 05
- Added 29 new tests (A1–A15 for strategies, A12–A14 for chain priority, F1–F4 for meta-nudge gating)
- All 125/125 tests passing, build clean, hexagonal invariant verified

## Task Commits

1. **Task 1: Write failing tests (RED)** — `ba81847`
   - Added A1–A15 strategy tests, A12–A14 chain priority tests, F1–F4 meta-nudge gating tests
   - Module-not-found for issue-form.js/template-md.js confirmed RED

2. **Task 2: Implement strategies, update generator + format + main.ts (GREEN)** — `88643fe`
   - Created issue-form.ts, template-md.ts
   - Updated generator.ts, markdown.ts, main.ts
   - All 125 tests green

## Files Created/Modified

- `src/core/checklist/strategies/issue-form.ts` — IssueFormStrategy class (~65 LOC)
- `src/core/checklist/strategies/template-md.ts` — TemplateMdStrategy class (~62 LOC)
- `src/core/checklist/generator.ts` — Added 2 imports + 2 STRATEGIES entries + ctx propagation
- `src/core/format/markdown.ts` — Updated import, signature, showMetaNudge conditional
- `src/action/main.ts` — Updated format() call site (1-line diff)
- `tests/core/checklist.test.ts` — Added 19 new test blocks
- `tests/core/format.test.ts` — Added F1–F4 meta-nudge tests

## Decisions Made

- Hexagonal invariant: neither strategy imports from `src/adapters/` — clean core/adapter boundary
- D-06 fallthrough: `applies()` returns false when no template has any fields, allowing chain to fall through to next strategy
- @-mention sanitization: `replace(/@/g, '(at)')` prevents field labels like "Tag @maintainer" from tagging GitHub users in posted comments (T-02-16 threat mitigation)
- Backwards-compatible `format()`: `repoContext` is optional; existing callers with no second arg still see the meta-nudge

## Deviations from Plan

None — plan executed exactly as written. Format array style fixed to satisfy Biome formatter (inline to multi-line).

## TDD Gate Compliance

- RED gate: `ba81847` — `test(02-04): add failing tests...`
- GREEN gate: `88643fe` — `feat(02-04): implement IssueFormStrategy...`
- Both gates present in git log.

## Known Stubs

None — all strategy logic is fully implemented. The Phase 1 stub `repoContext` in `main.ts` (lines 38-43) is intentional and documented; Plan 05 will replace it with a real `loadRepoContext()` call.

## Threat Flags

No new network endpoints, auth paths, or file access patterns introduced. All changes are pure core logic.

## Self-Check: PASSED

- `src/core/checklist/strategies/issue-form.ts`: FOUND
- `src/core/checklist/strategies/template-md.ts`: FOUND
- `src/core/checklist/generator.ts`: FOUND (updated)
- `src/core/format/markdown.ts`: FOUND (updated)
- `src/action/main.ts`: FOUND (updated)
- Commit `ba81847`: FOUND (test RED)
- Commit `88643fe`: FOUND (feat GREEN)
- 125/125 tests passing
- Build: clean
- Hexagonal invariant: clean

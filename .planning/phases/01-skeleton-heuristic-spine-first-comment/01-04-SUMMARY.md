---
phase: 01-skeleton-heuristic-spine-first-comment
plan: "04"
subsystem: core
tags: [checklist, score, format, tone, walking-skeleton, pipeline]
dependency_graph:
  requires: [01-03-heuristics-classifier]
  provides: [CHECK-01, CHECK-02, CORE-04, CORE-05, CORE-01-final]
  affects: [src/core/index.ts, src/action/main.ts]
tech_stack:
  added: []
  patterns: [strategy-chain, first-applies-wins, weighted-sum-score, gray-zone-band, D-07-comment-structure]
key_files:
  created:
    - src/core/checklist/baselines.ts
    - src/core/checklist/strategies/baseline.ts
    - src/core/checklist/generator.ts
    - src/core/score/weights.ts
    - src/core/score/compute.ts
    - src/core/format/markdown.ts
    - tests/core/checklist.test.ts
    - tests/core/score.test.ts
    - tests/core/format.test.ts
    - tests/core/score-pipeline.test.ts
  modified:
    - src/core/types.ts
    - src/core/index.ts
    - dist/index.js
decisions:
  - "D-07 ordering preserved: intro → checklist → badge → meta-nudge → closing → marker"
  - "D-09 hero-output-always: empty checklist uses well-formed intro, comment still posts"
  - "Tone tests search for **Tip:** (bold markdown) not plain 'Tip:' to match actual META_NUDGE format"
  - "Gray-zone band: GRAY_ZONE_LOW=4, GRAY_ZONE_HIGH=6 per D-13"
metrics:
  duration: "~10 minutes"
  completed: "2026-05-09"
  tasks_completed: 2
  files_created: 10
  tests_added: 27
---

# Phase 1 Plan 04: Checklist Generator, Score, Format Summary

**One-liner:** Strategy-chain checklist generator with Tier-4 baseline, weighted-sum score 0-10 with gray-zone band 4-6, and D-07 markdown formatter — replaces Plan 02 stub with real pipeline.

## Confirmed Deliverables

- **Real score() pipeline replaces Plan 02 stub:** `src/core/index.ts` now calls `extractSignals → classifyType → generateChecklist → computeScore` (CORE-01 final delivery).
- **D-07 comment structure rendered in correct order:** intro / checklist / badge / nudge / closing / marker — verified by format.test.ts ordering assertions.
- **D-09 hero-output-always invariant:** empty-items branch tested — comment still posts with well-formed intro, score badge, nudge, and marker.
- **dist/index.js byte size after Plan 04 build:** 1,335,783 bytes (1.3 MB).
- **Tone guide:** `grep -rE "(Required:|\\bMust\\b|\\bInvalid\\b)" src/core/` returns 0 lines.
- **Hexagonal invariant:** `grep -rE "from ['\"](@octokit|@actions|fs|https|@anthropic-ai/sdk|openai)" src/core/` returns 0 lines.

## Sample format() Output

### High-quality bug (all signals satisfied → empty checklist)

```
This issue looks well-formed — no missing info detected.

**Actionability score: 10/10**

> **Tip:** adding an issue template to `.github/ISSUE_TEMPLATE/` helps reporters include the right information upfront.

<!-- signal-oss:v1 -->
```

### Low-quality bug (empty issue body)

```
Thanks for opening this issue! To help us investigate, a few things seem to be missing:

- [ ] Could you share the steps to reproduce the issue?
- [ ] Could you share the version of the library/tool you're using?
- [ ] Could you share any error messages or stack traces you saw?
- [ ] Could you provide a minimal reproduction (a small code snippet)?

**Actionability score: 0/10**

> **Tip:** adding an issue template to `.github/ISSUE_TEMPLATE/` helps reporters include the right information upfront.

Once these are added, we'll take another look. Thanks for helping make this actionable!

<!-- signal-oss:v1 -->
```

## Test Results

- **86 tests passing** across 7 test files (types, heuristics, classifier, checklist, score, format, score-pipeline).
- Breakdown: types(5) + heuristics(28) + classifier(20) + checklist(10) + score(8) + format(11) + score-pipeline(6) + format(12) = 86 total.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Test assertions used wrong substring for META_NUDGE**
- **Found during:** Task 2 — first test run
- **Issue:** `format.test.ts` searched for `'Tip: adding an issue template'` but the META_NUDGE string is `> **Tip:** adding an issue template...`. The bold markdown `**Tip:**` means the substring `Tip:` followed by a space is never present — it's followed by `**`.
- **Fix:** Changed test assertions from `'Tip: adding an issue template'` to `'**Tip:**'` to match the actual rendered output.
- **Files modified:** `tests/core/format.test.ts`
- **Commit:** 37de712

## Known Stubs

None. All pipeline stages are wired. format() output is the exact comment that Plan 05 will post via Octokit.

## Threat Flags

None. format() only interpolates internally-computed values (score number, item texts from BASELINE_ITEMS). Issue body content is never interpolated into the comment (T-01-01 mitigated by inspection).

## Self-Check: PASSED

- src/core/checklist/baselines.ts: FOUND
- src/core/checklist/strategies/baseline.ts: FOUND
- src/core/checklist/generator.ts: FOUND
- src/core/score/weights.ts: FOUND
- src/core/score/compute.ts: FOUND
- src/core/format/markdown.ts: FOUND
- tests/core/format.test.ts: FOUND
- tests/core/score-pipeline.test.ts: FOUND
- Commit ec79a9c (Task 1): FOUND
- Commit 37de712 (Task 2): FOUND
- 86 tests passing: VERIFIED
- dist/index.js exists (1.3MB): VERIFIED

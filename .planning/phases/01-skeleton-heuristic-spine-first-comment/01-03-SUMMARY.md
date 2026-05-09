---
phase: 01-skeleton-heuristic-spine-first-comment
plan: "03"
subsystem: core-heuristics
tags: [heuristics, classifier, ast, remark, mdast]
dependency_graph:
  requires: [01-02-dtos-stub]
  provides: [extractSignals, classifyType]
  affects: [01-04-score-checklist]
tech_stack:
  added: [remark-parse, unified, unist-util-visit, mdast-util-to-string]
  patterns: [mdast-ast-walk, pure-function, hexagonal-boundary]
key_files:
  created:
    - src/core/heuristics/extractor.ts
    - src/core/classifier/issue-type.ts
    - tests/core/heuristics.test.ts
    - tests/core/classifier.test.ts
    - tests/fixtures/issues/bug-with-stack.md
    - tests/fixtures/issues/feature-request.md
    - tests/fixtures/issues/question.md
    - tests/fixtures/issues/image-only.md
    - tests/fixtures/issues/empty.md
  modified: []
decisions:
  - "VERSION_REGEX requires full semver (\\d+.\\d+.\\d+) OR lang-keyword+digit to prevent 'version 2 of the docs' false positive (Pitfall 7)"
  - "STACK_TRACE_REGEX checks for Error prefix OR 'at symbol(' pattern only in code nodes with no lang tag"
  - "classifyType default fallback is 'bug' per RESEARCH Pitfall 18 (most ambiguous issues are defects)"
  - "hasMinimalExample=false for bug-with-stack.md fixture (code block has no lang tag)"
metrics:
  duration: "~8 minutes"
  completed: "2026-05-09"
  tasks_completed: 2
  tasks_total: 2
  files_created: 9
  files_modified: 0
requirements_met: [CORE-02, CORE-03]
---

# Phase 01 Plan 03: Heuristics Classifier Summary

**One-liner:** Pure mdast AST heuristics extractor (7 signals) + 4-tier label/title/body/default issue-type classifier, both fully tested with 59 total suite tests passing.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | extractSignals + 5 fixtures + heuristics tests | 53af457 | src/core/heuristics/extractor.ts, tests/core/heuristics.test.ts, 5 fixture files |
| 2 | classifyType + classifier tests | 3e2e3b8 | src/core/classifier/issue-type.ts, tests/core/classifier.test.ts |

## What Was Built

### extractSignals (CORE-02)

Pure function walking the mdast AST of `issue.body` via `remark-parse` + `unist-util-visit`. Emits all 7 boolean `Signals`:

| Signal | Detection Strategy |
|--------|--------------------|
| hasCodeBlock | Any `code` mdast node present |
| hasStackTrace | `code` node with no lang AND matches `^Error\b` or `\s+at symbol(` |
| hasVersionMention | Concatenated `text` node blob matches full semver OR lang-keyword+digit |
| hasReproKeywords | Any `heading` toString matches repro/steps-to/to-reproduce |
| hasExpectedActual | One heading matches /expected/i AND another matches /actual/i |
| hasMinimalExample | Any `code` node has a non-empty `lang` field |
| hasImageOnly | imageCount > 0 AND codeNodes.length === 0 |

### classifyType (CORE-03)

Pure precedence chain:
1. **Labels** — matches bug/crash/defect/regression, feat/feature/enhancement, question/support/help
2. **Title patterns** — [BUG]/bug:/crash patterns, feat:/feature-request patterns, how-do-i/why/what patterns
3. **Body signals** — hasStackTrace|hasExpectedActual→bug; body keywords→feature or question
4. **Default** — 'bug'

### Test Coverage

- **heuristics.test.ts**: 28 tests — positive+negative for each of 7 signals + 4 fixture-driven cross-checks
- **classifier.test.ts**: 20 tests — all 4 precedence tiers, label-wins-over-title, case-insensitivity, default fallback
- **Total suite**: 59 tests passing (11 prior + 28 heuristics + 20 classifier)

## Decisions Made

1. **VERSION_REGEX requires `\d+\.\d+\.\d+` (three-part semver) OR explicit lang-keyword + digit.** "version 2 of the docs" → false (no match). "Node v18" → true. "v1.2.3" → true. Directly addresses Pitfall 7.

2. **STACK_TRACE_REGEX only fires on code nodes with no lang tag.** A `\`\`\`js` block with `Error: something` is not a stack trace — it's a minimal example. Unlang'd blocks containing `Error:` or `at symbol(` are stack traces.

3. **classifyType defaults to 'bug'.** Most ambiguous OSS issues are defects not yet articulated well. Per RESEARCH Pitfall 18 and CONTEXT decision D-05.

4. **bug-with-stack.md fixture has `hasMinimalExample=false`** because the error code block has no lang tag (triple-backtick only). This is correct and intentional — the fixture tests hasStackTrace=true, not hasMinimalExample.

5. **mdast-util-to-string on headings** worked correctly for nested inline content. `toString(headingNode)` flattens all child text nodes, so `## Steps to **Reproduce**` correctly returns "Steps to Reproduce".

## Confirmed Signal Behaviors on Fixtures

| Fixture | hasCodeBlock | hasStackTrace | hasVersion | hasRepro | hasExpActual | hasMinExample | hasImageOnly |
|---------|-------------|---------------|------------|----------|--------------|---------------|--------------|
| bug-with-stack.md | true | true | true | true | true | false | false |
| feature-request.md | false | false | false | false | false | false | false |
| question.md | false | false | false | false | false | false | false |
| image-only.md | false | false | false | false | false | false | true |
| empty.md | false | false | false | false | false | false | false |

## Hexagonal Boundary

`grep -rE "from ['\"](@octokit|@actions|fs|https|@anthropic-ai/sdk|openai)" src/core/` — **0 lines**. Both modules are pure functions with zero I/O imports.

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- src/core/heuristics/extractor.ts: FOUND
- src/core/classifier/issue-type.ts: FOUND
- tests/core/heuristics.test.ts: FOUND (28 it() declarations)
- tests/core/classifier.test.ts: FOUND (20 it() declarations)
- All 5 fixture files in tests/fixtures/issues/: FOUND
- Commits 53af457 and 3e2e3b8: FOUND
- Full test suite: 59/59 passing
- Hexagonal invariant: PASSED

---
status: testing
phase: 01-skeleton-heuristic-spine-first-comment
source:
  - .planning/phases/01-skeleton-heuristic-spine-first-comment/01-01-SUMMARY.md
  - .planning/phases/01-skeleton-heuristic-spine-first-comment/01-02-SUMMARY.md
  - .planning/phases/01-skeleton-heuristic-spine-first-comment/01-03-SUMMARY.md
  - .planning/phases/01-skeleton-heuristic-spine-first-comment/01-04-SUMMARY.md
  - .planning/phases/01-skeleton-heuristic-spine-first-comment/01-05-SUMMARY.md
started: 2026-05-09T00:00:00Z
updated: 2026-05-09T00:00:00Z
---

## Current Test

number: 4
name: Format Comment — Structure and Tone
expected: |
  For a low-quality issue (empty body), format() produces a comment that:
  1. Starts with a friendly intro line (contains "Thanks for opening" or similar — NOT "Required:" or "Must" or "Invalid")
  2. Has the checklist items as markdown task list items (- [ ] …)
  3. Has an **Actionability score: N/10** badge line
  4. Has a > **Tip:** nudge line about issue templates
  5. Ends with a closing line followed by `<!-- signal-oss:v1 -->`
  Sections appear in that order. No gatekeeping language.
awaiting: automated-check

## Tests

### 1. Cold Start Smoke Test
expected: |
  From a clean state: run `npm install` (if node_modules absent) then `npm run test`.
  Vitest runs 96 tests across 8 test files and reports 96 passed, 0 failed, 0 skipped.
  No errors in stderr output.
result: pass

### 2. Full Pipeline Build (npm run all)
expected: |
  Run `npm run all` from the repo root.
  All three stages complete with exit 0:
  - Biome lint: "Checked N file(s)" with no errors
  - Vitest: 96 passed, 0 failed
  - Rollup bundle: dist/index.js written, no RollupError in output
  The final exit code of `npm run all` is 0.
result: pass

### 3. Score Pipeline — Low-Quality Issue
expected: |
  Run `npm run test` and look at the score-pipeline.test.ts output (or run node -e in the REPL):
  Given an issue with title "bug" and an empty body, score() should return:
  - score: 0 (or very low, ≤2)
  - items array with at least 3 checklist items (repro steps, version, error/stack, minimal example)
  - tierUsed: "baseline" (Tier 4)
  - isGrayZone: false
  No crash or unhandled exception.
result: pass

### 4. Format Comment — Structure and Tone
expected: |
  For a low-quality issue (empty body), format() produces a comment that:
  1. Starts with a friendly intro line (contains "Thanks for opening" or similar — NOT "Required:" or "Must" or "Invalid")
  2. Has the checklist items as markdown task list items (- [ ] …)
  3. Has an **Actionability score: N/10** badge line
  4. Has a > **Tip:** nudge line about issue templates
  5. Ends with a closing line followed by `<!-- signal-oss:v1 -->`
  Sections appear in that order. No gatekeeping language.
result: pass

### 5. Local-Action Dry Run
expected: |
  Run the Action locally using the fixture event:
    npx @github/local-action run dist/index.js
  (Set required env vars: GITHUB_TOKEN=any-fake-value, INPUT_ANTHROPIC-API-KEY=sk-ant-fake, etc.)
  The action logs a score, issue type, tier, and comment ID to stdout (core.info calls).
  The comment body printed/dispatched contains `<!-- signal-oss:v1 -->`.
  The process exits 0 (no core.setFailed call triggered).
result: [pending]

### 6. Sandbox E2E — Live GitHub Comment
expected: |
  Push the action to a sandbox GitHub repo and open a new issue with minimal body (e.g., "it doesn't work").
  Within ~30 seconds the triage.yml workflow runs and posts a comment on the issue containing:
  - A friendly intro paragraph
  - A markdown checklist of 3–4 missing-info items
  - An "Actionability score: N/10" line (score expected ≤3 for this minimal issue)
  - The `<!-- signal-oss:v1 -->` marker at the end
  Reopening the same issue triggers an UPDATE to the existing comment (not a second comment).
result: [pending]

## Summary

total: 6
passed: 4
issues: 0
skipped: 0
pending: 2

## Gaps

- truth: "hasStackTrace detects stack traces in fenced code blocks regardless of language tag, and in plain paragraph text"
  status: fixed
  reason: "User reported: stack trace not detected when pasted as plain text or in lang-tagged code block"
  fix: "Extended hasStackTrace to check all code nodes (any lang) + textBlob for STACK_TRACE_REGEX. 96/96 tests pass."
  severity: major
  test: 3
  artifacts: [src/core/heuristics/extractor.ts]

- truth: "hasVersionMention detects version strings that appear inside code blocks, not just text nodes"
  status: fixed
  reason: "User reported: version only scans textBlob (text nodes); version strings in code block content are invisible"
  fix: "Added codeBlob (joined code node values) OR'd into hasVersionMention check. 96/96 tests pass."
  severity: major
  test: 3
  artifacts: [src/core/heuristics/extractor.ts]

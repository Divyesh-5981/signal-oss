---
phase: 02-action-hardening-repo-awareness
plan: "02"
subsystem: adapters
tags: [adapter, octokit, yaml-parser, markdown-parser, templates, CHECK-03, CHECK-04]

# Dependency graph
requires:
  - phase: 02-action-hardening-repo-awareness
    plan: "01"
    provides: yaml@2.9.0 installed, ParsedTemplate interface, RepoContext.templates typed

provides:
  - src/adapters/github/templates.ts with loadRepoContext(), parseIssueFormFields(), parseMdTemplate()
  - 5 real-world fixture files under tests/fixtures/templates/
  - 10 unit tests in tests/adapters/templates.test.ts covering all 4 branches

affects:
  - 02-04-strategies (IssueFormStrategy and TemplateMdStrategy consume loadRepoContext output)
  - 02-05-wiring (main.ts calls loadRepoContext to populate RepoContext)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Adapter trust boundary: all Octokit calls, base64 decoding, YAML parsing, AST walking contained in one file
    - Never-throw pattern: every error path uses core.warning() + fallthrough, never propagates exceptions
    - Pitfall 3 guard: v.required === true || v.required === 'true' (loose coercion avoids missing string variant)
    - Pitfall 2 guard: f.name.toLowerCase() !== 'config.yml' before any parse
    - Pitfall 1 guard: Array.isArray(data) check immediately after directory listing response

key-files:
  created:
    - src/adapters/github/templates.ts (loadRepoContext + private parseIssueFormFields + parseMdTemplate)
    - tests/adapters/templates.test.ts (10 unit tests, Vitest 3.x with mocked Octokit)
    - tests/fixtures/templates/vue-bug_report.yml (vue/core-style issue form, 3 required fields)
    - tests/fixtures/templates/vscode-bug_report.yml (required: 'true' string coercion variant)
    - tests/fixtures/templates/rust-bug_report.md (mixed heading depths, 3 H3 headings)
    - tests/fixtures/templates/config.yml (chooser config, must be skipped)
    - tests/fixtures/templates/malformed.yml (invalid YAML, resilience fixture)
  modified: []

key-decisions:
  - "loadRepoContext never throws — all errors become core.warning() + empty fallback; hero output invariant (D-03)"
  - "config.yml filtered by name before fetch to avoid wasted API call (Pitfall 2 / T-02-07)"
  - "Explicit === true || === 'true' over loose == true to satisfy Biome linter while still covering Pitfall 3"
  - "Both functions (parseIssueFormFields, parseMdTemplate) are private (unexported) — only loadRepoContext is the public surface"
  - "markdown.ts reformatted (long-line Biome format fix) as Rule 3 auto-fix (linter blocked the task)"

requirements-completed: [CHECK-03, CHECK-04]

# Metrics
duration: 4min
completed: 2026-05-14
---

# Phase 2 Plan 02: Templates Adapter Summary

**Octokit-based templates adapter that decodes base64 file content, parses issue-form YAML (required fields only, type:markdown skipped, config.yml skipped) and markdown H3 headings into typed ParsedTemplate[], never throws on any API or parse error**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-05-14T11:47:22Z
- **Completed:** 2026-05-14T11:51:00Z
- **Tasks:** 2 (TDD RED + GREEN)
- **Files created:** 7

## Accomplishments

- Created `src/adapters/github/templates.ts` implementing `loadRepoContext()` with two private parsers
- `parseIssueFormFields()`: walks `doc.body`, filters `type: markdown` entries, includes only `validations.required === true || 'true'` fields, extracts `attributes.label`
- `parseMdTemplate()`: uses `unified()` + `remark-parse` + `unist-util-visit` to extract only H3 (`depth === 3`) headings via `mdast-util-to-string`
- All 3 Pitfall guards implemented: Array.isArray (Pitfall 1), config.yml skip (Pitfall 2), string 'true' coercion (Pitfall 3)
- Never-throw contract: 5 `core.warning()` paths, zero `throw` statements
- 5 real-world fixtures: vue form (3 required fields), vscode form (string 'true' variant), rust markdown (3 H3s), config.yml (skip), malformed.yml (resilience)
- 10 unit tests covering: 404 dir, required fields, config skip, malformed YAML, H3 extraction, string coercion, markdown skip, partial-failure resilience, base64 newlines, mixed dir

## Task Commits

1. **Task 1: Fixture corpus + failing test suite (RED)** - `eae71bb` (test)
2. **Task 2: Implement loadRepoContext (GREEN)** - `9239560` (feat)

## Files Created/Modified

- `src/adapters/github/templates.ts` (new, 137 lines) — loadRepoContext + private parsers
- `tests/adapters/templates.test.ts` (new, 10 tests) — all branches covered
- `tests/fixtures/templates/vue-bug_report.yml` (new) — vue/core-style form with 3 required fields
- `tests/fixtures/templates/vscode-bug_report.yml` (new) — Pitfall 3 string 'true' variant
- `tests/fixtures/templates/rust-bug_report.md` (new) — mixed headings, H1/H2/H3/H4
- `tests/fixtures/templates/config.yml` (new) — chooser config (skip test)
- `tests/fixtures/templates/malformed.yml` (new) — invalid YAML (resilience test)

## Decisions Made

- `loadRepoContext` never throws: hero output invariant (D-03) requires the function to always return a safe `RepoContext` even on total API failure
- `config.yml` filtered by filename *before* the per-file fetch — avoids a wasted Octokit call (Test 3 asserts getContent called exactly twice)
- Explicit `=== true || === 'true'` instead of loose `== true` — satisfies Biome 2.x linter (`useLiteralKeys` and no-eqeqeq rules) while covering both variants of Pitfall 3
- Private (unexported) parsers: `parseIssueFormFields` and `parseMdTemplate` are implementation details; only `loadRepoContext` forms the public adapter contract
- `hasContributing: false` hardcoded — CONTRIBUTING.md loading is deferred to Phase 4 (Phase 2 scope per D-01..D-04)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Biome lint: computed property access instead of dot notation**
- **Found during:** Task 2 — `npm run lint` after implementation
- **Issue:** `f['validations']`, `v['required']`, `f['attributes']`, `attrs?.['label']` flagged by Biome `useLiteralKeys` rule
- **Fix:** Replaced bracket notation with dot notation throughout `parseIssueFormFields`
- **Files modified:** `src/adapters/github/templates.ts`
- **Commit:** `9239560` (fixed in same commit)

**2. [Rule 1 - Bug] Biome format: long line in markdown.ts**
- **Found during:** Task 2 — `npm run lint` showed format error in `src/core/format/markdown.ts`
- **Issue:** Long array chain on single line exceeded Biome print width
- **Resolution:** Another parallel Wave 2 agent (02-04) had already fixed this file by the time lint ran. No additional commit needed.

**3. [Rule 1 - Bug] Biome format: import order in templates.ts**
- **Found during:** Task 2 — `npm run lint` flagged `organizeImports` violation
- **Fix:** Reordered imports alphabetically as required by Biome's `organizeImports` assist rule
- **Files modified:** `src/adapters/github/templates.ts`
- **Commit:** `9239560` (fixed in same commit)

## Known Stubs

None — `loadRepoContext` is fully implemented. `hasContributing: false` is intentional and documented (Phase 4 scope).

## Threat Flags

No new network endpoints, auth paths, or trust boundaries introduced beyond what the plan's threat model (`<threat_model>`) already documents (T-02-05 through T-02-10).

| Threat ID | Status |
|-----------|--------|
| T-02-05 Malformed YAML | Mitigated — try/catch in parseIssueFormFields returns [] |
| T-02-07 config.yml parsed as template | Mitigated — filename filter before fetch |
| T-02-10 Polymorphic getContent | Mitigated — Array.isArray guard |

## Self-Check

- `src/adapters/github/templates.ts` FOUND
- `tests/adapters/templates.test.ts` FOUND (21 it() blocks, 10 in the templates suite)
- `tests/fixtures/templates/*.{yml,md}` FOUND (5 files)
- Commits `eae71bb`, `9239560` present in git log
- `npm test -- --run tests/adapters/templates.test.ts` → 10 passed
- `npm run build` → exit 0
- `npm run lint` → no errors

## Self-Check: PASSED

---
*Phase: 02-action-hardening-repo-awareness*
*Completed: 2026-05-14*

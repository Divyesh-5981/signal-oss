---
phase: 02-action-hardening-repo-awareness
verified: 2026-05-15T10:05:00Z
status: human_needed
score: 9/10 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Sandbox E2E — 5 scenarios on a real GitHub repo"
    expected: "Tier 1 checklist from issue form fields; idempotent comment (no duplicate on reopen); label removed when checklist empty; signal-oss-ignore opt-out produces skip-only summary; meta-nudge visible when repo has no templates"
    why_human: "Task 4 in Plan 05 is a blocking checkpoint:human-verify gate. The SUMMARY claims 5/5 scenarios passed and the gate was APPROVED, but this cannot be verified programmatically. Must be confirmed by the developer who ran the E2E."
---

# Phase 2: Action Hardening + Repo-Awareness Verification Report

**Phase Goal:** The Action becomes safe to install on real popular OSS repos — comments are idempotent, labels managed cleanly, opt-out works, checklist tailored via Tier 1 (issue forms YAML) and Tier 2 (markdown templates).
**Verified:** 2026-05-15T10:05:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `yaml` package installed as runtime dependency | ✓ VERIFIED | `package.json` has `"yaml": "^2.9.0"` under `dependencies`; `npm ls yaml` confirms `yaml@2.9.0` |
| 2 | `ParsedTemplate` interface exported from `src/core/types.ts` with `filename`, `type`, `fields` | ✓ VERIFIED | Lines 32–36 of `types.ts`; exact shape matches plan spec |
| 3 | `RepoContext.templates` typed `ParsedTemplate[]` (no longer `unknown[]`) | ✓ VERIFIED | Line 27 of `types.ts`: `templates: ParsedTemplate[]` |
| 4 | `ChecklistStrategy.generate` accepts optional `ctx?: RepoContext` third parameter | ✓ VERIFIED | Line 58 of `types.ts`: `generate(type: IssueType, signals: Signals, ctx?: RepoContext): ChecklistItem[]` |
| 5 | `action.yml` declares all 9 inputs with correct defaults | ✓ VERIFIED | `node -e` validation confirms 9 keys present; all defaults correct; `runs: node24` preserved |
| 6 | `loadRepoContext` in `src/adapters/github/templates.ts` returns typed `RepoContext` from `.github/ISSUE_TEMPLATE/` with never-throw contract | ✓ VERIFIED | 137 lines; `Array.isArray` guard; `config.yml` filter; 5 `core.warning` error paths; 0 `throw` statements; 10 tests all passing |
| 7 | Label adapter (`ensureLabel`, `applyLabel`, `removeLabel`) is idempotent and never throws | ✓ VERIFIED | `labels.ts` 92 lines; `status !== 404` appears twice; color `replace(/^#/,'')` present; 0 `throw` statements; 11 tests passing |
| 8 | Strategy chain uses IssueFormStrategy → TemplateMdStrategy → BaselineStrategy; meta-nudge gated on template absence | ✓ VERIFIED | `generator.ts` confirms chain order and `s.generate(type, signals, ctx)` call; `markdown.ts` has `showMetaNudge` conditional; hexagonal invariant holds (no `src/core/` imports `src/adapters/`) |
| 9 | `main.ts` wires all 8 inputs, skip-label check, real `loadRepoContext`, body truncation, label management, dry-run gating, rich summary | ✓ VERIFIED | All 17 acceptance criterion strings found in `main.ts`; 10 tests in `main.test.ts`; `dist/index.js` (1.75MB) contains all 9 required symbols |
| 10 | Sandbox E2E: 5 scenarios passed on a real GitHub repo | ? UNCERTAIN | SUMMARY claims APPROVED (5/5 scenarios); Task 4 is a blocking `checkpoint:human-verify` gate — requires human confirmation |

**Score:** 9/10 truths verified (1 uncertain — human checkpoint)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/core/types.ts` | ParsedTemplate interface; widened templates type; ctx? on generate | ✓ VERIFIED | Lines 30–36 add `ParsedTemplate`; line 27 `templates: ParsedTemplate[]`; line 58 `ctx?: RepoContext` |
| `action.yml` | 9 ACT-07 inputs; `runs: node24` preserved | ✓ VERIFIED | 9 inputs confirmed; `runs.using === 'node24'` |
| `package.json` | `yaml` under `dependencies` | ✓ VERIFIED | `"yaml": "^2.9.0"` in `dependencies` |
| `src/adapters/github/templates.ts` | `loadRepoContext` + parsers; ≥80 lines | ✓ VERIFIED | 137 lines; `loadRepoContext` exported; `parseYaml` from `yaml`; `remarkParse` imported |
| `tests/adapters/templates.test.ts` | ≥100 lines; 10+ tests | ✓ VERIFIED | 10 `it()` blocks; all pass |
| `tests/fixtures/templates/vue-bug_report.yml` | Real-world form fixture | ✓ VERIFIED | Exists with `required: true` fields |
| `tests/fixtures/templates/rust-bug_report.md` | Markdown template fixture | ✓ VERIFIED | Exists with H3 headings |
| `tests/fixtures/templates/vscode-bug_report.yml` | String `required: 'true'` variant | ✓ VERIFIED | Exists |
| `tests/fixtures/templates/config.yml` | Chooser config (skip test) | ✓ VERIFIED | Exists |
| `tests/fixtures/templates/malformed.yml` | Invalid YAML (resilience) | ✓ VERIFIED | Exists |
| `src/adapters/github/labels.ts` | `ensureLabel`, `applyLabel`, `removeLabel`, `LabelAction`; ≥60 lines | ✓ VERIFIED | 92 lines; all 4 exports present |
| `tests/adapters/labels.test.ts` | ≥100 lines; 10+ tests | ✓ VERIFIED | 11 `it()` blocks; all pass |
| `src/core/checklist/strategies/issue-form.ts` | `IssueFormStrategy`; ≥40 lines | ✓ VERIFIED | 82 lines; `IssueFormStrategy` exported; `MAX_ITEMS = 5`; `@`-sanitization present |
| `src/core/checklist/strategies/template-md.ts` | `TemplateMdStrategy`; ≥35 lines | ✓ VERIFIED | 79 lines; `TemplateMdStrategy` exported; same patterns |
| `src/core/checklist/generator.ts` | IssueFormStrategy + TemplateMdStrategy in chain; `ctx` passed | ✓ VERIFIED | Both new strategies prepended; `s.generate(type, signals, ctx)` |
| `src/core/format/markdown.ts` | `repoContext?: RepoContext` param; `showMetaNudge` conditional | ✓ VERIFIED | Both patterns present |
| `src/action/main.ts` | Full Phase 2 orchestrator; all acceptance criteria | ✓ VERIFIED | All 17 required strings present; `format(scored, repoContext)` wired |
| `src/action/summary.ts` | `writeSummary` + `writeSkipSummary`; ≥50 lines | ✓ VERIFIED | 73 lines; dry-run banner; 7 signal labels; try/catch on `summary.write()` |
| `tests/action/summary.test.ts` | 8+ tests | ✓ VERIFIED | 9 `it()` blocks; all pass |
| `tests/action/main.test.ts` | 9+ new tests | ✓ VERIFIED | 10 `it()` blocks total |
| `dist/index.js` | Rebuilt bundle; all 9 symbols present; 1.0–4.0 MB | ✓ VERIFIED | 1.75 MB; all 9 symbols present (`loadRepoContext`, `ensureLabel`, `applyLabel`, `removeLabel`, `writeSummary`, `IssueFormStrategy`, `TemplateMdStrategy`, `signal-oss:v1`, `signal-oss-ignore`) |
| `dist/index.js.map` | Source map alongside bundle | ✓ VERIFIED | 3.1 MB; exists |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/core/types.ts` | `src/core/checklist/strategies/baseline.ts` | `implements ChecklistStrategy` | ✓ WIRED | BaselineStrategy still implements the extended interface |
| `src/adapters/github/templates.ts` | `src/core/types.ts` | `import type { ParsedTemplate, RepoContext }` | ✓ WIRED | Line 14 of `templates.ts` |
| `src/adapters/github/templates.ts` | `octokit.rest.repos.getContent` | directory listing + per-file fetch | ✓ WIRED | Both calls present with try/catch |
| `src/adapters/github/templates.ts` | `yaml` | `parse as parseYaml` from `'yaml'` | ✓ WIRED | Line 13 of `templates.ts` |
| `src/adapters/github/templates.ts` | `remark-parse` | `unified().use(remarkParse).parse()` | ✓ WIRED | `remarkParse` imported; used in `parseMdTemplate` |
| `src/adapters/github/labels.ts` | `octokit.rest.issues.getLabel / createLabel` | `ensureLabel` try-get-first → catch 404 → create | ✓ WIRED | Both calls use `octokit.rest.issues` (corrected from plan spec) |
| `src/adapters/github/labels.ts` | `octokit.rest.issues.addLabels / removeLabel` | `applyLabel` / `removeLabel` | ✓ WIRED | Both calls present |
| `src/core/checklist/generator.ts` | `src/core/checklist/strategies/issue-form.ts` | `new IssueFormStrategy()` in STRATEGIES array | ✓ WIRED | Line 10 of `generator.ts` |
| `src/core/checklist/generator.ts` | `src/core/checklist/strategies/template-md.ts` | `new TemplateMdStrategy()` in STRATEGIES array | ✓ WIRED | Line 11 of `generator.ts` |
| `src/core/checklist/generator.ts` | `ChecklistStrategy.generate` | passes `ctx` as third arg | ✓ WIRED | `s.generate(type, signals, ctx)` on line 23 |
| `src/core/format/markdown.ts` | `RepoContext` | second optional parameter | ✓ WIRED | `format(scored: ScoredIssue, repoContext?: RepoContext)` |
| `src/action/main.ts` | `src/adapters/github/templates.ts` | `loadRepoContext(octokit, owner, repo, defaultBranch)` | ✓ WIRED | Line 71 of `main.ts` |
| `src/action/main.ts` | `src/adapters/github/labels.ts` | `ensureLabel / applyLabel / removeLabel` | ✓ WIRED | All three calls present; gated on `!dryRun && enableLabels` |
| `src/action/main.ts` | `src/action/summary.ts` | `writeSummary(...)` + `writeSkipSummary(...)` | ✓ WIRED | Both calls present |
| `src/action/main.ts` | `core.getInput / core.getBooleanInput` | all 8 ACT-07 inputs read at top of `run()` | ✓ WIRED | 3+ `getBooleanInput` calls; `label-name`, `max-body-bytes`, `model`, gray-zone inputs |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `src/action/main.ts` | `repoContext` | `loadRepoContext(octokit, owner, repo, defaultBranch)` | Yes — real Octokit call to `.github/ISSUE_TEMPLATE/` | ✓ FLOWING |
| `src/core/format/markdown.ts` | `showMetaNudge` | `repoContext?.hasIssueForms && hasMdTemplates` from real `repoContext` | Yes — derived from real template data | ✓ FLOWING |
| `src/action/main.ts` | `labelAction` | `applyLabel` / `removeLabel` return value (real Octokit calls) | Yes | ✓ FLOWING |
| `src/action/summary.ts` | summary content | `data.scored.signals`, `data.labelAction`, `data.commentUrl` | Yes — all from real runtime values | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| 157 tests pass end-to-end | `npm test -- --run` | 12 test files, 157 tests passed in 1.77s | ✓ PASS |
| TypeScript compiles | `npm run build` | Exit 0, no errors | ✓ PASS |
| `dist/index.js` contains all Phase 2 symbols | `node` symbol grep | ALL-OK — 9/9 symbols present | ✓ PASS |
| `action.yml` has 9 inputs, `runs: node24` | `node -e` YAML parse | 9 inputs; `using: 'node24'` | ✓ PASS |
| `yaml` 2.x in runtime dependencies | `npm ls yaml --depth=0` | `yaml@2.9.0` | ✓ PASS |
| `main.ts` wires all required calls | `node -e` string checks | All 17 acceptance strings found | ✓ PASS |
| No `throw` in labels.ts | grep | 0 matches | ✓ PASS |
| No `throw` in templates.ts non-comment lines | grep | 0 matches | ✓ PASS |
| Hexagonal invariant (core does not import adapters) | grep | No matches in `src/core/` | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| ACT-06 | 02-03, 02-05 | Label management — auto-create, apply, remove | ✓ SATISFIED | `labels.ts` implements all 3 operations; `main.ts` wires them after hero comment |
| ACT-07 | 02-01, 02-05 | 8 action inputs with safe defaults | ✓ SATISFIED | `action.yml` has 9 inputs; `main.ts` reads all 8 via `getInput`/`getBooleanInput` |
| ACT-08 | 02-05 | `signal-oss-ignore` skip-label opt-out | ✓ SATISFIED | `main.ts` checks `issue.labels.includes('signal-oss-ignore')` before any I/O |
| ACT-09 | 02-05 | `core.summary` rich workflow report | ✓ SATISFIED | `summary.ts` implements `writeSummary` with 7 signals, score, tier, label action, comment URL |
| ACT-10 | 02-05 | Cold-start budget < 10s p50 | ? NEEDS HUMAN | No synchronous I/O added; JS Action; but real timing can only be measured on a live runner |
| CHECK-03 | 02-02, 02-04 | Tier 1 YAML template parsing | ✓ SATISFIED | `templates.ts` parses issue forms; `IssueFormStrategy` consumes them |
| CHECK-04 | 02-02, 02-04 | Tier 2 markdown template parsing | ✓ SATISFIED | `templates.ts` parses H3 headings; `TemplateMdStrategy` consumes them |
| CHECK-06 | 02-04 | Meta-nudge gated on template absence | ✓ SATISFIED | `format()` uses `showMetaNudge = !repoContext?.hasIssueForms && !repoContext?.hasMdTemplates` |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | No TODOs, placeholders, stub returns, or empty handlers found | — | None |

The `hasContributing: false` hardcode in `templates.ts` (line 94) is intentional: CONTRIBUTING.md loading is explicitly deferred to Phase 4 (documented in SUMMARY decision notes). Not a stub — it is the correct fallback for this phase.

### Human Verification Required

#### 1. Sandbox E2E — 5 Real-Repo Scenarios

**Test:** Use the sandbox repo (the developer ran this as Task 4 in Plan 05). Re-run on a real repo that has a `bug_report.yml` in `.github/ISSUE_TEMPLATE/`. Open a low-quality bug issue and verify:
1. Signal-OSS comment appears with checklist from `required: true` fields (NOT the baseline generic list). Comment ends with `<!-- signal-oss:v1 -->`. `needs-info` label applied yellow (`#e4e669`). `**Tip:**` meta-nudge does NOT appear.
2. Close and reopen same issue — exactly 1 Signal-OSS comment exists (idempotent).
3. Open a high-quality issue covering all 7 signals — checklist is empty; `needs-info` label removed.
4. Manually add `signal-oss-ignore` label to an issue then reopen it — no comment posted; workflow summary is a single skip line.
5. Move `.github/ISSUE_TEMPLATE/` to a temp name, open low-quality issue — baseline checklist appears WITH `**Tip:**` meta-nudge.

**Expected:** All 5 scenarios pass (as documented in SUMMARY).

**Why human:** Plan 05 Task 4 is a `checkpoint:human-verify` gate tagged `gate: blocking`. The SUMMARY documents APPROVED (5/5 scenarios), but this cannot be verified programmatically without runner access to the sandbox repo.

#### 2. Cold-Start Budget (ACT-10)

**Test:** On a warm GitHub Actions runner, trigger `issues.opened` on a real repo and measure event-receipt to comment-posted time.

**Expected:** p50 < 10 seconds.

**Why human:** Requires a live runner with timing instrumentation. The architecture (no synchronous I/O; no large startup computations; `dist/index.js` is a pre-bundled single file) is consistent with meeting the budget, but cannot be proven without live measurement.

### Gaps Summary

No programmatic gaps found. All 9 programmatically verifiable must-haves are VERIFIED:
- All artifacts exist and are substantive (no stubs)
- All key links are wired
- Data flows through real Octokit calls — no hardcoded empty arrays in the production runtime path
- 157 tests pass; TypeScript compiles; lint clean; bundle rebuilt

The only open items are:
1. The blocking sandbox E2E human-verify gate (Task 4, Plan 05) — SUMMARY claims APPROVED but requires developer confirmation
2. ACT-10 cold-start budget — architectural evidence is favorable but timing is unverifiable programmatically

---

_Verified: 2026-05-15T10:05:00Z_
_Verifier: Claude (gsd-verifier)_

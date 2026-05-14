---
phase: 02-action-hardening-repo-awareness
plan: 05
type: execute
wave: 3
depends_on: ["02-02", "02-03", "02-04"]
files_modified:
  - src/action/main.ts
  - src/action/summary.ts
  - tests/action/main.test.ts
  - tests/action/summary.test.ts
  - dist/index.js
  - dist/index.js.map
autonomous: false
requirements: [ACT-06, ACT-07, ACT-08, ACT-09, ACT-10, CHECK-06]
tags: [github-action, orchestrator, core-summary, dry-run, sandbox-checkpoint]

must_haves:
  truths:
    - "Reading any action input (e.g. `dry-run`, `label-name`) inside main.ts uses `@actions/core` getInput / getBooleanInput with the documented fallback values"
    - "If the triggering issue carries the `signal-oss-ignore` label, the Action exits cleanly before any I/O — single `core.summary` line says `'Skipped — reason: signal-oss-ignore label present'`"
    - "When `dry-run === true`, the Action computes the score and would-be comment body but does NOT call `postOrUpdateComment` or any label-management function; the rich `core.summary` report is still written with a `⚠️ Dry-run mode` banner (D-10)"
    - "When `enable-comments === false`, no comment is posted but label management still runs (label is the secondary surface; comments and labels are independently switchable)"
    - "When `enable-labels === false`, no label call is made and `labelAction === 'disabled'`"
    - "On a normal run with a non-empty checklist, the order of operations is: parse inputs → skip-label check → loadRepoContext → score → postOrUpdateComment → ensureLabel → applyLabel → writeSummary"
    - "On a normal run with an empty checklist (no missing items), `removeLabel` is called instead of `applyLabel`"
    - "Every Octokit-side error from labels or summary is caught at the call boundary; the hero comment posts before any label/summary call so a label failure cannot block it"
    - "The rich `core.summary` report (D-09) renders issue title/number, type, score, tier-used, signals table (all 7 with ✓/✗), label action, and comment URL"
    - "`core.summary.write()` is wrapped in try/catch — if `$GITHUB_STEP_SUMMARY` is unset (local-action testing), the function logs `core.warning` and continues"
    - "Sandbox E2E run on a real GitHub repo posts a comment, applies the `needs-info` label, and the workflow-run UI shows the rich summary report"
    - "Cold-start budget preserved — event-to-comment p50 < 10s (ACT-10) on a warm runner (Plan 05 adds 2-5 Octokit calls for templates + 1-3 for labels; all are fast network I/O)"
  artifacts:
    - path: "src/action/main.ts"
      provides: "Phase 2 orchestrator with inputs, skip-label, real loadRepoContext, label management, dry-run gating"
      contains: "loadRepoContext("
    - path: "src/action/summary.ts"
      provides: "writeSummary(data) — renders rich core.summary markdown per D-09 / D-10 / D-11"
      exports: ["writeSummary", "writeSkipSummary"]
      min_lines: 50
    - path: "dist/index.js"
      provides: "Rebuilt bundle including yaml + all Phase 2 modules"
      contains: "signal-oss:v1"
  key_links:
    - from: "src/action/main.ts"
      to: "src/adapters/github/templates.ts"
      via: "loadRepoContext(octokit, owner, repo, defaultBranch)"
      pattern: "loadRepoContext\\("
    - from: "src/action/main.ts"
      to: "src/adapters/github/labels.ts"
      via: "ensureLabel / applyLabel / removeLabel"
      pattern: "(ensureLabel|applyLabel|removeLabel)\\("
    - from: "src/action/main.ts"
      to: "src/action/summary.ts"
      via: "writeSummary(...) at end of run, writeSkipSummary on early exit"
      pattern: "writeSummary\\("
    - from: "src/action/main.ts"
      to: "core.getInput / core.getBooleanInput"
      via: "all 8 ACT-07 inputs read at the top of run()"
      pattern: "core\\.get(Boolean)?Input"
---

<objective>
Wire everything together. Update `src/action/main.ts` to consume the 8 ACT-07 inputs, perform the `signal-oss-ignore` skip-label check before any I/O, replace the Phase 1 stub `repoContext` with a real `loadRepoContext()` call, run label management after the hero comment, and emit a rich `core.summary` report. Add a new `src/action/summary.ts` for the report markdown (kept separate from `main.ts` to keep the orchestrator readable). Rebuild `dist/index.js`. End with a sandbox human-verify checkpoint on a real repo.

Purpose: This is the final wiring that turns the Phase 2 components into a single end-to-end flow. After this plan, the Action is installable on real popular OSS repos: it survives missing templates, respects opt-out, reports cleanly via `core.summary`, and degrades gracefully when any secondary surface (labels, summary) fails.

Output: Updated `main.ts` orchestrator, new `summary.ts` helper, expanded `main.test.ts` covering the 6 input-driven branches, and a committed `dist/index.js` rebuilt with the new modules. Final task is a checkpoint where the user verifies a real sandbox issue.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/02-action-hardening-repo-awareness/02-CONTEXT.md
@.planning/phases/02-action-hardening-repo-awareness/02-RESEARCH.md
@.planning/phases/02-action-hardening-repo-awareness/02-PATTERNS.md
@.planning/phases/02-action-hardening-repo-awareness/02-01-foundations-SUMMARY.md
@.planning/phases/02-action-hardening-repo-awareness/02-02-templates-adapter-SUMMARY.md
@.planning/phases/02-action-hardening-repo-awareness/02-03-labels-adapter-SUMMARY.md
@.planning/phases/02-action-hardening-repo-awareness/02-04-strategies-and-format-SUMMARY.md
@src/action/main.ts
@src/adapters/github/io.ts
@src/adapters/github/templates.ts
@src/adapters/github/labels.ts
@src/core/format/markdown.ts
@tests/action/main.test.ts
@.github/workflows/triage.yml

<interfaces>
<!-- Final main.ts orchestrator shape (sketch) -->
```typescript
export async function run(): Promise<void> {
  // 1. Bot-loop guard (Phase 1 — keep verbatim)
  if (github.context.actor === 'github-actions[bot]') { ... return }

  // 2. Payload extraction (Phase 1 — keep verbatim)
  const issue: Issue = { ... }
  const issueNumber = payload.issue.number as number

  // 3. NEW: Read all ACT-07 inputs
  const dryRun = core.getBooleanInput('dry-run')
  const enableComments = core.getBooleanInput('enable-comments')
  const enableLabels = core.getBooleanInput('enable-labels')
  const labelName = core.getInput('label-name') || 'needs-info'
  // model, gray-zone-low, gray-zone-high, max-body-bytes parsed similarly

  // 4. NEW: Skip-label check (ACT-08) — earliest exit
  if (issue.labels.includes('signal-oss-ignore')) {
    await writeSkipSummary('signal-oss-ignore label present')
    return
  }

  // 5. Octokit + repo setup (Phase 1 — same code, moved earlier)
  const token = core.getInput('github-token') || process.env.GITHUB_TOKEN
  if (!token) throw new Error(...)
  const octokit = github.getOctokit(token)
  const { owner, repo } = github.context.repo
  const defaultBranch = (payload.repository as { default_branch?: string })?.default_branch ?? 'main'

  // 6. NEW: Real template loading
  const repoContext = await loadRepoContext(octokit, owner, repo, defaultBranch)

  // 7. Score + format (now passes repoContext to format per Plan 04)
  const scored = score(issue, repoContext, null)
  const body = format(scored, repoContext)

  // 8. NEW: Gated comment + labels
  let commentResult: { commentId: number; action: 'created' | 'updated' } | null = null
  if (!dryRun && enableComments) {
    commentResult = await postOrUpdateComment(octokit, owner, repo, issueNumber, body)
  }

  let labelAction: LabelAction = 'disabled'
  if (dryRun) {
    labelAction = 'dry-run'
  } else if (enableLabels) {
    await ensureLabel(octokit, owner, repo, labelName, '#e4e669', 'Waiting for more information from the issue author')
    if (scored.items.length > 0) {
      labelAction = await applyLabel(octokit, owner, repo, issueNumber, labelName)
    } else {
      labelAction = await removeLabel(octokit, owner, repo, issueNumber, labelName)
    }
  }

  // 9. NEW: Rich summary report (ACT-09)
  await writeSummary({ issue, scored, labelAction, commentResult, repoContext, dryRun })
}
```

<!-- summary.ts contract -->
```typescript
export interface SummaryData {
  issue: Issue
  issueNumber: number
  scored: ScoredIssue
  labelAction: LabelAction
  commentUrl: string | null
  repoContext: RepoContext
  dryRun: boolean
}
export async function writeSummary(data: SummaryData): Promise<void>
export async function writeSkipSummary(reason: string): Promise<void>
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Create `src/action/summary.ts` and its tests</name>
  <read_first>
    - .planning/phases/02-action-hardening-repo-awareness/02-RESEARCH.md (Pattern 7: core.summary code template; D-09 rich report fields; D-10 dry-run banner; D-11 one-liner on early exit)
    - tests/action/main.test.ts (existing Vitest mocks of `@actions/core.summary` — copy the mock shape)
    - src/core/types.ts (ScoredIssue, Issue, Signals shapes for the summary data)
    - src/adapters/github/labels.ts (LabelAction type)
  </read_first>
  <behavior>
    Tests fail until `src/action/summary.ts` exists. Test contract:

    - Test S1 (`writeSummary — renders header line with issue # and title`): the buffered summary content (captured via the mock) contains `'#42'` and the issue title (`'Sample bug'`).
    - Test S2 (`writeSummary — renders signals table with all 7 signals`): output contains all 7 signal labels (`Code block`, `Stack trace`, `Version mention`, `Repro keywords`, `Expected/actual`, `Minimal example`, `Image only`); each has either `✓` or `✗` adjacent.
    - Test S3 (`writeSummary — renders tier used, score, type`): output contains `'baseline'` (or whichever `tierUsed` is passed), `'6/10'` (score badge), and `'bug'` (issueType).
    - Test S4 (`writeSummary — dry-run banner appears when dryRun=true`): output starts with or contains the substring `'⚠️ Dry-run mode'` (per D-10).
    - Test S5 (`writeSummary — comment URL rendered when commentUrl is non-null`): output contains the URL string passed in.
    - Test S6 (`writeSummary — label action line`): output contains `'Label: applied'` (or `removed`, `skipped`, `disabled`, `dry-run`).
    - Test S7 (`writeSummary — $GITHUB_STEP_SUMMARY missing → core.warning, no throw`): mock `summary.write` to reject. Function resolves. `core.warning` was called.
    - Test S8 (`writeSkipSummary — single line with reason`): output is one line, contains the passed `reason` string. Does not contain the signals table or any other report sections.
  </behavior>
  <action>
    Step A — write `tests/action/summary.test.ts`:

    ```typescript
    import { describe, it, expect, vi, beforeEach } from 'vitest'

    // Capture the markdown buffered via core.summary.addRaw
    const buffer: string[] = []
    const mockSummary = {
      addRaw: vi.fn((s: string, _addEOL?: boolean) => {
        buffer.push(s)
        return mockSummary
      }),
      addTable: vi.fn((rows: unknown[]) => {
        // Flatten table cells for assertion convenience
        buffer.push(JSON.stringify(rows))
        return mockSummary
      }),
      addEOL: vi.fn(() => mockSummary),
      write: vi.fn().mockResolvedValue(undefined),
    }

    vi.mock('@actions/core', () => ({
      warning: vi.fn(),
      info: vi.fn(),
      summary: mockSummary,
    }))

    import { writeSummary, writeSkipSummary, type SummaryData } from '../../src/action/summary.js'
    import * as core from '@actions/core'

    function makeData(overrides: Partial<SummaryData> = {}): SummaryData {
      return {
        issue: { title: 'Sample bug', body: 'foo', labels: [] },
        issueNumber: 42,
        scored: {
          score: 6,
          missing: [],
          signals: {
            hasCodeBlock: true, hasStackTrace: false, hasVersionMention: true,
            hasReproKeywords: false, hasExpectedActual: true, hasMinimalExample: false,
            hasImageOnly: false,
          },
          issueType: 'bug',
          isGrayZone: true,
          items: [{ text: 'Could you share the version?' }],
          tierUsed: 'baseline',
        },
        labelAction: 'applied',
        commentUrl: 'https://github.com/o/r/issues/42#issuecomment-123',
        repoContext: { hasIssueForms: false, hasMdTemplates: false, hasContributing: false, templates: [] },
        dryRun: false,
        ...overrides,
      }
    }

    beforeEach(() => {
      buffer.length = 0
      vi.clearAllMocks()
    })

    // Implement S1..S8 — each calls writeSummary or writeSkipSummary and asserts on `buffer.join('')`.
    ```

    Run `npm test -- --run tests/action/summary.test.ts` — expect RED (module not found).

    Step B — implement `src/action/summary.ts`:

    ```typescript
    // src/action/summary.ts
    // ACT-09: rich workflow-run UI report via core.summary. Per D-09 (full report), D-10 (dry-run
    // banner), D-11 (one-line skip-summary on early exit). $GITHUB_STEP_SUMMARY may be absent in
    // local-action testing — wrap writes in try/catch and surface failures via core.warning.

    import * as core from '@actions/core'
    import type { Issue, RepoContext, ScoredIssue } from '../core/types.js'
    import type { LabelAction } from '../adapters/github/labels.js'

    export interface SummaryData {
      issue: Issue
      issueNumber: number
      scored: ScoredIssue
      labelAction: LabelAction
      commentUrl: string | null
      repoContext: RepoContext
      dryRun: boolean
    }

    const SIGNAL_LABELS: Array<[keyof ScoredIssue['signals'], string]> = [
      ['hasCodeBlock', 'Code block'],
      ['hasStackTrace', 'Stack trace'],
      ['hasVersionMention', 'Version mention'],
      ['hasReproKeywords', 'Repro keywords'],
      ['hasExpectedActual', 'Expected/actual'],
      ['hasMinimalExample', 'Minimal example'],
      ['hasImageOnly', 'Image only'],
    ]

    export async function writeSummary(data: SummaryData): Promise<void> {
      try {
        if (data.dryRun) {
          core.summary.addRaw('⚠️ **Dry-run mode** — no comment was posted, no labels were changed.\n\n', true)
        }
        core.summary.addRaw(`## Signal-OSS: #${data.issueNumber} ${data.issue.title}\n\n`, true)
        core.summary.addRaw(
          `**Type:** ${data.scored.issueType} | **Score:** ${data.scored.score}/10 | **Tier:** ${data.scored.tierUsed} | **Templates:** ${data.repoContext.templates.length}\n\n`,
          true,
        )
        const rows: Array<Array<string | { data: string; header: true }>> = [
          [{ data: 'Signal', header: true }, { data: 'Detected', header: true }],
          ...SIGNAL_LABELS.map(([key, label]) => [
            label,
            data.scored.signals[key] ? '✓' : '✗',
          ]),
        ]
        core.summary.addTable(rows)
        core.summary.addRaw(`\n**Label:** ${data.labelAction}\n`, true)
        if (data.commentUrl) {
          core.summary.addRaw(`**Comment:** ${data.commentUrl}\n`, true)
        }
        await core.summary.write()
      } catch (err: unknown) {
        core.warning(`Could not write workflow summary: ${(err as Error).message}`)
      }
    }

    export async function writeSkipSummary(reason: string): Promise<void> {
      try {
        core.summary.addRaw(`Signal-OSS: Skipped — reason: ${reason}\n`, true)
        await core.summary.write()
      } catch (err: unknown) {
        core.warning(`Could not write skip summary: ${(err as Error).message}`)
      }
    }
    ```

    Step C — run `npm test -- --run tests/action/summary.test.ts`. Expect GREEN.
  </action>
  <verify>
    <automated>npm test -- --run tests/action/summary.test.ts &amp;&amp; npm run build &amp;&amp; npm run lint</automated>
  </verify>
  <acceptance_criteria>
    - `src/action/summary.ts` exists; `grep -c "export async function writeSummary" src/action/summary.ts` returns 1
    - `grep -c "export async function writeSkipSummary" src/action/summary.ts` returns 1
    - `grep "⚠️" src/action/summary.ts` matches once (dry-run banner per D-10)
    - `grep "Code block" src/action/summary.ts` matches once (one of the 7 signals)
    - `grep -c "core.warning" src/action/summary.ts` ≥ 2 (one per try/catch wrapping summary.write)
    - `tests/action/summary.test.ts` contains at least 8 `it(` blocks
    - All 8 tests in `summary.test.ts` pass
    - `npm test -- --run` total pass count unchanged for prior tests + 8 new tests
  </acceptance_criteria>
  <done>
    Summary helper is implemented and tested. Both `writeSummary` (rich D-09 report with optional dry-run banner) and `writeSkipSummary` (one-liner per D-11) work. `$GITHUB_STEP_SUMMARY` absence is handled gracefully.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Update `src/action/main.ts` + expand `tests/action/main.test.ts` for the 6 input-driven branches</name>
  <read_first>
    - src/action/main.ts (current 63-line file — modify carefully, preserve bot-loop guard verbatim)
    - tests/action/main.test.ts (existing Vitest mocks of @actions/core + @actions/github + postOrUpdateComment — extend them)
    - src/adapters/github/templates.ts (loadRepoContext signature)
    - src/adapters/github/labels.ts (ensureLabel, applyLabel, removeLabel, LabelAction)
    - src/action/summary.ts (writeSummary, writeSkipSummary from Task 1)
    - .planning/phases/02-action-hardening-repo-awareness/02-PATTERNS.md (main.ts MODIFY section — full insertion sites)
    - .planning/phases/02-action-hardening-repo-awareness/02-CONTEXT.md (D-12 color value, D-14 unconditional re-apply, D-11 skip-summary)
  </read_first>
  <behavior>
    Tests added to `tests/action/main.test.ts` (RED first, then GREEN). New test branches:

    - Test M1 (`signal-oss-ignore label → early exit`): mock event payload with `issue.labels: [{name: 'signal-oss-ignore'}]`. Assert `postOrUpdateComment` NOT called; `loadRepoContext` NOT called; `core.summary` invoked with a string containing `'signal-oss-ignore'`. `run()` resolves.
    - Test M2 (`dry-run=true → no postOrUpdateComment, no label calls, summary has banner`): set `core.getBooleanInput('dry-run')` to `true`. Assert `postOrUpdateComment` NOT called; `ensureLabel/applyLabel/removeLabel` NOT called. `core.summary.addRaw` called with a string containing `'Dry-run'`.
    - Test M3 (`enable-comments=false → no comment, but labels still run`): `enable-comments=false`, `enable-labels=true`, checklist has items. Assert `postOrUpdateComment` NOT called; `ensureLabel + applyLabel` ARE called.
    - Test M4 (`enable-labels=false → labelAction=disabled, no label Octokit calls`): `enable-labels=false`. Assert none of `ensureLabel/applyLabel/removeLabel` called. Summary receives `labelAction: 'disabled'`.
    - Test M5 (`scored.items.length === 0 → removeLabel instead of applyLabel`): mock score to return `items: []`. Assert `removeLabel` called, `applyLabel` NOT called.
    - Test M6 (`scored.items.length > 0 → applyLabel called`): default mock with non-empty items. Assert `applyLabel` called with `'needs-info'` (the default label-name input).
    - Test M7 (`custom label-name input respected`): `core.getInput('label-name')` returns `'awaiting-info'`. Assert `applyLabel` called with `'awaiting-info'`.
    - Test M8 (`loadRepoContext called with default_branch from payload`): payload includes `repository.default_branch: 'develop'`. Assert `loadRepoContext` called with `4th arg === 'develop'`.
    - Test M9 (`loadRepoContext default_branch fallback to 'main'`): payload has no `repository.default_branch`. Assert `loadRepoContext` called with `4th arg === 'main'`.

    Step A — extend `tests/action/main.test.ts`. The existing file already mocks `@actions/core`, `@actions/github`, and `../../src/adapters/github/io.js`. ADD mocks for:
    ```typescript
    vi.mock('../../src/adapters/github/templates.js', () => ({
      loadRepoContext: vi.fn().mockResolvedValue({
        hasIssueForms: false, hasMdTemplates: false, hasContributing: false, templates: [],
      }),
    }))
    vi.mock('../../src/adapters/github/labels.js', () => ({
      ensureLabel: vi.fn().mockResolvedValue(undefined),
      applyLabel: vi.fn().mockResolvedValue('applied'),
      removeLabel: vi.fn().mockResolvedValue('removed'),
    }))
    vi.mock('../../src/action/summary.js', () => ({
      writeSummary: vi.fn().mockResolvedValue(undefined),
      writeSkipSummary: vi.fn().mockResolvedValue(undefined),
    }))
    ```

    Add `core.getInput` and `core.getBooleanInput` to the `@actions/core` mock if not already there. Per-test, override via `vi.mocked(core.getBooleanInput).mockImplementation((name: string) => map[name] ?? false)`.

    Implement all 9 tests above. Run `npm test -- --run tests/action/main.test.ts` — expect RED (the new code paths in main.ts don't exist yet).

    Step B — rewrite `src/action/main.ts` to match the orchestrator sketch in `<interfaces>` above. Preserve verbatim:
    - The bot-loop guard (current lines 13-17)
    - The payload extraction logic (current lines 19-35), including the `Issue` construction
    - The error thrown when `GITHUB_TOKEN` is missing

    Add (in the order shown in the sketch):
    1. Input reading after payload extraction (8 inputs per ACT-07)
    2. Skip-label check immediately after inputs — calls `writeSkipSummary('signal-oss-ignore label present')` and returns
    3. Octokit + owner/repo/defaultBranch setup
    4. `const repoContext = await loadRepoContext(octokit, owner, repo, defaultBranch)`
    5. `score(issue, repoContext, null)` + `format(scored, repoContext)`
    6. Conditional `postOrUpdateComment` (gated on `!dryRun && enableComments`)
    7. Label management block (gated on `!dryRun && enableLabels`, branching on `scored.items.length`)
    8. `writeSummary({...})` at the end

    Specific code requirements:
    - Read inputs via `core.getBooleanInput('dry-run')`, `core.getBooleanInput('enable-comments')`, `core.getBooleanInput('enable-labels')`, `core.getInput('label-name') || 'needs-info'`. The three numeric inputs (`gray-zone-low`, `gray-zone-high`, `max-body-bytes`) and `model` are read into local consts BUT NOT YET CONSUMED in this phase (Phase 4 consumes `model`; Phase 3 consumes the gray-zone ones; `max-body-bytes` is wired to truncate `issue.body` before passing to `score()`).
    - Truncate `issue.body` to `maxBodyBytes` characters BEFORE passing to `score()`: `if (issue.body.length > maxBodyBytes) issue.body = issue.body.slice(0, maxBodyBytes)`. This addresses the "content size abuse" threat noted in the planning context.
    - Default branch fallback: `const defaultBranch = (payload.repository as { default_branch?: string })?.default_branch ?? 'main'`
    - Label color literal: `'#e4e669'` (D-12)
    - Label description literal: `'Waiting for more information from the issue author'` (D-12)
    - Build the `commentUrl` for the summary from `commentResult`. If `commentResult` is not null, build the URL via `https://github.com/${owner}/${repo}/issues/${issueNumber}#issuecomment-${commentResult.commentId}`. Otherwise `commentUrl = null`.

    Step C — run validation:
    1. `npm test -- --run` — all tests green (including new M1-M9 + S1-S8 + Plan 02/03/04 tests + Phase 1 baseline)
    2. `npm run build` — clean
    3. `npm run lint` — clean
  </action>
  <verify>
    <automated>npm test -- --run &amp;&amp; npm run build &amp;&amp; npm run lint</automated>
  </verify>
  <acceptance_criteria>
    - `grep "loadRepoContext(" src/action/main.ts` matches once
    - `grep "ensureLabel(" src/action/main.ts` matches once
    - `grep "applyLabel(" src/action/main.ts` matches once
    - `grep "removeLabel(" src/action/main.ts` matches once
    - `grep "writeSummary(" src/action/main.ts` matches once
    - `grep "writeSkipSummary(" src/action/main.ts` matches once
    - `grep "signal-oss-ignore" src/action/main.ts` matches once
    - `grep "getBooleanInput" src/action/main.ts` matches at least 3 times (dry-run, enable-comments, enable-labels)
    - `grep "label-name" src/action/main.ts` matches at least once
    - `grep "needs-info" src/action/main.ts` matches at least once (fallback string)
    - `grep "'#e4e669'" src/action/main.ts` matches once (D-12 color literal)
    - `grep "Waiting for more information" src/action/main.ts` matches once (D-12 description literal)
    - `grep "default_branch" src/action/main.ts` matches at least once
    - `grep "max-body-bytes" src/action/main.ts` matches at least once AND `grep "slice(0, maxBodyBytes" src/action/main.ts` matches once (truncation guard)
    - `grep "format(scored, repoContext)" src/action/main.ts` matches once
    - `grep "github-actions\[bot\]" src/action/main.ts` still matches (Phase 1 bot-loop guard preserved)
    - `tests/action/main.test.ts` has at least 9 new `it(` blocks (verifiable: `grep -c "it(" tests/action/main.test.ts` ≥ (Phase 1 baseline + 9))
    - `npm test -- --run` exits 0 with ALL tests passing (baseline 96 + Plan 02/03/04 additions + 9 new in main.test.ts + 8 new in summary.test.ts)
    - `npm run build` and `npm run lint` exit 0
  </acceptance_criteria>
  <done>
    `main.ts` is the full Phase 2 orchestrator: inputs read, skip-label check first, real `loadRepoContext`, body truncation, score + format + comment + labels + summary, all error paths defensive. Tests cover all 6 input-driven branches plus the skip-label early exit.
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 3: Rebuild `dist/index.js` and verify the bundle contains Phase 2 modules</name>
  <read_first>
    - package.json (confirm `npm run package` invokes rollup)
    - rollup.config.ts (existing config — should already handle ESM bundling; `yaml` package may need explicit external/inlining check)
    - dist/index.js (current 1.5MB bundle from Phase 1 — to be replaced)
  </read_first>
  <action>
    From the repo root run `npm run bundle` (which is `npm run format && npm run package`). This formats with Biome then runs Rollup. Confirm:
    1. Rollup completes without warnings about `yaml`, `unified`, `remark-parse`, `mdast-util-to-string`, or `unist-util-visit` (any of these going missing from the bundle would break runtime)
    2. `dist/index.js` is regenerated; its size will grow modestly (yaml package + new code adds ~50-150KB)
    3. `node -e "const fs=require('fs');const s=fs.readFileSync('dist/index.js','utf8');for(const m of ['loadRepoContext','ensureLabel','applyLabel','removeLabel','writeSummary','IssueFormStrategy','TemplateMdStrategy','signal-oss:v1','signal-oss-ignore']){if(!s.includes(m)){console.error('MISSING:',m);process.exit(1)}}console.log('ALL-OK')"` prints `ALL-OK` (confirms tree-shaking did not drop our new symbols)
    4. `dist/index.js` still has `using: 'node24'` runtime compatibility (no ESM-only syntax that breaks Node 24 — Rollup should output `"format": "cjs"` per the existing rollup.config; if it outputs ESM, that's also fine since `action.yml` uses `node24`)

    Run smoke test:
    ```bash
    node --version    # confirm 24.x
    node -e "import('./dist/index.js').then(m => console.log(Object.keys(m).length > 0 ? 'IMPORT-OK' : 'EMPTY')).catch(e => { console.error('IMPORT-FAIL:', e.message); process.exit(1) })"
    ```

    If `dist/index.js` fails to load OR is missing any of the symbols above, FIX rollup.config.ts (typical fix: explicit `nodeResolve()` plugin for the `yaml` package which is ESM-only). Do not commit a broken bundle.

    Commit `dist/index.js` AND `dist/index.js.map` along with all the source file changes. Without this commit, consumers cannot install the Action.
  </action>
  <verify>
    <automated>npm run bundle &amp;&amp; node -e "const s=require('fs').readFileSync('dist/index.js','utf8');for(const m of ['loadRepoContext','ensureLabel','applyLabel','removeLabel','writeSummary','IssueFormStrategy','TemplateMdStrategy','signal-oss:v1','signal-oss-ignore']){if(!s.includes(m))process.exit(1)}console.log('OK')"</automated>
  </verify>
  <acceptance_criteria>
    - `dist/index.js` exists and modification time is newer than the start of this task
    - `dist/index.js.map` exists alongside it
    - The 9 symbol-presence checks (see action) all pass — `node` script exits 0 with `OK` (or `ALL-OK`)
    - `dist/index.js` size is between 1.0MB and 4.0MB (Phase 1 was 1.5MB; expected growth is modest)
    - `node -e "import('./dist/index.js')..."` resolves without throwing
    - `git status` shows `dist/index.js` and `dist/index.js.map` as modified (ready to commit)
  </acceptance_criteria>
  <done>
    `dist/index.js` is rebuilt with all Phase 2 modules tree-shake-survived and committed. The Action is installable end-to-end (cannot be installed without a fresh bundle).
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 4: Sandbox E2E — verify on a real GitHub issue</name>
  <what-built>
    Phase 2 wired end-to-end:
    - Real template loading (`.github/ISSUE_TEMPLATE/` from default branch)
    - Tier 1 / Tier 2 strategies generating repo-aware checklists
    - Idempotent comment (still uses Phase 1's `<!-- signal-oss:v1 -->` marker)
    - `needs-info` label auto-create + apply / remove (D-12, D-13, D-14)
    - `signal-oss-ignore` opt-out (ACT-08)
    - Rich `core.summary` report on the workflow-run UI (ACT-09)
    - All 8 ACT-07 inputs honored with documented defaults
    - Hero output invariant preserved: any label/summary failure surfaces as `core.warning` but the comment still posts
  </what-built>
  <how-to-verify>
    Use the sandbox repo from Phase 1 (`divyeshk/signal-oss-sandbox` or whichever was used for the Phase 1 E2E verification).

    **Setup:**
    1. Ensure the sandbox repo's main branch has the updated workflow (`.github/workflows/triage.yml`) pinning the Action to the current commit SHA on this branch. If using `uses: ./` (local action), no SHA pin needed. If using `uses: divyeshk/signal-oss@<sha>`, push the current branch to GitHub first and update the SHA.
    2. On the sandbox repo, ensure `.github/ISSUE_TEMPLATE/` has at least one `bug_report.yml` (issue form). If not, copy `tests/fixtures/templates/vue-bug_report.yml` into `.github/ISSUE_TEMPLATE/bug_report.yml` and commit.

    **Test 1 — Tier 1 path (repo has issue forms):**
    1. Visit the sandbox repo on github.com
    2. Open a new issue titled `[BUG] crash on save` with body `it crashes` (intentionally low-quality, no version, no repro)
    3. Wait up to 30s for the Action to run
    4. **Expected:** A Signal-OSS comment appears once with checklist items derived from the bug_report.yml's `required: true` fields (e.g., `- [ ] Could you share the vue version?`, `- [ ] Could you share the link to minimal reproduction?`). The comment ends with `<!-- signal-oss:v1 -->`. The `needs-info` label is applied (yellow `#e4e669`). The `**Tip:**` meta-nudge does NOT appear (because the repo has templates).
    5. Click "Actions" tab → latest run → "Summary" section in the workflow-run UI. **Expected:** A rich report with issue # and title, signals table with ✓/✗ marks, label action `applied`, comment URL link.

    **Test 2 — Idempotency:**
    1. Edit the same issue body (e.g., add the missing version info). Save.
    2. Reopen the issue if it auto-closed; if not, no action needed (Phase 2 only listens to `[opened, reopened]`).
    3. Close and immediately reopen the issue.
    4. **Expected:** No duplicate comment ever appears. The single existing comment may be updated in place when re-triggered. Verify by counting Signal-OSS comments on the issue — must be exactly 1.

    **Test 3 — Empty checklist → label removed:**
    1. Open a new issue with a high-quality body (code block, version, repro steps, expected vs actual — covers all 7 signals). Use template content that satisfies the required fields.
    2. **Expected:** Score ≥ 7. Checklist is empty (or short). The `needs-info` label is removed (or never applied — depends on initial state).

    **Test 4 — Skip-label opt-out (ACT-08):**
    1. On a new issue, manually add the `signal-oss-ignore` label (create it manually if missing — color/desc whatever).
    2. Open the issue (or reopen it after adding the label).
    3. **Expected:** No Signal-OSS comment posted. Workflow run summary shows a single line: `Signal-OSS: Skipped — reason: signal-oss-ignore label present`.

    **Test 5 — Meta-nudge appears when repo has no templates:**
    1. Move `.github/ISSUE_TEMPLATE/` to a temporary name (e.g. `.github/_ISSUE_TEMPLATE/`) on the sandbox repo, commit, push to main.
    2. Open a new issue with a low-quality body.
    3. **Expected:** Comment contains the `**Tip:** adding an issue template…` meta-nudge AND the Tier-4 baseline checklist.
    4. Restore the template directory afterwards.

    **All 5 tests must pass before approving.** If any test fails (duplicate comment, missing label, missing summary, meta-nudge in wrong scenario), describe the failure mode in your response so the planner can issue a gap-closure plan.
  </how-to-verify>
  <resume-signal>
    Type `approved` to mark Phase 2 complete.
    If a test failed, describe what went wrong (which test, expected vs observed) and the planner will issue a gap-closure plan.
  </resume-signal>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| GitHub webhook event payload → main.ts | The `issues.opened/reopened` payload is trusted (signed by GitHub) but contains user-authored fields (`issue.title`, `issue.body`, `issue.labels[].name`). |
| consumer workflow `with:` inputs → main.ts | Workflow YAML values flow into `core.getInput`. Some inputs become numeric (`max-body-bytes`); some are booleans (`dry-run`); some are free-form strings (`label-name`, `model`). |
| consumer's `.github/ISSUE_TEMPLATE/` → loadRepoContext | Already addressed in Plan 02; the templates adapter never throws. |
| Octokit response (comment.id, default_branch) → orchestrator | Trusted transport; values flow into URLs and additional Octokit calls. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-02-21 | Denial of Service | Oversized `issue.body` (e.g. 10MB log paste) consumes memory in `score()` AST walk | mitigate | `main.ts` truncates `issue.body` to `maxBodyBytes` characters (default 10000) BEFORE calling `score()`. Acceptance criterion grep-verifies `slice(0, maxBodyBytes` is present. |
| T-02-22 | Tampering | Spoofed `signal-oss-ignore` label via labels payload | accept | The label list comes from `payload.issue.labels`, which is signed as part of the trusted webhook payload by GitHub. An attacker would need write access to the repo to add the label — at which point they already control the issue. Per RESEARCH.md §Security Domain row 5. |
| T-02-23 | Information Disclosure | Token leaked in `core.warning` log when an Octokit error includes the auth header | mitigate | `@actions/github`'s Octokit client does not include the bearer token in error messages by default (it goes through `@octokit/auth-token`). All errors in the Action runtime are surfaced via `core.warning(err.message)`; Phase 4 will add `core.setSecret(apiKey)` for the LLM key, but Phase 2 has no additional secrets to mask. |
| T-02-24 | Tampering | `default_branch` from payload spoofed to point to an attacker's fork | accept | The payload comes from the trusted GitHub webhook for the consumer's own repo. The Action runs inside that repo's workflow context — there is no cross-repo trust boundary here. |
| T-02-25 | Race Condition | Two simultaneous `issues.opened` runs both try to create the comment | mitigate | Phase 1's existing `postOrUpdateComment` uses `<!-- signal-oss:v1 -->` marker + list-existing-first pattern. If both runs reach the create step before either marker lands, GitHub deduplicates by issue + actor (the second create just becomes a second comment). RESEARCH.md notes this is healed on the next `reopened` event — the second comment can be merged into one. Acceptable for v1. |
| T-02-26 | DoS via summary | Many summary writes consuming `$GITHUB_STEP_SUMMARY` budget | accept | `core.summary.write()` is called exactly once per run. The buffer is bounded by `SIGNAL_LABELS.length` (7) + a small fixed header. No risk. |
| T-02-27 | Tampering | `label-name` input set to control characters or extremely long string | mitigate | The label name flows into Octokit's `addLabels({ labels: [name] })` — the array form prevents URL/JSON injection. GitHub enforces a 50-character label name limit server-side; longer names return HTTP 422 which is caught by `applyLabel` and converted to `'skipped'`. |
</threat_model>

<verification>
- All tests pass: 96 baseline + Plan 02 (~10) + Plan 03 (~10) + Plan 04 (~15) + Plan 05 (~17) = ~148 tests
- `npm run build`, `npm run lint`, `npm run format` clean
- `dist/index.js` rebuilt and contains every Phase 2 symbol (grep-verified)
- Sandbox E2E Tests 1-5 all pass (human-verify)
- Cold-start budget preserved: event-to-comment p50 < 10s
</verification>

<success_criteria>
- All 8 ACT-07 inputs consumed in `main.ts` with documented defaults
- ACT-08 skip-label exits before any I/O and writes a single summary line
- ACT-06 label management runs after the hero comment; never blocks it
- ACT-09 rich summary report renders all D-09 fields; dry-run banner per D-10; skip line per D-11
- CHECK-06 meta-nudge gated on template absence (already in Plan 04; this plan exercises the real `repoContext` path)
- `dist/index.js` committed with all Phase 2 modules
- Sandbox E2E confirms 5 scenarios: Tier 1 happy path, idempotency, label remove, opt-out, meta-nudge
</success_criteria>

<output>
After completion, create `.planning/phases/02-action-hardening-repo-awareness/02-05-action-wiring-SUMMARY.md`.
</output>

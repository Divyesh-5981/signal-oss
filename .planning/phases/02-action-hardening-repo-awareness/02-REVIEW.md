---
phase: 02-action-hardening-repo-awareness
reviewed: 2026-05-15T04:21:29Z
depth: standard
files_reviewed: 15
files_reviewed_list:
  - src/action/main.ts
  - src/action/summary.ts
  - src/adapters/github/labels.ts
  - src/adapters/github/templates.ts
  - src/core/checklist/generator.ts
  - src/core/checklist/strategies/issue-form.ts
  - src/core/checklist/strategies/template-md.ts
  - src/core/format/markdown.ts
  - src/core/types.ts
  - tests/action/main.test.ts
  - tests/action/summary.test.ts
  - tests/adapters/labels.test.ts
  - tests/adapters/templates.test.ts
  - tests/core/checklist.test.ts
  - tests/core/format.test.ts
findings:
  critical: 3
  warning: 6
  info: 3
  total: 12
status: fixed
---

# Phase 02: Code Review Report

**Reviewed:** 2026-05-15T04:21:29Z
**Depth:** standard
**Files Reviewed:** 15
**Status:** issues_found

## Summary

Phase 2 delivers action hardening and repo-awareness: real template loading via Octokit, a Tier 1/2 checklist strategy chain, label management, and a rich workflow summary. The architecture is clean and the layering (adapters → core → action) is correctly maintained. However, three correctness bugs were found — one that silently drops all issues with more than 100 comments, one that misses `config.yaml` (only skips `config.yml`), and one that causes a XSS-class injection risk via unsanitized issue title in the workflow summary. Six additional warnings cover incomplete bot-loop guard, fragile integer parsing, code duplication, and test coverage gaps.

---

## Critical Issues

### CR-01: Comment pagination missing — issues with >100 comments silently lose idempotency

**File:** `src/adapters/github/io.ts:19-24`
**Issue:** `listComments` is called with `per_page: 100` and no pagination loop. For any issue that already has more than 100 comments, the existing Signal-OSS marker comment will not be found in the first page, causing a duplicate comment to be created on every subsequent run instead of updating the existing one. The inline comment acknowledges this ("Phase 1 reads first page only") but it is not a safe default for an action that runs on every `issues.opened`-equivalent event — issues in active repos can accumulate 100+ comments before a re-triage.

**Fix:**
```typescript
// Use octokit.paginate to walk all pages, or at minimum raise per_page to 100
// and document the hard cap clearly in action.yml. Full fix:
const comments = await octokit.paginate(octokit.rest.issues.listComments, {
  owner,
  repo,
  issue_number: issueNumber,
  per_page: 100,
})
const existing = comments.find(
  (c) => typeof c.body === 'string' && c.body.includes(MARKER),
)
```

---

### CR-02: `config.yaml` (with `.yaml` extension) not skipped — parsed as issue form

**File:** `src/adapters/github/templates.ts:51-57`
**Issue:** The filter that skips the GitHub issue template config file only checks for `config.yml` (lowercase, `.yml` extension):
```typescript
f.name.toLowerCase() !== 'config.yml'
```
The GitHub documentation allows the config file to be named `config.yaml` as well. A repo using `config.yaml` will have that file parsed by `parseIssueFormFields`, which will produce an empty or nonsense fields array (the config file has no `body` key). This doesn't crash (the YAML parser returns `[]` from the empty-body path), but it does cause a spurious template entry to be included in `templates[]` with `fields: []`. Because `fields.length === 0`, `applies()` correctly returns false for it — so the strategy chain is not broken. However, `templates` will contain the garbage entry, `hasIssueForms` could be set to `true` if *other* form templates exist, and the template count shown in the summary will be inflated by 1. More critically: if `config.yaml` is the *only* file in the directory and it somehow has a `body` array (unusual but possible for non-standard configs), its fields would be fed to the strategy.

**Fix:**
```typescript
const SKIP_NAMES = new Set(['config.yml', 'config.yaml'])
const templateFiles = listing.filter(
  (f) =>
    f.type === 'file' &&
    (f.name.endsWith('.yml') || f.name.endsWith('.yaml') || f.name.endsWith('.md')) &&
    !SKIP_NAMES.has(f.name.toLowerCase()),
)
```

---

### CR-03: Issue title rendered unsanitized into workflow summary — GitHub markdown injection

**File:** `src/action/summary.ts:40`
**Issue:** The issue title is interpolated directly into the workflow summary markdown without any sanitization:
```typescript
core.summary.addRaw(`## Signal-OSS: #${data.issueNumber} ${data.issue.title}\n\n`, true)
```
`data.issue.title` is the raw GitHub issue title authored by the reporter. A title containing markdown such as `](javascript:...)` or `` `; rm -rf /` `` or a heading like `\n## Injected Section\n` will render as-is in the workflow step summary UI, which is a GitHub-controlled HTML surface. While this is not a remote code execution vector (GitHub sanitizes summary HTML), it does allow an issue reporter to inject arbitrary markdown structure into the maintainer's workflow run UI — including fake headings, fake tables, fake alert boxes, or obfuscated links. This violates the principle that untrusted reporter input should not control the structure of operator-visible surfaces.

**Fix:**
```typescript
// Escape markdown structural characters in the title before embedding
function escapeMdTitle(raw: string): string {
  // Strip newlines (prevent heading injection), escape leading # chars
  return raw.replace(/[\r\n]/g, ' ').replace(/^#+\s*/gm, '').slice(0, 200)
}

core.summary.addRaw(
  `## Signal-OSS: #${data.issueNumber} ${escapeMdTitle(data.issue.title)}\n\n`,
  true,
)
```

---

## Warnings

### WR-01: Bot-loop guard only checks `github-actions[bot]` — misses other automation actors

**File:** `src/action/main.ts:20-23`
**Issue:** The bot-loop guard hard-codes a single actor name:
```typescript
if (github.context.actor === 'github-actions[bot]') {
```
Other common bot actors that open issues include `dependabot[bot]`, `renovate[bot]`, `github-advanced-security[bot]`, and organization-specific bots. Any of these will pass through the guard and trigger the full triage pipeline, including a comment post and label application — neither of which is useful on an automated issue. The comment also cannot be "helpful" in tone if the reporter is a bot.

**Fix:**
```typescript
const BOT_ACTOR_SUFFIX = '[bot]'
if (github.context.actor.endsWith(BOT_ACTOR_SUFFIX)) {
  core.info(`Skipping — triggered by bot actor: ${github.context.actor}`)
  return
}
```

---

### WR-02: `parseInt` without radix validation — `NaN` silently propagates to scorer

**File:** `src/action/main.ts:49-51`
**Issue:** Three inputs are parsed with `parseInt` but the results are never validated:
```typescript
const _grayZoneLow = parseInt(core.getInput('gray-zone-low') || '4', 10)
const _grayZoneHigh = parseInt(core.getInput('gray-zone-high') || '6', 10)
const maxBodyBytes = parseInt(core.getInput('max-body-bytes') || '10000', 10)
```
If a user sets `max-body-bytes: abc` in their workflow file, `parseInt('abc', 10)` returns `NaN`. The truncation check `issue.body.length > maxBodyBytes` then evaluates `N > NaN` which is `false`, so no truncation happens regardless of body size — the DoS protection described in comment `T-02-21` is silently disabled. `_grayZoneLow` and `_grayZoneHigh` have the same NaN risk when they are eventually wired in Phase 3.

**Fix:**
```typescript
function parsePositiveInt(raw: string, fallback: number): number {
  const v = parseInt(raw, 10)
  return Number.isFinite(v) && v > 0 ? v : fallback
}
const maxBodyBytes = parsePositiveInt(core.getInput('max-body-bytes') || '10000', 10000)
```

---

### WR-03: `hasContributing` is always `false` — field is a dead stub with no warning

**File:** `src/adapters/github/templates.ts:94`
**Issue:** `loadRepoContext` always returns `hasContributing: false` regardless of whether `CONTRIBUTING.md` exists in the repository. This is expected for Phase 2 (Phase 4 wires it), but the value is consumed by `format()` and `writeSummary()` as a live field today. Any downstream consumer that reads `repoContext.hasContributing` will always get `false`, making it indistinguishable from a repo that genuinely has no CONTRIBUTING.md. There is no `core.debug` or inline comment at the return site warning callers of this. If a Phase 3/4 developer reads the return value without checking the implementation, they will assume it reflects reality.

**Fix:** Add a comment at the return statement making the stub explicit, and add a `core.debug` log:
```typescript
// hasContributing: always false in Phase 2; Phase 4 will add CONTRIBUTING.md fetch
core.debug('hasContributing: stubbed false (Phase 4 will implement)')
return {
  hasIssueForms: templates.some((t) => t.type === 'form'),
  hasMdTemplates: templates.some((t) => t.type === 'md'),
  hasContributing: false,
  templates,
}
```

---

### WR-04: Massive code duplication between `IssueFormStrategy` and `TemplateMdStrategy`

**File:** `src/core/checklist/strategies/issue-form.ts`, `src/core/checklist/strategies/template-md.ts`
**Issue:** The two strategy files are near-identical copies: `TYPE_KEYWORDS`, `MAX_ITEMS`, `FIELD_SIGNAL_MAP`, `isFieldSatisfied`, and `sanitizeFieldLabel` are duplicated verbatim. The only differences are the template type filter (`'form'` vs `'md'`) and the `selectFormFields` / `selectMdFields` function names. When `FIELD_SIGNAL_MAP` needs to be updated (e.g., adding a new signal), the developer must update both files. This is already a maintenance liability and will worsen when Phase 4 adds a third strategy.

**Fix:** Extract shared logic to a `src/core/checklist/strategies/shared.ts` module:
```typescript
// shared.ts
export const TYPE_KEYWORDS: Record<IssueType, string> = { ... }
export const MAX_ITEMS = 5
export const FIELD_SIGNAL_MAP: Array<...> = [ ... ]
export function isFieldSatisfied(label: string, signals: Signals): boolean { ... }
export function sanitizeFieldLabel(label: string): string { ... }
export function selectByTypeOrUnion(
  type: IssueType,
  templates: ParsedTemplate[],
): string[] { ... }
```

---

### WR-05: `removeLabel` returns `'skipped'` on success path too — misleading return value

**File:** `src/adapters/github/labels.ts:68-91`
**Issue:** `removeLabel` returns `'removed'` on success and `'skipped'` on any error (both 404 and non-404). However the `LabelAction` type also contains `'skipped'` as a shared value for both "label wasn't on the issue (desired state achieved)" and "an unexpected error occurred and we swallowed it." The caller in `main.ts` passes this value to `writeSummary` which renders it in the workflow summary UI. A maintainer seeing "Label: skipped" in their summary cannot distinguish between "label was never on the issue" (normal) and "we got a 500 from the API" (silent failure).

**Fix:** Consider adding a `'error'` variant to `LabelAction`, or at minimum document in the type that `'skipped'` conflates two different outcomes. The current approach makes silent API failures invisible to operators.
```typescript
export type LabelAction = 'applied' | 'removed' | 'skipped' | 'error' | 'disabled' | 'dry-run'
// In removeLabel: return 'error' on non-404 errors instead of 'skipped'
```

---

### WR-06: Test M1 asserts `loadRepoContext` not called, but skip happens before Octokit is initialized

**File:** `tests/action/main.test.ts:166-175`
**Issue:** Test M1 asserts `expect(mockLoadRepoContext).not.toHaveBeenCalled()` after setting the `signal-oss-ignore` label. This is correct behavior but tests the wrong guarantee. The `signal-oss-ignore` exit at line 54-57 of `main.ts` occurs *before* the `GITHUB_TOKEN` is read and Octokit is initialized (lines 60-65). So the test passes for a coincidental reason: the mock for `loadRepoContext` is never invoked because the function returns early — but if someone moves the skip-label check to *after* token validation (a reasonable refactor), the test would still pass. The test does not assert that `mockGetOctokit` was also not called, which is the stronger guarantee and the actual security property (no I/O on ignored issues).

**Fix:**
```typescript
expect(vi.mocked(postOrUpdateComment)).not.toHaveBeenCalled()
expect(mockLoadRepoContext).not.toHaveBeenCalled()
expect(mockGetOctokit).not.toHaveBeenCalled() // add this assertion
expect(mockWriteSkipSummary).toHaveBeenCalledWith(expect.stringContaining('signal-oss-ignore'))
```

---

## Info

### IN-01: `parseMdTemplate` extracts only H3 headings — H2 headings common in real templates are ignored

**File:** `src/adapters/github/templates.ts:124-136`
**Issue:** The markdown template parser exclusively extracts `node.depth === 3` (H3) headings as field labels. However, many real-world markdown issue templates use H2 (`##`) for their section headings (e.g., the Rust `bug_report.md` fixture used in tests has `## Code` at H2). The test at `templates.test.ts:133` asserts `expect(result.templates[0].fields).not.toContain('Code')` — confirming that H2 headings are intentionally excluded. This is a deliberate design choice but it means a repo using H2-structured templates (common) will produce empty `fields[]` arrays, causing Tier 2 to not apply (`applies()` returns false when no fields) and falling through to baseline. The design choice should be documented as a known limitation.

**Fix:** Document the H3-only restriction as a known limitation in a comment, or broaden to `node.depth >= 2 && node.depth <= 3` to capture both H2 and H3 section headings from real templates.

---

### IN-02: `_model`, `_grayZoneLow`, `_grayZoneHigh` are read but unused — produces dead-code lint noise

**File:** `src/action/main.ts:48-50`
**Issue:** Three inputs are parsed into variables prefixed with `_` to signal intentional non-use, but they are still read from `core.getInput` on every run. The `_` prefix suppresses the unused-variable linter warning but the `core.getInput` calls execute regardless. This is fine for now but if input validation is ever added (see WR-02), these reads will need to be guarded or handled separately. Additionally, the pattern makes it non-obvious to reviewers that these are truly dead paths vs. accidentally unused variables.

**Fix:** Add an inline comment at each read making the phase intent explicit, or wrap them in a `/* Phase 3/4: */` block comment.

---

### IN-03: `writeSkipSummary` reason parameter is not sanitized before rendering into summary

**File:** `src/action/summary.ts:65-71`
**Issue:** The `reason` string passed to `writeSkipSummary` is embedded directly in the summary output. Currently the only call site passes the hardcoded string `'signal-oss-ignore label present'` (line 55 of `main.ts`), so there is no actual injection risk today. However, the function signature accepts any `string`, and a future call site could pass a value derived from user input (e.g., a label name read from the payload). Given that CR-03 already documents unsanitized title rendering as a critical issue, this pattern should be hardened proactively.

**Fix:** Apply the same `escapeMdTitle` helper (from CR-03 fix) to `reason` before rendering, or constrain the parameter type to a union of known-safe string literals.

---

_Reviewed: 2026-05-15T04:21:29Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

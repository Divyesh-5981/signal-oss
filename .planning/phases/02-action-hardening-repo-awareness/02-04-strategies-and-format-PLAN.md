---
phase: 02-action-hardening-repo-awareness
plan: 04
type: execute
wave: 2
depends_on: ["02-01"]
files_modified:
  - src/core/checklist/strategies/issue-form.ts
  - src/core/checklist/strategies/template-md.ts
  - src/core/checklist/generator.ts
  - src/core/format/markdown.ts
  - src/action/main.ts
  - tests/core/checklist.test.ts
  - tests/core/format.test.ts
autonomous: true
requirements: [CHECK-03, CHECK-04, CHECK-06]
tags: [strategy-chain, tier-1, tier-2, meta-nudge, markdown-format]

must_haves:
  truths:
    - "When `repoContext.hasIssueForms === true` AND at least one form template has `fields.length > 0`, `generateChecklist` returns `tierUsed === 'issue-form'`"
    - "When only `repoContext.hasMdTemplates === true` AND at least one md template has `fields.length > 0`, `generateChecklist` returns `tierUsed === 'template-md'`"
    - "When neither condition above holds, the chain falls through to `BaselineStrategy` and returns `tierUsed === 'baseline'`"
    - "`IssueFormStrategy.generate` returns at most 5 items (D-08)"
    - "`IssueFormStrategy` selects the template whose filename contains the issue-type keyword (`bug_report` / `feature_request` / `question`); if no filename matches, it returns the deduplicated union of all form templates' fields (D-05)"
    - "`TemplateMdStrategy` applies the same filename-match selection logic but on `type === 'md'` templates only"
    - "Every checklist item text follows the `'Could you share the X?'` framing (tone style guide CORE-06)"
    - "The meta-nudge in `format()` renders ONLY when both `repoContext.hasIssueForms === false` AND `repoContext.hasMdTemplates === false` (CHECK-06)"
    - "When `repoContext` is `undefined` (legacy callers), `format()` still shows the meta-nudge (backwards-compatible default)"
    - "Checklist item text strips/escapes potential `@mention` characters (`@`) from template field labels — replace `@` with `(at)` or remove (T-02-09 follow-up from Plan 02)"
  artifacts:
    - path: "src/core/checklist/strategies/issue-form.ts"
      provides: "IssueFormStrategy class implementing ChecklistStrategy for Tier 1"
      exports: ["IssueFormStrategy"]
      min_lines: 40
    - path: "src/core/checklist/strategies/template-md.ts"
      provides: "TemplateMdStrategy class for Tier 2"
      exports: ["TemplateMdStrategy"]
      min_lines: 35
    - path: "src/core/checklist/generator.ts"
      provides: "Updated STRATEGIES array with both new strategies prepended; passes ctx to generate()"
      contains: "new IssueFormStrategy()"
    - path: "src/core/format/markdown.ts"
      provides: "Updated format() with optional repoContext param; conditional META_NUDGE"
      contains: "repoContext?: RepoContext"
    - path: "src/action/main.ts"
      provides: "Updated call site: `format(scored, repoContext)`"
      contains: "format(scored, repoContext)"
  key_links:
    - from: "src/core/checklist/generator.ts"
      to: "src/core/checklist/strategies/issue-form.ts"
      via: "import + STRATEGIES array first entry"
      pattern: "new IssueFormStrategy"
    - from: "src/core/checklist/generator.ts"
      to: "src/core/checklist/strategies/template-md.ts"
      via: "import + STRATEGIES array second entry"
      pattern: "new TemplateMdStrategy"
    - from: "src/core/checklist/generator.ts"
      to: "ChecklistStrategy.generate"
      via: "passes ctx as third arg"
      pattern: "s\\.generate\\(type, signals, ctx\\)"
    - from: "src/core/format/markdown.ts"
      to: "RepoContext"
      via: "second optional parameter"
      pattern: "repoContext\\?: RepoContext"
---

<objective>
Land Tier 1 (Issue Forms) and Tier 2 (Markdown Templates) in the strategy chain, plus gate the meta-nudge so it only fires when the repo has no templates at all. Delivers CHECK-03, CHECK-04, and CHECK-06 at the *strategy/formatting* layer (Plan 02 delivered the parsers; this plan delivers the consumers).

Purpose: The hero output (the checklist) is now repo-aware. When a maintainer's `.github/ISSUE_TEMPLATE/bug_report.yml` declares `required: true` on "Reproduction URL", a low-quality issue gets back `- [ ] Could you share the reproduction url?` instead of the generic Tier-4 baseline. The meta-nudge stops nagging maintainers who already have templates — it only appears when the repo has none.

Output: Two new strategy files (~40 LOC each), updated generator (3-line diff), updated format function (signature + one conditional), updated main.ts call site (1-line diff), and tests covering all five new branches.
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
@src/core/types.ts
@src/core/checklist/strategies/baseline.ts
@src/core/checklist/generator.ts
@src/core/format/markdown.ts
@src/core/checklist/baselines.ts
@tests/core/checklist.test.ts
@tests/core/format.test.ts

<interfaces>
<!-- Existing contract (Plan 01 added ctx?) -->
```typescript
export interface ChecklistStrategy {
  name: string
  applies(ctx: RepoContext): boolean
  generate(type: IssueType, signals: Signals, ctx?: RepoContext): ChecklistItem[]
}

export interface ParsedTemplate {
  filename: string
  type: 'form' | 'md'
  fields: string[]
}
```

<!-- Existing format() to update -->
```typescript
// Before:
export function format(scored: ScoredIssue): string
// After:
export function format(scored: ScoredIssue, repoContext?: RepoContext): string
```

<!-- Existing generator.ts call to update -->
```typescript
// Before (line 20):
return { items: s.generate(type, signals), tierUsed: s.name }
// After:
return { items: s.generate(type, signals, ctx), tierUsed: s.name }
```

<!-- Filename-to-type keyword map (D-05) -->
```typescript
const TYPE_KEYWORDS: Record<IssueType, string> = {
  bug: 'bug_report',
  feature: 'feature_request',
  question: 'question',
}
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Write failing tests for both strategies, generator wiring, and meta-nudge gating</name>
  <read_first>
    - tests/core/checklist.test.ts (existing strategy-chain tests — extend, don't rewrite)
    - tests/core/format.test.ts (line 22 confirms `format(makeScored({...}))` is the call shape; preserve backwards-compatible default)
    - src/core/checklist/strategies/baseline.ts (analog class structure to copy)
    - src/core/types.ts (confirm ParsedTemplate / RepoContext shape after Plan 01)
  </read_first>
  <behavior>
    RED phase. Append (do not rewrite) test blocks to existing files. After this task, total test count goes up but new tests fail.

    Tests to add to `tests/core/checklist.test.ts`:
    - Test A1 (`IssueFormStrategy.applies — false when hasIssueForms=false`): `applies({ hasIssueForms: false, hasMdTemplates: true, hasContributing: false, templates: [{filename: 'x.yml', type: 'form', fields: ['a']}] })` returns `false`.
    - Test A2 (`IssueFormStrategy.applies — false when no form template has fields`): `applies({ hasIssueForms: true, hasMdTemplates: false, hasContributing: false, templates: [{filename: 'bug_report.yml', type: 'form', fields: []}] })` returns `false` (D-06).
    - Test A3 (`IssueFormStrategy.applies — true when at least one form template has fields`): returns `true` for `templates: [{filename: 'bug_report.yml', type: 'form', fields: ['Version']}]`.
    - Test A4 (`IssueFormStrategy.generate — bug type matches bug_report.yml filename`): given `templates: [{filename: 'bug_report.yml', type: 'form', fields: ['Reproduction URL', 'Version']}, {filename: 'feature_request.yml', type: 'form', fields: ['Use case']}]`, calling `generate('bug', signals, ctx)` returns 2 items whose `text` includes `'reproduction url'` and `'version'` (case-insensitive, lowercased per `'Could you share the X?'` framing).
    - Test A5 (`IssueFormStrategy.generate — no filename match → union of all form fields`): given templates with no filename matching `'question'`, `generate('question', signals, ctx)` returns the deduplicated union of all form templates' fields.
    - Test A6 (`IssueFormStrategy.generate — caps at 5 items`): given a single form template with 7 fields, `generate(...)` returns exactly 5 items (D-08).
    - Test A7 (`IssueFormStrategy.generate — uses Could you share framing`): every returned `item.text` starts with `'Could you share '`.
    - Test A8 (`TemplateMdStrategy.applies — false when hasMdTemplates=false`): returns `false` even if a `type: 'md'` template appears in `templates` (defensive).
    - Test A9 (`TemplateMdStrategy.applies — true when at least one md template has fields`): true for `templates: [{filename: 'bug_report.md', type: 'md', fields: ['Steps to Reproduce']}]`.
    - Test A10 (`TemplateMdStrategy.generate — selects md template by filename`): same logic as A4 but for `type: 'md'` templates only.
    - Test A11 (`TemplateMdStrategy.generate — 5-item cap and Could you share framing`).
    - Test A12 (`generateChecklist — IssueFormStrategy wins when applies`): given `ctx` with form templates having fields, the returned `tierUsed === 'issue-form'`.
    - Test A13 (`generateChecklist — TemplateMdStrategy wins when no forms but md templates apply`): `tierUsed === 'template-md'`.
    - Test A14 (`generateChecklist — falls through to baseline when neither applies`): given `ctx` with `templates: []`, `tierUsed === 'baseline'`.
    - Test A15 (`IssueFormStrategy.generate — sanitizes @mentions in field labels`): given `fields: ['Tag @maintainer for help']`, the returned `item.text` does NOT contain `'@maintainer'` (either replaced with `'(at)maintainer'` or stripped). Asserts via `expect(item.text).not.toContain('@')`.

    Tests to add to `tests/core/format.test.ts`:
    - Test F1 (`format(scored) without repoContext — still shows META_NUDGE`): existing tests already cover this; verify the existing assertion of `**Tip:**` still passes after the signature change.
    - Test F2 (`format(scored, ctx) with hasIssueForms=true → no META_NUDGE`): result string does NOT contain `'**Tip:**'`.
    - Test F3 (`format(scored, ctx) with hasMdTemplates=true → no META_NUDGE`): result string does NOT contain `'**Tip:**'`.
    - Test F4 (`format(scored, ctx) with both flags false → META_NUDGE present`): result string contains `'**Tip:**'`.

    Run `npm test -- --run`; new tests fail because strategy files do not exist and `format` has no `repoContext` parameter.
  </behavior>
  <action>
    Append new tests to `tests/core/checklist.test.ts` and `tests/core/format.test.ts`. For each new test, use the same `makeScored` / fixture helpers already in those files (read them first to copy idioms).

    For `tests/core/checklist.test.ts`, import the strategies (these imports will fail to resolve until Task 2):
    ```typescript
    import { IssueFormStrategy } from '../../src/core/checklist/strategies/issue-form.js'
    import { TemplateMdStrategy } from '../../src/core/checklist/strategies/template-md.js'
    import { generateChecklist } from '../../src/core/checklist/generator.js'
    ```

    For `tests/core/format.test.ts`, the existing tests call `format(scored)` (1 arg). Keep all existing tests unchanged — Plan 01's signature change made `repoContext` optional, so those tests still type-check. Add the 4 new tests (F1 is just renaming the existing assertion to anchor the regression; F2/F3/F4 require constructing a fresh `repoContext`).

    Run `npm test -- --run`. Expect failures: module-not-found for the strategy imports, plus the F2/F3 tests fail because `format()` still always includes META_NUDGE. Confirm RED.

    Do NOT yet modify `src/core/checklist/strategies/issue-form.ts`, `template-md.ts`, `generator.ts`, `format/markdown.ts`, or `main.ts`. Task 2 implements all of them.
  </action>
  <verify>
    <automated>npm test -- --run 2&gt;&amp;1 | tee /tmp/red-output.txt | grep -E "(FAIL|Cannot find module)" &amp;&amp; echo "RED-OK"</automated>
  </verify>
  <acceptance_criteria>
    - `tests/core/checklist.test.ts` has at least 15 new `it(` blocks (or descriptive titles containing `'IssueFormStrategy'` or `'TemplateMdStrategy'`); verifiable with `grep -cE "IssueFormStrategy|TemplateMdStrategy|generateChecklist" tests/core/checklist.test.ts` ≥ 10
    - `tests/core/format.test.ts` contains at least 4 new test assertions related to META_NUDGE conditional behavior; verifiable with `grep -c "Tip:" tests/core/format.test.ts` ≥ 4 (existing + new)
    - `tests/core/format.test.ts` contains at least one test that constructs a `repoContext` with `hasIssueForms: true` (verifiable: `grep "hasIssueForms: true" tests/core/format.test.ts`)
    - `npm test -- --run` exits non-zero (RED)
    - The failing test output references `IssueFormStrategy`, `TemplateMdStrategy`, OR `'**Tip:**'` (the three new failure surfaces)
  </acceptance_criteria>
  <done>
    Tests are written that fully specify Tier 1, Tier 2, and the meta-nudge gating. Test run is RED with clear "module not found" + assertion failures.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Implement both strategies, update generator + format + main.ts call sites</name>
  <read_first>
    - src/core/checklist/strategies/baseline.ts (verbatim analog for class structure)
    - src/core/checklist/generator.ts (current STRATEGIES array; only insert two entries + pass ctx)
    - src/core/format/markdown.ts (current 33-line file)
    - src/action/main.ts (line 46 call site to update)
    - .planning/phases/02-action-hardening-repo-awareness/02-PATTERNS.md (full strategy and format patterns)
    - tests/core/checklist.test.ts + tests/core/format.test.ts (the spec)
  </read_first>
  <behavior>
    GREEN phase. After all five files are updated, the full test suite passes (96 baseline + Plan 02 tests + Plan 03 tests + new tests from Task 1).
  </behavior>
  <action>
    Step A — create `src/core/checklist/strategies/issue-form.ts`:

    ```typescript
    // src/core/checklist/strategies/issue-form.ts
    // Tier 1 (CHECK-03): consumes ParsedTemplate[] (type: 'form') from RepoContext.templates.
    // Pure — no Octokit, no fs. Templates are produced by src/adapters/github/templates.ts.

    import type {
      ChecklistItem,
      ChecklistStrategy,
      IssueType,
      ParsedTemplate,
      RepoContext,
      Signals,
    } from '../../types.js'

    const TYPE_KEYWORDS: Record<IssueType, string> = {
      bug: 'bug_report',
      feature: 'feature_request',
      question: 'question',
    }

    const MAX_ITEMS = 5

    function sanitizeFieldLabel(label: string): string {
      // T-02-09 follow-up: defang @mentions in user-authored template field labels
      // so they don't tag arbitrary users when rendered as comment text.
      return label.replace(/@/g, '(at)').trim()
    }

    function selectFormFields(type: IssueType, forms: ParsedTemplate[]): string[] {
      const keyword = TYPE_KEYWORDS[type]
      const matched = forms.find((t) => t.filename.toLowerCase().includes(keyword))
      if (matched) return matched.fields
      // D-05 fallback: deduplicated union of all form templates' fields, preserving first-seen order
      const seen = new Set<string>()
      const union: string[] = []
      for (const t of forms) {
        for (const f of t.fields) {
          if (!seen.has(f)) {
            seen.add(f)
            union.push(f)
          }
        }
      }
      return union
    }

    export class IssueFormStrategy implements ChecklistStrategy {
      name = 'issue-form'

      applies(ctx: RepoContext): boolean {
        if (!ctx.hasIssueForms) return false
        return ctx.templates.some((t) => t.type === 'form' && t.fields.length > 0)
      }

      generate(type: IssueType, _signals: Signals, ctx?: RepoContext): ChecklistItem[] {
        if (!ctx) return []
        const forms = ctx.templates.filter((t) => t.type === 'form')
        const fields = selectFormFields(type, forms)
        return fields
          .map((label) => ({
            text: `Could you share the ${sanitizeFieldLabel(label).toLowerCase()}?`,
          }))
          .slice(0, MAX_ITEMS)
      }
    }
    ```

    Step B — create `src/core/checklist/strategies/template-md.ts`:

    ```typescript
    // src/core/checklist/strategies/template-md.ts
    // Tier 2 (CHECK-04): consumes ParsedTemplate[] (type: 'md') from RepoContext.templates.
    // Same selection rules as Tier 1 but only operates on markdown templates.

    import type {
      ChecklistItem,
      ChecklistStrategy,
      IssueType,
      ParsedTemplate,
      RepoContext,
      Signals,
    } from '../../types.js'

    const TYPE_KEYWORDS: Record<IssueType, string> = {
      bug: 'bug_report',
      feature: 'feature_request',
      question: 'question',
    }

    const MAX_ITEMS = 5

    function sanitizeFieldLabel(label: string): string {
      return label.replace(/@/g, '(at)').trim()
    }

    function selectMdFields(type: IssueType, mds: ParsedTemplate[]): string[] {
      const keyword = TYPE_KEYWORDS[type]
      const matched = mds.find((t) => t.filename.toLowerCase().includes(keyword))
      if (matched) return matched.fields
      const seen = new Set<string>()
      const union: string[] = []
      for (const t of mds) {
        for (const f of t.fields) {
          if (!seen.has(f)) {
            seen.add(f)
            union.push(f)
          }
        }
      }
      return union
    }

    export class TemplateMdStrategy implements ChecklistStrategy {
      name = 'template-md'

      applies(ctx: RepoContext): boolean {
        if (!ctx.hasMdTemplates) return false
        return ctx.templates.some((t) => t.type === 'md' && t.fields.length > 0)
      }

      generate(type: IssueType, _signals: Signals, ctx?: RepoContext): ChecklistItem[] {
        if (!ctx) return []
        const mds = ctx.templates.filter((t) => t.type === 'md')
        const fields = selectMdFields(type, mds)
        return fields
          .map((label) => ({
            text: `Could you share the ${sanitizeFieldLabel(label).toLowerCase()}?`,
          }))
          .slice(0, MAX_ITEMS)
      }
    }
    ```

    Step C — update `src/core/checklist/generator.ts`. Edit in place (do not rewrite the whole file). Apply these two changes:

    1. Add imports above the existing `import { BaselineStrategy }` line:
    ```typescript
    import { IssueFormStrategy } from './strategies/issue-form.js'
    import { TemplateMdStrategy } from './strategies/template-md.js'
    ```

    2. Replace the `STRATEGIES` array (currently containing only `new BaselineStrategy()`) with:
    ```typescript
    const STRATEGIES: ChecklistStrategy[] = [
      new IssueFormStrategy(),   // Tier 1
      new TemplateMdStrategy(),  // Tier 2
      // Phase 4 will prepend: ContributingStrategy (Tier 3)
      new BaselineStrategy(),    // Tier 4 — always applies; must stay last
    ]
    ```

    3. Update the call inside `generateChecklist`:
    ```typescript
    // Before: return { items: s.generate(type, signals), tierUsed: s.name }
    // After:
    return { items: s.generate(type, signals, ctx), tierUsed: s.name }
    ```

    Step D — update `src/core/format/markdown.ts`. Apply these surgical edits:

    1. Update import line. Replace `import type { ScoredIssue } from '../types.js'` with `import type { RepoContext, ScoredIssue } from '../types.js'`.

    2. Update `format` signature. Replace `export function format(scored: ScoredIssue): string {` with `export function format(scored: ScoredIssue, repoContext?: RepoContext): string {`.

    3. Update the `sections` array. Currently line 28:
    ```typescript
    const sections = [intro, checklist, badge, META_NUDGE, closing, MARKER].filter(
      (s) => s.length > 0,
    )
    ```
    Replace with:
    ```typescript
    // CHECK-06: meta-nudge appears ONLY when the repo has no templates of either kind.
    // When repoContext is undefined (legacy callers), default to showing the nudge.
    const showMetaNudge = !repoContext?.hasIssueForms && !repoContext?.hasMdTemplates
    const sections = [intro, checklist, badge, showMetaNudge ? META_NUDGE : '', closing, MARKER].filter(
      (s) => s.length > 0,
    )
    ```

    Step E — update `src/action/main.ts` to pass `repoContext` to `format`. The current line 46 reads `const body = format(scored)`. Change to `const body = format(scored, repoContext)`. The rest of `main.ts` is untouched in this plan — Plan 05 handles the bigger wiring changes (skip-label, inputs, labels, summary, real `loadRepoContext`). The Phase 1 stub `repoContext` (lines 38-43) stays in place for now; passing it through `format` is harmless because `hasIssueForms: false && hasMdTemplates: false` → meta-nudge still renders (matching current Phase 1 behavior on a no-template repo).

    Step F — run validation:
    1. `npm test -- --run` — full suite green
    2. `npm run build` — clean
    3. `npm run lint` — clean
    4. `npm run format` — formats any new whitespace
  </action>
  <verify>
    <automated>npm test -- --run &amp;&amp; npm run build &amp;&amp; npm run lint</automated>
  </verify>
  <acceptance_criteria>
    - `src/core/checklist/strategies/issue-form.ts` exists; `grep -c "export class IssueFormStrategy" src/core/checklist/strategies/issue-form.ts` returns 1
    - `src/core/checklist/strategies/template-md.ts` exists; `grep -c "export class TemplateMdStrategy" src/core/checklist/strategies/template-md.ts` returns 1
    - Neither strategy file imports from `src/adapters/` (hexagonal invariant): `grep -E "from '.*adapters" src/core/checklist/strategies/issue-form.ts src/core/checklist/strategies/template-md.ts` returns no matches
    - Both strategies contain the 5-item cap: `grep -c "MAX_ITEMS" src/core/checklist/strategies/issue-form.ts` ≥ 2 (const + slice); same for template-md
    - Both strategies sanitize `@`: `grep "replace(/@/g" src/core/checklist/strategies/issue-form.ts` matches once; same for template-md
    - `grep "new IssueFormStrategy()" src/core/checklist/generator.ts` matches once
    - `grep "new TemplateMdStrategy()" src/core/checklist/generator.ts` matches once
    - `grep "new BaselineStrategy()" src/core/checklist/generator.ts` still matches once (Tier 4 retained as fallback)
    - `grep "s.generate(type, signals, ctx)" src/core/checklist/generator.ts` matches once
    - `grep "repoContext?: RepoContext" src/core/format/markdown.ts` matches once
    - `grep "showMetaNudge" src/core/format/markdown.ts` matches at least twice (declaration + usage)
    - `grep "format(scored, repoContext)" src/action/main.ts` matches once
    - `npm test -- --run` exits 0 with pass count = baseline 96 + Plan 02 tests + Plan 03 tests + new tests from Task 1 (all green)
    - `npm run build` and `npm run lint` exit 0
  </acceptance_criteria>
  <done>
    Both strategies exist and pass tests. Generator prepends them in the correct order with BaselineStrategy as the final fallback. `format()` conditionally renders the meta-nudge. `main.ts` call site updated. Tier 1, Tier 2, and CHECK-06 are all functionally wired (Plan 05 will swap the Phase 1 stub `repoContext` for a real one).
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| `RepoContext.templates` → strategies | Strategies treat `ParsedTemplate.fields[]` as opaque strings produced by the adapter (Plan 02). Strings originated from untrusted YAML/Markdown in the consumer repo. |
| strategies → posted comment body | Each `ChecklistItem.text` is rendered as Markdown by GitHub Issues. `@mentions` would tag users; HTML tags would render. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-02-16 | Elevation of Privilege | `@mention` in template field label (e.g. `"Tag @maintainer here"`) tags users in the posted comment | mitigate | Both strategies pass field labels through `sanitizeFieldLabel(label)` which replaces every `@` with `(at)`. Test A15 (Task 1) asserts `expect(item.text).not.toContain('@')`. Acceptance criterion grep-verifies the `replace(/@/g, '(at)')` call exists in both files. |
| T-02-17 | Tampering | Template field label contains Markdown injection (e.g. `"[click me](javascript:alert(1))"`) | accept | The text is wrapped in `'Could you share the X?'` framing — links rendered inside that sentence are visually obvious to a maintainer scanning the comment, and `javascript:` URLs are blocked by GitHub's Markdown sanitizer. Defense in depth (HTML escaping) is overkill for a hackathon-scope output and would degrade legitimate uses (e.g. field labels containing backticks). |
| T-02-18 | Information Disclosure | Field label containing a private path or secret leaks into a public comment | accept | The label came from a file already public on the same repo (`.github/ISSUE_TEMPLATE/*` is committed). Re-posting it cannot leak anything not already public. |
| T-02-19 | Denial of Service | Template with 500 required fields produces 500-line checklist | mitigate | D-08 cap: `.slice(0, 5)` is grep-verified in acceptance criteria. Even if a maintainer authors a massive template, the comment contains at most 5 items. |
| T-02-20 | Tampering | Meta-nudge shown on a repo that already has templates (CHECK-06 regression) | mitigate | `format()` gates the nudge on `!repoContext?.hasIssueForms && !repoContext?.hasMdTemplates`. Tests F2 and F3 (Task 1) assert the nudge does NOT appear when either flag is true. Acceptance criterion grep-verifies the `showMetaNudge` conditional. |
</threat_model>

<verification>
- Full test suite passes (96 baseline + tests added in Plans 02, 03, and this plan)
- `npm run build` clean
- `npm run lint` clean
- Hexagonal invariant preserved: `grep -rE "from '.*adapters" src/core/` returns no matches
- BaselineStrategy still the last entry in STRATEGIES array
</verification>

<success_criteria>
- `IssueFormStrategy` and `TemplateMdStrategy` exist as pure core classes
- Strategy chain order is: IssueForm → TemplateMd → Baseline (first-applies-wins)
- D-05 filename selection + D-06 empty-fields fallthrough + D-08 5-item cap all enforced
- Field labels with `@` are sanitized to `(at)` before rendering
- Meta-nudge gated on absence of both template types (CHECK-06)
- `format()` is backwards-compatible: legacy single-arg calls still show meta-nudge
- No `src/core/` file imports from `src/adapters/` (hexagonal invariant)
</success_criteria>

<output>
After completion, create `.planning/phases/02-action-hardening-repo-awareness/02-04-strategies-and-format-SUMMARY.md`.
</output>

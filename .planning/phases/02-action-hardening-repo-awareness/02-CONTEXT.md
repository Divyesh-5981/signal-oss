# Phase 2: Action Hardening + Repo-Awareness - Context

**Gathered:** 2026-05-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Make the Action safe to install on real popular OSS repos. This phase adds:
- Idempotent edit-in-place comments (already scaffolded in Phase 1, soak-hardened here)
- Label management: auto-create `needs-info`, apply/remove, skip-label opt-out
- Action inputs with sensible zero-config defaults
- `core.summary()` workflow-run UI report
- Tier 1 checklist strategy: issue forms YAML (`.github/ISSUE_TEMPLATE/*.yml`)
- Tier 2 checklist strategy: markdown templates (`.github/ISSUE_TEMPLATE/*.md`)
- Meta-nudge when no templates are detected (CHECK-06)

**Delivers:** ACT-06, ACT-07, ACT-08, ACT-09, ACT-10, CHECK-03, CHECK-04, CHECK-06 (8 requirements)

**Does NOT deliver:** Tier 3 CONTRIBUTING.md / LLM extraction (Phase 4), benchmark harness (Phase 3), LLM adjudicator (Phase 4).

</domain>

<decisions>
## Implementation Decisions

### Template Loading (Tier 1 + Tier 2)
- **D-01:** Load `.github/ISSUE_TEMPLATE/` files via `octokit.rest.repos.getContent` API — no `actions/checkout` step needed by consumers. Already have `contents: read` permission (ACT-03). Self-contained: directory listing + per-file fetches.
- **D-02:** Template-fetching code lives in `src/adapters/github/templates.ts` — new file alongside `io.ts`. Keeps all Octokit calls in the adapter layer; pure fetch+parse, no business logic.
- **D-03:** On any template API failure (404, rate limit, network error): silent fallthrough — `core.warning()` log entry + `RepoContext` gets `hasIssueForms=false, hasMdTemplates=false`. Never throws. Hero output (checklist) always posts. Preserves hero-output-always invariant.
- **D-04:** Fetch template files from the repo's **default branch** (not the triggering commit SHA). Templates are config — they live on the default branch, not in feature branches.

### Multi-Template Selection + Checklist Cap
- **D-05:** When a repo has multiple templates, select by **filename type-match** (case-insensitive substring): bug → `*bug_report*`, feature → `*feature_request*`, question → `*question*`. If no filename matches the detected issue type, fall through to union of all templates' required fields as a last resort before Tier 4.
- **D-06:** `IssueFormStrategy.applies()` returns `false` when the matched template has **zero `required: true` fields**. Chain falls through to Tier 4 baseline. A template that requires nothing is treated as "no useful template."
- **D-07:** Tier 2 (markdown templates): parse **H3 headings only** (`### Header`) as field labels. H3 is the GitHub issue template convention (Steps to Reproduce, Expected vs Actual, etc.). Do not parse H1/H2/H4.
- **D-08:** **Max 5 checklist items** from Tier 1 or Tier 2. Take the top 5 by template order if more than 5 required fields exist. Keeps checklist tight and scannable (consistent with D-05's phase-1 spirit of 3–4 items).

### `core.summary()` Report
- **D-09:** Rich demo surface — render all of: issue title + number, detected type, signals table (all 7 signals with ✓/✗), score badge, tier used (Tier 1 / 2 / 4), template count found, label action taken (applied / removed / skipped / N/A), comment URL.
- **D-10:** When `dry-run` is active: render the full rich report **plus** a ⚠️ dry-run banner at the top — "⚠️ Dry-run mode — no comment was posted, no labels were changed." Best for demos and debugging.
- **D-11:** When Action exits early (bot-loop guard or `signal-oss-ignore` skip-label): write **one-line exit reason** only to `core.summary()` — "Skipped — reason: signal-oss-ignore label present" or "Skipped — bot-loop guard." Per ACT-08 spec. No full analysis pipeline.

### Label Management
- **D-12:** Default label color: **`#e4e669`** (yellow). Default description: `"Waiting for more information from the issue author"`. Yellow matches the "needs info" convention used by many popular repos; avoids the punitive signal of red/orange.
- **D-13:** If the configured label name **already exists** in the repo: silent succeed — apply the existing label as-is. Do NOT overwrite the maintainer's color or description. Respects customization.
- **D-14:** On re-run (e.g., issue reopened): **always re-apply** the label if checklist has any items, regardless of whether a maintainer manually removed it between events. ACT-06 spec is unconditional: "apply when checklist has any items." No extra state tracking.

### Claude's Discretion
- `src/adapters/github/labels.ts` — new file for label management, alongside `io.ts` and `templates.ts`. Consistent adapter pattern; implementation structure is Claude's call.
- Exact action input default values for `max-body-bytes` (suggest 10000, per typical GH issue limits), `gray-zone-low` (4, matching Phase 1 D-13), `gray-zone-high` (6, matching Phase 1 D-13).
- Exact `core.summary()` Markdown formatting (tables vs. lists, section headers) — follow GitHub Actions summary spec and pick what renders cleanest.
- Exact filename-to-type mapping heuristics beyond the three listed in D-05 (e.g., `general.yml`, `support.yml` → default to bug or question type).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Decisions & Requirements
- `.planning/PROJECT.md` — Core value, constraints (solo dev, 48h, BYOK, GitHub Action only), out-of-scope list
- `.planning/REQUIREMENTS.md` — Full ACT-06..10, CHECK-03, CHECK-04, CHECK-06 specs with acceptance criteria
- `.planning/ROADMAP.md` — Phase 2 success criteria (5 criteria), pitfall coverage; Pitfalls 8, 12, 15, 19 are directly relevant

### Architecture
- `.planning/research/ARCHITECTURE.md` — Hexagonal layout, shared CORE pattern, adapter boundaries, testability strategy. `src/core/` must stay pure — all Octokit in `src/adapters/`.

### Technology Stack
- `CLAUDE.md` §Technology Stack — Locked stack; includes `yaml` 2.x (eemeli/yaml) for issue-form YAML parsing, `unified`+`remark-parse` for markdown template AST, `zod` 4.x for validation, `@actions/core` 3.x for `core.summary()`

### Key Source Files (Phase 2 touch points)
- `src/action/main.ts` — `repoContext` stub clearly labeled "Phase 1 stub — Phase 2 implements real template loading"; this is the primary injection point
- `src/core/checklist/generator.ts` — `STRATEGIES` array has comment "Phase 2 prepends: IssueFormStrategy, TemplateMdStrategy"; new strategies go at the top
- `src/core/types.ts` — `RepoContext.templates: unknown[]` type needs to be typed in Phase 2 to hold parsed template data; `ChecklistStrategy` interface is the contract new strategies implement
- `src/adapters/github/io.ts` — existing `postOrUpdateComment()` handles idempotent comment; Phase 2 adds label operations in separate `labels.ts`

### Research
- `.planning/research/PITFALLS.md` — Pitfall 8 (tolerant issue-form YAML parser tested against 10 popular repos), Pitfall 12 (re-fetch issue body via API heals first-comment race), Pitfall 15 (markdown render visual review), Pitfall 19 (versioned marker `signal-oss:v1`)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/adapters/github/io.ts` → `postOrUpdateComment()` — already handles find-by-marker → update-in-place. Phase 2 adds `src/adapters/github/labels.ts` alongside it.
- `src/core/types.ts` → `ChecklistStrategy` interface (`applies()` + `generate()`) — Phase 2 implements `IssueFormStrategy` and `TemplateMdStrategy` against this interface.
- `src/core/types.ts` → `RepoContext` — `hasIssueForms`, `hasMdTemplates`, `hasContributing`, `templates: unknown[]` already defined. Phase 2 types the `templates` field (currently `unknown[]`).
- `src/core/checklist/baselines.ts` → `BASELINE_ITEMS` — Tier 4 fallback per issue type; Phase 2 strategies that return no items cause the chain to reach this.

### Established Patterns
- **Hexagonal:** `src/core/` is pure (zero Octokit, zero fs). All I/O lives in `src/adapters/github/`. This is inviolable — new template parsing logic belongs in adapters, not core.
- **Strategy chain:** `applies(ctx) → boolean`, `generate(type, signals) → ChecklistItem[]`. First strategy that returns `applies() === true` wins. Phase 2 prepends two strategies; they must NOT import from Octokit — they receive parsed data from the adapter layer.
- **Error resilience:** `io.ts` never throws on Octokit errors in production path. Same pattern must apply to `templates.ts` and `labels.ts`.

### Integration Points
- `src/action/main.ts` stub at `const repoContext: RepoContext = { ... }` — replace with real template loader call
- `src/core/checklist/generator.ts` `STRATEGIES` array — prepend `IssueFormStrategy`, `TemplateMdStrategy`
- `action.yml` — add ACT-07 inputs (`dry-run`, `enable-comments`, `enable-labels`, `label-name`, `model`, `gray-zone-low`, `gray-zone-high`, `max-body-bytes`) with defaults

</code_context>

<specifics>
## Specific Ideas

- The 10-repo soak test (success criteria 3) validates the Tier 1/2 parsers against repos like vue/core, microsoft/vscode, rust-lang/rust. The "either extract OR fall through without crashing" bar is the pass condition — not that parsing succeeds on every repo.
- `<!-- signal-oss:v1 -->` idempotency marker is already in `io.ts` (`MARKER` export). Phase 2 must use the same marker — do not change or version-bump it.
- `core.summary()` rich report doubles as screencast demo material. Format it for visual clarity at 1080p — short table rows, clear emoji indicators for ✓/✗, avoid overly wide columns.
- The `signal-oss-ignore` skip-label check (ACT-08) happens BEFORE template loading or any expensive operations — early exit should be the first meaningful check after the bot-loop guard.

</specifics>

<deferred>
## Deferred Ideas

- Tier 3: CONTRIBUTING.md → LLM extraction → Phase 4
- LLM adjudicator for gray-zone scoring → Phase 4
- Pagination for comment listing (Phase 1's `io.ts` fetches first 100 comments only; edge case for very active issues) → Phase 3 or Phase 4 if it surfaces in soak
- `issues.edited` trigger (currently blocked by ACT-02 per Phase 1 decisions — only `[opened, reopened]`; re-enabling requires soak confirmation) → evaluate in Phase 3

</deferred>

---

*Phase: 2-Action Hardening + Repo-Awareness*
*Context gathered: 2026-05-14*

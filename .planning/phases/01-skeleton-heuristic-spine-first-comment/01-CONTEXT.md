# Phase 1: Skeleton + Heuristic Spine + First Comment - Context

**Gathered:** 2026-05-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Bootstrap a working Node 24 / TypeScript GitHub Action that posts a Tier-4 baseline missing-info checklist comment on a sandbox repo issue — heuristics-only, no LLM, no repo-awareness. The hero output (the checklist comment) must work end-to-end by the time this phase closes.

**Delivers:** CORE-01..06, CHECK-01, CHECK-02, ACT-01..05 (13 requirements)

**Does NOT deliver:** repo-awareness (Phase 2), benchmark harness (Phase 3), LLM adjudicator (Phase 4), Tier 1/2/3 checklist strategies (Phase 2+4).

</domain>

<decisions>
## Implementation Decisions

### Scaffold
- **D-01:** Bootstrap from `actions/typescript-action` (official GitHub template). Not `int128/typescript-action` or manual init.
- **D-02:** Swap Jest→Vitest and ESLint+Prettier→Biome immediately in the **first commit** — before writing any source code. Avoids mid-sprint migration.
- **D-03:** `tsconfig` module resolution: **NodeNext / Node16**. Required for ESM-only deps (`unified` 11, `remark-parse` 11). ncc handles the ESM→CJS transpile transparently.
- **D-04:** Commit `dist/` (ncc-bundled output) to the repo from Phase 1. Required for the Action to be installable without a build step on the consumer side. ACT-01.

### Baseline Checklist Content (hero output)
- **D-05:** Tier-4 baseline: **3–4 items per issue type** (bug / feature / question). Tight and scannable; high-signal.
- **D-06:** Item framing: **question framing** ("Could you share…" style). No "Required:" / "Must:" / "Invalid" language. Matches CORE-06 tone guide. Passes the read-aloud test.
- **D-07:** Comment structure (top to bottom):
  1. Neutral helper intro: *"Thanks for opening this issue! To help us investigate, a few things seem to be missing:"*
  2. Checklist items (the hero output — front-and-center)
  3. Score badge (secondary, rendered after checklist)
  4. Meta-nudge stub (if no `.github/ISSUE_TEMPLATE/` detected)
  5. Soft closing: *"Once these are added, we'll take another look. Thanks for helping make this actionable!"*
- **D-08:** Meta-nudge stub copy (Phase 1 version): *"Tip: adding an issue template to `.github/ISSUE_TEMPLATE/` helps reporters include the right information upfront."* Phrased as a suggestion, never demanding.
- **D-09:** **Always post** a comment, even for high-quality issues. When checklist is empty (high-quality issue): adapt intro to *"This issue looks well-formed — no missing info detected."* The hero-output-always invariant is never broken.

### Heuristic Signal Scope
- **D-10:** **All 7 CORE-02 signals** are implemented in Phase 1: code blocks, stack-trace pattern, version/env mention, repro keywords, expected-vs-actual structure, minimal-example presence, screenshot/image-only flag. No deferred signals.
- **D-11:** Heuristic extractor: **mdast AST walk via `remark-parse`**. Not regex/string matching. Required for reliable structural detection (fenced code blocks, headings, images). CLAUDE.md explicitly requires AST parsing for heuristics.
- **D-12:** Signals DTO: **boolean presence flags only** in Phase 1. No span/offset metadata. DTO stays lean; can be extended in Phase 2 if template matching needs exact locations.
- **D-13:** Initial **gray-zone band: score 4–6**. Symmetric around the midpoint. Single tunable constant. Will be re-tuned in Phase 3 via benchmark. Exported from `src/core/score/weights.ts`.
- **D-14:** Per-signal weights: **typed constants in `src/core/score/weights.ts`** — not exposed as action inputs. Individual weights are internal tuning knobs; only `gray-zone-low` and `gray-zone-high` are action inputs (ACT-07, Phase 2).

### End-to-End Test Strategy
- **D-15:** Two-layer E2E approach:
  1. **`@github/local-action`** with a hand-crafted `event.json` (`issues.opened` payload) — local dry-run, no GitHub API calls, fast iteration.
  2. **Push to a new personal throwaway sandbox repo** (e.g., `signal-oss-sandbox`) — fire a real test issue, watch the live comment post.
- **D-16:** Sandbox: a **new throwaway repo** under the developer's GitHub account. Not a fork of an existing repo, not the signal-oss repo itself.
- **D-17:** Phase 1 soak = **single successful comment run**. No 24h bot-loop wait. Bot-loop guard (ACT-04: `github.actor === 'github-actions[bot]'` early exit) is verifiable by unit test + manual code inspection.

### Claude's Discretion
- Exact per-signal weights (initial values in `weights.ts` before benchmark tuning) — implementer picks reasonable starting values.
- Exact bug/feature/question checklist item text beyond the framing style (D-06) and count (D-05).
- tsconfig strict settings beyond module resolution.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Decisions & Requirements
- `.planning/PROJECT.md` — Core value, key decisions, constraints (solo dev, 48h window, BYOK, GitHub Action only), out-of-scope list
- `.planning/REQUIREMENTS.md` — Full CORE-01..06, CHECK-01..02, ACT-01..05 requirement specs with acceptance criteria
- `.planning/ROADMAP.md` — Phase 1 success criteria (5 criteria), pitfall coverage, hackathon rubric anchoring

### Architecture
- `.planning/research/ARCHITECTURE.md` — Hexagonal/ports-and-adapters layout, shared CORE pattern, component catalog, recommended project structure (`src/core/`, `src/adapters/`, `src/action/`), anti-patterns to avoid, testability strategy per component

### Technology Stack
- `CLAUDE.md` (§Technology Stack) — Full locked stack: Node 24, TypeScript 5.x, `@actions/core` 3.x, `@actions/github` 9.x, `@vercel/ncc` 0.38.x, `@anthropic-ai/sdk` 0.95.x, `unified` 11 + `remark-parse` 11, `zod` 4.x, Vitest 3.x, Biome 2.x, `tsx` 4.x, `@github/local-action`. Lists what NOT to use and why.

### Research Summaries
- `.planning/research/STACK.md` — Stack research (referenced by CLAUDE.md)
- `.planning/research/PITFALLS.md` — Critical pitfalls; Phase 1 addresses: Pitfall 1 (pull_request_target), Pitfall 2 (bot-loop), Pitfall 7 (explicit permissions), Pitfall 10 (JS+ncc cold-start), Pitfall 17 (no issue_comment listener)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- None yet — this is Phase 1, the repo is being created from scratch.

### Established Patterns
- All patterns are being established in this phase. The hexagonal layout defined in ARCHITECTURE.md is the founding pattern: `src/core/` stays pure (no I/O); adapters in `src/adapters/` implement ports.
- The `score(issue, repoContext, llm?)` entrypoint in `src/core/index.ts` is the load-bearing pattern — both Action runtime and benchmark harness call it. Never diverge.

### Integration Points
- `src/action/main.ts` → orchestrates: read event → load repo context (stub for Phase 1) → `score()` → `format()` → GitHub I/O adapter
- `dist/index.js` → ncc-bundled output; `action.yml` declares `using: 'node24'`; this is what GitHub runners execute

</code_context>

<specifics>
## Specific Ideas

- The comment structure (D-07) is the canonical layout for Phase 1: intro → checklist → score badge → meta-nudge → closing.
- "We don't care who wrote it. We care if it's actionable." — anchor narrative from PROJECT.md. Not used in the comment copy itself, but informs every tone decision.
- `@github/local-action` with a fixture `event.json` is the recommended local iteration loop before any push to sandbox. This is faster than push-per-iteration.
- `<!-- signal-oss:v1 -->` HTML idempotency marker (ACT-05) is already in scope for Phase 1 — implement it now even though Phase 2 hardens it. Do not skip it.

</specifics>

<deferred>
## Deferred Ideas

- Repo-awareness (Tier 1/2 template parsing, Octokit.getContent for `.github/ISSUE_TEMPLATE/`) → Phase 2
- Idempotency hardening (24h soak test, `issues.edited` trigger) → Phase 2
- Label management (`needs-info` auto-create/apply/remove) → Phase 2
- Action inputs (`dry-run`, `enable-comments`, `enable-labels`, etc.) → Phase 2
- Span/offset metadata in Signals DTO → Phase 2 (if template matching needs it)
- LLM adjudicator wiring → Phase 4
- Benchmark harness → Phase 3

</deferred>

---

*Phase: 1-Skeleton + Heuristic Spine + First Comment*
*Context gathered: 2026-05-09*

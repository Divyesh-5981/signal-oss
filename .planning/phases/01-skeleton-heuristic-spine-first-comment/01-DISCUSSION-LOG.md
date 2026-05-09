# Phase 1: Skeleton + Heuristic Spine + First Comment - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-09
**Phase:** 1-Skeleton + Heuristic Spine + First Comment
**Areas discussed:** Scaffold starting point, Baseline checklist content, Heuristic signal scope, End-to-end test strategy

---

## Scaffold Starting Point

| Option | Description | Selected |
|--------|-------------|----------|
| actions/typescript-action | Official GitHub template. Needs Jest→Vitest + ESLint+Prettier→Biome swap (~30min). Battle-tested. | ✓ |
| int128/typescript-action | Community template with Biome + Vitest pre-wired. Skips swap but less commonly referenced. | |
| Manual init (npm init) | Start from bare package.json. Maximum control, highest setup cost (~60-90min). | |

**User's choice:** `actions/typescript-action`

| Option | Description | Selected |
|--------|-------------|----------|
| Immediately — first commit | Swap before writing any source code. Avoids mid-sprint Jest migration. | ✓ |
| After first green test | Slight confidence check but risks messy mid-plan migration. | |

**User's choice:** Swap Jest→Vitest and ESLint+Prettier→Biome immediately in first commit.

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — commit dist/ from Phase 1 | Required for installable Action. ACT-01. | ✓ |
| No — defer to end of Phase 1 | Keeps early commits clean but blocks install testing. | |

**User's choice:** Commit `dist/` from Phase 1.

| Option | Description | Selected |
|--------|-------------|----------|
| NodeNext / Node16 | Required for ESM-only deps (unified 11, remark-parse 11). ncc handles transpile. | ✓ |
| Bundler | May need extra config for ESM-only packages. | |

**User's choice:** NodeNext / Node16 module resolution.

---

## Baseline Checklist Content

| Option | Description | Selected |
|--------|-------------|----------|
| 3–4 items per type | Tight, scannable, high-signal. | ✓ |
| 5–7 items | More comprehensive but risks wall-of-demands feel. | |
| You decide per type | Implementer picks counts independently per type. | |

**User's choice:** 3–4 items per issue type.

| Option | Description | Selected |
|--------|-------------|----------|
| Question framing — "Could you share..." | Reads as helpful ask. Matches CORE-06 tone guide. | ✓ |
| Action framing — "Add steps to reproduce" | Concise but directive. Risks "Required:" territory. | |
| Noun framing — "Reproduction steps" | Neutral but vague. | |

**User's choice:** Question framing ("Could you share…" style).

| Option | Description | Selected |
|--------|-------------|----------|
| Soft tip about templates | "Tip: adding an issue template to .github/ISSUE_TEMPLATE/ helps reporters include the right information upfront." | ✓ |
| Skip meta-nudge in Phase 1 | Render without nudge section. Add in Phase 2. | |
| Custom copy | User provides specific copy. | |

**User's choice:** Soft tip about templates.

| Option | Description | Selected |
|--------|-------------|----------|
| After the checklist | Checklist first = maintainer sees actionable items immediately. Score badge is contextual. | ✓ |
| Before the checklist | Score is prominent. Risks focus on number over checklist. | |
| Collapsible \<details\> block | Available but hidden. Keeps comment clean but adds HTML complexity. | |

**User's choice:** Score badge after checklist.

| Option | Description | Selected |
|--------|-------------|----------|
| Neutral helper intro | "Thanks for opening this issue! To help us investigate, a few things seem to be missing:" | ✓ |
| Score-first intro | "This issue scored 3/10 on actionability. Here's what would help:" | |
| No intro — just the checklist | Minimal but abrupt. | |

**User's choice:** Neutral helper intro.

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — soft thank-you | "Once these are added, we'll take another look. Thanks for helping make this actionable!" | ✓ |
| No closing line | Ends after score badge. Clean but abrupt. | |
| You decide | Implementer drafts appropriate closing copy. | |

**User's choice:** Soft thank-you closing line.

| Option | Description | Selected |
|--------|-------------|----------|
| Always post, adapt copy | High-quality issues get: "This issue looks well-formed — no missing info detected." | ✓ |
| Only post when checklist is non-empty | Cleaner for reporters but maintainers can't confirm Action ran. | |

**User's choice:** Always post; adapt copy for high-quality issues.

---

## Heuristic Signal Scope

| Option | Description | Selected |
|--------|-------------|----------|
| All 7 in Phase 1 | CORE-02 is a Phase 1 requirement. Checklist filtering depends on all signals. | ✓ |
| Minimum viable set first | Ship 4–5 high-value signals; add screenshot-only + minimal-example in Phase 2. Risk: success criterion #2 may not pass. | |

**User's choice:** All 7 CORE-02 signals in Phase 1.

| Option | Description | Selected |
|--------|-------------|----------|
| mdast AST walk via remark-parse | Reliable for structural signals. CLAUDE.md requires this. | ✓ |
| Regex/string matching | Faster to write but brittle. False positives from markdown-formatted text. | |

**User's choice:** mdast AST walk via `remark-parse`.

| Option | Description | Selected |
|--------|-------------|----------|
| Score 4–6 | Default from ARCHITECTURE.md and REQUIREMENTS.md. Symmetric, captures ambiguous middle. | ✓ |
| Score 3–7 | Wider band. More LLM calls. Higher cost. | |
| You decide | Implementer picks. | |

**User's choice:** Gray-zone band 4–6.

| Option | Description | Selected |
|--------|-------------|----------|
| Typed constants in weights.ts | CORE-04 requirement. Not user-facing config. | ✓ |
| Action inputs | Only gray-zone band is an action input. Individual weights are internal. | |

**User's choice:** Typed constants in `src/core/score/weights.ts`.

| Option | Description | Selected |
|--------|-------------|----------|
| Boolean presence flags only | Lean DTO. Extend in Phase 2 if needed. | ✓ |
| Booleans + spans | More data upfront but adds complexity Phase 1 doesn't need. | |

**User's choice:** Boolean presence flags only.

---

## End-to-End Test Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| @github/local-action + sandbox repo | Local dry-run first, then live push. Two confidence layers. | ✓ |
| Sandbox repo only | Push and test directly. Faster but round-trip per iteration. | |
| Vitest integration with recorded responses | No live sandbox. Doesn't satisfy success criterion #1. | |

**User's choice:** `@github/local-action` local dry-run first, then push to sandbox repo.

| Option | Description | Selected |
|--------|-------------|----------|
| New throwaway repo | Dedicated, disposable, no risk to existing repos. | ✓ |
| Fork of existing popular repo | More realistic but Phase 1 doesn't use repo-awareness yet. | |
| signal-oss repo itself | Demo appeal but pollutes issue tracker with test issues. | |

**User's choice:** New throwaway repo under the developer's GitHub account.

| Option | Description | Selected |
|--------|-------------|----------|
| Single run is sufficient | Bot-loop guard verifiable by unit test + code inspection. | ✓ |
| Run 24h soak test | Highest confidence but consumes half the hackathon window passively. | |

**User's choice:** Single run is sufficient for Phase 1.

---

## Claude's Discretion

- Exact per-signal weights (initial values in `weights.ts` before benchmark tuning)
- Exact checklist item text for bug/feature/question types beyond framing style and count constraints
- tsconfig strict settings beyond module resolution

## Deferred Ideas

- Repo-awareness (Tier 1/2) → Phase 2
- Label management → Phase 2
- Action inputs (`dry-run`, `enable-comments`, etc.) → Phase 2
- Span/offset metadata in Signals DTO → Phase 2 (if needed)
- LLM adjudicator → Phase 4
- Benchmark harness → Phase 3

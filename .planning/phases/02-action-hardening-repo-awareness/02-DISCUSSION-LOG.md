# Phase 2: Action Hardening + Repo-Awareness - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-14
**Phase:** 2-Action Hardening + Repo-Awareness
**Areas discussed:** Template loading, Multi-template selection, core.summary() depth, Label defaults + conflicts

---

## Template Loading

| Option | Description | Selected |
|--------|-------------|----------|
| API fetch (getContent) | octokit.rest.repos.getContent — no actions/checkout step needed | ✓ |
| actions/checkout + filesystem | Requires consumer to add checkout step; reads from disk | |

**User's choice:** API fetch (Recommended)
**Notes:** Self-contained; already have contents: read permission from ACT-03.

---

| Option | Description | Selected |
|--------|-------------|----------|
| src/adapters/github/templates.ts | New file alongside io.ts — keeps adapter pattern consistent | ✓ |
| src/adapters/github/io.ts | Add to existing io.ts — simpler but mixes concerns | |
| src/action/repo-context.ts | New file in action layer — logic in main.ts territory | |

**User's choice:** src/adapters/github/templates.ts (Recommended)
**Notes:** Consistent with emerging adapter pattern.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Silent fallthrough to Tier 4 | core.warning() + RepoContext defaults to false — never throws | ✓ |
| Throw and fail the Action | Exit non-zero on template fetch failure | |

**User's choice:** Silent fallthrough to Tier 4 (Recommended)
**Notes:** Preserves hero-output-always invariant.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Default branch | Fetch from repo's default branch (main/master) | ✓ |
| Triggering commit SHA | Use SHA from event context — more precise but complex | |

**User's choice:** Default branch (Recommended)
**Notes:** Templates are config files; they live on default branch.

---

## Multi-Template Selection

| Option | Description | Selected |
|--------|-------------|----------|
| Type-match by filename | bug → bug_report.yml, feature → feature_request.yml; union fallback | ✓ |
| Union of all required fields | Merge all templates' required:true fields | |
| First template found | Alphabetically first — fragile, ignores issue type | |

**User's choice:** Type-match by filename (Recommended)
**Notes:** Most targeted checklist; union is the fallback when no type-specific match found.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Fall through to Tier 4 | applies() returns false when zero required:true fields | ✓ |
| Use all optional fields | Every template field becomes a checklist item | |
| Use field labels as-is | No filtering on required flag | |

**User's choice:** Fall through to Tier 4 baseline (Recommended)
**Notes:** A template requiring nothing is treated as "no useful template."

---

| Option | Description | Selected |
|--------|-------------|----------|
| H3 only (### Header) | GitHub issue template convention — most reliable | ✓ |
| H2 and H3 | Broader coverage; risks false positives from structural headings | |
| Any heading (H1–H4) | Widest coverage; high false-positive rate | |

**User's choice:** H3 only (### Header) (Recommended)
**Notes:** Consistent with CLAUDE.md recommendation for remark-parse/AST usage.

---

| Option | Description | Selected |
|--------|-------------|----------|
| 5 items max | Top 5 by template order; tight and scannable | ✓ |
| No cap — all required fields | Could produce 8-10 item wall on thorough templates | |
| 3 items max | Stricter; risks omitting important required fields | |

**User's choice:** 5 items max (Recommended)
**Notes:** Consistent with Phase 1's D-05 spirit (3-4 items per type).

---

## core.summary() Depth

| Option | Description | Selected |
|--------|-------------|----------|
| Rich demo surface | Issue title/number, type, signals table, score, tier, templates, label action, comment URL | ✓ |
| Minimal compliance | Just the 4 ACT-09 required fields | |

**User's choice:** Rich demo surface (Recommended)
**Notes:** Roadmap says it doubles as live demo material.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Full report + dry-run banner | Same rich breakdown + ⚠️ banner at top | ✓ |
| Dry-run notice only | Just confirms dry-run fired | |

**User's choice:** Show full report + dry-run banner (Recommended)
**Notes:** Best for demos and debugging.

---

| Option | Description | Selected |
|--------|-------------|----------|
| One-line exit reason | "Skipped — reason: signal-oss-ignore label present" | ✓ |
| Full report with skip flag | Full analysis pipeline + skip flag | |

**User's choice:** One-line exit reason (Recommended)
**Notes:** Matches ACT-08 spec. Avoids wasting compute on intentionally-skipped issues.

---

## Label Defaults + Conflicts

| Option | Description | Selected |
|--------|-------------|----------|
| #e4e669 (yellow) | Soft yellow — common "needs info" convention on popular repos | ✓ |
| #d93f0b (orange-red) | More urgent-looking; risks feeling punitive | |
| #0075ca (blue) | GitHub's doc color — neutral but doesn't signal "missing info" | |

**User's choice:** #e4e669 (yellow, Recommended)
**Notes:** Widely used convention for this label type.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Silent succeed — use as-is | Apply existing label without overwriting | ✓ |
| Update color + description | Overwrite maintainer's customization | |

**User's choice:** Silent succeed — use it as-is (Recommended)
**Notes:** Respects maintainer customization.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, always re-apply | Unconditional per ACT-06 spec | ✓ |
| No, respect manual removal | Check prior state; skip if manually removed | |

**User's choice:** Yes, always re-apply if checklist has items (Recommended)
**Notes:** ACT-06 is unconditional; tracking state would add complexity.

---

| Option | Description | Selected |
|--------|-------------|----------|
| src/adapters/github/labels.ts | New file — consistent adapter pattern | ✓ (Claude's discretion) |
| src/adapters/github/io.ts | Add to existing io.ts | |

**User's choice:** "Whichever best follow" — deferred to Claude
**Notes:** Claude selected labels.ts to maintain consistent adapter separation.

---

## Claude's Discretion

- Label adapter file location: `src/adapters/github/labels.ts` (consistent with io.ts/templates.ts pattern)
- Default `max-body-bytes`: 10000 (typical GitHub issue body limit)
- Default `gray-zone-low`/`gray-zone-high`: 4/6 (matching Phase 1 D-13)
- `core.summary()` Markdown formatting: tables with emoji indicators — Claude picks exact layout

## Deferred Ideas

- Tier 3 CONTRIBUTING.md → LLM extraction → Phase 4
- LLM adjudicator → Phase 4
- `issues.edited` trigger (currently blocked by ACT-02) → evaluate in Phase 3
- Comment listing pagination (Phase 1 fetches first 100 only) → Phase 3/4 if surfaces in soak

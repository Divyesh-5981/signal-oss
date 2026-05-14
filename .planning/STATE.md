---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: executing
last_updated: "2026-05-14T14:30:00.000Z"
progress:
  total_phases: 5
  completed_phases: 1
  total_plans: 5
  completed_plans: 5
  percent: 100
---

# State: Signal-OSS

**Project Memory** — Updated at every phase, plan, and milestone transition.

## Project Reference

**Name:** Signal-OSS
**Project file:** `.planning/PROJECT.md`
**Roadmap:** `.planning/ROADMAP.md`
**Requirements:** `.planning/REQUIREMENTS.md`

**Core Value:** The hero output is a tailored missing-info checklist on every new issue. If the score, the labeling, the dashboards, and every other feature fail, the comment with a useful checklist must still post — because that's what saves the maintainer time.

**Current Focus:** Phase 1 complete. Next: Phase 2 — Action Hardening + Repo-Awareness (idempotent edit-in-place, label management, Tier 1/2 template parsers).

**Mode:** MVP — every phase ships a demoable end-to-end slice. Phase 1 already comments something useful; later phases enrich.

## Current Position

**Phase:** Phase 1 — Complete ✓ | Next: Phase 2 — Action Hardening + Repo-Awareness
**Plan:** All 5 Phase 1 plans executed and verified
**Status:** Phase 1 Done — sandbox E2E verified (comment posts correctly on real issue)
**Progress:** [██████████] 100% (Phase 1)

```
[==        ] 20%  Overall (1/5 phases complete)
```

## Performance Metrics

| Metric                              | Target             | Current                  |
| ----------------------------------- | ------------------ | ------------------------ |
| v1 requirements covered             | 43/43              | 43/43 (mapped to phases) |
| Phases complete                     | 5/5                | 1/5                      |
| Phase 1 tests passing               | All                | 96/96 ✓                  |
| Cold-start budget (event → comment) | <10s p50           | Verified in sandbox ✓    |
| dist/index.js bundle                | Single file        | 1.5MB committed ✓        |
| Benchmark P/R reported              | Yes (≥N=100, ±CIs) | (Phase 3 ships)          |
| Critical pitfalls addressed         | 5/5                | 5/5 (mapped to phases)   |
| Demo screencast recorded            | Yes                | (Phase 5 ships)          |

## Accumulated Context

### Key Decisions (carried from PROJECT.md + Plan 02)

- GitHub Action only — no CLI, App, or dashboard for v1
- Checklist is the hero output; score is a secondary badge
- Repo-aware checklist with 4-tier graceful-degradation fallback
- Issues only — PRs explicitly v2
- Hybrid heuristics-first + LLM-on-gray-zone
- Auto-comment + `needs-info` label; no auto-close
- Issue-type classified by heuristics + label inference (no LLM)
- Meta-nudge in comment when repo has no templates
- Ship a precision/recall benchmark on real repo issues
- Bring-your-own-key for LLM access
- score() is synchronous (not async) — Phase 4 LLM async handled at adapter boundary
- rollup.config.ts overrides outDir to 'dist' to satisfy @rollup/plugin-typescript path validation

### Architecture Spine (from research/ARCHITECTURE.md)

- Hexagonal / ports-and-adapters
- Pure `src/core/score(issue, repoContext, llm?)` entrypoint called by both Action runtime and benchmark harness
- All I/O (Octokit, LLM, filesystem) injected as ports
- Strategy chain for 4-tier checklist generator
- LLM is the LAST component wired so heuristics-only is shippable from Phase 1

### Active Todos

- Begin Phase 2 planning: idempotent edit-in-place, label management, Tier 1 (issue forms YAML) + Tier 2 (markdown templates) parsers, action inputs with zero-config defaults.

### Completed Plans

- **01-01-scaffold** (2026-05-09): Bootstrapped toolchain — Node 24, TypeScript 5.9, Rollup 4, Vitest 4.1.5, Biome 2.4.14; all Phase 1 deps installed; 2/2 smoke tests passing.
- **01-02-dtos-stub** (2026-05-09): Locked all Phase 1 DTOs in src/core/types.ts (verbatim from SKELETON.md A6), LLMPort in src/core/llm/port.ts, stub score() with locked sync signature, first Rollup bundle dist/index.js (971KB, Walking Skeleton Stage A). 11/11 tests passing. Hexagonal invariant verified.
- **01-03-heuristics-classifier** (2026-05-09): Implemented extractSignals() via mdast AST walk (remark-parse + unist-util-visit) for all 7 signals; classifyType() with 4-tier label/title/body/default precedence. 5 fixture files. 59/59 tests passing. Hexagonal invariant verified.
- **01-04-checklist-score-format** (2026-05-09): Implemented strategy-chain checklist generator (BaselineStrategy, Tier-4), weighted-sum computeScore() with gray-zone band 4-6, markdown formatter with idempotency marker. Real score() pipeline wired. Tests passing. Hexagonal invariant verified.
- **01-05-action-wiring** (2026-05-14): Implemented GitHub I/O adapter (postOrUpdateComment with idempotency marker), full main.ts orchestrator with bot-loop guard, action.yml (node24), triage.yml + ci.yml workflows, fixture event JSON, dist/index.js rebuilt (1.5MB). 96/96 tests passing. Sandbox E2E verified — comment posts correctly on real issue.

### Blockers

None.

### Risk Register (top items, from research/PITFALLS.md)

- Critical: prompt injection from issue body — addressed Phase 4
- Critical: BYOK key leakage — addressed Phase 4
- Critical: live-demo LLM outage — addressed Phase 4 + Phase 5
- Critical: bot-loop on edits — addressed Phase 1 ✓ (verified in sandbox)
- Critical: `pull_request_target` misuse — sidestepped in Phase 1 ✓ (on: issues: only)
- High: benchmark ground-truth contamination — addressed Phase 3 (70/30 split frozen pre-tuning, κ-audit)
- High: tolerant YAML parser for issue forms — addressed Phase 2 (corpus from 10 popular repos)
- Pre-approved benchmark fallback: if hour 30 budget at risk → 50 issues × 3 repos (BENCH-07)

## Session Continuity

**Last action:** Phase 1 complete (2026-05-14). All 5 plans executed. 96/96 tests passing. Sandbox E2E verified — Action posts Tier-4 baseline checklist comment on real issue within cold-start budget.
**Next action:** Begin Phase 2 — Action Hardening + Repo-Awareness. First step: create Phase 2 plans (idempotent edit-in-place already partially implemented via marker; focus on label management, Tier 1/2 parsers, action inputs).
**Resume hint:** Phase 1 is DONE. Phase 2 requirements: ACT-06, ACT-07, ACT-08, ACT-09, ACT-10, CHECK-03, CHECK-04, CHECK-06. Key deliverables: needs-info label auto-create/apply/remove, signal-oss-ignore skip-label, tolerant issue-form YAML parser, markdown template parser, action inputs with defaults, core.summary() report.

---

_State initialized: 2026-05-08_
_Last updated: 2026-05-14 — Phase 1 complete (5/5 plans, sandbox E2E verified)_

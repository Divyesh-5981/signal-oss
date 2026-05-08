# State: Signal-OSS

**Project Memory** — Updated at every phase, plan, and milestone transition.

## Project Reference

**Name:** Signal-OSS
**Project file:** `.planning/PROJECT.md`
**Roadmap:** `.planning/ROADMAP.md`
**Requirements:** `.planning/REQUIREMENTS.md`

**Core Value:** The hero output is a tailored missing-info checklist on every new issue. If the score, the labeling, the dashboards, and every other feature fail, the comment with a useful checklist must still post — because that's what saves the maintainer time.

**Current Focus:** Ship the heuristics-only hero output (Tier-4 baseline checklist + heuristic score badge) end-to-end on a sandbox repo via a hardened Node 24 / TypeScript GitHub Action.

**Mode:** MVP — every phase ships a demoable end-to-end slice. Phase 1 already comments something useful; later phases enrich.

## Current Position

**Phase:** Phase 1 — Skeleton + Heuristic Spine + First Comment
**Plan:** Not yet planned (`/gsd-plan-phase 1` to begin)
**Status:** Roadmap approved; awaiting plan-phase invocation
**Progress:** 0/5 phases complete

```
[          ] 0%   Phase 1 of 5
```

## Performance Metrics

| Metric | Target | Current |
|--------|--------|---------|
| v1 requirements covered | 43/43 | 43/43 (mapped to phases) |
| Phases complete | 5/5 | 0/5 |
| Cold-start budget (event → comment) | <10s p50 | (Phase 1 verifies) |
| Benchmark P/R reported | Yes (≥N=100, ±CIs) | (Phase 3 ships) |
| Critical pitfalls addressed | 5/5 | 5/5 (mapped to phases) |
| Demo screencast recorded | Yes | (Phase 5 ships) |

## Accumulated Context

### Key Decisions (carried from PROJECT.md)
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

### Architecture Spine (from research/ARCHITECTURE.md)
- Hexagonal / ports-and-adapters
- Pure `src/core/score(issue, repoContext, llm?)` entrypoint called by both Action runtime and benchmark harness
- All I/O (Octokit, LLM, filesystem) injected as ports
- Strategy chain for 4-tier checklist generator
- LLM is the LAST component wired so heuristics-only is shippable from Phase 1

### Active Todos
- Begin Phase 1 plan: scaffold from `actions/typescript-action`, swap Jest→Vitest and ESLint+Prettier→Biome, lock DTOs, ship workflow YAML with hardened triggers + permissions, build heuristics extractor, ship Tier-4 baseline checklist, end-to-end first comment on sandbox repo.

### Blockers
None.

### Risk Register (top items, from research/PITFALLS.md)
- Critical: prompt injection from issue body — addressed Phase 4
- Critical: BYOK key leakage — addressed Phase 4
- Critical: live-demo LLM outage — addressed Phase 4 + Phase 5
- Critical: bot-loop on edits — addressed Phase 1
- Critical: `pull_request_target` misuse — sidestepped in Phase 1 by scope
- High: benchmark ground-truth contamination — addressed Phase 3 (70/30 split frozen pre-tuning, κ-audit)
- High: tolerant YAML parser for issue forms — addressed Phase 2 (corpus from 10 popular repos)
- Pre-approved benchmark fallback: if hour 30 budget at risk → 50 issues × 3 repos (BENCH-07)

## Session Continuity

**Last action:** Roadmap created from PROJECT.md + REQUIREMENTS.md + research/SUMMARY.md.
**Next action:** `/gsd-plan-phase 1` — decompose Phase 1 into executable plans.
**Resume hint:** Phase 1 hero milestone is "Action posts a real Tier-4 baseline checklist comment on a sandbox repo issue" — every plan inside Phase 1 must contribute to that demoable end-to-end slice.

---

*State initialized: 2026-05-08*
*Last updated: 2026-05-08 after roadmap creation*

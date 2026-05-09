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
**Plan:** 01-02 complete; next: 01-03-heuristics
**Status:** In Progress — Plan 01-02 (DTOs + stub) complete
**Progress:** 0/5 phases complete (Phase 1 in progress: 2/5 plans done)

```
[====      ] 40%  Phase 1 Plan 2/5 complete
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
- Execute Phase 1 Plan 03 (01-03-heuristics): Implement extractSignals() heuristic extractor using unified/remark AST parsing.

### Completed Plans
- **01-01-scaffold** (2026-05-09): Bootstrapped toolchain — Node 24, TypeScript 5.9, Rollup 4, Vitest 4.1.5, Biome 2.4.14; all Phase 1 deps installed; 2/2 smoke tests passing.
- **01-02-dtos-stub** (2026-05-09): Locked all Phase 1 DTOs in src/core/types.ts (verbatim from SKELETON.md A6), LLMPort in src/core/llm/port.ts, stub score() with locked sync signature, first Rollup bundle dist/index.js (971KB, Walking Skeleton Stage A). 11/11 tests passing. Hexagonal invariant verified.

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

**Last action:** Plan 01-02-dtos-stub executed (2026-05-09). DTOs locked, score() stubbed, first dist build at 971KB. 11/11 tests passing.
**Next action:** Execute Plan 01-03-heuristics — implement extractSignals() with unified/remark AST parsing.
**Resume hint:** Phase 1 hero milestone is "Action posts a real Tier-4 baseline checklist comment on a sandbox repo issue". Plans 01-01 and 01-02 done; 3 plans remain in Phase 1.

---

*State initialized: 2026-05-08*
*Last updated: 2026-05-09 after Plan 01-02-dtos-stub*

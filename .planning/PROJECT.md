# Signal-OSS

## What This Is

A GitHub Action that triages incoming GitHub Issues for open-source maintainers. For every new issue, Signal-OSS computes an actionability score (0–10) and posts a repo-aware checklist of what's missing — repro steps, version, stack trace, minimal example — so maintainers don't have to type "can you share your version?" ever again. Built for OSS maintainers of repos in the 1k–50k-star range who drown in low-effort, value-void reports ("slop").

## Core Value

**The hero output is a tailored missing-info checklist on every new issue.** If the score, the labeling, the dashboards, and every other feature fail, the comment with a useful checklist must still post — because that's what saves the maintainer time.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] GitHub Action installs into a target repo with one workflow file
- [ ] Heuristics layer detects presence/absence of standard signals (repro steps, version, stack trace, code blocks, minimal example)
- [ ] Issue-type classifier (bug / feature / question) using heuristics + existing labels + title patterns — no LLM
- [ ] Repo-aware checklist generator with graceful-degradation fallback hierarchy:
  - issue forms (`.github/ISSUE_TEMPLATE/*.yml`) → use exact required fields
  - issue templates (`.github/ISSUE_TEMPLATE/*.md`) → parse headers
  - CONTRIBUTING.md only → LLM extracts expectations
  - nothing → universal baseline checklist for the detected issue type
- [ ] LLM-assisted scoring on gray-zone cases only (heuristics-first, LLM gates the ambiguous middle)
- [ ] Auto-comment with the missing-info checklist + score badge + meta-nudge when templates are missing
- [ ] Auto-apply `needs-info` label when checklist has any items
- [ ] Bring-your-own-key configuration (OPENAI_API_KEY / ANTHROPIC_API_KEY via repo secrets)
- [ ] Precision/recall benchmark — 100–200 historical issues across 3–5 popular repos, ground-truth = closed-as-invalid/needs-info without action
- [ ] Demo screencast running the Action against real public repos' historical issues

### Out of Scope

- AI-authorship detection — the hackathon explicitly devalues this; we don't care who wrote it, only if it's actionable
- Pull Request triage — different rubric (diff size, tests, linked issue); explicit v2
- CLI for backlog scan — folded into v2; one surface for v1
- GitHub App / standalone web service — Action is the only surface
- Web dashboard / leaderboard — out of scope; no UI surface in v1
- Auto-closing stale "needs-info" issues — politically sensitive, opt-in v2
- Replacing or generating issue templates for the repo — we triage what comes in, not the templating system itself
- Per-repo aggressiveness configuration file — comment + label is fixed default for v1
- Browser extension / pre-submit "Slop-Coach" — innovation hook deferred to v2
- Public Slop-Bench leaderboard of repos — out of scope (presentation magnet, weak utility)

## Context

**Hackathon:** Slop Scan 2026. The hackathon's stated philosophy is to move *beyond* AI-detection and toward utility — measure whether content is actionable, not whether it was AI-written. Signal-OSS is built directly to that brief.

**Judging rubric** (drives every scope decision):

| Pillar | Weight | How Signal-OSS targets it |
|---|---|---|
| Accuracy | 30% | Heuristics-first design + benchmark with precision/recall on real ground-truth issues |
| Usefulness | 25% | Checklist-first output saves maintainer keystrokes immediately |
| Execution | 20% | Single surface (Action), tight scope, demoable in <60s |
| Innovation | 15% | Repo-aware checklist (reads CONTRIBUTING.md + templates) — no other tool does this |
| Presentation | 10% | "We don't care who wrote it. We care if it's actionable." Demo on real popular repos. |

**Target users:** Maintainers of OSS repos in the 1k–50k-star range. Below 1k = not enough volume to feel the pain; above 50k = already have full-time triagers, scripts, and labelers. The 1k–50k band is where the pain is real and the install-friction tolerance is highest.

**Anti-pattern we avoid:** Generic "AI-content classifier" framing. The hackathon and the target user both reject it. Signal-OSS frames every decision through the question *"does this make a maintainer's next minute easier?"*

## Constraints

- **Time/Team**: Solo developer, 48-hour hackathon window — every feature must defend its place against the demo
- **Surface**: GitHub Action only for v1 — no CLI, no GitHub App, no web UI; all output lives in PR/issue comments and Action logs
- **LLM cost model**: Bring-your-own-key (no hosted backend); heuristics-first design keeps LLM calls to gray-zone cases only — must work plausibly with a single Anthropic/OpenAI API key under typical OSS issue volume
- **Voice & tone**: The auto-comment must read as helpful, not gatekeeping; tone is a quality dimension, not just polish
- **Benchmark scope risk**: 100–200 issues × 5 repos × LLM calls is the highest-risk feature for the time budget. Pre-approved fallback: cut to 50 issues × 3 repos if needed by hour 30
- **Public repo data only**: Benchmark uses historical public issues, no private data, no scraping that violates ToS
- **Demo plausibility**: Demo must run against real, recognizable OSS repos (not toy fixtures) — judges discount synthetic demos

## Key Decisions

| Decision | Rationale | Outcome |
|---|---|---|
| GitHub Action only — no CLI, App, or dashboard for v1 | One surface lets us polish to demo-grade in 48h; Action is highest-utility for the target user | — Pending |
| Checklist is the hero output; score is a secondary badge | Score saves no time; checklist saves the "can you share X?" round-trip. Aligns with Usefulness pillar (25%). | — Pending |
| Repo-aware checklist with 4-tier graceful-degradation fallback | Differentiates from generic Probot bots; works even on repos with no templates (universal baseline by issue type) | — Pending |
| Issues only — PRs explicitly v2 | PR rubric (diff, tests, links) is a different problem; doing both = doing neither well in 48h | — Pending |
| Hybrid heuristics-first + LLM-on-gray-zone | Cheapest and most accurate combo; deterministic for clear cases, LLM where it adds value | — Pending |
| Auto-comment + `needs-info` label; no auto-close | Comment + label is the safe-but-useful sweet spot; auto-close is politically risky | — Pending |
| Issue-type classified by heuristics + label inference (no LLM) | Title patterns and existing labels are reliable signals; saves an LLM call per issue | — Pending |
| Meta-nudge in comment when repo has no templates | Doubles as anti-slop messaging — better templates upstream = less slop downstream; reinforces our story | — Pending |
| Ship a precision/recall benchmark on real repo issues | Wins the Accuracy pillar (30% weight); turns "good vibes" into a defensible number | — Pending |
| Bring-your-own-key for LLM access | Standard OSS Action pattern; no infra to run; zero cost to us | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-05-08 after initialization*

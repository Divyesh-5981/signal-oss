# Project Research Summary — Signal-OSS

**Project:** Signal-OSS
**Domain:** GitHub Action — LLM-assisted OSS issue triage (Slop Scan 2026 hackathon)
**Researched:** 2026-05-08
**Confidence:** HIGH (4 independent research lenses converged on the same architecture, build order, and risk set)

---

## Executive Summary

Signal-OSS is a Node 24 / TypeScript GitHub Action that posts a **repo-aware missing-info checklist** as the hero output on every new issue, with a 0–10 actionability score as a secondary badge. Research across stack, feature, architecture, and pitfalls lenses converges tightly: this is a *narrow-scope, heuristics-first* product where the LLM is an enhancer (gray-zone adjudicator + tier-3 CONTRIBUTING.md extractor), never a critical-path dependency. Every other AI-triage tool surveyed (Dosu, GitHub Copilot Triage, mattleibow's triage-assistant, Probot apps) either burns an LLM on every issue, hard-matches a single template format, or skips checklist generation entirely — none read `.github/ISSUE_TEMPLATE/*.yml` *and* CONTRIBUTING.md to tailor output. That gap is the entire innovation thesis.

The recommended approach is the **shared-CORE pattern**: a pure `score(issue, repoContext, llm?)` entrypoint in `src/core/` that the Action runtime and the offline benchmark harness both call, with all I/O (Octokit, LLM, filesystem) injected as ports. This is non-negotiable because the Accuracy pillar (30% — the heaviest rubric weight) is defended by a public precision/recall benchmark whose credibility depends on judges being able to verify *the same code* runs in production and in the benchmark. Stack picks lean on the `actions/typescript-action` template (Node 24, ncc bundling, `@actions/core`/`@actions/github`), with Vitest+Biome swapped in for fast iteration, `@anthropic-ai/sdk` primary + `openai` secondary behind a thin LLMPort, and `unified`+`remark-parse` for AST-driven heuristics.

The risk shape is well-understood: the top five Critical pitfalls — `pull_request_target` misuse (sidestepped by `on: issues:` only), bot loops on `issues.edited` (mitigated by `GITHUB_TOKEN`-only + actor guards + idempotency markers), prompt injection from issue bodies (mitigated by no-tool-access LLM + JSON schema + delimited boundaries), API key leakage in logs (mitigated by `core.setSecret` + sanitized error wrapper), and live-demo LLM outage (mitigated by heuristics-only hero output + DEMO_MODE cache + pre-recorded screencast) — all have concrete prevention strategies that fit naturally into the build order. The single unresolved tension across the research is **timing of Tier 3** (CONTRIBUTING.md → LLM extraction): architecture wants it bundled with LLM integration in Phase 8, features wants it in v1 as a differentiator, and pitfalls warns it's the riskiest checklist tier. Resolution: ship it in Phase 8 alongside the adjudicator with an explicit kill-switch to fall back to baseline if hour 38 is squeezed.

---

## Stack at a Glance

The stack is the `actions/typescript-action` template with three opinionated swaps and a small library set on top. Detailed rationale lives in [STACK.md](./STACK.md).

**Core technologies:**
- **Node 24 LTS + TypeScript 5.6+** — Node 20 hits EOL April 2026; submitting in May with a deprecated runtime is a self-inflicted demerit. TS catches issue-payload mis-keys at compile time.
- **`@actions/core` 3.x + `@actions/github` 9.x** — pre-authenticated Octokit + inputs/outputs/masking; saves ~20 lines of auth code.
- **`@vercel/ncc` 0.38.x** — single-file `dist/index.js` is required for JS Actions (consumers can't `npm install`); commit `dist/` to repo.
- **`@anthropic-ai/sdk` 0.95.x (primary) + `openai` 6.x (secondary)** — both behind a thin `LLMPort` interface; Anthropic prompt caching cuts BYOK cost ~10x on the rubric system prompt.
- **`unified` + `remark-parse` + `remark-gfm`** — AST walks for heuristics (code fences, headings like "Steps to Reproduce", lists, images). Markdown-it/marked are renderer-only, wrong tool.
- **`yaml` (eemeli) 2.x + `zod` 4.x** — parse `.github/ISSUE_TEMPLATE/*.yml` issue forms tolerantly; validate parsed forms AND LLM JSON outputs with the same schema (zod 4 has native `z.toJSONSchema()`).
- **Vitest 3 + Biome 2 + `tsx`** — replace template's Jest+ESLint+Prettier; sub-second test loops; `tsx scripts/benchmark.ts` runs benchmark with no compile dance.
- **`@octokit/plugin-throttling` + `p-limit`** — benchmark scrapes 5 repos × 200 issues; without throttling you hit 403s mid-run.

**Anti-recommendations:** Docker action (60–90s cold start), Vercel AI SDK (over-abstracts a single classify call), `langchain`/`llamaindex` (massive deps), Probot (wrong surface — would require hosted backend), Node 20 (deprecated), `markdown-it`/`marked` (renderer-only, no AST walk).

---

## Table-Stakes Features

Detailed feature landscape, competitor matrix, and rage-uninstall floor live in [FEATURES.md](./FEATURES.md).

**Must have (missing any = rage-uninstall within a week):**
- Comment idempotency via HTML marker (`<!-- signal-oss:v1 -->`) — find-existing → update-or-create
- Workflow runs on `issues: [opened, edited, reopened]` only; explicit `permissions:` block (`issues: write`, `contents: read`)
- Single-file install; zero-config defaults; `dry-run`, `enable-comments`, `enable-labels`, `label-name`, `model` inputs
- `GITHUB_TOKEN` only (NOT a PAT); skip-label opt-out (`signal-oss-ignore`)
- `needs-info` (configurable) label management; auto-create label if missing
- Graceful degradation when LLM key absent — heuristics-only path always works
- Helpful, non-gatekeeping tone — *quality dimension, not polish*

---

## Differentiators

**Should have (earn Innovation 15% + Usefulness 25%):**
- **Repo-aware 4-tier checklist fallback** (forms YAML → MD templates → CONTRIBUTING.md via LLM → universal baseline) — UNIQUE in the surveyed market
- **Heuristics-first scoring with LLM only on gray-zone band (4–6)** — lower cost, deterministic for clear cases
- **Issue-type classifier without LLM** (title patterns + label inference, 85%+ reliable per Probot precedents)
- **Meta-nudge** when repo lacks issue templates — reinforces the anti-slop thesis
- **Public precision/recall benchmark** (100–200 issues × 3–5 repos; 50/3 fallback per PROJECT.md) — UNIQUE
- **BYOK with both providers** behind one adapter

**Defer (v2+):**
- PR triage (different rubric); CLI for backlog scan; `.github/signal-oss.yml` config file
- Auto-close stale `needs-info` (politically toxic per Tomlinson); duplicate detection (different problem, vector store)
- Browser extension / Slop-Coach; multi-language prompts; sentiment / toxicity flagging
- Public Slop-Bench leaderboard (PROJECT.md "weak utility, divisive")

---

## Architecture Spine

Hexagonal / ports-and-adapters: a pure `src/core/` library with zero side-effects, called identically by `src/action/main.ts` and `src/bench/run.ts`. All I/O (Octokit, LLM, filesystem) is injected. Detailed component catalog, data-flow diagrams, and project structure are in [ARCHITECTURE.md](./ARCHITECTURE.md).

**Major components:**
1. **CORE `score(issue, repoContext, llm?)`** — pure entrypoint; runs heuristics → classifier → checklist → score → optional LLM adjudication on gray-zone
2. **Heuristics Extractor** — regex + mdast-walk detectors for code blocks, stack traces, version mentions, repro keywords; emits `Signals` DTO
3. **IssueType Classifier** — bug/feature/question via title regex + existing labels + body weighting; pure, no LLM
4. **Checklist Generator (Strategy chain)** — Tier 1 (issue forms YAML) → Tier 2 (MD template headers) → Tier 3 (CONTRIBUTING.md via LLM, cached per-repo) → Tier 4 (universal baseline). Each tier is a class with `applies()` + `generate()`.
5. **Score Computer** — weighted-sum heuristic 0–10; flags `isGrayZone` for the 4–6 band
6. **LLM Adjudicator (port)** — interface in core; `AnthropicAdapter` / `OpenAIAdapter` in `src/adapters/llm/`
7. **Output Formatter** — markdown comment + label list + meta-nudge (pure)
8. **GitHub I/O Adapter** — `postComment` (idempotent via marker), `addLabel`, `getContent` for templates
9. **Benchmark Harness** — replays scraped fixtures through CORE; computes P/R/F1 with optional null LLM port

**Key patterns:** Ports & Adapters (so benchmark runs offline); Strategy Chain (so adding a tier is a one-array edit); DTO-first wiring (locked in Phase 0 to prevent solo re-typing); Heuristics-First with LLM Gating (gray-zone band is a single tunable constant).

---

## Build Order with Hourly Budget

The 9-phase sequence emerges from research as the only credible solo-48h path. Each phase ends in a *demoable* state; risk is front-loaded; the LLM is the *last* component wired so heuristics-only is shippable from hour 28.

| Phase | Hours | Demoable? | Hero milestone |
|---|---|---|---|
| 1. Skeleton, DTOs & workflow hardening | 0–3 | No | Types + workflow YAML locked (`on: issues:`, explicit `permissions:`, `GITHUB_TOKEN`-only, actor guard) |
| 2. Heuristics Extractor | 3–7 | Yes | mdast detectors over fixtures from ≥3 unrelated repos |
| 3. IssueType Classifier | 7–9 | Yes | Full classification offline; labels trump heuristics |
| 4. Checklist + Tier 4 baseline | 9–13 | **Yes** | **First useful output: real checklist for any body — 60% of demo value** |
| 5. Score + Output Formatter | 13–16 | Yes | End-to-end `score()` returns polished comment string with tone-pass copy |
| 6. GitHub I/O + Action wiring | 16–22 | **CRITICAL MILESTONE** | **Action posts a real comment on a real issue.** Idempotency marker + edit-in-place. |
| 7. Repo Context Loader + Tiers 1 & 2 | 22–28 | Yes | Repo-aware checklist; Innovation pillar earned. Tolerant parser tested against 10 popular repos. |
| 8. Benchmark (heuristics-only) | 28–34 | **Yes** | **Real P/R number defends Accuracy pillar — even without LLM.** 70/30 split frozen pre-tuning; κ-audit on N=30. |
| 9. LLM Adjudicator + Tier 3 | 34–40 | Yes | Boundary-delimited prompt, zod-validated JSON, no tool access, `temperature=0`, dedup cache + daily cap; benchmark shows lift on gray-zone |
| 10. Polish, demo, screencast | 40–48 | Final | Pre-recorded screencast (primary artifact), DEMO_MODE cached LLM responses, fresh-repo install dry-run twice |

**Hard fallback (per PROJECT.md):** if at hour 30 benchmark scope is at risk, cut to **50 issues × 3 repos**. Harness shape doesn't change; only input list shrinks.

**Phase ordering rationale:**
- **Heuristics-first invariant:** hero output works without an LLM key from Phase 6 onward.
- **Risk front-loaded:** Action wiring + idempotency + permissions clear by hour 22, not hour 47.
- **Benchmark before LLM:** weights *tune* in Phase 8 against held-out set; if benchmark were after LLM, weights would freeze and the number would just describe the system instead of improving it.
- **Tier 3 bundled with LLM (Phase 9) with kill-switch:** if hour 38 is squeezed, Tier 3 `applies()` returns false and chain falls through to baseline; gray-zone adjudicator still ships.
- **Each phase ends demoable:** if hackathon ends at hour 30, we ship a polished heuristics-only Action with a benchmark — credible submission.

---

## Top Pitfalls (Critical + High)

Top 5 Critical-severity from [PITFALLS.md](./PITFALLS.md). Each maps to a build phase.

1. **`pull_request_target` misuse** *(Critical)* — sidestepped entirely by scoping to `on: issues:` only. Never use `pull_request_target` in v1; defer PR triage to v2 with separated trusted/untrusted workflows. **Phase 1.**
2. **Bot-loop on `issues.edited`** *(Critical)* — `GITHUB_TOKEN` only (NEVER a PAT — PATs re-trigger workflows infinitely; `GITHUB_TOKEN` doesn't, by design); actor guard `if: github.actor != 'github-actions[bot]'`; idempotency-marker edit-in-place; v1 listens on `[opened, reopened]` only until idempotency is verified end-to-end, then adds `edited`. **Phase 1 + Phase 6.**
3. **Prompt injection from issue body** *(Critical)* — LLM has NO tool access (returns score+text only; code maps score → action); strict JSON schema validated by zod; boundary-delimited prompt (`<ISSUE>...</ISSUE>` with system message naming the boundary as data); body truncated to 4–8KB; output sanitized for `@mentions` / HTML / boundary tokens before posting. **Phase 9.**
4. **BYOK key leakage in logs/comments** *(Critical)* — `core.setSecret(apiKey)` at startup; sanitized error wrapper that re-throws `new Error("LLM call failed: " + status)`; never `console.log` config or full error objects; user-visible comments use a fixed fallback template, never `repr(error)`. **Phase 9.**
5. **Live-demo LLM outage** *(Critical)* — hero output (checklist) is heuristic-only by architecture; `DEMO_MODE=true` env flag returns canned LLM responses for the demo issue numbers; pre-recorded screencast as primary artifact; both `OPENAI_API_KEY` + `ANTHROPIC_API_KEY` for failover; `OPENAI_API_KEY=invalid` end-to-end test before demo day. **Phase 9 + Phase 10.**

**High-severity (must address):**
- **Benchmark ground-truth contamination** — split 70/30 at scrape, freeze 30% pre-tuning, manual κ-audit on N=30, report ±CIs (with N=100, 95% CI is ±10 points). **Phase 8.**
- **Permissions block missing or over-broad** — explicit `permissions:` from first commit; default `contents: read` then per-job grant. **Phase 1.**
- **Issue-form YAML parser breaks on real-world repos** — tolerant parser (try/except → fall through), skip `config.yml`, fixture corpus from 10 popular repos. **Phase 7.**
- **Comment tone reads as gatekeeping** — tone style guide before template; "Could you share..." not "Required:"; no "needs-info" word in comment body; read-aloud test. **Phase 5.**
- **Cold-start latency** — JS+ncc bundle (not Docker); `dist/` committed; <10s p50 budget. **Phase 1.**
- **Cost runaway from LLM retries** — `(issue, hash)` dedup cache; daily cap (50 calls/24h); single retry on 429 only. **Phase 9.**
- **First-comment race** — re-fetch issue via API after small delay; idempotency marker heals via edit-in-place on `edited`. **Phase 6.**

---

## Open Questions (defer to phase planning)

- **Specific gray-zone band (4–6 vs 3–7):** tunable constant; final value comes from Phase 8 benchmark output before Phase 9 wires the LLM.
- **Anthropic model tier (Sonnet 4.5 vs Haiku 4.5):** decide in Phase 9 after one round of benchmark; Haiku is 5–10x cheaper if precision holds.
- **Issue body length cap before LLM (8KB?):** Phase 9 prompt-design decision; truncate with marker, defends against token-cost blowup AND adversarial-prompt-size injection class.
- **Comment idempotency on workflow re-run:** marker-versioned (`<!-- signal-oss:v1 -->`); update-in-place via `octokit.rest.issues.updateComment` in Phase 6; v1.x marker-version-bump path documented, not implemented.

---

## How This Maps to the Hackathon Rubric

| Pillar | Weight | Earned by which phases / features |
|---|---|---|
| **Accuracy** | 30% | Phase 8 (heuristics-only benchmark on held-out 30% test set with κ-audited ground-truth and reported CIs) + Phase 9 (LLM lift on gray-zone band, same `score()` entrypoint as production). The shared-CORE pattern is the *structural guarantee* that the published number describes the demo. Tuning heuristic weights in Phase 8 (before LLM freezes them) is what makes the number defensible. |
| **Usefulness** | 25% | Phase 4 (Tier-4 baseline checklist — the hero output), Phase 5 (tone-pass markdown formatter), Phase 6 (idempotency so users aren't spammed), Phase 7 (repo-aware Tiers 1+2 making the checklist *tailored*, not generic). Tone is treated as a quality dimension throughout — read-aloud review on every static string per Pitfall 9. |
| **Execution** | 20% | Phase 1 cold-start budget (<10s p50 via JS+ncc, no Docker), Phase 6 single-file install, Phase 10 fresh-repo install dry-run twice, the 9-phase risk-front-loaded plan itself. Single surface (Action only — no CLI/App/dashboard) is the scope discipline that makes 48h credible. |
| **Innovation** | 15% | Three uniques per FEATURES competitor matrix: **repo-aware 4-tier checklist** (Phases 4 + 7 + 9 — no surveyed tool does this), **meta-nudge for missing templates** (Phase 5), **public precision/recall benchmark** (Phase 8 — no surveyed competitor publishes one). All three were called out as Innovation bets in PROJECT.md and confirmed by features research. |
| **Presentation** | 10% | Phase 10 pre-recorded screencast (primary artifact — live LLM outage = demo death per Pitfall 5), demo on real recognizable repos (PROJECT.md "judges discount synthetic demos"), narrative anchor *"We don't care who wrote it. We care if it's actionable"* — explicit anti-positioning against AI-detection framing. `core.summary` markdown report doubles as demo material. |

---

## Conflicts Across Research Outputs (resolved)

The four research lenses agreed on more than 95% of decisions. Tensions and resolutions:

1. **Tier 3 (CONTRIBUTING.md → LLM extraction) timing.** Features wants v1 differentiator; pitfalls warns it's the riskiest checklist tier; architecture notes it's the only tier needing `LLMPort`. **Resolution:** ship in Phase 9 (bundled with LLM adjudicator) with explicit kill-switch — if hour 38 is squeezed, Tier 3 `applies()` returns false and chain falls through to baseline; gray-zone adjudicator still ships independently.
2. **Listening on `issues.edited`.** Features (table-stakes "edit-on-update") wants it day 1; pitfalls (Pitfall 2 bot loop) wants it deferred until idempotency is proven. **Resolution:** Phase 1 ships `[opened, reopened]` only; `edited` adds in Phase 6 *after* marker-based update-in-place is verified end-to-end on sandbox repo. 24h soak test gates the addition.
3. **Score badge in comment vs. label-only.** Features says "score badge in comment is cheap demo material"; pitfalls (Pitfall 9 tone) warns "a numeric score on someone's bug report reads as a grade." **Resolution:** keep score in comment (PROJECT.md hero spec calls for it as secondary badge) but render small/late in markdown — checklist front-and-center, score after; tone-test with read-aloud review.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | **HIGH** | All version policies (Node 24, EOL dates) verified against GitHub's Sep 2025 + Feb 2026 changelogs; SDK versions current; `actions/typescript-action` is the official template. |
| Features | **HIGH** | 16+ direct competitors surveyed; rage-uninstall floor verified against poetry #9091, community #5793, Tomlinson's stale-bot post, 12+ marketplace READMEs. Three uniques confirmed in matrix. |
| Architecture | **HIGH** | Component decomposition dictated by locked PROJECT.md decisions; hexagonal/ports-and-adapters fit forced by offline benchmark requirement. Only sub-internals (specific gray-zone band) are MEDIUM. |
| Pitfalls | **HIGH** | Verified against current GitHub docs, GHSL guidance, OWASP LLM01, Aikido PromptPwnd 2026, peer-reviewed benchmark-leakage papers, 2026 incident reports (CanisterWorm, AI-PR-essay tone backlash). |

**Overall confidence:** **HIGH**

---

*Research synthesis completed: 2026-05-08*
*Ready for roadmap: yes*
*Detailed research: [STACK.md](./STACK.md) · [FEATURES.md](./FEATURES.md) · [ARCHITECTURE.md](./ARCHITECTURE.md) · [PITFALLS.md](./PITFALLS.md)*

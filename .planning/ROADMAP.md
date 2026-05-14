# Roadmap: Signal-OSS

**Created:** 2026-05-08
**Mode:** MVP (every phase ships a demoable end-to-end slice)
**Granularity:** coarse (5 phases)
**Coverage:** 43/43 v1 requirements mapped

Hero output (per PROJECT.md): the repo-aware missing-info checklist on every new issue must post even if every other layer fails. Each phase below preserves that invariant — Phase 1 already comments SOMETHING useful; later phases enrich.

---

## Phases

- [x] **Phase 1: Skeleton + Heuristic Spine + First Comment** - Action posts a real Tier-4 baseline checklist comment on a sandbox issue
- [ ] **Phase 2: Action Hardening + Repo-Awareness** - Idempotent comments + label management + Tier 1 (issue forms) + Tier 2 (markdown templates) live on real popular repos
- [ ] **Phase 3: Benchmark + Heuristic Tuning** - Precision/recall report committed to `bench/REPORT.md` against held-out 30% with κ-audited ground truth
- [ ] **Phase 4: LLM Adjudicator + Tier 3** - Gray-zone LLM adjudication + Tier-3 CONTRIBUTING.md extraction with kill-switch; benchmark re-run shows lift
- [ ] **Phase 5: Demo & Submission** - Pre-recorded screencast, twin fresh-install dry-runs, resilience smoke test, polished README

---

## Phase Details

### Phase 1: Skeleton + Heuristic Spine + First Comment

**Goal:** Action installs into a sandbox repo and posts a real Tier-4 baseline missing-info checklist comment as the hero output, with no repo-awareness and no LLM yet — the heuristics-only spine is shippable end-to-end.
**Mode:** mvp
**Depends on:** Nothing (first phase)
**Requirements:** CORE-01, CORE-02, CORE-03, CORE-04, CORE-05, CORE-06, CHECK-01, CHECK-02, ACT-01, ACT-02, ACT-03, ACT-04, ACT-05
**Success Criteria** (what must be TRUE):

1. On a sandbox repo, opening a new issue with a low-quality body causes the Action to post a markdown comment containing a non-empty Tier-4 baseline checklist tailored to the detected issue type (bug / feature / question), front-and-center with a small score badge rendered after.
2. Pure `score(issue, repoContext, llm?)` entrypoint in `src/core/` returns `{ score, missing, signals, issueType, isGrayZone }` with zero Octokit, fs, or LLM SDK imports inside `src/core/` (verifiable by grep + unit tests that run with no network).
3. Workflow YAML scopes `on: issues: types: [opened, reopened]` only, declares an explicit `permissions:` block (`issues: write`, `contents: read`), uses only `GITHUB_TOKEN`, and exits early when `github.actor === 'github-actions[bot]'` — no second comment ever appears in a 24h sandbox soak.
4. Cold-start budget is met: `dist/index.js` is a single bundled file (Rollup ESM) committed to the repo, `action.yml` declares `using: 'node24'`, and event-to-comment p50 is under 10 seconds on a warm runner.
5. Every static string in the comment passes the read-aloud tone test: no "Required:" / "Must:" / "Invalid"; uses "Could you share…" framings; checklist always non-empty; meta-nudge stub renders correctly when no templates are detected.
   **Plans:** 5/5 plans executed

- [x] 01-01-scaffold-PLAN.md — Bootstrap actions/typescript-action template; swap Jest→Vitest and ESLint+Prettier→Biome; lock NodeNext tsconfig and Phase 1 deps
- [x] 01-02-dtos-stub-PLAN.md — Define all Phase 1 DTOs (Issue, Signals, IssueType, RepoContext, ChecklistItem, ScoredIssue, LLMPort); stub score() entrypoint; first Rollup build of dist/index.js (Walking Skeleton Stage A)
- [x] 01-03-heuristics-classifier-PLAN.md — Implement extractSignals (mdast AST walk, all 7 signals) and classifyType (label→title→body→default precedence) as pure functions
- [x] 01-04-checklist-score-format-PLAN.md — Implement strategy-chain checklist generator with Tier-4 baseline, weighted-sum score with gray-zone band 4-6, markdown formatter per D-07; replace stub score() with real pipeline
- [x] 01-05-action-wiring-PLAN.md — Implement GitHub I/O adapter with idempotency marker, full main.ts orchestrator with bot-loop guard, action.yml + workflow YAMLs + fixture event; rebuild dist/; sandbox E2E human-verify checkpoint
      **Pitfall coverage:** Pitfall 1 (`pull_request_target` sidestepped by `on: issues:` only — Critical), Pitfall 2 (bot-loop — `GITHUB_TOKEN`-only + actor guard + `[opened, reopened]` only — Critical), Pitfall 7 (explicit minimal `permissions:` block — High), Pitfall 10 (JS+Rollup cold-start — High), Pitfall 14 (heuristics tested across ≥3 unrelated repos — Medium), Pitfall 17 (no `issue_comment` listener — Medium), Pitfall 20 (structured log levels — Low).

### Phase 2: Action Hardening + Repo-Awareness

**Goal:** The Action becomes safe to install on real popular OSS repos — comments are idempotent (one per issue, edit-in-place), labels are managed cleanly, opt-out works, and the checklist is now _tailored_ to the repo via Tier 1 (issue forms YAML) and Tier 2 (markdown templates). Innovation pillar lands.
**Mode:** mvp
**Depends on:** Phase 1
**Requirements:** ACT-06, ACT-07, ACT-08, ACT-09, ACT-10, CHECK-03, CHECK-04, CHECK-06
**Success Criteria** (what must be TRUE):

1. Opening, then editing, then reopening the same issue results in exactly one Signal-OSS comment that updates in-place via the HTML idempotency marker (`<!-- signal-oss:v1 -->`); no duplicate comment ever appears across `[opened, reopened]` and re-runs.
2. The configurable `needs-info` label auto-creates with color + description if missing, applies when checklist has any items, and is removed when checklist becomes empty on re-run; the `signal-oss-ignore` skip-label causes the Action to exit cleanly with a one-line `core.summary`.
3. On a corpus of 10 real popular repos (e.g., vue/core, microsoft/vscode, rust-lang/rust), the tolerant Tier 1 / Tier 2 parsers either successfully extract `required: true` fields / `### Header` field labels OR fall through to Tier 4 without crashing — zero parser exceptions in the soak run.
4. The meta-nudge appended to the comment when no `.github/ISSUE_TEMPLATE/` is present reads as a soft tip ("you might consider adding…"), never demanding; this is verified by read-aloud review.
5. Action inputs (`dry-run`, `enable-comments`, `enable-labels`, `label-name`, `model`, `gray-zone-low`, `gray-zone-high`, `max-body-bytes`) work with sensible zero-config defaults; `core.summary()` writes a workflow-run UI report containing input issue, signals detected, score, and posted comment URL.
   **Plans:** TBD
   **Pitfall coverage:** Pitfall 8 (tolerant issue-form YAML parser tested against 10 popular repos — High), Pitfall 12 (re-fetch issue body via API + idempotency-marker edit-in-place heals first-comment race — High), Pitfall 15 (markdown render visual review — Medium), Pitfall 19 (versioned marker `signal-oss:v1` — Low).

### Phase 3: Benchmark + Heuristic Tuning

**Goal:** A defensible precision/recall number ships against held-out real OSS issues using the _same_ `score()` entrypoint that runs in production. Heuristic weights tune against the 70% training split before the LLM ever lands; the 30% test split is frozen and untouched. Accuracy pillar (30% rubric weight) earned.
**Mode:** mvp
**Depends on:** Phase 2
**Requirements:** BENCH-01, BENCH-02, BENCH-03, BENCH-04, BENCH-05, BENCH-06, BENCH-07
**Success Criteria** (what must be TRUE):

1. `bench/REPORT.md` is committed to the repo and reports precision, recall, and F1 per issue type and overall, with 95% confidence intervals on N≥100; numbers are produced by replaying scraped fixtures through the _same_ `score()` from `src/core/` (not a duplicate scorer).
2. The 70/30 deterministic seeded train/test split was frozen at scrape time; weight tuning happened against the 70% only, and the held-out 30% was never inspected during heuristic development (verifiable by git history).
3. The κ-audit on N=30 manually-labeled issues is documented in REPORT.md with Cohen's κ between proxy labels (closed-as-invalid / duplicate / wontfix / needs-info / closed-without-action) and manual labels — reported as transparency, not gated on a threshold.
4. The scraper harness uses `@octokit/plugin-throttling`, accepts `--repos` and `--limit` flags, caches raw issue JSON to `bench/fixtures/`, and supports the pre-approved fallback (50 issues × 3 repos) without code changes — only input-list shrinks.
5. Replay harness supports `--no-llm` mode (pure heuristics, used for this phase) and `--with-llm` mode (used in Phase 4); a heuristics-only baseline P/R number is published and defends Accuracy pillar even without any LLM.
   **Plans:** TBD
   **Pitfall coverage:** Pitfall 6 (benchmark ground-truth contamination — held-out test set frozen pre-tuning, κ-audit, ±CIs reported — High), Pitfall 14 (heuristics already cross-repo from Phase 1 — Medium), Pitfall 18 (confusion matrix per issue type — Medium).

### Phase 4: LLM Adjudicator + Tier 3

**Goal:** The gray-zone LLM adjudicator and Tier-3 (CONTRIBUTING.md → LLM extraction) ship behind a hardened, kill-switchable, BYOK adapter port — without ever putting LLM calls on the critical path of the hero output. Benchmark re-run with `--with-llm` shows measurable lift on the gray-zone band.
**Mode:** mvp
**Depends on:** Phase 3
**Requirements:** LLM-01, LLM-02, LLM-03, LLM-04, LLM-05, LLM-06, LLM-07, LLM-08, LLM-09, CHECK-05
**Success Criteria** (what must be TRUE):

1. The `LLMPort` interface lives in `src/core/`; concrete `AnthropicAdapter` (primary, `@anthropic-ai/sdk` 0.95.x) and `OpenAIAdapter` (secondary, `openai` 6.x) live in `src/adapters/llm/`. The adjudicator is invoked only when `score().isGrayZone === true`; clear-cut issues never call the LLM (verifiable by call-counter unit test).
2. The prompt uses boundary-delimited input (`<ISSUE>…</ISSUE>` with system message naming the boundary as untrusted data); issue body is truncated to 4–8KB; LLM has NO tool access and NO write access to GitHub; output is a typed JSON object validated by zod 4 schema; on parse failure, falls back to heuristic score; output is sanitized for `@mentions`, HTML, and boundary tokens before insertion. Adversarial-prompt corpus (≥10 injection payloads) passes — score field stays valid, no instruction-following appears in posted comments.
3. Secret hardening verified end-to-end: `core.setSecret(apiKey)` is called at startup; sanitized error wrapper never logs request/response bodies; `temperature=0`; forced-error-path log scan with `grep` for `sk-`, `Bearer`, `Authorization` returns zero hits.
4. Cost guards work: `(repo, issueNumber, contentHash)` dedup cache prevents re-billing; daily cap (50 calls/24h, configurable) trips and falls through to heuristics; single retry only on 429; abort on 5xx after one retry; forced 100-issue burst test caps correctly.
5. Graceful degradation works: with `OPENAI_API_KEY=invalid` and `ANTHROPIC_API_KEY=invalid`, the heuristic-only path posts the same hero output (checklist + heuristic score) with no warnings in the user-visible comment. Tier 3 (CONTRIBUTING.md → LLM extraction) ships with explicit kill-switch — `applies()` returns false when disabled, chain falls through to Tier 4 if disabled. `DEMO_MODE=true` env flag returns canned LLM responses keyed by issue number. Benchmark re-run with `--with-llm` shows lift on the gray-zone band, recorded in `bench/REPORT.md`.
   **Plans:** TBD
   **Pitfall coverage:** Pitfall 3 (prompt injection — boundary-delimited prompt + zod-validated JSON + no tool access + output sanitization — Critical), Pitfall 4 (BYOK key leakage — `core.setSecret` + sanitized error wrapper — Critical), Pitfall 5 (live-demo LLM outage — heuristics-only invariant + DEMO_MODE — Critical, partial; rest in Phase 5), Pitfall 11 (cost runaway — dedup + daily cap + single 429 retry — High), Pitfall 16 (LLM non-determinism — `temperature=0` — Medium).

### Phase 5: Demo & Submission

**Goal:** The hackathon submission ships polished — pre-recorded screencast on real public repos, twin fresh-install dry-runs verified, resilience smoke test passes, README mapped to the rubric, and the link to `bench/REPORT.md` lands in the README. Zero live-LLM dependence on the demo critical path.
**Mode:** mvp
**Depends on:** Phase 4
**Requirements:** DEMO-01, DEMO-02, DEMO-03, DEMO-04, DEMO-05
**Success Criteria** (what must be TRUE):

1. A pre-recorded screencast (≤3 min) is the primary demo artifact; live LLM is never on the demo critical path. The screencast runs against 2–3 real, recognizable public OSS repos' historical issues (no synthetic fixtures) and includes the anchor narrative _"We don't care who wrote it. We care if it's actionable."_
2. README contains a one-paragraph pitch, an install snippet (≤8 lines of YAML), the hackathon-rubric mapping table from SUMMARY.md, and a link to `bench/REPORT.md`. Install snippet has been copy-pasted onto a brand-new throwaway repo and worked first try.
3. A fresh-repo install dry-run has been executed _twice_ on a sandbox repo before submission (once on a repo with templates, once without); both runs verified end-to-end: comment posted with full hero checklist, label applied, idempotency marker present, no duplicate on a forced re-run.
4. The resilience smoke test passes: with both `OPENAI_API_KEY=invalid` and `ANTHROPIC_API_KEY=invalid`, an end-to-end run produces the full hero output (checklist + heuristic score badge + meta-nudge if applicable) with no warnings, errors, or "(LLM unavailable)" leakage in the user-visible comment.
5. Submission artifacts are complete: tagged release of the Action; `dist/` committed; `bench/REPORT.md` published with κ-audit and ±CIs; README cost preview section present; `signal-oss-ignore` opt-out documented; pinned action SHA documented in install footnote.
   **Plans:** TBD
   **Pitfall coverage:** Pitfall 5 (live-demo LLM outage — pre-recorded screencast + DEMO_MODE + dual key + heuristics-only smoke test — Critical), Pitfall 13 (fresh-repo install dry-run twice — Medium), Pitfall 21 (`uses: <owner>/signal-oss@<sha>` documented — Low).

---

## Progress

| Phase                                         | Plans Complete | Status      | Completed  |
| --------------------------------------------- | -------------- | ----------- | ---------- |
| 1. Skeleton + Heuristic Spine + First Comment | 5/5            | Done        | 2026-05-14 |
| 2. Action Hardening + Repo-Awareness          | 0/0            | Not started | -          |
| 3. Benchmark + Heuristic Tuning               | 0/0            | Not started | -          |
| 4. LLM Adjudicator + Tier 3                   | 0/0            | Not started | -          |
| 5. Demo & Submission                          | 0/0            | Not started | -          |

---

## Hackathon Rubric Anchoring

| Pillar           | Weight | Earned by                                                                                                                                                                                      |
| ---------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Accuracy**     | 30%    | Phase 3 (heuristics-only P/R on held-out 30% with κ-audited ground-truth and CIs) + Phase 4 (LLM lift on gray-zone band, same `score()` entrypoint as production via shared-CORE pattern)      |
| **Usefulness**   | 25%    | Phase 1 (Tier-4 baseline checklist hero output with read-aloud tone-passed copy) + Phase 2 (Tier 1 + Tier 2 repo-awareness, idempotent comments so users aren't spammed)                       |
| **Execution**    | 20%    | Phase 1 (cold-start budget <10s p50 via JS+Rollup ESM bundle, single-file install, zero-config defaults) + Phase 5 (twin fresh-install dry-runs verified)                                      |
| **Innovation**   | 15%    | Phase 2 (repo-aware Tier 1+2 checklists — UNIQUE in market) + Phase 3 (public precision/recall benchmark — UNIQUE) + Phase 4 (Tier-3 CONTRIBUTING.md LLM extraction with kill-switch — UNIQUE) |
| **Presentation** | 10%    | Phase 5 (pre-recorded screencast, demo on real recognizable repos, README rubric mapping, `core.summary` workflow report as live demo material)                                                |

---

## Critical Pitfall Coverage Cross-Check

| Critical Pitfall                     | Phase             | Mechanism                                                                                                                                        |
| ------------------------------------ | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1. `pull_request_target` misuse      | Phase 1           | `on: issues:` only; never `pull_request_target` in v1                                                                                            |
| 2. Bot-loop on `issues.edited`       | Phase 1           | `GITHUB_TOKEN`-only + actor guard + `[opened, reopened]` only in v1                                                                              |
| 3. Prompt injection from issue body  | Phase 4           | No tool access + zod-validated JSON + boundary-delimited prompt + output sanitization + adversarial corpus test                                  |
| 4. BYOK key leakage in logs/comments | Phase 4           | `core.setSecret` + sanitized error wrapper + fixed fallback templates + grep audit                                                               |
| 5. Live-demo LLM outage              | Phase 4 + Phase 5 | Heuristics-only hero output (architectural invariant from Phase 1) + DEMO_MODE + dual-key failover + pre-recorded screencast as primary artifact |

All 5 Critical pitfalls have explicit success criteria in the phase that prevents them. No Critical pitfall is unaddressed.

---

_Roadmap created: 2026-05-08_
_Last updated: 2026-05-14 — Phase 1 complete (5/5 plans executed, sandbox E2E verified)_

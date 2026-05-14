# Requirements: Signal-OSS

**Defined:** 2026-05-08
**Core Value:** The hero output is a tailored missing-info checklist on every new issue. If everything else fails, the comment with a useful checklist must still post.

## v1 Requirements

Requirements for hackathon submission (Slop Scan 2026). Each maps to a roadmap phase.

### Core — Pure Scoring Spine (`src/core/`)

- [x] **CORE-01**: A pure `score(issue, repoContext, llm?)` entrypoint that returns `{ score, missing, signals, issueType, isGrayZone }` with zero side effects (no Octokit, no fs, no LLM SDK imports inside `src/core/`)
- [ ] **CORE-02**: Heuristics extractor that walks an mdast/remark AST of the issue body and emits a `Signals` DTO covering: code blocks, stack-trace pattern, version/env mention, repro keywords, expected-vs-actual structure, minimal-example presence, screenshot/image-only flag
- [ ] **CORE-03**: Issue-type classifier (bug / feature / question) using existing labels (precedence) → title patterns (`[BUG]`, `feat:`, etc.) → body keyword weighting; pure, no LLM
- [x] **CORE-04**: Weighted-sum heuristic score 0–10 with documented per-signal weights in a single `weights.ts` constants file; flags `isGrayZone` for the configured band (default 4–6)
- [x] **CORE-05**: Output formatter renders a markdown comment containing the checklist (front-and-center) and a small score badge (rendered late); applies meta-nudge when no repo templates are present
- [x] **CORE-06**: Comment copy passes a tone style guide — no "Required:" / "Must:" / "Invalid"; uses "Could you share…" framings; read-aloud test on every static string before commit

### Checklist — 4-Tier Generator (`src/core/checklist/`)

- [x] **CHECK-01**: Strategy-chain interface — each tier implements `{ applies(repoContext): boolean, generate(issueType, signals): ChecklistItem[] }`; chain runs first-applies-wins
- [x] **CHECK-02**: Tier 4 (Universal Baseline) — bug/feature/question-specific default checklists; always returns a non-empty list; ships first so hero output works on any repo
- [ ] **CHECK-03**: Tier 1 (Issue Forms YAML) — tolerant parser of `.github/ISSUE_TEMPLATE/*.yml` extracts `required: true` fields and matches against signals; gracefully falls through on parse error or unknown schema variation
- [ ] **CHECK-04**: Tier 2 (Markdown Templates) — parses `.github/ISSUE_TEMPLATE/*.md` headers as field labels (`### Steps to Reproduce`, `### Version`); matches against signals
- [ ] **CHECK-05**: Tier 3 (CONTRIBUTING.md → LLM extraction) — when only `CONTRIBUTING.md` is present, LLM extracts issue-reporting expectations into a checklist; cached per-repo by content hash; explicit kill-switch (`applies()` returns false) so chain falls through to Tier 4 if disabled
- [ ] **CHECK-06**: Meta-nudge appended to comment when no `.github/ISSUE_TEMPLATE/` exists, suggesting the maintainer add one — phrased as a soft tip, never demanding

### Action — GitHub Action Runtime (`src/action/`)

- [ ] **ACT-01**: Single-file `dist/index.js` produced by `@vercel/ncc`; `dist/` committed to repo; `action.yml` declares `using: 'node24'` runtime
- [ ] **ACT-02**: Workflow YAML scoped to `on: issues: types: [opened, reopened]` only in v1 (no `pull_request_target`, no `edited` until idempotency proven in soak)
- [ ] **ACT-03**: Explicit `permissions:` block (`issues: write`, `contents: read`); uses only built-in `GITHUB_TOKEN` (never a PAT)
- [ ] **ACT-04**: Bot-loop guard — early return when `github.actor === 'github-actions[bot]'` or comment author is the Action's bot identity
- [ ] **ACT-05**: Comment idempotency via HTML marker (`<!-- signal-oss:v1 -->`); find-existing → update-in-place via `octokit.rest.issues.updateComment`; never creates a duplicate
- [ ] **ACT-06**: Label management — auto-create configured `needs-info` label (color + description) if missing; apply when checklist has any items; remove when checklist becomes empty on re-run
- [x] **ACT-07**: Action inputs — `dry-run`, `enable-comments`, `enable-labels`, `label-name`, `model` (string), `gray-zone-low`, `gray-zone-high`, `max-body-bytes`; sensible zero-config defaults
- [ ] **ACT-08**: Skip-label opt-out — if issue carries `signal-oss-ignore` label at trigger time, exit cleanly with a one-line summary
- [ ] **ACT-09**: `core.summary()` writes a workflow-run UI report (input issue, signals detected, score, posted comment URL) — doubles as live demo material
- [ ] **ACT-10**: Cold-start budget — JS+ncc bundle achieves <10s p50 from event to comment posted on a warm runner

### LLM — Gray-Zone Adjudicator (`src/adapters/llm/`)

- [ ] **LLM-01**: `LLMPort` interface defined in `src/core/`; concrete `AnthropicAdapter` (primary, `@anthropic-ai/sdk` 0.95.x) and `OpenAIAdapter` (secondary, `openai` 6.x) live in `src/adapters/llm/`
- [ ] **LLM-02**: Adjudicator runs only when `score().isGrayZone === true`; never on clear-score issues; gray-zone band is a tunable constant
- [ ] **LLM-03**: Prompt uses boundary-delimited input (`<ISSUE>…</ISSUE>` with system message naming the boundary as untrusted data); issue body truncated to 4–8KB before injection
- [ ] **LLM-04**: LLM has NO tool access and NO write access to GitHub; returns a typed JSON object (`{ score: 0–10, rationale: string, missing: string[] }`) validated by zod 4 schema; on parse failure, fall back to heuristic score
- [ ] **LLM-05**: Output sanitized for `@mentions`, HTML, and boundary tokens before insertion into the comment body
- [ ] **LLM-06**: Secret hardening — `core.setSecret(apiKey)` at startup; sanitized error wrapper that never logs request/response bodies; `temperature=0`
- [ ] **LLM-07**: Cost guards — `(repo, issueNumber, contentHash)` dedup cache; daily cap (50 calls/24h, configurable); single retry only on 429; abort on 5xx after one retry
- [ ] **LLM-08**: Graceful degradation — when no LLM key is configured OR adapter fails, heuristic-only path posts the same hero output (checklist + heuristic score)
- [ ] **LLM-09**: `DEMO_MODE=true` env flag returns canned LLM responses keyed by issue number for live-demo resilience

### Bench — Precision/Recall Benchmark (`src/bench/`, `scripts/benchmark.ts`)

- [ ] **BENCH-01**: Scraper harness — Octokit + `@octokit/plugin-throttling`; fetches closed issues from a configured list of public repos with `--repos` and `--limit` flags; caches raw issue JSON to `bench/fixtures/` so re-runs cost zero API budget
- [ ] **BENCH-02**: Ground-truth proxy — labels each cached issue as "slop" or "actionable" based on close metadata: closed without comment by maintainer, `invalid` / `duplicate` / `wontfix` / `needs-info` labels, or closed-without-action heuristic
- [ ] **BENCH-03**: Train/test split — 70/30 deterministic split (seeded), frozen at scrape time; held-out set never seen until final report; weights tune against the 70% only
- [ ] **BENCH-04**: Replay harness calls the same `score()` from `src/core/` (NOT a duplicate scorer); supports `--no-llm` mode for pure-heuristics runs and `--with-llm` for full pipeline
- [ ] **BENCH-05**: Reports precision, recall, F1 per issue type and overall; reports 95% confidence intervals on N≥100; emits a markdown report committed to `bench/REPORT.md`
- [ ] **BENCH-06**: Sub-sample κ-audit — manually label N=30 issues; compute Cohen's κ between proxy and manual labels; document in REPORT.md (do not gate on a threshold)
- [ ] **BENCH-07**: Pre-approved fallback — if benchmark scope at risk by hour 30, drop to 50 issues × 3 repos; harness shape unchanged

### Demo — Presentation & Submission Artifacts

- [ ] **DEMO-01**: Pre-recorded screencast (≤3 min) is the primary demo artifact; live LLM is never the demo critical path
- [ ] **DEMO-02**: Demo runs against 2–3 real, recognizable public OSS repos' historical issues (no synthetic fixtures); narrative includes the anchor line *"We don't care who wrote it. We care if it's actionable."*
- [ ] **DEMO-03**: README — one-paragraph pitch, install snippet (≤8 lines of YAML), the hackathon-rubric mapping table from SUMMARY.md, link to `bench/REPORT.md`
- [ ] **DEMO-04**: Fresh-repo install dry-run executed twice on a sandbox repo before submission; both runs verified end-to-end (comment posted, label applied, marker present, no duplicate)
- [ ] **DEMO-05**: Resilience smoke test — `OPENAI_API_KEY=invalid` and `ANTHROPIC_API_KEY=invalid` end-to-end run before demo; heuristic-only path produces full hero output without warnings in user-visible comment

## v2 Requirements

Acknowledged but not in v1 roadmap.

### PR Triage

- **PR-01**: Score Pull Requests on a different rubric (diff size, tests present, linked issue, description quality)
- **PR-02**: Comment with PR-specific actionability checklist
- **PR-03**: Trigger via `pull_request` (NOT `pull_request_target`) with separated trusted/untrusted workflows

### CLI & Backlog

- **CLI-01**: Standalone CLI for backlog scan ("show me the slop in your existing inbox")
- **CLI-02**: Batch report mode emits a `slop-report.md` for an existing issue queue

### Configurability

- **CFG-01**: Per-repo `.github/signal-oss.yml` config file overriding Action inputs
- **CFG-02**: Configurable aggressiveness presets (gentle / standard / strict)
- **CFG-03**: Auto-close stale `needs-info` issues after configurable window

### Scope Expansions

- **SCOPE-01**: Browser extension scoring issues at composition time ("Slop-Coach")
- **SCOPE-02**: Public Slop-Bench leaderboard ranking popular repos by issue quality
- **SCOPE-03**: Multi-language prompts for non-English repos
- **SCOPE-04**: Sentiment / toxicity flagging
- **SCOPE-05**: Duplicate-issue detection (separate problem, requires vector store)

## Out of Scope

Explicit exclusions. Prevents scope creep and re-debate.

| Feature | Reason |
|---------|--------|
| AI-authorship detection ("was this written by AI?") | Hackathon explicitly devalues this framing; we measure utility, not provenance |
| Pull Request triage in v1 | Different rubric; doing both = doing neither well in 48h. Deferred to v2. |
| CLI surface in v1 | One surface (Action) for v1 to ensure polish; CLI deferred to v2 |
| GitHub App / hosted backend | Requires infra; Action-only is the install-friction sweet spot |
| Web dashboard / leaderboard | No UI surface in v1; output lives in PR/issue comments and `core.summary` |
| Auto-closing stale issues | Politically toxic per Tomlinson; opt-in v2 only |
| Replacing or generating issue templates | We triage what comes in; template authoring is a different product |
| Per-repo config file (`.signal-oss.yml`) in v1 | Action inputs cover v1 needs; config file deferred to v2 |
| Browser extension / pre-submit Slop-Coach | High wow-factor, high build risk; v2 |
| Public Slop-Bench leaderboard of repos | Weak utility, divisive; not in this submission |
| Multiple LLM providers beyond Anthropic + OpenAI | Two adapters covers BYOK; more providers = port surface bloat |
| Vector-store-backed duplicate detection | Different problem class entirely |
| Custom rubric authoring by maintainers | Out of scope for v1; default rubric must work universally |
| Sentiment / toxicity flagging | Adjacent concern; not the actionability thesis |
| `pull_request_target` event ever | Critical security pitfall; never used in this codebase |
| Hosted backend or proxied LLM access | Not BYOK; v1 is BYOK only |

## Traceability

Every v1 requirement maps to exactly one phase. Coverage validated.

| Requirement | Phase | Status |
|-------------|-------|--------|
| CORE-01 | Phase 1 | Complete |
| CORE-02 | Phase 1 | Pending |
| CORE-03 | Phase 1 | Pending |
| CORE-04 | Phase 1 | Complete |
| CORE-05 | Phase 1 | Complete |
| CORE-06 | Phase 1 | Complete |
| CHECK-01 | Phase 1 | Complete |
| CHECK-02 | Phase 1 | Complete |
| CHECK-03 | Phase 2 | Pending |
| CHECK-04 | Phase 2 | Pending |
| CHECK-05 | Phase 4 | Pending |
| CHECK-06 | Phase 2 | Pending |
| ACT-01 | Phase 1 | Pending |
| ACT-02 | Phase 1 | Pending |
| ACT-03 | Phase 1 | Pending |
| ACT-04 | Phase 1 | Pending |
| ACT-05 | Phase 1 | Pending |
| ACT-06 | Phase 2 | Pending |
| ACT-07 | Phase 2 | Complete |
| ACT-08 | Phase 2 | Pending |
| ACT-09 | Phase 2 | Pending |
| ACT-10 | Phase 2 | Pending |
| LLM-01 | Phase 4 | Pending |
| LLM-02 | Phase 4 | Pending |
| LLM-03 | Phase 4 | Pending |
| LLM-04 | Phase 4 | Pending |
| LLM-05 | Phase 4 | Pending |
| LLM-06 | Phase 4 | Pending |
| LLM-07 | Phase 4 | Pending |
| LLM-08 | Phase 4 | Pending |
| LLM-09 | Phase 4 | Pending |
| BENCH-01 | Phase 3 | Pending |
| BENCH-02 | Phase 3 | Pending |
| BENCH-03 | Phase 3 | Pending |
| BENCH-04 | Phase 3 | Pending |
| BENCH-05 | Phase 3 | Pending |
| BENCH-06 | Phase 3 | Pending |
| BENCH-07 | Phase 3 | Pending |
| DEMO-01 | Phase 5 | Pending |
| DEMO-02 | Phase 5 | Pending |
| DEMO-03 | Phase 5 | Pending |
| DEMO-04 | Phase 5 | Pending |
| DEMO-05 | Phase 5 | Pending |

**Coverage:**
- v1 requirements (itemized REQ-IDs): 43 total — CORE (6) + CHECK (6) + ACT (10) + LLM (9) + BENCH (7) + DEMO (5)
- Mapped to phases: 43
- Unmapped: 0

> **Note on count:** The original instruction and PROJECT.md narrative referenced "47 v1 requirements" as an estimate; the itemized REQ-ID list in this document totals 43 unique IDs (CORE-01..06, CHECK-01..06, ACT-01..10, LLM-01..09, BENCH-01..07, DEMO-01..05). All 43 itemized REQ-IDs are mapped to exactly one phase. No orphans, no duplicates.

**Per-phase breakdown:**
- Phase 1 (Skeleton + Heuristic Spine + First Comment): 13 requirements — CORE-01..06, CHECK-01, CHECK-02, ACT-01..05
- Phase 2 (Action Hardening + Repo-Awareness): 8 requirements — CHECK-03, CHECK-04, CHECK-06, ACT-06..10
- Phase 3 (Benchmark + Heuristic Tuning): 7 requirements — BENCH-01..07
- Phase 4 (LLM Adjudicator + Tier 3): 10 requirements — LLM-01..09, CHECK-05
- Phase 5 (Demo & Submission): 5 requirements — DEMO-01..05
- **Total: 13 + 8 + 7 + 10 + 5 = 43 ✓**

**Coverage validated: 43/43 ✓**

---
*Requirements defined: 2026-05-08*
*Last updated: 2026-05-08 — traceability populated by roadmapper*

# Phase 3: Benchmark + Heuristic Tuning - Context

**Gathered:** 2026-05-15
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the scraper harness, replay harness, and heuristic-tuning loop that produces a defensible precision/recall number against held-out real OSS issues — using the **same** `score()` entrypoint from `src/core/` that runs in production.

**Delivers:** BENCH-01, BENCH-02, BENCH-03, BENCH-04, BENCH-05, BENCH-06, BENCH-07 (7 requirements)

**Does NOT deliver:** LLM adjudicator (Phase 4), Tier 3 CONTRIBUTING.md extraction (Phase 4), demo screencast (Phase 5).

**Outputs:**
- `bench/fixtures/` — raw scraped issue JSON (cached so re-runs cost zero API budget)
- `bench/REPORT.md` — precision, recall, F1 per issue type and overall, with 95% CIs; κ-audit docs
- Updated `src/core/score/weights.ts` — tuned against 70% training split only

</domain>

<decisions>
## Implementation Decisions

### Target Repos

- **D-01:** Scrape **`microsoft/vscode`, `facebook/react`, `rust-lang/rust`** — three repos, full scope target 100–200 issues total. These cover bug-heavy (vscode), feature/question-heavy (react), and infrastructure (rust) issue distributions. All three have strong triage hygiene with `invalid`/`needs-info`/`duplicate` labels applied consistently.
- **D-02:** Pre-approved fallback (BENCH-07): if benchmark scope is at risk, shrink input list to 50 issues × 3 repos. **Same repos, same code — only the `--limit` flag changes.** No code changes needed.

### Ground-Truth Proxy Rules (BENCH-02)

- **D-03:** An issue is labeled **"slop"** (low-actionability, expected score ≤ threshold) if **any** of the following labels were present at close time: `invalid`, `duplicate`, `wontfix`, `needs-info`. All other closed issues are labeled **"actionable"**.
- **D-04:** These rules are frozen at scrape time. No post-scrape adjustment to labeling rules is permitted — any change would require re-scraping with a new seed to avoid test-set contamination (BENCH-03 invariant).
- **D-05:** The κ-audit (BENCH-06) validates the proxy quality by comparing these proxy labels against N=30 manually-labeled issues. Cohen's κ is reported as transparency, not gated on a threshold.

### Train/Test Split (BENCH-03)

- **D-06:** Deterministic seeded 70/30 split, computed at scrape time and written alongside the fixtures. Seed is a constant (e.g., `42`). The 30% test set is never inspected during weight tuning. Git history is the audit trail — `weights.ts` commits must occur before any test-set replay.

### Heuristic Tuning Method

- **D-07:** **Manual tuning** — the replay harness prints a per-signal confusion matrix on the 70% training split. Developer inspects which signals over-fire or under-fire, then edits `src/core/score/weights.ts` directly. No grid-search infrastructure needed.
- **D-08:** Tuning loop: `tsx scripts/benchmark.ts --no-llm --split train` → inspect matrix → edit `weights.ts` → repeat until satisfied. Final run: `tsx scripts/benchmark.ts --no-llm --split test` (run once, committed to `bench/REPORT.md`).

### Issue Type Handling

- **D-09:** Scrape **all closed issues** (no pre-filtering by type label). `classifyType()` from `src/core/classifier/` assigns types at replay time — same code path as production. Mirrors real-world distribution; thin per-type buckets are reported accurately rather than artificially padded.

### Report Format (BENCH-05)

- **D-10:** `bench/REPORT.md` reports: precision, recall, F1 per issue type (bug / feature / question) and overall; 95% Wilson confidence intervals when N≥30 per bucket; total N and per-type N; threshold used for score → binary conversion; κ value and manual label methodology.
- **D-11:** Score → binary threshold: report the threshold that maximizes F1 on the training split. Apply it unchanged to the test split.

### Claude's Discretion

- Exact `bench/fixtures/` directory layout (one JSON file per issue vs. one file per repo)
- Concurrency limit for Octokit calls (suggest `p-limit(5)` to stay under GitHub's 5000/hr budget)
- CSV vs. JSON intermediate format for replay pipeline
- Exact markdown table structure in `bench/REPORT.md`
- Which of the N=30 κ-audit issues to manually label (suggest: stratified sample across the 3 repos, balanced slop/actionable)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` §Bench — Full BENCH-01..07 specs with acceptance criteria
- `.planning/ROADMAP.md` §Phase 3 — Success criteria (5 criteria), pitfall coverage (Pitfall 6, 14, 18)

### Project Constraints
- `.planning/PROJECT.md` — Core value (hero output invariant), benchmark scope risk, pre-approved fallback (50 × 3 repos), public-data-only constraint
- `.planning/STATE.md` — Current position, architecture spine, key decisions carried forward

### Architecture
- `.planning/research/ARCHITECTURE.md` — Hexagonal layout, shared CORE pattern. `src/core/` stays pure — the benchmark script calls `score()` directly, no adapter layer needed.

### Key Source Files (Phase 3 touch points)
- `src/core/index.ts` — `score(issue, repoContext, llm?)` entrypoint; benchmark calls this directly (not a duplicate scorer — BENCH-04 invariant)
- `src/core/score/weights.ts` — Tunable constants: `WEIGHTS`, `GRAY_ZONE_LOW`, `GRAY_ZONE_HIGH`. This is what Phase 3 tunes.
- `src/core/score/compute.ts` — Weighted-sum algorithm; shows how weights map to score
- `src/core/classifier/issue-type.ts` — `classifyType()` used at replay time to assign issue types to scraped issues
- `src/core/types.ts` — `Issue`, `ScoredIssue`, `Signals`, `RepoContext` DTOs passed to `score()`

### Technology
- `CLAUDE.md` §Technology Stack — `@octokit/plugin-throttling` for scraper rate limiting, `p-limit` for concurrency cap, `tsx` for running scripts, `@actions/github` not used here (scripts use standalone Octokit)

### Prior Phase Context
- `.planning/phases/02-action-hardening-repo-awareness/02-CONTEXT.md` — Phase 2 decisions; `vue/core` was already validated in soak run (Phase 2 parser tests)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/core/index.ts` → `score()` — The benchmark's replay harness calls this directly. Synchronous, pure. Pass `null` for `llm` to get heuristics-only mode (`--no-llm`).
- `src/core/score/weights.ts` → `WEIGHTS`, `GRAY_ZONE_LOW`, `GRAY_ZONE_HIGH` — These are the tuning levers. The replay harness should print per-signal firing rates to guide manual adjustment.
- `src/core/classifier/issue-type.ts` → `classifyType()` — Used at replay time to classify scraped issues by type before per-type P/R breakdown.
- `tests/fixtures/` — Existing fixture issues (6 markdown files). Structure reference for how issue bodies are stored; benchmark fixtures are richer (JSON with full close metadata).

### Established Patterns
- **Hexagonal:** `src/core/` is pure — no Octokit, no fs. The benchmark script in `scripts/benchmark.ts` is the I/O shell; it fetches, parses, calls `score()`, and reports.
- **`tsx` for scripts:** `tsx scripts/benchmark.ts` — no compile step, no separate tsconfig. Matches Phase 1 toolchain decision.
- **`@octokit/plugin-throttling`:** Already in the planned stack for the scraper. Auto-backs off on 403/429. Critical for 3 repos × 100+ issues without hitting rate limits.

### Integration Points
- `scripts/benchmark.ts` — new entry point for the entire harness (scraper + replay + report)
- `bench/fixtures/` — new directory for cached raw issue JSON
- `bench/REPORT.md` — new output committed to repo (Phase 3 success criterion 1)
- `src/core/score/weights.ts` — updated in-place after training-split tuning; committed before any test-split run

</code_context>

<specifics>
## Specific Ideas

- The three chosen repos (`microsoft/vscode`, `facebook/react`, `rust-lang/rust`) were selected for: (a) strong label hygiene with `invalid`/`needs-info`/`duplicate`, (b) diverse issue type distribution, (c) high enough volume to hit N≥100 with normal closed-issue volume.
- The fallback (50 × 3 repos) uses the **same repos** — only the `--limit` flag changes. This was explicitly pre-approved and must require no code changes to invoke (BENCH-07).
- Ground-truth proxy uses label-presence at close time only (no timeline-events parsing, no PR-link checks). Keeps the scraper simple; κ-audit validates quality.
- The per-signal confusion matrix output from the replay harness is the core tuning tool — it should show: signal name, true-positive rate, false-positive rate, count. Actionable enough that the developer can decide which weight to adjust without deep analysis.
- `bench/REPORT.md` must be committed to the repo (it's a Phase 3 success criterion). It doubles as demo material for the Accuracy pillar (30% rubric weight).

</specifics>

<deferred>
## Deferred Ideas

- `--with-llm` mode replay (BENCH-04 partially deferred) — the harness should accept the flag and no-op or stub it in Phase 3; Phase 4 implements the actual LLM path and re-runs bench with `--with-llm`
- `issues.edited` trigger re-evaluation (noted in Phase 2 deferred) — still deferred; only relevant after soak confirmation
- Pagination edge case in `io.ts` (Phase 2 deferred) — still deferred to Phase 3 or 4 if it surfaces in soak

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 3-Benchmark + Heuristic Tuning*
*Context gathered: 2026-05-15*

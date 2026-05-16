# Phase 3: Benchmark + Heuristic Tuning - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-15
**Phase:** 3-Benchmark + Heuristic Tuning
**Areas discussed:** Target repos, Ground-truth proxy rules, Heuristic tuning method, Issue type filtering

---

## Target Repos

| Option | Description | Selected |
|--------|-------------|----------|
| microsoft/vscode, facebook/react, rust-lang/rust | High volume, diverse types, strong label hygiene | ✓ |
| vuejs/core, vercel/next.js, denoland/deno | JS-ecosystem focus; vue/core already validated in Phase 2 soak | |
| Specify the exact repos myself | User-specified repos | |

**User's choice:** `microsoft/vscode`, `facebook/react`, `rust-lang/rust`
**Notes:** Default recommendation accepted. Fallback (50 × 3) uses same repos — only `--limit` changes.

---

## Ground-Truth Proxy Rules

| Option | Description | Selected |
|--------|-------------|----------|
| Labels-first: invalid OR duplicate OR wontfix OR needs-info | Strongest signal; consistently applied by all 3 target repos | ✓ |
| Closed-without-action: no merged PR, no maintainer comment, within 7 days | More complex; higher false-positive risk | |
| Combined: labels-first OR closed-without-action OR no-comment | Broadest definition; more noise; κ-audit becomes more important | |

**User's choice:** Labels-first (recommended)
**Notes:** Slop = any of `invalid | duplicate | wontfix | needs-info` label present at close time. Actionable = all other closed issues. Rules frozen at scrape time.

---

## Heuristic Tuning Method

| Option | Description | Selected |
|--------|-------------|----------|
| Manual: per-signal confusion matrix, developer edits weights.ts | Fast to implement, no overfitting risk | ✓ |
| Grid search script: ~100 weight combos, picks highest training-set F1 | More systematic; ~2h extra build time; overfitting risk | |
| Threshold tuning only: tune score→binary cutoff, keep weights fixed | Simplest; doesn't improve signal sensitivity | |

**User's choice:** Manual tuning (recommended)
**Notes:** Replay script prints per-signal confusion matrix on training split. Developer edits `src/core/score/weights.ts` directly. No grid-search infrastructure needed.

---

## Issue Type Filtering

| Option | Description | Selected |
|--------|-------------|----------|
| All closed issues; classifier assigns types at replay | Simpler; matches real-world distribution | ✓ |
| Filter at scrape: only issues with clear type labels | Guaranteed per-type coverage; label normalization work required | |
| Take all issues but cap per-type at N=50 | Balanced sampling; discards real data | |

**User's choice:** All closed issues, classifyType() at replay (recommended)
**Notes:** Mirrors production code path. Thin per-type buckets reported accurately rather than artificially balanced.

---

## Claude's Discretion

- `bench/fixtures/` directory layout (one JSON per issue vs. per repo)
- Concurrency limit for Octokit calls (suggest `p-limit(5)`)
- CSV vs. JSON intermediate format for replay pipeline
- Exact markdown table structure in `bench/REPORT.md`
- κ-audit issue selection (suggest stratified sample across 3 repos, balanced slop/actionable)

## Deferred Ideas

- `--with-llm` mode implementation: flag accepted in Phase 3 harness but LLM path implemented in Phase 4
- `issues.edited` trigger re-evaluation: still deferred from Phase 2
- Pagination edge case in `io.ts`: deferred to Phase 3/4 if it surfaces in soak

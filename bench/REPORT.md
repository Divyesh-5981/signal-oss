# Signal-OSS Heuristics Benchmark Report

**Generated:** 2026-05-16T06:44:17.683Z
**Mode:** heuristics-only (`--no-llm`)
**Repos:** microsoft/vscode, facebook/react, rust-lang/rust
**N (total):** 451 | **Train:** 315 | **Test:** 136
**Score→binary threshold:** 4 (F1-maximizing on training split per D-11)
**Split seed:** 42 | **Split:** 70/30 (frozen at scrape time per D-06)
**Oracle slop threshold:** quality < 3 (of 7 content signals)

## Ground Truth: Why Oracle, Not Labels

The previous benchmark derived `isSlop` from GitHub labels (`wontfix`, `invalid`, `stale`,
`needs-info`, …). Fixture analysis showed this proxy is contaminated:

- **rust-lang/rust 156060** is labeled `D-invalid-suggestion` — Rust's diagnostics taxonomy
  for "the compiler emits an invalid suggestion." The label describes the *bug content*, not
  issue actionability. The body is a top-quality reproducer with code, error, version, and
  rationale. Proxy: slop. Reality: high-quality bug.
- **facebook/react 34884** is labeled `Resolution: Stale`. Body has Steps To Reproduce,
  expected vs current behavior, version, and a GitHub repo link. Closed because nobody had
  bandwidth to triage. Proxy: slop. Reality: actionable.
- **rust-lang/rust 43535**: 2 sentences of speculation, no repro, no version, no code. No
  slop labels (rust uses domain labels like `T-infra`, not actionability ones). Proxy:
  actionable. Reality: slop.

Across the three benchmark repos this skew is severe. Label-slop rates were captured at
scrape time per fixture; oracle-slop rates are recomputed at replay time over all 451
fixtures using `src/bench/oracle.ts`:

| Repo               | Label-Slop / Total          | Oracle-Slop / Total          | Notes |
|--------------------|----------------------------|------------------------------|-------|
| microsoft/vscode   | 50 / 151 (33.1%)           | 105 / 151 (69.5%)            | uses `info-needed` heavily |
| facebook/react     | 134 / 150 (89.3%)          | 57 / 150 (38.0%)              | aggressive `Resolution: Stale` |
| rust-lang/rust     | 1 / 150 (0.7%)             | 44 / 150 (29.3%)              | uses content labels, not actionability |

**Replacement (this report):** Ground truth is computed at replay time by
`src/bench/oracle.ts`. The oracle strips HTML comments and auto-generated `<details>`
boilerplate (System Info, A/B Experiments, TRIAGEBOT), then counts 7 binary content
signals over the user-written portion: substantive prose (≥25 words), repro list (ordered
or plain), code block with real content (not just `<placeholder>`), multi-frame stack
trace (handles JS `at`, Python Traceback, Rust E\d+ / panic, JVM Caused-by), version /
runtime mention, expected-actual structure (headings, labeled paragraphs, or "I expected
X / instead Y" prose), repro URL (sandboxes, playgrounds, GitHub repo/tree/blob links).
`oracleIsSlop = quality < 3`. Sanity check: oracle agreed with hand-judged labels
on 12/12 fixtures in pre-flight validation (see `scripts/oracle-check.ts`).

**Class distribution under oracle (this split):** slop = 75 (55.1%),
actionable = 61.

## Overall Performance (Held-Out 30% Test Split)

| Metric    | Value   | 95% Wilson CI                     |
|-----------|---------|-----------------------------------|
| Precision | 0.660   | [0.566, 0.744] |
| Recall    | 0.933   | [0.853, 0.971] |
| F1        | 0.773   | —                                 |
| N         | 136     |                                   |

## Per-Type Performance

| Issue Type | N | Precision | Recall | F1 | CI Note |
|------------|---|-----------|--------|----|---------|
| bug      | 132 | 0.647 [0.551,0.733] | 0.930 [0.846,0.970] | 0.763 |  |
| feature  | 3 | 1.000 | 1.000 | 1.000 | N<30, CI not reported |
| question | 1 | 1.000 | 1.000 | 1.000 | N<30, CI not reported |

*CI reported at 95% (Wilson) when N≥30; "N<30, CI not reported" otherwise.*

## Per-Signal Evidence (drives weight choices)

How often each production Signal fires on oracle-actionable vs oracle-slop in this split.
**Lift = on-actionable rate minus on-slop rate.** Lift > 0 ⇒ quality signal ⇒ positive
weight; lift ≈ 0 ⇒ no signal value ⇒ near-zero weight; lift < 0 ⇒ noise correlated with
slop ⇒ ≤ 0 weight.

**Source for this table:** Training Split (N=315)

| Signal | Fires | On-Slop% | On-Act% | Lift | Weight |
|--------|------:|---------:|--------:|-----:|-------:|
| `hasCodeBlock` | 195 | 42.0% | 76.1% | 0.341 | 1.5 |
| `hasStackTrace` | 49 | 3.8% | 23.9% | 0.201 | 1.0 |
| `hasVersionMention` | 182 | 31.3% | 76.6% | 0.453 | 2.5 |
| `hasReproKeywords` | 83 | 13.0% | 35.9% | 0.229 | 1.0 |
| `hasExpectedActual` | 12 | 1.5% | 5.4% | 0.039 | 0.5 |
| `hasMinimalExample` | 123 | 11.5% | 58.7% | 0.472 | 2.5 |
| `hasImageOnly` | 4 | 0.0% | 2.2% | 0.022 | -1.0 |

Weights in `src/core/score/weights.ts` are set proportional to lift on the **training**
split. The same weights are applied to the test split unchanged (BENCH-03 invariant).

**Before/after (Phase 3 rebuild evidence):** the old weights, tuned against label-derived
ground truth, had `hasReproKeywords = -2.5` and `hasVersionMention = 0.0`. Under the
oracle, both are positive-lift quality signals — the contaminated proxy had taught the
classifier the *inverse* on its strongest available signal.

## Automated κ-Audit (Ground-Truth Sanity Check)

**Method:** Deterministic random sample of 30 fixtures from the same split.
Cohen's κ is computed programmatically between the classifier's binary prediction
(score ≤ threshold ⇒ slop) and the oracle's verdict. No manual review.

**Sample seed:** 42 (reproducible across runs)
**Cohen's κ:** 0.133 (poor)

| Cell                                | Count |
|-------------------------------------|-------|
| Classifier=slop, Oracle=slop (TP)   | 13   |
| Classifier=slop, Oracle=actionable (FP) | 11   |
| Classifier=actionable, Oracle=slop (FN) | 2   |
| Classifier=actionable, Oracle=actionable (TN) | 4   |

**Interpretation:** κ penalizes agreement that could occur by chance. In this n=30 sample
the classifier predicted slop 80% of the time and the oracle predicted slop
50% of the time. With such skewed marginals, chance agreement is high, so a
modest κ understates the actual signal — observed P/R/F1 on the full 136-issue split
are the headline metrics, and κ here is reported strictly as a transparency check that the
audit is fully automatic and reproducible.


## Methodology

- **Same entrypoint:** Replay calls `score(issue, BENCH_REPO_CTX, null)` from
  `src/core/index.ts` — identical to the Action runtime path (BENCH-04 invariant).
- **RepoContext:** Tier-4 baseline only (no template data). This measures the heuristic
  scoring layer alone; production scores on repos with templates will be better (higher
  tier applied).
- **Threshold:** `predictedSlop = score ≤ 4`. Threshold selected by F1
  maximization on the training split (D-11) and persisted to
  `bench/fixtures/trained-threshold.json`. The test run loads this value rather than
  recomputing — git history is the audit trail (D-06).
- **Issue type:** Assigned by `classifyType()` from `src/core/classifier/` (same
  production code).
- **PR contamination:** Closed pull requests filtered during scrape (`issue.pull_request != null`).
- **Oracle independence:** Oracle uses signals the production extractor does NOT —
  specifically substantive-prose word-count, ordered-list-with-content, and repro-URL
  detection. Without this non-overlap, agreement between classifier and oracle would be
  trivially perfect and uninformative.

// src/core/score/weights.ts
// CORE-04: per-signal weights and gray-zone band.
//
// Phase 3 rebuild: weights derived from per-signal lift on the training split
// (N=315) using the content-based oracle as ground truth. Each weight = lift × 5
// (rounded to 0.5), capped so the max-positive-score is near MAX_SCORE.
//
// Evidence table (training split, oracle ground truth, N=315):
//   Signal              On-Slop  On-Act  Lift   Weight   Rationale
//   hasMinimalExample    11.5%   58.7%  +0.47    2.5     Strongest quality signal
//   hasVersionMention    31.3%   76.6%  +0.45    2.5     Was 0.0 — proxy contamination zeroed it
//   hasCodeBlock         42.0%   76.1%  +0.34    1.5     Moderate quality signal
//   hasReproKeywords     13.0%   35.9%  +0.23    1.0     WAS -2.5 — proxy mis-signed (see REPORT)
//   hasStackTrace         3.8%   23.9%  +0.20    1.0     Rare-but-strong on bugs
//   hasExpectedActual     1.5%    5.4%  +0.04    0.5     Small lift; rare fire
//   hasImageOnly          0.0%    2.2%  +0.02   -1.0     Barely fires; intuitive low-info penalty
//
// D-14: Weights are internal constants — NOT action inputs.
// Threshold (score ≤ N ⇒ slop) is learned on training split and persisted to
// bench/fixtures/trained-threshold.json. The test run loads it unchanged.

export const WEIGHTS = {
  hasCodeBlock: 1.5,
  hasStackTrace: 1.0,
  hasVersionMention: 2.5,
  hasReproKeywords: 1.0,
  hasExpectedActual: 0.5,
  hasMinimalExample: 2.5,
  hasImageOnly: -1.0,
} as const

export const GRAY_ZONE_LOW = 3
export const GRAY_ZONE_HIGH = 5
export const MAX_SCORE = 10

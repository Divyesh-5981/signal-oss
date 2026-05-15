// src/core/score/weights.ts
// CORE-04: per-signal weights and gray-zone band.
// Phase 3 tuned: weights derived from training-split signal analysis (105 issues).
// Signals that fire more on actionable issues get positive weight.
// Signals that fire more on slop get negative or zero weight.
// D-14: Weights are internal constants — NOT action inputs.

export const WEIGHTS = {
  hasCodeBlock: 2.5,        // 56% actionable vs 44% slop — positive quality signal
  hasStackTrace: 0.5,       // 17% vs 18% — nearly equal, minimal weight
  hasVersionMention: 0.0,   // 42% actionable vs 59% slop — fires more on slop; neutral
  hasReproKeywords: -2.5,   // 21% actionable vs 65% slop — strongest slop indicator
  hasExpectedActual: 1.5,   // 8% vs 12% — rare but shows effort
  hasMinimalExample: 3.5,   // 44% actionable vs 29% slop — strongest quality signal
  hasImageOnly: -2.5,       // penalty for screenshot-only issues
} as const

export const GRAY_ZONE_LOW = 3
export const GRAY_ZONE_HIGH = 5
export const MAX_SCORE = 10

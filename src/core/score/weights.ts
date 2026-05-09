// src/core/score/weights.ts
// CORE-04: per-signal weights and gray-zone band.
// D-13: Initial gray-zone band 4-6 (symmetric around midpoint). Tunable in Phase 3.
// D-14: Weights are internal constants — NOT action inputs.

export const WEIGHTS = {
  hasCodeBlock: 1.5,
  hasStackTrace: 2.0,
  hasVersionMention: 1.5,
  hasReproKeywords: 1.5,
  hasExpectedActual: 1.5,
  hasMinimalExample: 2.0,
  hasImageOnly: -1.0,
} as const

export const GRAY_ZONE_LOW = 4
export const GRAY_ZONE_HIGH = 6
export const MAX_SCORE = 10

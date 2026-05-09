// src/core/score/compute.ts
// CORE-04: weighted-sum heuristic score 0-10.

import type { Signals } from '../types.js'
import { GRAY_ZONE_HIGH, GRAY_ZONE_LOW, MAX_SCORE, WEIGHTS } from './weights.js'

export function computeScore(signals: Signals): { score: number; isGrayZone: boolean } {
  let raw = 0
  for (const [key, weight] of Object.entries(WEIGHTS) as Array<[keyof Signals, number]>) {
    if (signals[key]) raw += weight
  }
  const score = Math.max(0, Math.min(MAX_SCORE, Math.round(raw)))
  const isGrayZone = score >= GRAY_ZONE_LOW && score <= GRAY_ZONE_HIGH
  return { score, isGrayZone }
}

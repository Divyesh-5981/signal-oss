import { describe, it, expect } from 'vitest'
import { computeScore } from '../../src/core/score/compute.js'
import { GRAY_ZONE_HIGH, GRAY_ZONE_LOW, MAX_SCORE } from '../../src/core/score/weights.js'
import type { Signals } from '../../src/core/types.js'

const ZERO: Signals = {
  hasCodeBlock: false, hasStackTrace: false, hasVersionMention: false,
  hasReproKeywords: false, hasExpectedActual: false,
  hasMinimalExample: false, hasImageOnly: false,
}

describe('computeScore — boundaries', () => {
  it('all-false signals → score 0', () => {
    const r = computeScore(ZERO)
    expect(r.score).toBe(0)
    expect(r.isGrayZone).toBe(false)
  })

  it('all-true positive signals (no image-only) → score in [0,10] integer', () => {
    const allTrue: Signals = {
      hasCodeBlock: true, hasStackTrace: true, hasVersionMention: true,
      hasReproKeywords: true, hasExpectedActual: true, hasMinimalExample: true,
      hasImageOnly: false,
    }
    const r = computeScore(allTrue)
    expect(Number.isInteger(r.score)).toBe(true)
    expect(r.score).toBeGreaterThanOrEqual(0)
    expect(r.score).toBeLessThanOrEqual(MAX_SCORE)
    expect(r.score).toBeGreaterThanOrEqual(7) // high-quality bug → high score
  })

  it('image-only flag drags score down', () => {
    const a = computeScore({ ...ZERO, hasCodeBlock: true })
    const b = computeScore({ ...ZERO, hasCodeBlock: true, hasImageOnly: true })
    expect(b.score).toBeLessThan(a.score)
  })

  it('clamps below 0 to 0', () => {
    const onlyImage: Signals = { ...ZERO, hasImageOnly: true }
    expect(computeScore(onlyImage).score).toBe(0)
  })
})

describe('computeScore — gray-zone band', () => {
  it('GRAY_ZONE_LOW=4, GRAY_ZONE_HIGH=6 (D-13)', () => {
    expect(GRAY_ZONE_LOW).toBe(4)
    expect(GRAY_ZONE_HIGH).toBe(6)
  })

  it('signals producing score 4 → isGrayZone true', () => {
    // 1.5 + 1.5 + 1.5 = 4.5 → rounds to 5 → in band
    const sig = { ...ZERO, hasCodeBlock: true, hasVersionMention: true, hasReproKeywords: true }
    const r = computeScore(sig)
    expect(r.score).toBeGreaterThanOrEqual(GRAY_ZONE_LOW)
    expect(r.score).toBeLessThanOrEqual(GRAY_ZONE_HIGH)
    expect(r.isGrayZone).toBe(true)
  })

  it('score 0 → !isGrayZone', () => {
    expect(computeScore(ZERO).isGrayZone).toBe(false)
  })

  it('high score (>= 7) → !isGrayZone', () => {
    const allTrue: Signals = {
      hasCodeBlock: true, hasStackTrace: true, hasVersionMention: true,
      hasReproKeywords: true, hasExpectedActual: true, hasMinimalExample: true,
      hasImageOnly: false,
    }
    const r = computeScore(allTrue)
    if (r.score >= 7) expect(r.isGrayZone).toBe(false)
  })
})

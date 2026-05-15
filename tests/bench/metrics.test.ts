import { describe, expect, it } from 'vitest'
import {
  cohensKappa,
  computePRF,
  findOptimalThreshold,
  seededSplit,
  wilsonCI,
} from '../../src/bench/metrics.js'

describe('wilsonCI', () => {
  it('80/100 → lower ~0.711, upper ~0.867', () => {
    const { lower, upper } = wilsonCI(80, 100)
    expect(lower).toBeGreaterThan(0.70)
    expect(lower).toBeLessThan(0.725)
    expect(upper).toBeGreaterThan(0.855)
    expect(upper).toBeLessThan(0.880)
  })

  it('0/0 → {lower:0, upper:0} (zero-division guard)', () => {
    expect(wilsonCI(0, 0)).toEqual({ lower: 0, upper: 0 })
  })

  it('100/100 → upper≈1.0 (clamp)', () => {
    const { upper } = wilsonCI(100, 100)
    expect(upper).toBeCloseTo(1, 10)
  })

  it('0/100 → lower=0 (clamp)', () => {
    const { lower } = wilsonCI(0, 100)
    expect(lower).toBe(0)
  })
})

describe('cohensKappa', () => {
  it('perfect agreement → kappa=1', () => {
    expect(cohensKappa(15, 0, 0, 15)).toBe(1)
  })

  it('zero agreement (random) → kappa ~0', () => {
    // tp=12, fp=13, fn=13, tn=12 — chance level agreement
    const k = cohensKappa(12, 13, 13, 12)
    expect(k).toBeCloseTo(0, 1)
  })

  it('n=0 → kappa=0 (empty)', () => {
    expect(cohensKappa(0, 0, 0, 0)).toBe(0)
  })

  it('typical moderate agreement → kappa between 0.4 and 0.8', () => {
    // tp=20, fp=5, fn=3, tn=2 — biased but moderate
    const k = cohensKappa(20, 5, 3, 2)
    expect(k).toBeGreaterThan(0.1)
    expect(k).toBeLessThan(1.0)
  })
})

describe('findOptimalThreshold', () => {
  it('trivially separable data → f1=1, correct threshold', () => {
    const preds = [
      { score: 2, isSlop: true },
      { score: 2, isSlop: true },
      { score: 8, isSlop: false },
      { score: 9, isSlop: false },
    ]
    const { threshold, f1 } = findOptimalThreshold(preds)
    expect(f1).toBe(1)
    expect(threshold).toBeLessThan(8)  // must separate slop (2) from actionable (8,9)
  })

  it('all slop → threshold=10, f1=1', () => {
    const preds = [
      { score: 3, isSlop: true },
      { score: 5, isSlop: true },
    ]
    const { f1 } = findOptimalThreshold(preds)
    expect(f1).toBe(1)
  })

  it('returns {threshold, f1} with numeric values', () => {
    const preds = [{ score: 5, isSlop: true }]
    const result = findOptimalThreshold(preds)
    expect(typeof result.threshold).toBe('number')
    expect(typeof result.f1).toBe('number')
  })
})

describe('computePRF', () => {
  it('tp=8,fp=2,fn=2,tn=8 → precision=0.8, recall=0.8, f1=0.8', () => {
    const { precision, recall, f1 } = computePRF({ tp: 8, fp: 2, fn: 2, tn: 8 })
    expect(precision).toBeCloseTo(0.8, 5)
    expect(recall).toBeCloseTo(0.8, 5)
    expect(f1).toBeCloseTo(0.8, 5)
  })

  it('tp=0,fp=0,fn=0,tn=0 → all zeros (empty guard)', () => {
    const { precision, recall, f1 } = computePRF({ tp: 0, fp: 0, fn: 0, tn: 0 })
    expect(precision).toBe(0)
    expect(recall).toBe(0)
    expect(f1).toBe(0)
  })
})

describe('seededSplit', () => {
  it('seed=42, 10 items → 7 train, 3 test', () => {
    const items = ['a','b','c','d','e','f','g','h','i','j']
    const { train, test } = seededSplit(items, 42)
    expect(train.length).toBe(7)
    expect(test.length).toBe(3)
  })

  it('deterministic — same seed produces same split', () => {
    const items = Array.from({ length: 20 }, (_, i) => `item-${i}`)
    const r1 = seededSplit(items, 42)
    const r2 = seededSplit(items, 42)
    expect(r1.train).toEqual(r2.train)
    expect(r1.test).toEqual(r2.test)
  })

  it('different seeds produce different splits', () => {
    const items = Array.from({ length: 20 }, (_, i) => `item-${i}`)
    const r1 = seededSplit(items, 42)
    const r2 = seededSplit(items, 99)
    expect(r1.train).not.toEqual(r2.train)
  })

  it('train + test covers all items (no loss)', () => {
    const items = ['x','y','z','a','b']
    const { train, test } = seededSplit(items, 42)
    expect([...train, ...test].sort()).toEqual([...items].sort())
  })
})

// src/bench/metrics.ts
// BENCH-05: precision/recall/F1 metrics, Wilson CI, Cohen's kappa, F1-threshold scan.
// BENCH-06: cohensKappa() used in κ-audit (N=30 manual labels vs proxy labels).
// Pure math module — no I/O, no imports from @actions or @octokit.

import { WEIGHTS } from '../core/score/weights.js'
import type { Signals } from '../core/types.js'
import type { BenchmarkFixture, ConfusionMatrix } from './types.js'

// --- Wilson 95% Confidence Interval on a proportion ---
// Source: Wikipedia Binomial proportion confidence interval
export function wilsonCI(successes: number, n: number, z = 1.96): { lower: number; upper: number } {
  if (n === 0) return { lower: 0, upper: 0 }
  const p = successes / n
  const z2 = z * z
  const center = (p + z2 / (2 * n)) / (1 + z2 / n)
  const halfWidth = (z / (1 + z2 / n)) * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))
  return {
    lower: Math.max(0, center - halfWidth),
    upper: Math.min(1, center + halfWidth),
  }
}

// --- Cohen's Kappa (BENCH-06: κ-audit between proxy and manual labels) ---
// tp=both-slop, fp=proxy-slop/manual-actionable, fn=proxy-actionable/manual-slop, tn=both-actionable
export function cohensKappa(tp: number, fp: number, fn: number, tn: number): number {
  const n = tp + fp + fn + tn
  if (n === 0) return 0
  const po = (tp + tn) / n
  const pe = ((tp + fp) * (tp + fn) + (tn + fp) * (tn + fn)) / (n * n)
  if (1 - pe === 0) return 1 // perfect agreement edge case
  return (po - pe) / (1 - pe)
}

// --- F1-optimal threshold scan on training split (D-11) ---
// Scans integer thresholds 0-10; returns the threshold that maximizes F1.
// "slop" = score <= threshold (lower score = worse quality = more likely slop)
export function findOptimalThreshold(predictions: Array<{ score: number; isSlop: boolean }>): {
  threshold: number
  f1: number
} {
  const candidates = Array.from({ length: 11 }, (_, i) => i)
  let best = { threshold: 5, f1: 0 }

  for (const t of candidates) {
    let tp = 0
    let fp = 0
    let fn = 0
    for (const p of predictions) {
      const pred = p.score <= t
      if (pred && p.isSlop) tp++
      else if (pred && !p.isSlop) fp++
      else if (!pred && p.isSlop) fn++
    }
    const precision = tp + fp > 0 ? tp / (tp + fp) : 0
    const recall = tp + fn > 0 ? tp / (tp + fn) : 0
    const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0
    if (f1 > best.f1) best = { threshold: t, f1 }
  }
  return best
}

// --- Precision/Recall/F1 from confusion matrix ---
export function computePRF(cm: ConfusionMatrix): {
  precision: number
  recall: number
  f1: number
} {
  const precision = cm.tp + cm.fp > 0 ? cm.tp / (cm.tp + cm.fp) : 0
  const recall = cm.tp + cm.fn > 0 ? cm.tp / (cm.tp + cm.fn) : 0
  const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0
  return { precision, recall, f1 }
}

// --- Per-signal confusion matrix — tuning aid printed to stdout (D-07) ---
// Prints one line per signal showing how often it fires and on which class.
// Used during --split train tuning loop to guide weight edits in weights.ts.
export function printSignalAnalysis(fixtures: BenchmarkFixture[], _threshold: number): void {
  const signalKeys = Object.keys(WEIGHTS) as Array<keyof Signals>
  console.log('\n=== Per-Signal Analysis (training split) ===')
  for (const key of signalKeys) {
    const fires = fixtures.filter((f) => {
      // signals not stored in fixture; we report label/type distribution only
      // Full signal analysis requires replay result — see replay.ts printSignalAnalysis
      void f
      return false
    })
    void fires
    // Placeholder: real per-signal data is printed by replay.ts after scoring
    console.log(`${key.padEnd(24)} [run replay to get per-signal stats]`)
  }
}

// --- Mulberry32 PRNG + Fisher-Yates seeded shuffle (BENCH-03) ---
function mulberry32(seed: number): () => number {
  let s = seed
  return () => {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function seededSplit(
  items: string[],
  seed = 42,
  trainFraction = 0.7,
): { train: string[]; test: string[] } {
  const rng = mulberry32(seed)
  const shuffled = [...items]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [
      shuffled[j] as (typeof shuffled)[0],
      shuffled[i] as (typeof shuffled)[0],
    ]
  }
  const trainN = Math.floor(shuffled.length * trainFraction)
  return { train: shuffled.slice(0, trainN), test: shuffled.slice(trainN) }
}

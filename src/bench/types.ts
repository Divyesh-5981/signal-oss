// src/bench/types.ts
// Phase 3 DTOs — benchmark harness only. Never imported by src/action/ or src/adapters/.
// BENCH-01, BENCH-02, BENCH-03: BenchmarkFixture shape frozen at scrape time.

import type { IssueType } from '../core/types.js'

export interface BenchmarkFixture {
  // Identifiers
  repo: string       // 'microsoft/vscode'
  number: number     // GitHub issue number

  // Raw fields needed to reconstruct Issue DTO at replay time
  title: string
  body: string
  labels: string[]   // Current labels (proxy for at-close labels per D-03)

  // Ground truth (computed at scrape time, NEVER changed per D-04)
  isSlop: boolean    // true if any of: invalid|duplicate|wontfix|needs-info label present

  // Metadata
  closedAt: string   // ISO 8601
  htmlUrl: string    // for κ-audit manual review (BENCH-06)
}

export interface SplitManifest {
  seed: number          // 42 (per D-06)
  trainFraction: number // 0.7
  createdAt: string     // ISO 8601 — used to detect if weights.ts was modified after split
  train: string[]       // fixture file paths relative to bench/fixtures/ (stable keys)
  test: string[]        // fixture file paths relative to bench/fixtures/
}

// Replay-time result (NOT stored in fixture; recomputed each replay run)
export interface ReplayResult {
  fixture: BenchmarkFixture
  issueType: IssueType
  predictedScore: number
  predictedSlop: boolean  // score <= threshold
}

// Per-type and overall confusion matrix accumulator
export interface ConfusionMatrix {
  tp: number  // predicted slop, actually slop
  fp: number  // predicted slop, actually actionable
  fn: number  // predicted actionable, actually slop
  tn: number  // predicted actionable, actually actionable
}

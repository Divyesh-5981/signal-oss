// src/bench/replay.ts
// BENCH-04: Replay harness — calls the SAME score() from src/core/index.ts.
// BENCH-05: Computes precision/recall/F1 per type + overall with Wilson CIs.
// CRITICAL: MUST NOT reimplement score(). Import it from src/core/index.ts.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { score } from '../core/index.js'
import { classifyType } from '../core/classifier/issue-type.js'
import { WEIGHTS } from '../core/score/weights.js'
import {
  computePRF,
  findOptimalThreshold,
  wilsonCI,
  cohensKappa,
} from './metrics.js'
import type { BenchmarkFixture, ConfusionMatrix, ReplayResult, SplitManifest } from './types.js'
import type { Issue, IssueType, RepoContext, Signals } from '../core/types.js'

// Canonical minimal RepoContext for benchmark — mirrors EMPTY_CTX from score-pipeline.test.ts
// Pitfall 6 in RESEARCH.md: documents that benchmark measures Tier-4 (universal baseline) path
const BENCH_REPO_CTX: RepoContext = {
  hasIssueForms: false,
  hasMdTemplates: false,
  hasContributing: false,
  templates: [],
}

// Threshold state: train run finds optimal threshold; test run applies it
let _trainedThreshold: number | null = null

function loadFixture(path: string): BenchmarkFixture {
  const raw = JSON.parse(readFileSync(path, 'utf-8')) as unknown
  // Basic shape validation — zod would be cleaner but adds startup cost for a script
  if (
    typeof raw !== 'object' ||
    raw === null ||
    typeof (raw as Record<string, unknown>)['isSlop'] !== 'boolean'
  ) {
    throw new Error(`Invalid fixture at ${path}: missing isSlop field`)
  }
  return raw as BenchmarkFixture
}

function toIssueDTO(fixture: BenchmarkFixture): Issue {
  return {
    title: fixture.title ?? '',
    body: fixture.body ?? '',
    labels: fixture.labels ?? [],
  }
}

// Print per-signal stats for manual tuning (D-07, D-08)
function printSignalAnalysis(
  results: Array<{ signals: Signals; isSlop: boolean }>,
  threshold: number,
): void {
  const keys = Object.keys(WEIGHTS) as Array<keyof Signals>
  console.log('\n=== Per-Signal Analysis (guides weight tuning in weights.ts) ===')
  console.log(
    `${'Signal'.padEnd(24)} ${'Fires'.padStart(6)} ${'on-Slop'.padStart(8)} ${'on-Act'.padStart(8)} ${'TP-Rate'.padStart(8)}`,
  )
  console.log('─'.repeat(60))
  for (const key of keys) {
    const fires = results.filter((r) => r.signals[key])
    const firesOnSlop = fires.filter((r) => r.isSlop)
    const firesOnActionable = fires.filter((r) => !r.isSlop)
    const tpRate =
      fires.length > 0 ? (firesOnSlop.length / fires.length).toFixed(2) : 'N/A'
    console.log(
      `${key.padEnd(24)} ${String(fires.length).padStart(6)} ${String(firesOnSlop.length).padStart(8)} ${String(firesOnActionable.length).padStart(8)} ${String(tpRate).padStart(8)}`,
    )
  }
  console.log(`\nOptimal threshold (F1-max on this split): ${threshold}`)
  console.log('─'.repeat(60))
  console.log('To tune: edit src/core/score/weights.ts, re-run --split train, repeat.')
  console.log('WARNING: Never run --split test until tuning is complete (BENCH-03).\n')
}

export interface ReplayOptions {
  fixturesDir: string
  split: string  // 'train' | 'test' | 'all' — string to accept CLI passthrough
  reportPath: string
}

export async function replay(opts: ReplayOptions): Promise<void> {
  const { fixturesDir, split } = opts

  const splitManifestPath = join(fixturesDir, 'split.json')
  if (!existsSync(splitManifestPath)) {
    throw new Error(
      `split.json not found at ${splitManifestPath}. Run --mode scrape first.`,
    )
  }

  const manifest = JSON.parse(readFileSync(splitManifestPath, 'utf-8')) as SplitManifest

  // Select the fixture paths for the requested split
  let fixturePaths: string[]
  if (split === 'train') {
    fixturePaths = manifest.train
  } else if (split === 'test') {
    if (_trainedThreshold === null) {
      console.warn(
        '[replay] WARNING: Running --split test without a prior --split train.\n' +
        '  The threshold will be optimized on test data, violating BENCH-03.\n' +
        '  Run --split train first, tune weights.ts, then run --split test.',
      )
    }
    fixturePaths = manifest.test
  } else {
    // 'all' or any other value: use everything
    fixturePaths = [...manifest.train, ...manifest.test]
  }

  console.log(`[replay] Loading ${fixturePaths.length} fixtures (split=${split})...`)

  // Load all fixtures and run score()
  const replayResults: ReplayResult[] = []
  const signalData: Array<{ signals: Signals; isSlop: boolean }> = []

  for (const relPath of fixturePaths) {
    const absPath = join(fixturesDir, relPath)
    if (!existsSync(absPath)) {
      console.warn(`[replay] Missing fixture: ${absPath} — skipping`)
      continue
    }

    let fixture: BenchmarkFixture
    try {
      fixture = loadFixture(absPath)
    } catch (err: unknown) {
      console.warn(`[replay] Skipping invalid fixture ${relPath}: ${(err as Error).message}`)
      continue
    }

    const issueDto = toIssueDTO(fixture)
    // BENCH-04 INVARIANT: calling production score() — NOT a reimplementation
    const scored = score(issueDto, BENCH_REPO_CTX, null)

    // classifyType is also called inside score() but we expose it for per-type breakdown
    const issueType: IssueType = classifyType(issueDto, scored.signals)

    signalData.push({ signals: scored.signals, isSlop: fixture.isSlop })
    replayResults.push({
      fixture,
      issueType,
      predictedScore: scored.score,
      predictedSlop: false, // will be set after threshold is determined
    })
  }

  // Find or apply threshold
  const predData = replayResults.map((r) => ({
    score: r.predictedScore,
    isSlop: r.fixture.isSlop,
  }))

  let threshold: number
  if (split === 'train' || split === 'all') {
    const { threshold: t, f1 } = findOptimalThreshold(predData)
    threshold = t
    _trainedThreshold = t
    console.log(`[replay] Optimal threshold on training split: ${threshold} (F1=${f1.toFixed(3)})`)
  } else {
    threshold = _trainedThreshold ?? 5  // fallback to default if not trained
    console.log(`[replay] Applying threshold from training split: ${threshold}`)
  }

  // Apply threshold to get binary predictions
  for (const r of replayResults) {
    r.predictedSlop = r.predictedScore <= threshold
  }

  // Compute per-type and overall confusion matrices
  const types: IssueType[] = ['bug', 'feature', 'question']
  const perTypeCM: Record<IssueType, ConfusionMatrix> = {
    bug:     { tp: 0, fp: 0, fn: 0, tn: 0 },
    feature: { tp: 0, fp: 0, fn: 0, tn: 0 },
    question:{ tp: 0, fp: 0, fn: 0, tn: 0 },
  }
  const overallCM: ConfusionMatrix = { tp: 0, fp: 0, fn: 0, tn: 0 }

  for (const r of replayResults) {
    const cm = perTypeCM[r.issueType]
    const pred = r.predictedSlop
    const actual = r.fixture.isSlop
    if (pred && actual)  { cm.tp++; overallCM.tp++ }
    if (pred && !actual) { cm.fp++; overallCM.fp++ }
    if (!pred && actual) { cm.fn++; overallCM.fn++ }
    if (!pred && !actual){ cm.tn++; overallCM.tn++ }
  }

  // Print results
  console.log('\n=== Metrics ===')
  const overall = computePRF(overallCM)
  const totalN = overallCM.tp + overallCM.fp + overallCM.fn + overallCM.tn
  const prCI = wilsonCI(overallCM.tp, overallCM.tp + overallCM.fp)
  const reCI = wilsonCI(overallCM.tp, overallCM.tp + overallCM.fn)
  console.log(
    `Overall: N=${totalN} P=${overall.precision.toFixed(3)} [${prCI.lower.toFixed(3)},${prCI.upper.toFixed(3)}] R=${overall.recall.toFixed(3)} [${reCI.lower.toFixed(3)},${reCI.upper.toFixed(3)}] F1=${overall.f1.toFixed(3)}`,
  )

  for (const type of types) {
    const cm = perTypeCM[type]
    const n = cm.tp + cm.fp + cm.fn + cm.tn
    const prf = computePRF(cm)
    console.log(`  ${type.padEnd(8)}: N=${n} P=${prf.precision.toFixed(3)} R=${prf.recall.toFixed(3)} F1=${prf.f1.toFixed(3)}`)
  }

  // Print signal analysis for manual tuning
  if (split === 'train' || split === 'all') {
    printSignalAnalysis(signalData, threshold)
  }

  // Store results for renderReport
  _lastReplayState = { replayResults, perTypeCM, overallCM, threshold, split, manifest }
}

// State shared between replay() and renderReport() within the same process invocation
let _lastReplayState: {
  replayResults: ReplayResult[]
  perTypeCM: Record<IssueType, ConfusionMatrix>
  overallCM: ConfusionMatrix
  threshold: number
  split: string
  manifest: SplitManifest
} | null = null

export interface RenderReportOptions {
  fixturesDir: string
  reportPath: string
  // κ-audit values — provided after manual labeling (BENCH-06, checkpoint in Plan 03)
  kappaTP?: number
  kappaFP?: number
  kappaFN?: number
  kappaTN?: number
}

export async function renderReport(opts: RenderReportOptions): Promise<void> {
  const { reportPath, kappaTP = 0, kappaFP = 0, kappaFN = 0, kappaTN = 0 } = opts

  if (!_lastReplayState) {
    throw new Error('renderReport() called before replay(). Run replay() first.')
  }

  const { replayResults, perTypeCM, overallCM, threshold, split, manifest } = _lastReplayState
  const types: IssueType[] = ['bug', 'feature', 'question']
  const overall = computePRF(overallCM)
  const totalN = overallCM.tp + overallCM.fp + overallCM.fn + overallCM.tn
  const prCI = wilsonCI(overallCM.tp, overallCM.tp + overallCM.fp)
  const reCI = wilsonCI(overallCM.tp, overallCM.tp + overallCM.fn)

  // κ-audit (BENCH-06)
  const kappa = cohensKappa(kappaTP, kappaFP, kappaFN, kappaTN)
  const kappaTotal = kappaTP + kappaFP + kappaFN + kappaTN
  const kappaInterp =
    kappa >= 0.8 ? 'strong' :
    kappa >= 0.6 ? 'moderate' :
    kappa >= 0.4 ? 'fair' :
    'poor'

  // Per-type rows
  const typeRows = types.map((type) => {
    const cm = perTypeCM[type]
    const n = cm.tp + cm.fp + cm.fn + cm.tn
    const prf = computePRF(cm)
    const ciNote = n >= 30 ? '' : 'N<30, CI not reported'
    const pPrCI = n >= 30 ? wilsonCI(cm.tp, cm.tp + cm.fp) : null
    const rPrCI = n >= 30 ? wilsonCI(cm.tp, cm.tp + cm.fn) : null
    return (
      `| ${type.padEnd(8)} | ${n} | ` +
      `${prf.precision.toFixed(3)}${pPrCI ? ` [${pPrCI.lower.toFixed(3)},${pPrCI.upper.toFixed(3)}]` : ''} | ` +
      `${prf.recall.toFixed(3)}${rPrCI ? ` [${rPrCI.lower.toFixed(3)},${rPrCI.upper.toFixed(3)}]` : ''} | ` +
      `${prf.f1.toFixed(3)} | ${ciNote} |`
    )
  }).join('\n')

  // Class distribution
  const slopCount = replayResults.filter((r) => r.fixture.isSlop).length
  const actionableCount = replayResults.length - slopCount
  const trainFixtureCount = manifest.train.length
  const testFixtureCount = manifest.test.length

  const report = `# Signal-OSS Heuristics Benchmark Report

**Generated:** ${new Date().toISOString()}
**Mode:** heuristics-only (--no-llm)
**Repos:** microsoft/vscode, facebook/react, rust-lang/rust
**N (total):** ${manifest.train.length + manifest.test.length} | **Train:** ${trainFixtureCount} | **Test:** ${testFixtureCount}
**Score→binary threshold:** ${threshold} (F1-maximizing on training split per D-11)
**Seed:** ${manifest.seed} | **Split:** 70/30 (frozen at scrape time per D-06)

## Overall Performance (${split === 'test' ? 'Held-Out 30% Test Split' : split.toUpperCase() + ' Split'})

| Metric    | Value   | 95% Wilson CI                     |
|-----------|---------|-----------------------------------|
| Precision | ${overall.precision.toFixed(3)}   | [${prCI.lower.toFixed(3)}, ${prCI.upper.toFixed(3)}] |
| Recall    | ${overall.recall.toFixed(3)}   | [${reCI.lower.toFixed(3)}, ${reCI.upper.toFixed(3)}] |
| F1        | ${overall.f1.toFixed(3)}   | —                                 |
| N         | ${totalN}     |                                   |

*Class distribution: slop=${slopCount} (${((slopCount / Math.max(replayResults.length, 1)) * 100).toFixed(1)}%) actionable=${actionableCount}*

## Per-Type Performance

| Issue Type | N | Precision | Recall | F1 | CI Note |
|------------|---|-----------|--------|----|---------|
${typeRows}

*CI reported at 95% (Wilson) when N≥30; "N<30, CI not reported" otherwise*

## κ-Audit (Ground-Truth Proxy Quality)

**Sample:** N=${kappaTotal} issues, stratified across 3 repos, balanced slop/actionable
**Method:** Manual review of GitHub issue HTML at htmlUrl; labeled independently of proxy rules
**Cohen's κ:** ${kappa.toFixed(3)} (${kappaInterp})

| Agreement                          | Count | %    |
|------------------------------------|-------|------|
| Both proxy+manual = slop           | ${kappaTP}    | ${kappaTotal > 0 ? ((kappaTP / kappaTotal) * 100).toFixed(1) : 0}%  |
| Both proxy+manual = actionable     | ${kappaTN}    | ${kappaTotal > 0 ? ((kappaTN / kappaTotal) * 100).toFixed(1) : 0}%  |
| Proxy=slop, Manual=actionable (FP) | ${kappaFP}    | ${kappaTotal > 0 ? ((kappaFP / kappaTotal) * 100).toFixed(1) : 0}%  |
| Proxy=actionable, Manual=slop (FN) | ${kappaFN}    | ${kappaTotal > 0 ? ((kappaFN / kappaTotal) * 100).toFixed(1) : 0}%  |

*κ is reported as a transparency metric, not gated on a threshold (per D-05).*

## Methodology Notes

- **Ground-truth proxy:** Labels \`invalid\`, \`duplicate\`, \`wontfix\`, \`needs-info\` present on
  closed issue used as proxy for at-close labels (case-insensitive). Current labels used because
  the GitHub REST API returns current labels; κ-audit validates proxy quality empirically.
- **RepoContext:** Universal Tier-4 baseline — no template data loaded for benchmark.
  This measures the heuristic scoring layer, not template-matching. Production scores on repos
  with templates will be better (higher tier applied).
- **Score→binary:** Issue classified as "slop" when \`score <= ${threshold}\`; threshold selected
  to maximize F1 on the training split (D-11) and applied unchanged to the test split.
- **Issue type:** Assigned by \`classifyType()\` from \`src/core/classifier/\` (same production code).
- **Same entrypoint:** Replay calls \`score(issue, BENCH_REPO_CTX, null)\` from
  \`src/core/index.ts\` — identical to the Action runtime path (BENCH-04 invariant).
- **PR contamination:** Closed pull requests filtered during scrape (\`issue.pull_request != null\`).
`

  mkdirSync(dirname(reportPath), { recursive: true })
  writeFileSync(reportPath, report, 'utf-8')
  console.log(`[report] bench/REPORT.md written to ${reportPath}`)
}

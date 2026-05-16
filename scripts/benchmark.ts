#!/usr/bin/env tsx
// scripts/benchmark.ts
// Phase 3: Benchmark + Heuristic Tuning entry point.
// BENCH-01, BENCH-04, BENCH-07: CLI harness for scrape / replay / report modes.
//
// Usage:
//   tsx scripts/benchmark.ts --mode scrape --repos microsoft/vscode,facebook/react,rust-lang/rust --limit 200
//   tsx scripts/benchmark.ts --mode replay --no-llm --split train
//   tsx scripts/benchmark.ts --mode replay --no-llm --split test
//   tsx scripts/benchmark.ts --mode report
//
// Pre-approved fallback (BENCH-07): --limit 50 reduces to 50 issues × 3 repos
// without code changes.

import { parseArgs } from 'node:util'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// All paths relative to repo root (one level up from scripts/)
const REPO_ROOT = join(__dirname, '..')
const FIXTURES_DIR = join(REPO_ROOT, 'bench', 'fixtures')
const REPORT_PATH = join(REPO_ROOT, 'bench', 'REPORT.md')

const DEFAULT_REPOS = [
  'microsoft/vscode',
  'facebook/react',
  'rust-lang/rust',
]

async function run(): Promise<void> {
  const { values } = parseArgs({
    options: {
      mode:       { type: 'string',  default: 'scrape'  }, // 'scrape' | 'replay' | 'report'
      repos:      { type: 'string'                       }, // comma-separated 'owner/repo,...'
      limit:      { type: 'string',  default: '200'      }, // per-repo issue limit
      'no-llm':   { type: 'boolean', default: false      }, // heuristics-only mode (Phase 3)
      'with-llm': { type: 'boolean', default: false      }, // Phase 4 path (stub in Phase 3)
      split:      { type: 'string',  default: 'train'    }, // 'train' | 'test' | 'all'
      token:      { type: 'string'                       }, // override GITHUB_TOKEN
      seed:       { type: 'string',  default: '42'       }, // split seed (D-06)
    },
    strict: true,
    allowPositionals: false,
  })

  const mode = values.mode ?? 'scrape'
  const token = values.token ?? process.env['GITHUB_TOKEN'] ?? ''
  const limitPerRepo = parseInt(values.limit ?? '200', 10)
  const repos = values.repos
    ? values.repos.split(',').map((r) => r.trim()).filter(Boolean)
    : DEFAULT_REPOS
  const split = values.split ?? 'train'
  const seed = parseInt(values.seed ?? '42', 10)
  const noLlm = values['no-llm'] ?? false
  const withLlm = values['with-llm'] ?? false

  console.log(`[benchmark] mode=${mode} repos=${repos.join(',')} limit=${limitPerRepo} split=${split}`)

  if (mode === 'scrape') {
    if (!token) {
      console.error('[benchmark] GITHUB_TOKEN is required for --mode scrape')
      console.error('  Set GITHUB_TOKEN env var or pass --token <token>')
      process.exit(1)
    }

    const { scrape } = await import('../src/bench/scraper.js')
    await scrape({ token, repos, limitPerRepo, fixturesDir: FIXTURES_DIR, seed })

  } else if (mode === 'replay') {
    // Plan 03 implements this path.
    // BENCH-04: replay calls score() from src/core/ with --no-llm or --with-llm.
    if (withLlm) {
      console.warn('[benchmark] --with-llm is not yet implemented (Phase 4). Falling back to --no-llm.')
    }
    void noLlm
    void split

    const { replay, renderReport } = await import('../src/bench/replay.js')
    await replay({ fixturesDir: FIXTURES_DIR, split, reportPath: REPORT_PATH })
    // Phase 3 rebuild: REPORT.md is written from the same process so the in-memory
    // replay state is available. Test-split run is the one that produces the final
    // REPORT.md committed to the repo.
    if (split === 'test' || split === 'all') {
      await renderReport({ fixturesDir: FIXTURES_DIR, reportPath: REPORT_PATH })
    }

  } else if (mode === 'report') {
    // Backwards-compat path: re-run replay on test split, then write report.
    const { replay, renderReport } = await import('../src/bench/replay.js')
    await replay({ fixturesDir: FIXTURES_DIR, split: 'test', reportPath: REPORT_PATH })
    await renderReport({ fixturesDir: FIXTURES_DIR, reportPath: REPORT_PATH })

  } else {
    console.error(`[benchmark] Unknown mode: ${mode}. Use: scrape | replay | report`)
    process.exit(1)
  }
}

run().catch((err: unknown) => {
  console.error('[benchmark] Fatal error:', (err as Error).message)
  process.exit(1)
})

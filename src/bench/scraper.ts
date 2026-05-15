// src/bench/scraper.ts
// BENCH-01: Octokit scraper. I/O shell — calls @octokit/rest, writes to bench/fixtures/.
// BENCH-02: Ground-truth labeling using D-03 slop label rules (frozen at scrape time per D-04).
// BENCH-03: Seeded 70/30 split written to bench/fixtures/split.json after scraping.
// CRITICAL: This file MUST NOT import from @actions/core or @actions/github (not Action runtime).

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { Octokit } from '@octokit/rest'
import { throttling } from '@octokit/plugin-throttling'
import pLimit from 'p-limit'
import { seededSplit } from './metrics.js'
import type { BenchmarkFixture, SplitManifest } from './types.js'

// D-03: Slop label rules — FROZEN. Do not change without re-scraping with new seed.
// Case-insensitive match for robustness (Pitfall 5 in RESEARCH.md).
// D-03: Slop label rules — expanded to cover real-world label conventions.
// Exact matches (case-insensitive):
const SLOP_LABELS_EXACT = ['invalid', 'duplicate', 'wontfix', 'needs-info', 'spam', 'stale']

// Substring matches (case-insensitive) — catches variants like "Resolution: Stale",
// "needs more info", "not-reproducible", "closed-as-duplicate", etc.
const SLOP_LABELS_PARTIAL = [
  'stale',
  'needs-info',
  'needs more info',
  'info-needed',
  'not-reproducible',
  'cannot-reproduce',
  'can\'t reproduce',
  'unconfirmed',
  'wontfix',
  'won\'t fix',
  'duplicate',
  'invalid',
  'spam',
]

function isSlop(labels: string[]): boolean {
  return labels.some((l) => {
    const lower = l.toLowerCase()
    if (SLOP_LABELS_EXACT.some((slop) => lower === slop)) return true
    if (SLOP_LABELS_PARTIAL.some((partial) => lower.includes(partial))) return true
    return false
  })
}

const ThrottledOctokit = Octokit.plugin(throttling)

export function createOctokit(token: string): InstanceType<typeof ThrottledOctokit> {
  return new ThrottledOctokit({
    auth: token || undefined,
    throttle: {
      onRateLimit: (retryAfter, options, octokit, retryCount) => {
        octokit.log.warn(
          `Primary rate limit hit on ${options.method} ${options.url}; retryAfter=${retryAfter}s`,
        )
        if (retryCount < 2) {
          octokit.log.info(`Retrying after ${retryAfter}s (attempt ${retryCount + 1})`)
          return true
        }
        return false
      },
      onSecondaryRateLimit: (_retryAfter, options, octokit) => {
        // Secondary rate limit — log only; p-limit handles spacing
        octokit.log.warn(
          `Secondary rate limit on ${options.method} ${options.url}; backing off`,
        )
        return false
      },
    },
  })
}

async function scrapeRepo(
  octokit: InstanceType<typeof ThrottledOctokit>,
  owner: string,
  repo: string,
  maxIssues: number,
  fixturesDir: string,
): Promise<string[]> {
  const repoSlug = `${owner}-${repo}`
  const repoDir = join(fixturesDir, repoSlug)
  mkdirSync(repoDir, { recursive: true })

  const collected: string[] = []  // fixture file paths (relative to fixturesDir)
  console.log(`[scraper] ${owner}/${repo}: fetching up to ${maxIssues} closed issues...`)

  try {
    for await (const response of octokit.paginate.iterator(
      octokit.rest.issues.listForRepo,
      { owner, repo, state: 'closed', per_page: 100, sort: 'updated', direction: 'desc' },
    )) {
      for (const issue of response.data) {
        if (collected.length >= maxIssues) break

        // CRITICAL: skip pull requests (GitHub issues endpoint returns PRs too)
        if (issue.pull_request != null) continue

        const labels = (issue.labels ?? [])
          .map((l) => (typeof l === 'string' ? l : (l.name ?? '')))
          .filter((s) => s.length > 0)

        const fixture: BenchmarkFixture = {
          repo: `${owner}/${repo}`,
          number: issue.number,
          title: typeof issue.title === 'string' ? issue.title : '',
          body: typeof issue.body === 'string' ? issue.body : '',
          labels,
          isSlop: isSlop(labels),
          closedAt: issue.closed_at ?? new Date().toISOString(),
          htmlUrl:
            issue.html_url ??
            `https://github.com/${owner}/${repo}/issues/${issue.number}`,
        }

        const fileName = `${issue.number}.json`
        const fixturePath = join(repoDir, fileName)
        const relPath = `${repoSlug}/${fileName}`

        // Skip-if-exists: avoid overwriting cached fixtures (Pitfall 4 in RESEARCH.md)
        if (!existsSync(fixturePath)) {
          writeFileSync(fixturePath, JSON.stringify(fixture, null, 2), 'utf-8')
        }
        collected.push(relPath)
      }
      if (collected.length >= maxIssues) break
    }
  } catch (err: unknown) {
    console.warn(`[scraper] ${owner}/${repo}: ${(err as Error).message}`)
  }

  // Count slop from cached files (using top-level readFileSync import — no require())
  let slopInRepo = 0
  for (const relPath of collected) {
    try {
      const content = JSON.parse(
        readFileSync(join(fixturesDir, relPath), 'utf-8'),
      ) as BenchmarkFixture
      if (content.isSlop) slopInRepo++
    } catch { /* skip */ }
  }
  console.log(
    `[scraper] ${owner}/${repo}: ${collected.length} issues cached; ` +
    `slop=${slopInRepo}/${collected.length}`,
  )

  return collected
}

export interface ScrapeOptions {
  token: string
  repos: string[]          // ['microsoft/vscode', 'facebook/react', 'rust-lang/rust']
  limitPerRepo: number     // max issues per repo (default 200; fallback 50 per D-02/BENCH-07)
  fixturesDir: string      // absolute path to bench/fixtures/
  seed?: number            // split seed (default 42 per D-06)
}

export async function scrape(opts: ScrapeOptions): Promise<void> {
  const { token, repos, limitPerRepo, fixturesDir, seed = 42 } = opts

  mkdirSync(fixturesDir, { recursive: true })

  const octokit = createOctokit(token)
  const limit = pLimit(5)  // max 5 concurrent repo scrapes (CLAUDE.md recommendation)

  const allPaths: string[] = []

  const results = await Promise.all(
    repos.map((repoSpec) =>
      limit(async () => {
        const [owner, repo] = repoSpec.split('/')
        if (!owner || !repo) {
          console.warn(`[scraper] Invalid repo spec: ${repoSpec}`)
          return []
        }
        return scrapeRepo(octokit, owner, repo, limitPerRepo, fixturesDir)
      }),
    ),
  )

  for (const paths of results) {
    allPaths.push(...paths)
  }

  // Sort paths for deterministic split (order must be stable before shuffling)
  allPaths.sort()

  // Write seeded 70/30 split manifest (BENCH-03: frozen at scrape time per D-06)
  const { train, test } = seededSplit(allPaths, seed, 0.7)
  const manifest: SplitManifest = {
    seed,
    trainFraction: 0.7,
    createdAt: new Date().toISOString(),
    train,
    test,
  }

  const splitPath = join(fixturesDir, 'split.json')
  writeFileSync(splitPath, JSON.stringify(manifest, null, 2), 'utf-8')

  console.log(
    `[scraper] Done. Total=${allPaths.length} Train=${train.length} Test=${test.length}`,
  )
  console.log(`[scraper] Split manifest written to ${splitPath}`)

  // Log class distribution using top-level readFileSync import (no require())
  let slopCount = 0
  for (const p of allPaths) {
    try {
      const f = JSON.parse(
        readFileSync(join(fixturesDir, p), 'utf-8'),
      ) as BenchmarkFixture
      if (f.isSlop) slopCount++
    } catch { /* skip */ }
  }
  console.log(
    `[scraper] Class distribution: slop=${slopCount} (${((slopCount / Math.max(allPaths.length, 1)) * 100).toFixed(1)}%) actionable=${allPaths.length - slopCount}`,
  )
}

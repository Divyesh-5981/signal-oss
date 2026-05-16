#!/usr/bin/env tsx
// scripts/rebuild-split.ts
// Phase 3 rebuild: regenerate split.json from all fixtures currently on disk.
// The previous split.json was frozen against an older 50/repo scrape but the fixtures
// directory has since been refreshed to 200/repo, so the manifest pointed at half-missing
// files. This script reuses the same seeded mulberry32 shuffle the scraper uses so the
// split remains deterministic given the same seed.

import { readdirSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { seededSplit } from '../src/bench/metrics.js'
import type { SplitManifest } from '../src/bench/types.js'

const __filename = fileURLToPath(import.meta.url)
const REPO_ROOT = join(dirname(__filename), '..')
const FIXTURES_DIR = join(REPO_ROOT, 'bench', 'fixtures')

const REPOS = ['microsoft-vscode', 'facebook-react', 'rust-lang-rust']

const allPaths: string[] = []
for (const repo of REPOS) {
  const dir = join(FIXTURES_DIR, repo)
  const files = readdirSync(dir).filter((f) => f.endsWith('.json'))
  for (const f of files) allPaths.push(`${repo}/${f}`)
}
allPaths.sort() // stable order before shuffle

const seed = 42
const { train, test } = seededSplit(allPaths, seed, 0.7)
const manifest: SplitManifest = {
  seed,
  trainFraction: 0.7,
  createdAt: new Date().toISOString(),
  train,
  test,
}
writeFileSync(join(FIXTURES_DIR, 'split.json'), JSON.stringify(manifest, null, 2), 'utf-8')
console.log(`[rebuild-split] total=${allPaths.length} train=${train.length} test=${test.length} seed=${seed}`)

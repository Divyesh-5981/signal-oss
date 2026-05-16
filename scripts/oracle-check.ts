#!/usr/bin/env tsx
// scripts/oracle-check.ts
// Phase 3 rebuild — sanity-check the oracle on 12 hand-read fixtures.
// Run with: npx tsx scripts/oracle-check.ts

import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { oracle } from '../src/bench/oracle.ts'

const __filename = fileURLToPath(import.meta.url)
const REPO_ROOT = join(dirname(__filename), '..')

const cases: Array<[string, string]> = [
  ['microsoft-vscode/304087.json', 'SLOP (one sentence)'],
  ['microsoft-vscode/304089.json', 'SLOP (rant + template noise)'],
  ['microsoft-vscode/306026.json', 'SLOP (overheat rant, boilerplate)'],
  ['microsoft-vscode/306733.json', 'ACT  (Copilot Chat error)'],
  ['facebook-react/36100.json',    'SLOP ([spam])'],
  ['facebook-react/34884.json',    'ACT  (Flow defs, has repro + URL)'],
  ['facebook-react/35034.json',    'ACT  (useEffectEvent bug)'],
  ['facebook-react/35821.json',    'ACT  (useDeferredValue stale)'],
  ['rust-lang-rust/156060.json',   'ACT  (top-quality rust bug)'],
  ['rust-lang-rust/43535.json',    'SLOP (2-sentence speculation)'],
  ['rust-lang-rust/155620.json',   'ACT  (regression report)'],
  ['rust-lang-rust/149278.json',   'ACT  (ICE giant)'],
]

let agreed = 0
for (const [path, expected] of cases) {
  const j = JSON.parse(readFileSync(join(REPO_ROOT, 'bench', 'fixtures', path), 'utf-8'))
  const r = oracle({ title: j.title, body: j.body })
  const verdict = r.isSlop ? 'SLOP' : 'ACT '
  const expectSlop = expected.startsWith('SLOP')
  const agree = expectSlop === r.isSlop
  if (agree) agreed++
  console.log(
    `[${verdict}] q=${r.quality}/7 len=${r.userBodyLen}/${r.totalLen} ${agree ? '✓' : '✗'} ${path}`,
  )
  console.log(`     reasons: ${r.reasons.join(', ') || '(none)'} | expected: ${expected}`)
}
console.log(`\nOracle agreement with hand-judgment: ${agreed}/${cases.length}`)

---
id: 01-02-dtos-stub
phase: 01-skeleton-heuristic-spine-first-comment
plan: 02
type: execute
wave: 2
depends_on: [01-01-scaffold]
files_modified:
  - src/core/types.ts
  - src/core/llm/port.ts
  - src/core/index.ts
  - src/action/main.ts
  - tests/core/types.test.ts
  - tests/smoke.test.ts
requirements:
  - CORE-01
  - ACT-01
autonomous: true
tags: [dtos, types, scaffold, walking-skeleton]

must_haves:
  truths:
    - "All Phase 1 DTOs are defined in src/core/types.ts with locked shapes from SKELETON.md A6"
    - "LLMPort interface is defined in src/core/llm/port.ts (stubbed; real adapter in Phase 4)"
    - "score() entrypoint exists at src/core/index.ts with signature score(issue, repoContext, llm) and returns a hardcoded but well-typed ScoredIssue"
    - "src/action/main.ts is a stub orchestrator that imports score() and exits cleanly (no real Octokit calls yet)"
    - "src/core/ has zero imports from @octokit/*, @actions/*, fs, https, @anthropic-ai/sdk, openai (verifiable by grep)"
    - "npm run package produces dist/index.js successfully (Walking Skeleton Stage A: pipe is wired even if values are hardcoded)"
  artifacts:
    - path: "src/core/types.ts"
      provides: "All Phase 1 DTOs"
      contains: "export interface Signals"
    - path: "src/core/index.ts"
      provides: "score() entrypoint stub"
      contains: "export function score"
    - path: "src/core/llm/port.ts"
      provides: "LLMPort interface"
      contains: "export interface LLMPort"
    - path: "src/action/main.ts"
      provides: "Action entrypoint stub (Rollup input)"
      contains: "import { score }"
    - path: "dist/index.js"
      provides: "First successful Rollup bundle (walking skeleton stage A)"
      min_lines: 1
  key_links:
    - from: "src/action/main.ts"
      to: "src/core/index.ts (score function)"
      via: "ESM import with .js extension"
      pattern: "from '../core/index.js'"
    - from: "rollup input"
      to: "src/action/main.ts"
      via: "rollup.config.ts input field"
      pattern: "input: 'src/action/main.ts'"
    - from: "src/core/index.ts (score signature)"
      to: "src/core/types.ts (DTOs)"
      via: "TS type imports"
      pattern: "import type \\{ Issue, RepoContext, LLMPort, ScoredIssue \\}"
---

<objective>
Lock all Phase 1 DTOs in `src/core/types.ts`, define the `LLMPort` interface (stubbed for Phase 1, real implementation in Phase 4), and create a stub `score()` entrypoint plus stub `src/action/main.ts` that proves the Walking Skeleton wiring end-to-end. After this plan, `npm run package` succeeds and `dist/index.js` exists — even though the values inside are hardcoded.

**Purpose:** This is **Walking Skeleton Stage A** (per SKELETON.md). DTO contracts are the load-bearing decisions for every subsequent plan; defining them first prevents type churn during heuristic implementation. The hardcoded `score()` proves Rollup can bundle our actual entrypoint, all imports resolve with NodeNext + `.js` extensions, and the hexagonal core/adapters split holds (no Octokit imports inside `src/core/`).

**Output:** `src/core/types.ts`, `src/core/llm/port.ts`, `src/core/index.ts`, `src/action/main.ts`, type-test asserting DTO shapes, and a successful first build of `dist/index.js`.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/01-skeleton-heuristic-spine-first-comment/01-CONTEXT.md
@.planning/phases/01-skeleton-heuristic-spine-first-comment/01-RESEARCH.md
@.planning/phases/01-skeleton-heuristic-spine-first-comment/SKELETON.md
@.planning/research/ARCHITECTURE.md

<interfaces>
<!-- DTOs from SKELETON.md section A6 — these are LOCKED; implementer copies them verbatim -->
<!-- The types listed below are the source of truth; do NOT improvise additional fields in Phase 1 -->

```typescript
// src/core/types.ts (target file content — copy verbatim)
export interface Issue {
  title: string
  body: string
  labels: string[]
}

export interface Signals {
  hasCodeBlock: boolean
  hasStackTrace: boolean
  hasVersionMention: boolean
  hasReproKeywords: boolean
  hasExpectedActual: boolean
  hasMinimalExample: boolean
  hasImageOnly: boolean
}

export type IssueType = 'bug' | 'feature' | 'question'

export interface RepoContext {
  hasIssueForms: boolean
  hasMdTemplates: boolean
  hasContributing: boolean
  templates: unknown[]
}

export interface ChecklistItem {
  text: string
  signalKey?: keyof Signals
}

export interface ScoredIssue {
  score: number
  missing: string[]
  signals: Signals
  issueType: IssueType
  isGrayZone: boolean
  items: ChecklistItem[]
  tierUsed: string
}
```

```typescript
// src/core/llm/port.ts (target file content — copy verbatim)
import type { Issue, Signals, RepoContext } from '../types.js'

export interface LLMRequest {
  issue: Issue
  signals: Signals
  repoContext: RepoContext
}

export interface LLMVerdict {
  score: number
  rationale: string
  missing: string[]
}

export interface LLMPort {
  adjudicate(req: LLMRequest): Promise<LLMVerdict>
}
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Define core types and LLMPort, plus type-shape unit test</name>
  <read_first>
    - F:\Hackathon ideas\signal-oss\.planning\phases\01-skeleton-heuristic-spine-first-comment\SKELETON.md (section A6 — DTO definitions, A3 — hexagonal boundary)
    - F:\Hackathon ideas\signal-oss\tsconfig.json (verify NodeNext, strict)
  </read_first>
  <files>
    - src/core/types.ts
    - src/core/llm/port.ts
    - tests/core/types.test.ts
    - (delete) tests/smoke.test.ts
  </files>
  <behavior>
    - Test 1: A `Signals` literal with all 7 boolean fields type-checks; missing any field is a TS error (compile-time check; runtime test verifies the keys exist).
    - Test 2: An `IssueType` literal accepts exactly `'bug' | 'feature' | 'question'`.
    - Test 3: A `ScoredIssue` literal type-checks with all 7 fields populated.
    - Test 4: An `LLMPort` mock object satisfies the interface (has `adjudicate` returning a Promise).
    - Test 5: The 7 keys of a `Signals` object match exactly: `['hasCodeBlock','hasStackTrace','hasVersionMention','hasReproKeywords','hasExpectedActual','hasMinimalExample','hasImageOnly']`.
  </behavior>
  <action>
1. Create `src/core/types.ts` — copy the type definitions from the `<interfaces>` block above VERBATIM. Do NOT add fields, do NOT add JSDoc beyond a single header comment, do NOT improvise — these shapes are LOCKED for Phase 1 and must match SKELETON.md A6 exactly.

   Add this header comment to the top of `src/core/types.ts`:
   ```typescript
   // Phase 1 DTOs — locked in SKELETON.md section A6.
   // DO NOT add fields without updating SKELETON.md and notifying downstream phases.
   // Phase 2+ may EXTEND these types, but Phase 1 plans MUST NOT change their shape.
   ```

2. Create `src/core/llm/port.ts` — copy the `LLMRequest` / `LLMVerdict` / `LLMPort` definitions from the `<interfaces>` block VERBATIM. Note the `.js` extension on the relative import: `from '../types.js'` (NodeNext requirement; TypeScript resolves to `.ts`).

3. Delete `tests/smoke.test.ts` (Plan 01's placeholder — its job is done).

4. Create `tests/core/types.test.ts` with the 5 tests described in `<behavior>`:

   ```typescript
   import { describe, it, expect, expectTypeOf } from 'vitest'
   import type {
     Issue,
     Signals,
     IssueType,
     RepoContext,
     ChecklistItem,
     ScoredIssue,
   } from '../../src/core/types.js'
   import type { LLMPort, LLMRequest, LLMVerdict } from '../../src/core/llm/port.js'

   describe('Phase 1 DTO shapes', () => {
     it('Signals has exactly the 7 expected boolean keys', () => {
       const s: Signals = {
         hasCodeBlock: false,
         hasStackTrace: false,
         hasVersionMention: false,
         hasReproKeywords: false,
         hasExpectedActual: false,
         hasMinimalExample: false,
         hasImageOnly: false,
       }
       const keys = Object.keys(s).sort()
       expect(keys).toEqual([
         'hasCodeBlock',
         'hasExpectedActual',
         'hasImageOnly',
         'hasMinimalExample',
         'hasReproKeywords',
         'hasStackTrace',
         'hasVersionMention',
       ])
     })

     it('IssueType accepts only bug | feature | question', () => {
       const types: IssueType[] = ['bug', 'feature', 'question']
       expect(types).toHaveLength(3)
     })

     it('Issue, RepoContext, ChecklistItem, ScoredIssue compile with full shape', () => {
       const issue: Issue = { title: 't', body: 'b', labels: [] }
       const ctx: RepoContext = {
         hasIssueForms: false,
         hasMdTemplates: false,
         hasContributing: false,
         templates: [],
       }
       const item: ChecklistItem = { text: 'x', signalKey: 'hasCodeBlock' }
       const scored: ScoredIssue = {
         score: 5,
         missing: [],
         signals: {
           hasCodeBlock: false,
           hasStackTrace: false,
           hasVersionMention: false,
           hasReproKeywords: false,
           hasExpectedActual: false,
           hasMinimalExample: false,
           hasImageOnly: false,
         },
         issueType: 'bug',
         isGrayZone: true,
         items: [item],
         tierUsed: 'baseline',
       }
       expect(issue.body).toBe('b')
       expect(ctx.templates).toEqual([])
       expect(scored.score).toBe(5)
     })

     it('LLMPort interface is satisfied by a mock object', () => {
       const mockLLM: LLMPort = {
         async adjudicate(req: LLMRequest): Promise<LLMVerdict> {
           return { score: 5, rationale: 'mock', missing: [] }
         },
       }
       expectTypeOf(mockLLM.adjudicate).toBeFunction()
       expect(typeof mockLLM.adjudicate).toBe('function')
     })

     it('IssueType narrows correctly in switch', () => {
       function describe(t: IssueType): string {
         switch (t) {
           case 'bug': return 'b'
           case 'feature': return 'f'
           case 'question': return 'q'
         }
       }
       expect(describe('bug')).toBe('b')
       expect(describe('feature')).toBe('f')
       expect(describe('question')).toBe('q')
     })
   })
   ```
  </action>
  <verify>
    <automated>npm run test -- tests/core/types.test.ts</automated>
  </verify>
  <acceptance_criteria>
    - File `src/core/types.ts` exists and contains EXACT strings: `export interface Issue`, `export interface Signals`, `export type IssueType = 'bug' | 'feature' | 'question'`, `export interface RepoContext`, `export interface ChecklistItem`, `export interface ScoredIssue`.
    - File `src/core/types.ts` does NOT contain `import` from `@octokit`, `@actions`, `fs`, `https`, or any LLM SDK (run: `grep -E "from '(@octokit|@actions|fs|https|@anthropic-ai/sdk|openai)" src/core/types.ts` returns 0 lines).
    - File `src/core/llm/port.ts` exists and contains `export interface LLMPort` and `import type { Issue, Signals, RepoContext } from '../types.js'`.
    - File `tests/core/types.test.ts` exists and contains the literal string `Phase 1 DTO shapes`.
    - File `tests/smoke.test.ts` does NOT exist.
    - Running `npm run test -- tests/core/types.test.ts` exits 0 and reports `5 passed`.
  </acceptance_criteria>
  <done>
Locked DTOs are committed to `src/core/types.ts`. LLMPort interface is committed to `src/core/llm/port.ts`. Tests verify the shapes. Hexagonal boundary holds: zero side-effecting imports inside `src/core/`. The smoke test is deleted.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Implement score() stub + main.ts orchestrator stub + first Rollup build</name>
  <read_first>
    - F:\Hackathon ideas\signal-oss\src\core\types.ts (Task 1 — DTO shapes)
    - F:\Hackathon ideas\signal-oss\src\core\llm\port.ts (Task 1 — LLMPort)
    - F:\Hackathon ideas\signal-oss\rollup.config.ts (Plan 01 — input expected at src/action/main.ts)
    - F:\Hackathon ideas\signal-oss\.planning\phases\01-skeleton-heuristic-spine-first-comment\01-RESEARCH.md (Pattern 8 — main.ts orchestrator)
    - F:\Hackathon ideas\signal-oss\.planning\phases\01-skeleton-heuristic-spine-first-comment\SKELETON.md (Walking Skeleton diagram)
  </read_first>
  <files>
    - src/core/index.ts
    - src/action/main.ts
    - tests/core/score-stub.test.ts
    - dist/index.js
  </files>
  <behavior>
    - Test 1: `score()` called with a minimal valid Issue + empty RepoContext + null LLM returns a `ScoredIssue` whose `score` is a number 0–10.
    - Test 2: The returned `ScoredIssue.signals` object has all 7 expected boolean keys.
    - Test 3: The returned `ScoredIssue.issueType` is one of `'bug' | 'feature' | 'question'`.
    - Test 4: The returned `ScoredIssue.isGrayZone` is a boolean.
    - Test 5: The returned `ScoredIssue.items` is an array (length ≥ 0).
    - Test 6: `score()` is a synchronous function (returns ScoredIssue, not Promise<ScoredIssue>) — locks the signature for Phase 4 LLM integration where the Promise wrapping happens at the adapter, not at the entrypoint.
  </behavior>
  <action>
1. Create `src/core/index.ts` — the `score()` stub. The signature is **LOCKED**: it MUST match this exactly:

   ```typescript
   // src/core/index.ts
   // The pure score() entrypoint. PHASE 1: returns hardcoded values (Walking Skeleton stub).
   // Plan 04 replaces the stub body with the real heuristic pipeline.
   // CRITICAL: This file MUST NOT import from @octokit, @actions, fs, https, or any LLM SDK.

   import type { Issue, RepoContext, ScoredIssue, Signals } from './types.js'
   import type { LLMPort } from './llm/port.js'

   export function score(
     issue: Issue,
     repoContext: RepoContext,
     llm: LLMPort | null = null,
   ): ScoredIssue {
     // Phase 1 stub — Plan 04 replaces this body with extractSignals + classifyType + generateChecklist + computeScore.
     // The hardcoded values exist solely to prove the wiring works end-to-end (Walking Skeleton Stage A).
     // The fact that `repoContext` and `llm` parameters are accepted-but-unused is intentional: the signature is locked.
     void issue
     void repoContext
     void llm

     const signals: Signals = {
       hasCodeBlock: false,
       hasStackTrace: false,
       hasVersionMention: false,
       hasReproKeywords: false,
       hasExpectedActual: false,
       hasMinimalExample: false,
       hasImageOnly: false,
     }

     return {
       score: 5,
       missing: ['version'],
       signals,
       issueType: 'bug',
       isGrayZone: true,
       items: [{ text: 'Could you share your version?', signalKey: 'hasVersionMention' }],
       tierUsed: 'baseline-stub',
     }
   }
   ```

   Notes on the signature:
   - Sync return type `ScoredIssue` (NOT `Promise<ScoredIssue>`). Plan 04 keeps it sync; Phase 4 LLM integration handles async at the adapter boundary, not at the entrypoint, OR the signature changes in Phase 4 with explicit consensus. For Phase 1, sync.
   - `llm: LLMPort | null = null` — Phase 1 always passes `null`.
   - `void` statements suppress TS unused-param warnings without disabling strict mode.

2. Create `src/action/main.ts` — the orchestrator stub. This is the file Rollup bundles. Phase 1 Plan 05 replaces this with the real implementation; Plan 02 only needs enough to bundle:

   ```typescript
   // src/action/main.ts
   // Phase 1 stub — Plan 05 replaces this body with real Octokit calls + bot-loop guard + payload parsing.
   // For now: import score(), call it with a synthetic Issue, log the result, exit cleanly.
   // This proves the Walking Skeleton: ESM imports resolve, Rollup bundles, dist/index.js exists.

   import * as core from '@actions/core'
   import { score } from '../core/index.js'
   import type { Issue, RepoContext } from '../core/types.js'

   async function run(): Promise<void> {
     const stubIssue: Issue = {
       title: 'Stub issue (Plan 02 — replaced in Plan 05)',
       body: '',
       labels: [],
     }
     const stubRepoContext: RepoContext = {
       hasIssueForms: false,
       hasMdTemplates: false,
       hasContributing: false,
       templates: [],
     }

     const result = score(stubIssue, stubRepoContext, null)
     core.info(
       `Signal-OSS stub run — score=${result.score} type=${result.issueType} items=${result.items.length}`,
     )
   }

   run().catch((err) => {
     core.setFailed(err instanceof Error ? err.message : String(err))
   })
   ```

3. Create `tests/core/score-stub.test.ts`:

   ```typescript
   import { describe, it, expect } from 'vitest'
   import { score } from '../../src/core/index.js'
   import type { Issue, RepoContext } from '../../src/core/types.js'

   const minimalIssue: Issue = { title: 't', body: '', labels: [] }
   const emptyRepoContext: RepoContext = {
     hasIssueForms: false,
     hasMdTemplates: false,
     hasContributing: false,
     templates: [],
   }

   describe('score() stub (Walking Skeleton Stage A)', () => {
     it('returns a ScoredIssue with score in [0,10]', () => {
       const r = score(minimalIssue, emptyRepoContext, null)
       expect(typeof r.score).toBe('number')
       expect(r.score).toBeGreaterThanOrEqual(0)
       expect(r.score).toBeLessThanOrEqual(10)
     })

     it('signals object has all 7 expected boolean keys', () => {
       const r = score(minimalIssue, emptyRepoContext, null)
       expect(Object.keys(r.signals).sort()).toEqual([
         'hasCodeBlock',
         'hasExpectedActual',
         'hasImageOnly',
         'hasMinimalExample',
         'hasReproKeywords',
         'hasStackTrace',
         'hasVersionMention',
       ])
     })

     it('issueType is one of bug | feature | question', () => {
       const r = score(minimalIssue, emptyRepoContext, null)
       expect(['bug', 'feature', 'question']).toContain(r.issueType)
     })

     it('isGrayZone is a boolean', () => {
       const r = score(minimalIssue, emptyRepoContext, null)
       expect(typeof r.isGrayZone).toBe('boolean')
     })

     it('items is an array', () => {
       const r = score(minimalIssue, emptyRepoContext, null)
       expect(Array.isArray(r.items)).toBe(true)
     })

     it('score() is synchronous (does not return a Promise)', () => {
       const r = score(minimalIssue, emptyRepoContext, null)
       // If score were async, r would be a Promise and `.score` would be undefined.
       expect(r).not.toBeInstanceOf(Promise)
       expect(r.score).toBe(5) // stub value
     })
   })
   ```

4. Run `npm run package` to produce `dist/index.js` for the first time. This is **Walking Skeleton Stage A** — the bundle exists, contains the stub `score()` and `main.ts`. Verify it exists and is non-empty.

5. **Verify hexagonal invariant** by grep — `src/core/` MUST have zero side-effecting imports:
   ```bash
   grep -rn -E "from ['\"](@octokit|@actions|fs|https|@anthropic-ai/sdk|openai)" src/core/
   # Must return 0 lines
   ```
  </action>
  <verify>
    <automated>npm run test -- tests/core/score-stub.test.ts &amp;&amp; npm run package &amp;&amp; node -e "const fs=require('fs'); const s=fs.statSync('dist/index.js'); if(s.size&lt;100) process.exit(1); console.log('dist/index.js size:', s.size)" &amp;&amp; node -e "const {execSync}=require('child_process'); const out=execSync('grep -rE \"from [\\x27\\x22](@octokit|@actions|fs|https|@anthropic-ai/sdk|openai)\" src/core/ || true').toString(); if(out.trim().length&gt;0){console.error('HEXAGONAL VIOLATION:',out);process.exit(1)} console.log('hexagonal OK')"</automated>
  </verify>
  <acceptance_criteria>
    - File `src/core/index.ts` exists and contains `export function score`.
    - File `src/core/index.ts` contains the literal string `LLMPort | null = null` (signature lock).
    - File `src/core/index.ts` does NOT contain `async function score` or `Promise<ScoredIssue>` in its return-type position (Phase 1 sync).
    - File `src/action/main.ts` exists and contains `import { score } from '../core/index.js'` (verbatim, including `.js` extension).
    - File `src/action/main.ts` contains `import * as core from '@actions/core'`.
    - File `tests/core/score-stub.test.ts` exists and contains the test name `Walking Skeleton Stage A`.
    - Running `npm run test -- tests/core/score-stub.test.ts` exits 0 and reports `6 passed`.
    - Running `npm run package` exits 0.
    - File `dist/index.js` exists and is at least 100 bytes (Rollup output).
    - **Hexagonal invariant:** running `grep -rE "from ['\\\"](@octokit|@actions|fs|https|@anthropic-ai/sdk|openai)" src/core/` returns 0 matching lines.
  </acceptance_criteria>
  <done>
Walking Skeleton Stage A is complete. score() exists with locked signature, main.ts imports and calls it, Rollup successfully bundles to dist/index.js, and the hexagonal core/adapters split is enforced (verified by grep). The pipeline is wired even though the values inside score() are hardcoded — Plan 03 + 04 + 05 fill in the real logic.
  </done>
</task>

</tasks>

<verification>
End-to-end verification of Plan 02:

```bash
# DTO shapes locked
grep -E "export interface (Issue|Signals|RepoContext|ChecklistItem|ScoredIssue)" src/core/types.ts | wc -l   # 5
grep "export type IssueType" src/core/types.ts                                                              # present
grep "export interface LLMPort" src/core/llm/port.ts                                                        # present

# score() signature locked
grep "export function score" src/core/index.ts
grep "LLMPort | null = null" src/core/index.ts

# Hexagonal invariant
grep -rE "from ['\"](@octokit|@actions|fs|https|@anthropic-ai/sdk|openai)" src/core/    # 0 lines

# main.ts imports score()
grep "import { score } from '../core/index.js'" src/action/main.ts

# Rollup bundle exists
test -f dist/index.js && echo "OK"

# All tests pass
npm run test    # types.test.ts (5) + score-stub.test.ts (6) = 11 passing
```
</verification>

<success_criteria>
- DTOs locked in `src/core/types.ts` exactly per SKELETON.md A6.
- LLMPort interface locked in `src/core/llm/port.ts`.
- `score()` entrypoint exists with signature `score(issue, repoContext, llm = null) → ScoredIssue` (sync).
- `src/action/main.ts` imports `score` and is the Rollup input — bundles successfully.
- `dist/index.js` exists for the first time (Walking Skeleton Stage A).
- Hexagonal invariant verified by grep: zero side-effecting imports inside `src/core/`.
- 11/11 tests pass (5 type tests + 6 score-stub tests).
</success_criteria>

<output>
After completion, create `.planning/phases/01-skeleton-heuristic-spine-first-comment/01-02-SUMMARY.md` documenting:
- Confirmed: DTO shapes match SKELETON.md A6 verbatim
- Confirmed: hexagonal invariant holds (grep result)
- The size of `dist/index.js` after first build (signal of bundle bloat — should be small)
- Any TypeScript strict-mode warnings encountered and how they were resolved
</output>

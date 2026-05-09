---
id: 01-04-checklist-score-format
phase: 01-skeleton-heuristic-spine-first-comment
plan: 04
type: execute
wave: 4
depends_on: [01-03-heuristics-classifier]
files_modified:
  - src/core/checklist/generator.ts
  - src/core/checklist/strategies/baseline.ts
  - src/core/checklist/baselines.ts
  - src/core/score/weights.ts
  - src/core/score/compute.ts
  - src/core/format/markdown.ts
  - src/core/index.ts
  - tests/core/checklist.test.ts
  - tests/core/score.test.ts
  - tests/core/format.test.ts
requirements:
  - CORE-01
  - CORE-04
  - CORE-05
  - CORE-06
  - CHECK-01
  - CHECK-02
autonomous: true
tags: [checklist, score, format, tone, walking-skeleton]

must_haves:
  truths:
    - "Strategy chain interface (CHECK-01) is defined; chain runs first-applies-wins"
    - "BaselineStrategy (CHECK-02) is in the chain and always returns a non-empty list (3-4 items per type)"
    - "Tier-4 baseline checklists exist for bug/feature/question with 'Could you share...' framing (D-06, CORE-06)"
    - "Items already satisfied by signals are filtered out before rendering (e.g., hasStackTrace=true → no 'share error messages' item)"
    - "computeScore(signals) returns score in [0,10] integer; isGrayZone true iff 4 ≤ score ≤ 6 (D-13)"
    - "format(scoredIssue) renders markdown comment per D-07 structure: intro → checklist → score badge → meta-nudge → closing → marker"
    - "When checklist is empty (high-quality issue), intro adapts to 'This issue looks well-formed' but comment STILL POSTS (D-09 — hero-output-always invariant)"
    - "Comment passes tone test: no 'Required:', 'Must:', or 'Invalid' anywhere in output"
    - "score() entrypoint in src/core/index.ts is replaced with the real pipeline calling extractSignals → classifyType → generateChecklist → computeScore"
  artifacts:
    - path: "src/core/checklist/generator.ts"
      provides: "Strategy chain runner — first-applies-wins"
      contains: "export function generateChecklist"
    - path: "src/core/checklist/strategies/baseline.ts"
      provides: "Tier 4 BaselineStrategy — always applies"
      contains: "export class BaselineStrategy"
    - path: "src/core/checklist/baselines.ts"
      provides: "Per-IssueType item lists with 'Could you share...' framing"
      contains: "BASELINE_ITEMS"
    - path: "src/core/score/weights.ts"
      provides: "WEIGHTS const + GRAY_ZONE_LOW=4, GRAY_ZONE_HIGH=6"
      contains: "export const GRAY_ZONE_LOW = 4"
    - path: "src/core/score/compute.ts"
      provides: "computeScore(signals) → { score, isGrayZone }"
      contains: "export function computeScore"
    - path: "src/core/format/markdown.ts"
      provides: "format(scoredIssue) → markdown string per D-07"
      contains: "<!-- signal-oss:v1 -->"
    - path: "src/core/index.ts"
      provides: "Final score() entrypoint — real pipeline (no longer stub)"
      contains: "extractSignals(issue)"
  key_links:
    - from: "src/core/index.ts"
      to: "extractSignals + classifyType + generateChecklist + computeScore"
      via: "ESM imports with .js extensions"
      pattern: "import \\{ extractSignals \\}|import \\{ classifyType \\}|import \\{ generateChecklist \\}|import \\{ computeScore \\}"
    - from: "src/core/format/markdown.ts"
      to: "<!-- signal-oss:v1 --> idempotency marker"
      via: "literal string in output"
      pattern: "signal-oss:v1"
    - from: "BaselineStrategy.generate()"
      to: "BASELINE_ITEMS per IssueType"
      via: "lookup + signal-based filtering"
      pattern: "BASELINE_ITEMS\\["
---

<objective>
Build the rest of the pure scoring pipeline: the strategy-chain checklist generator (CHECK-01) with the Tier-4 universal baseline (CHECK-02), the weighted-sum score with gray-zone band (CORE-04), and the markdown output formatter that passes the tone style guide (CORE-05, CORE-06). Then **replace the Plan 02 `score()` stub** with the real pipeline that calls all four functions in sequence (CORE-01).

After this plan, given any `Issue` + empty `RepoContext` + `null` LLM, `format(score(...))` produces the exact markdown comment that will be posted to GitHub in Plan 05. Walking Skeleton Stage A (hardcoded stub) → end-of-Plan-04 = real-output-but-unposted.

**Purpose:** This plan is where the *hero output* takes shape. The end-of-Plan-04 deliverable is: given a real-shaped issue body, the `format(score(...))` string output is the comment that will land on GitHub. Plan 05 only adds the wiring to push that string through Octokit.

**Output:** 6 new TS modules under `src/core/`, 3 new test files (~40 tests total), and a rewritten `src/core/index.ts` whose `score()` is no longer a stub.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/01-skeleton-heuristic-spine-first-comment/01-CONTEXT.md
@.planning/phases/01-skeleton-heuristic-spine-first-comment/01-RESEARCH.md
@.planning/phases/01-skeleton-heuristic-spine-first-comment/SKELETON.md
@src/core/types.ts
@src/core/heuristics/extractor.ts
@src/core/classifier/issue-type.ts

<interfaces>
<!-- D-07 comment structure (CONTEXT.md) — implementer renders this exact layout -->
1. Intro line (adapts: missing-info case vs well-formed case)
2. Checklist items (front-and-center; the hero output)
3. Score badge: `**Actionability score: X/10**`
4. Meta-nudge stub (D-08): `> **Tip:** adding an issue template ...`  ← always shown in Phase 1
5. Closing line (adapts: missing-info case vs well-formed case)
6. `<!-- signal-oss:v1 -->` HTML idempotency marker on its own line

<!-- Strategy chain interface (CHECK-01, RESEARCH Pattern 2) -->
```typescript
export interface ChecklistStrategy {
  name: string
  applies(ctx: RepoContext): boolean
  generate(type: IssueType, signals: Signals): ChecklistItem[]
}
```

<!-- Initial weights (RESEARCH Pattern 3) — Claude's discretion per D-14 -->
```typescript
export const WEIGHTS = {
  hasCodeBlock:        1.5,
  hasStackTrace:       2.0,
  hasVersionMention:   1.5,
  hasReproKeywords:    1.5,
  hasExpectedActual:   1.5,
  hasMinimalExample:   2.0,
  hasImageOnly:       -1.0,
} as const

export const GRAY_ZONE_LOW  = 4
export const GRAY_ZONE_HIGH = 6
export const MAX_SCORE      = 10
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Implement checklist generator + Tier-4 BaselineStrategy + score computer with weights</name>
  <read_first>
    - F:\Hackathon ideas\signal-oss\src\core\types.ts (ChecklistItem, ChecklistStrategy is NEW — ChecklistItem already exists)
    - F:\Hackathon ideas\signal-oss\.planning\phases\01-skeleton-heuristic-spine-first-comment\01-RESEARCH.md (Pattern 2 — Strategy Chain; Pattern 3 — Score Computation; "Tier-4 Baseline Checklist Content")
    - F:\Hackathon ideas\signal-oss\.planning\phases\01-skeleton-heuristic-spine-first-comment\01-CONTEXT.md (D-05, D-06, D-13, D-14)
  </read_first>
  <files>
    - src/core/checklist/generator.ts
    - src/core/checklist/strategies/baseline.ts
    - src/core/checklist/baselines.ts
    - src/core/score/weights.ts
    - src/core/score/compute.ts
    - tests/core/checklist.test.ts
    - tests/core/score.test.ts
  </files>
  <behavior>
    Checklist:
    - Strategy chain runs in order; first `applies()` returns true wins.
    - BaselineStrategy.applies() always returns true (Phase 1).
    - BaselineStrategy.generate(type, signals) returns 3-4 items for the requested type, with items satisfied by signals removed.
    - bug: items asking for repro steps, version, error/stack trace, minimal repro.
    - feature: items asking for problem statement, example usage, alternatives.
    - question: items asking for what's been tried, version/env, minimal example.
    - All items use "Could you share..." or equivalent question framing — NEVER "Required:", "Must:", "Invalid", "Missing:".
    - Each item has an optional `signalKey` so tests can verify filtering.

    Score:
    - All-false signals → score 0 (clamped from possibly-negative raw weighted sum).
    - All-true signals (all 6 positive + hasImageOnly negative) → score in [0,10] integer; with default weights ≈ 9.
    - All-true signals EXCEPT hasImageOnly=false → still in [0,10].
    - score is rounded; `isGrayZone` true iff 4 ≤ score ≤ 6.
    - Score in [0,3] → !isGrayZone. Score in [7,10] → !isGrayZone.
  </behavior>
  <action>
1. **Update `src/core/types.ts`** — add the `ChecklistStrategy` interface. This is the only addition to the locked DTO file in Phase 1; SKELETON.md A6 implicitly allows it (the interface is referenced as a "load-bearing pattern" in CHECK-01). Add at the bottom of `types.ts`:

   ```typescript
   // Strategy chain interface (CHECK-01). Phase 1: only BaselineStrategy implements this.
   // Phase 2 adds IssueFormStrategy, TemplateMdStrategy. Phase 4 adds ContributingStrategy.
   export interface ChecklistStrategy {
     name: string
     applies(ctx: RepoContext): boolean
     generate(type: IssueType, signals: Signals): ChecklistItem[]
   }
   ```

2. **Create `src/core/checklist/baselines.ts`**:

   ```typescript
   // src/core/checklist/baselines.ts
   // Tier-4 (CHECK-02) baseline checklist content per IssueType.
   // 3-4 items each (D-05). 'Could you share...' question framing (D-06, CORE-06).
   // Each item has a signalKey so satisfied items can be filtered out.

   import type { ChecklistItem, IssueType } from '../types.js'

   export const BASELINE_ITEMS: Record<IssueType, readonly ChecklistItem[]> = {
     bug: [
       { text: 'Could you share the steps to reproduce the issue?', signalKey: 'hasReproKeywords' },
       { text: "Could you share the version of the library/tool you're using?", signalKey: 'hasVersionMention' },
       { text: 'Could you share any error messages or stack traces you saw?', signalKey: 'hasStackTrace' },
       { text: 'Could you provide a minimal reproduction (a small code snippet)?', signalKey: 'hasMinimalExample' },
     ],
     feature: [
       { text: 'Could you describe the problem this feature would solve?' },
       { text: "Could you share example code showing how you'd expect to use it?", signalKey: 'hasMinimalExample' },
       { text: "Could you describe any alternatives you've considered?" },
     ],
     question: [
       { text: "Could you share what you've already tried?" },
       { text: 'Could you share the relevant version or environment details?', signalKey: 'hasVersionMention' },
       { text: 'Could you provide a minimal example that shows your setup?', signalKey: 'hasMinimalExample' },
     ],
   }
   ```

3. **Create `src/core/checklist/strategies/baseline.ts`**:

   ```typescript
   // src/core/checklist/strategies/baseline.ts
   // Tier 4: Universal Baseline Strategy. Always applies (last in chain).

   import type { ChecklistItem, ChecklistStrategy, IssueType, RepoContext, Signals } from '../../types.js'
   import { BASELINE_ITEMS } from '../baselines.js'

   export class BaselineStrategy implements ChecklistStrategy {
     name = 'baseline'

     applies(_ctx: RepoContext): boolean {
       return true
     }

     generate(type: IssueType, signals: Signals): ChecklistItem[] {
       const items = BASELINE_ITEMS[type]
       // Filter out items already satisfied by signals (per RESEARCH "Filtering logic")
       return items.filter((item) => {
         if (!item.signalKey) return true
         return signals[item.signalKey] === false
       })
     }
   }
   ```

4. **Create `src/core/checklist/generator.ts`**:

   ```typescript
   // src/core/checklist/generator.ts
   // CHECK-01: Strategy chain runner. First-applies-wins.

   import type { ChecklistItem, ChecklistStrategy, IssueType, RepoContext, Signals } from '../types.js'
   import { BaselineStrategy } from './strategies/baseline.js'

   const STRATEGIES: ChecklistStrategy[] = [
     // Phase 2 prepends: IssueFormStrategy, TemplateMdStrategy
     // Phase 4 prepends:  ContributingStrategy
     new BaselineStrategy(),
   ]

   export function generateChecklist(
     signals: Signals,
     type: IssueType,
     ctx: RepoContext,
   ): { items: ChecklistItem[]; tierUsed: string } {
     for (const s of STRATEGIES) {
       if (s.applies(ctx)) {
         return { items: s.generate(type, signals), tierUsed: s.name }
       }
     }
     // Unreachable: BaselineStrategy.applies() always returns true.
     throw new Error('No checklist strategy applied — BaselineStrategy must always apply')
   }
   ```

5. **Create `src/core/score/weights.ts`**:

   ```typescript
   // src/core/score/weights.ts
   // CORE-04: per-signal weights and gray-zone band.
   // D-13: Initial gray-zone band 4-6 (symmetric around midpoint). Tunable in Phase 3.
   // D-14: Weights are internal constants — NOT action inputs.

   export const WEIGHTS = {
     hasCodeBlock:        1.5,
     hasStackTrace:       2.0,
     hasVersionMention:   1.5,
     hasReproKeywords:    1.5,
     hasExpectedActual:   1.5,
     hasMinimalExample:   2.0,
     hasImageOnly:       -1.0,
   } as const

   export const GRAY_ZONE_LOW  = 4
   export const GRAY_ZONE_HIGH = 6
   export const MAX_SCORE      = 10
   ```

6. **Create `src/core/score/compute.ts`**:

   ```typescript
   // src/core/score/compute.ts
   // CORE-04: weighted-sum heuristic score 0-10.

   import type { Signals } from '../types.js'
   import { GRAY_ZONE_HIGH, GRAY_ZONE_LOW, MAX_SCORE, WEIGHTS } from './weights.js'

   export function computeScore(signals: Signals): { score: number; isGrayZone: boolean } {
     let raw = 0
     for (const [key, weight] of Object.entries(WEIGHTS) as Array<[keyof Signals, number]>) {
       if (signals[key]) raw += weight
     }
     const score = Math.max(0, Math.min(MAX_SCORE, Math.round(raw)))
     const isGrayZone = score >= GRAY_ZONE_LOW && score <= GRAY_ZONE_HIGH
     return { score, isGrayZone }
   }
   ```

7. **Create `tests/core/checklist.test.ts`**:

   ```typescript
   import { describe, it, expect } from 'vitest'
   import { generateChecklist } from '../../src/core/checklist/generator.js'
   import type { RepoContext, Signals } from '../../src/core/types.js'

   const EMPTY_CTX: RepoContext = {
     hasIssueForms: false,
     hasMdTemplates: false,
     hasContributing: false,
     templates: [],
   }
   const ZERO_SIGNALS: Signals = {
     hasCodeBlock: false, hasStackTrace: false, hasVersionMention: false,
     hasReproKeywords: false, hasExpectedActual: false,
     hasMinimalExample: false, hasImageOnly: false,
   }

   describe('generateChecklist — Tier 4 baseline always applies', () => {
     it('bug type with zero signals → 4 baseline items', () => {
       const r = generateChecklist(ZERO_SIGNALS, 'bug', EMPTY_CTX)
       expect(r.tierUsed).toBe('baseline')
       expect(r.items).toHaveLength(4)
       r.items.forEach((i) => expect(i.text).toMatch(/^Could you/))
     })

     it('feature type with zero signals → 3 baseline items', () => {
       const r = generateChecklist(ZERO_SIGNALS, 'feature', EMPTY_CTX)
       expect(r.items.length).toBeGreaterThanOrEqual(3)
       r.items.forEach((i) => expect(i.text).toMatch(/^Could you/))
     })

     it('question type with zero signals → 3 baseline items', () => {
       const r = generateChecklist(ZERO_SIGNALS, 'question', EMPTY_CTX)
       expect(r.items.length).toBeGreaterThanOrEqual(3)
       r.items.forEach((i) => expect(i.text).toMatch(/^Could you/))
     })
   })

   describe('generateChecklist — signal-based filtering', () => {
     it('bug with hasStackTrace=true → no "error messages or stack traces" item', () => {
       const sig = { ...ZERO_SIGNALS, hasStackTrace: true }
       const r = generateChecklist(sig, 'bug', EMPTY_CTX)
       expect(r.items.find((i) => i.signalKey === 'hasStackTrace')).toBeUndefined()
       expect(r.items.length).toBeLessThan(4)
     })

     it('bug with hasVersionMention=true → no version item', () => {
       const sig = { ...ZERO_SIGNALS, hasVersionMention: true }
       const r = generateChecklist(sig, 'bug', EMPTY_CTX)
       expect(r.items.find((i) => i.signalKey === 'hasVersionMention')).toBeUndefined()
     })

     it('bug with all bug-relevant signals true → empty list (high-quality issue)', () => {
       const sig: Signals = {
         hasCodeBlock: true,
         hasStackTrace: true,
         hasVersionMention: true,
         hasReproKeywords: true,
         hasExpectedActual: true,
         hasMinimalExample: true,
         hasImageOnly: false,
       }
       const r = generateChecklist(sig, 'bug', EMPTY_CTX)
       expect(r.items).toHaveLength(0)
     })

     it('items lacking a signalKey are never filtered', () => {
       const sig: Signals = {
         ...ZERO_SIGNALS,
         hasMinimalExample: true,
         hasVersionMention: true,
       }
       const r = generateChecklist(sig, 'feature', EMPTY_CTX)
       // feature items: problem-statement (no key), example-usage (hasMinimalExample), alternatives (no key)
       expect(r.items.length).toBeGreaterThanOrEqual(2) // 2 keyless items remain
       r.items.forEach((i) => expect(i.signalKey).toBeUndefined())
     })
   })

   describe('generateChecklist — tone style guide (CORE-06)', () => {
     it('no item contains forbidden words "Required", "Must", "Invalid", "Missing:"', () => {
       const types: Array<'bug' | 'feature' | 'question'> = ['bug', 'feature', 'question']
       types.forEach((type) => {
         const r = generateChecklist(ZERO_SIGNALS, type, EMPTY_CTX)
         r.items.forEach((i) => {
           expect(i.text).not.toMatch(/\bRequired\b|\bMust\b|\bInvalid\b|\bMissing:/i)
         })
       })
     })
   })
   ```

8. **Create `tests/core/score.test.ts`**:

   ```typescript
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
   ```
  </action>
  <verify>
    <automated>npm run test -- tests/core/checklist.test.ts tests/core/score.test.ts</automated>
  </verify>
  <acceptance_criteria>
    - Files `src/core/checklist/generator.ts`, `src/core/checklist/strategies/baseline.ts`, `src/core/checklist/baselines.ts`, `src/core/score/weights.ts`, `src/core/score/compute.ts` all exist.
    - `src/core/types.ts` contains `export interface ChecklistStrategy` with `applies` and `generate` methods.
    - `src/core/checklist/baselines.ts` contains 3 keys in `BASELINE_ITEMS`: `bug`, `feature`, `question`.
    - All baseline items start with the literal string `Could you` (run: every item.text in BASELINE_ITEMS starts with "Could you").
    - `src/core/checklist/baselines.ts` does NOT contain the forbidden tone words (run: `grep -iE '\\bRequired\\b|\\bMust\\b|\\bInvalid\\b|Missing:' src/core/checklist/baselines.ts` returns 0 lines).
    - `src/core/score/weights.ts` contains the literal strings `GRAY_ZONE_LOW = 4` and `GRAY_ZONE_HIGH = 6`.
    - `src/core/checklist/generator.ts` contains `new BaselineStrategy()` in a strategy array.
    - Running `npm run test -- tests/core/checklist.test.ts tests/core/score.test.ts` exits 0 with all tests passing (≥ 14 tests).
    - Hexagonal invariant still holds: `grep -rE "from ['\\\"](@octokit|@actions|fs|https|@anthropic-ai/sdk|openai)" src/core/` returns 0 lines.
  </acceptance_criteria>
  <done>
CHECK-01 (strategy chain), CHECK-02 (Tier 4 baseline), CORE-04 (score with gray-zone band) are all delivered. Tone style guide enforced by tests. Items already satisfied by signals are filtered. Hexagonal boundary preserved.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Implement format() + replace score() stub with real pipeline + final dist build</name>
  <read_first>
    - F:\Hackathon ideas\signal-oss\src\core\index.ts (Plan 02 stub — to be replaced)
    - F:\Hackathon ideas\signal-oss\src\core\heuristics\extractor.ts (Plan 03)
    - F:\Hackathon ideas\signal-oss\src\core\classifier\issue-type.ts (Plan 03)
    - F:\Hackathon ideas\signal-oss\src\core\checklist\generator.ts (Task 1 of this plan)
    - F:\Hackathon ideas\signal-oss\src\core\score\compute.ts (Task 1 of this plan)
    - F:\Hackathon ideas\signal-oss\.planning\phases\01-skeleton-heuristic-spine-first-comment\01-RESEARCH.md (Pattern 5 — Comment Format D-07 structure)
    - F:\Hackathon ideas\signal-oss\.planning\phases\01-skeleton-heuristic-spine-first-comment\01-CONTEXT.md (D-07, D-08, D-09)
  </read_first>
  <files>
    - src/core/format/markdown.ts
    - src/core/index.ts
    - tests/core/format.test.ts
  </files>
  <behavior>
    Format:
    - Input: ScoredIssue.
    - Output: a single string. Six sections joined by `\n\n`:
      1. Intro: if items.length > 0 → "Thanks for opening this issue! To help us investigate, a few things seem to be missing:"; else (D-09) → "This issue looks well-formed — no missing info detected."
      2. Checklist: if items.length > 0 → `- [ ] {text}` lines joined by `\n`; else: omitted (filtered).
      3. Score badge: `**Actionability score: {score}/10**`.
      4. Meta-nudge stub (D-08, always shown in Phase 1 — no template detection yet): `> **Tip:** adding an issue template to \`.github/ISSUE_TEMPLATE/\` helps reporters include the right information upfront.`
      5. Closing: if items.length > 0 → "Once these are added, we'll take another look. Thanks for helping make this actionable!"; else: omitted.
      6. Marker: `<!-- signal-oss:v1 -->`.
    - Tone test: output never contains "Required:", "Must:", or "Invalid".
    - Marker is always present.

    score() final pipeline (replaces stub):
    - extractSignals(issue) → signals
    - classifyType(issue, signals) → issueType
    - generateChecklist(signals, issueType, repoContext) → { items, tierUsed }
    - computeScore(signals) → { score, isGrayZone }
    - Build `missing` from items[].text (the missing list is the human-readable version).
    - Return ScoredIssue with all fields populated.
    - Sync return; llm parameter accepted but unused in Phase 1 (Phase 4 wires it).
  </behavior>
  <action>
1. **Create `src/core/format/markdown.ts`**:

   ```typescript
   // src/core/format/markdown.ts
   // CORE-05: markdown comment formatter per D-07.
   // CORE-06: tone style guide enforced by no 'Required:' / 'Must:' / 'Invalid' static strings here.
   // ACT-05: emits the <!-- signal-oss:v1 --> idempotency marker.

   import type { ScoredIssue } from '../types.js'

   export const MARKER = '<!-- signal-oss:v1 -->'

   const INTRO_HAS_ITEMS  = 'Thanks for opening this issue! To help us investigate, a few things seem to be missing:'
   const INTRO_NO_ITEMS   = 'This issue looks well-formed — no missing info detected.'
   const META_NUDGE       = '> **Tip:** adding an issue template to `.github/ISSUE_TEMPLATE/` helps reporters include the right information upfront.'
   const CLOSING_HAS_ITEMS = "Once these are added, we'll take another look. Thanks for helping make this actionable!"

   export function format(scored: ScoredIssue): string {
     const { items, score } = scored
     const hasItems = items.length > 0

     const intro = hasItems ? INTRO_HAS_ITEMS : INTRO_NO_ITEMS
     const checklist = hasItems
       ? items.map((i) => `- [ ] ${i.text}`).join('\n')
       : ''
     const badge = `**Actionability score: ${score}/10**`
     const closing = hasItems ? CLOSING_HAS_ITEMS : ''

     // Filter empty sections; preserve D-07 ordering.
     const sections = [intro, checklist, badge, META_NUDGE, closing, MARKER]
       .filter((s) => s.length > 0)

     return sections.join('\n\n')
   }
   ```

2. **REPLACE `src/core/index.ts`** — remove the Plan 02 stub body, wire the real pipeline:

   ```typescript
   // src/core/index.ts
   // CORE-01: pure score() entrypoint. Real pipeline (no longer Plan 02 stub).
   // PHASE 1: llm parameter is accepted but always passed null. Phase 4 wires it.
   // CRITICAL: This file MUST NOT import from @octokit, @actions, fs, https, or any LLM SDK.

   import { extractSignals } from './heuristics/extractor.js'
   import { classifyType } from './classifier/issue-type.js'
   import { generateChecklist } from './checklist/generator.js'
   import { computeScore } from './score/compute.js'
   import type { Issue, RepoContext, ScoredIssue } from './types.js'
   import type { LLMPort } from './llm/port.js'

   export function score(
     issue: Issue,
     repoContext: RepoContext,
     llm: LLMPort | null = null,
   ): ScoredIssue {
     // Phase 1: llm is always null. Phase 4 will wire gray-zone adjudication here.
     void llm

     const signals = extractSignals(issue)
     const issueType = classifyType(issue, signals)
     const { items, tierUsed } = generateChecklist(signals, issueType, repoContext)
     const { score: scoreValue, isGrayZone } = computeScore(signals)

     return {
       score: scoreValue,
       missing: items.map((i) => i.text),
       signals,
       issueType,
       isGrayZone,
       items,
       tierUsed,
     }
   }
   ```

3. **Create `tests/core/format.test.ts`**:

   ```typescript
   import { describe, it, expect } from 'vitest'
   import { format, MARKER } from '../../src/core/format/markdown.js'
   import type { ScoredIssue, Signals } from '../../src/core/types.js'

   const ZERO_SIGNALS: Signals = {
     hasCodeBlock: false, hasStackTrace: false, hasVersionMention: false,
     hasReproKeywords: false, hasExpectedActual: false,
     hasMinimalExample: false, hasImageOnly: false,
   }

   function makeScored(over: Partial<ScoredIssue>): ScoredIssue {
     return {
       score: 5, missing: [], signals: ZERO_SIGNALS, issueType: 'bug',
       isGrayZone: true, items: [], tierUsed: 'baseline',
       ...over,
     }
   }

   describe('format() — D-07 structure with items', () => {
     it('contains intro, checklist, badge, meta-nudge, closing, marker — in order', () => {
       const md = format(makeScored({
         items: [{ text: 'Could you share your version?' }],
         score: 3,
       }))
       const introIdx = md.indexOf('Thanks for opening this issue')
       const checklistIdx = md.indexOf('- [ ] Could you share your version?')
       const badgeIdx = md.indexOf('Actionability score: 3/10')
       const nudgeIdx = md.indexOf('Tip: adding an issue template')
       const closingIdx = md.indexOf("Once these are added")
       const markerIdx = md.indexOf(MARKER)
       expect(introIdx).toBeGreaterThanOrEqual(0)
       expect(checklistIdx).toBeGreaterThan(introIdx)
       expect(badgeIdx).toBeGreaterThan(checklistIdx)
       expect(nudgeIdx).toBeGreaterThan(badgeIdx)
       expect(closingIdx).toBeGreaterThan(nudgeIdx)
       expect(markerIdx).toBeGreaterThan(closingIdx)
     })

     it('renders task-list checkboxes for all items', () => {
       const md = format(makeScored({
         items: [{ text: 'a' }, { text: 'b' }, { text: 'c' }],
         score: 4,
       }))
       expect(md).toContain('- [ ] a')
       expect(md).toContain('- [ ] b')
       expect(md).toContain('- [ ] c')
     })

     it('badge shows correct score', () => {
       expect(format(makeScored({ score: 9, items: [{ text: 'x' }] }))).toContain('**Actionability score: 9/10**')
     })
   })

   describe('format() — D-09 well-formed branch (empty checklist)', () => {
     it('uses well-formed intro when no items', () => {
       const md = format(makeScored({ items: [], score: 9 }))
       expect(md).toContain('This issue looks well-formed')
       expect(md).not.toContain('Thanks for opening this issue! To help us investigate')
     })

     it('omits checklist section when no items', () => {
       const md = format(makeScored({ items: [], score: 9 }))
       expect(md).not.toContain('- [ ]')
     })

     it('omits closing line when no items', () => {
       const md = format(makeScored({ items: [], score: 9 }))
       expect(md).not.toContain("Once these are added")
     })

     it('still emits score badge, meta-nudge, marker (hero-output-always invariant)', () => {
       const md = format(makeScored({ items: [], score: 9 }))
       expect(md).toContain('Actionability score: 9/10')
       expect(md).toContain('Tip: adding an issue template')
       expect(md).toContain(MARKER)
     })
   })

   describe('format() — tone style guide (CORE-06)', () => {
     it('output contains no forbidden words: Required:, Must:, Invalid', () => {
       const cases = [
         makeScored({ items: [{ text: 'Could you share x?' }] }),
         makeScored({ items: [] }),
       ]
       cases.forEach((s) => {
         const md = format(s)
         expect(md).not.toMatch(/Required:/)
         expect(md).not.toMatch(/\bMust\b/)
         expect(md).not.toMatch(/\bInvalid\b/)
       })
     })
   })

   describe('format() — idempotency marker (ACT-05)', () => {
     it('always emits exactly one marker', () => {
       const md = format(makeScored({ items: [{ text: 'x' }] }))
       const occurrences = md.split(MARKER).length - 1
       expect(occurrences).toBe(1)
     })

     it('marker is on its own line (no surrounding inline content)', () => {
       const md = format(makeScored({ items: [{ text: 'x' }] }))
       const lines = md.split('\n')
       expect(lines).toContain(MARKER)
     })

     it('marker uses the v1 literal — version-locked for Phase 2 hardening', () => {
       expect(MARKER).toBe('<!-- signal-oss:v1 -->')
     })
   })
   ```

4. **Update `tests/core/score-stub.test.ts`** — Plan 02 wrote tests asserting the stub returned hardcoded `score=5`. Now that the pipeline is real, those assertions break. **Rename and rewrite** the file as `tests/core/score-pipeline.test.ts` (delete the old `score-stub.test.ts`):

   ```typescript
   import { describe, it, expect } from 'vitest'
   import { score } from '../../src/core/index.js'
   import { GRAY_ZONE_HIGH, GRAY_ZONE_LOW } from '../../src/core/score/weights.js'
   import type { Issue, RepoContext } from '../../src/core/types.js'

   const EMPTY_CTX: RepoContext = {
     hasIssueForms: false, hasMdTemplates: false, hasContributing: false, templates: [],
   }

   describe('score() — full pipeline integration (Plan 04 — pipeline complete)', () => {
     it('empty issue → bug type, low score, items present, isGrayZone=false', () => {
       const issue: Issue = { title: '', body: '', labels: [] }
       const r = score(issue, EMPTY_CTX, null)
       expect(r.issueType).toBe('bug')
       expect(r.score).toBe(0)
       expect(r.items.length).toBeGreaterThan(0) // baseline always has items for empty issue
       expect(r.isGrayZone).toBe(false)
       expect(r.tierUsed).toBe('baseline')
     })

     it('high-quality bug issue → high score, no checklist items (all signals satisfied)', () => {
       const body = `## Steps to Reproduce

   1. install
   2. run

   ## Expected
   ok

   ## Actual
   \`\`\`
   Error: oops
       at foo (a.js:1:1)
   \`\`\`

   Using v1.2.3.

   \`\`\`js
   const x = 1
   \`\`\`
   `
       const issue: Issue = { title: 'crash on x', body, labels: [] }
       const r = score(issue, EMPTY_CTX, null)
       expect(r.issueType).toBe('bug')
       expect(r.score).toBeGreaterThanOrEqual(7)
       expect(r.items).toHaveLength(0) // all bug items satisfied
       expect(r.isGrayZone).toBe(false)
     })

     it('feature label + minimal body → feature type, low score, items present', () => {
       const issue: Issue = { title: 'enhance config', body: 'plz add', labels: ['enhancement'] }
       const r = score(issue, EMPTY_CTX, null)
       expect(r.issueType).toBe('feature')
       expect(r.items.length).toBeGreaterThan(0)
     })

     it('mid-quality issue → score in gray zone band', () => {
       const issue: Issue = {
         title: 'crash',
         body: 'I see this error.\n\n```\nat foo (a.js:1:1)\n```',
         labels: [],
       }
       const r = score(issue, EMPTY_CTX, null)
       if (r.score >= GRAY_ZONE_LOW && r.score <= GRAY_ZONE_HIGH) {
         expect(r.isGrayZone).toBe(true)
       }
     })

     it('returns missing list = item texts', () => {
       const issue: Issue = { title: '', body: '', labels: [] }
       const r = score(issue, EMPTY_CTX, null)
       expect(r.missing).toEqual(r.items.map((i) => i.text))
     })

     it('signature is sync (returns ScoredIssue, not Promise)', () => {
       const r = score({ title: '', body: '', labels: [] }, EMPTY_CTX, null)
       expect(r).not.toBeInstanceOf(Promise)
       expect(typeof r.score).toBe('number')
     })
   })
   ```

   Delete the old `tests/core/score-stub.test.ts`.

5. **Rebuild dist/index.js** with the real pipeline:
   ```bash
   npm run package
   ```
   `dist/index.js` will grow vs Plan 02 (now bundles remark/unified). It should still be well under 5 MB.

6. **Verify hexagonal invariant unchanged** by grep — `src/core/` still has zero side-effecting imports.
  </action>
  <verify>
    <automated>npm run test &amp;&amp; npm run package &amp;&amp; node -e "const fs=require('fs'); const s=fs.statSync('dist/index.js'); if(s.size&lt;1000) process.exit(1); console.log('dist size:', s.size); const {execSync}=require('child_process'); const out=execSync('grep -rE \"from [\\x27\\x22](@octokit|@actions|fs|https|@anthropic-ai/sdk|openai)\" src/core/ || true').toString(); if(out.trim().length&gt;0){console.error('HEXAGONAL VIOLATION:',out);process.exit(1)}"</automated>
  </verify>
  <acceptance_criteria>
    - File `src/core/format/markdown.ts` exists and exports both `format` function and `MARKER` constant.
    - File `src/core/format/markdown.ts` contains the literal string `<!-- signal-oss:v1 -->`.
    - File `src/core/format/markdown.ts` does NOT contain the literal strings `Required:`, `Must `, `Invalid` (run: `grep -E '(Required:|\\bMust\\b|\\bInvalid\\b)' src/core/format/markdown.ts` returns 0 lines).
    - File `src/core/index.ts` contains `import { extractSignals } from './heuristics/extractor.js'`.
    - File `src/core/index.ts` contains `import { classifyType } from './classifier/issue-type.js'`.
    - File `src/core/index.ts` contains `import { generateChecklist } from './checklist/generator.js'`.
    - File `src/core/index.ts` contains `import { computeScore } from './score/compute.js'`.
    - File `src/core/index.ts` does NOT contain the literal string `score: 5,` followed by hardcoded values (the Plan 02 stub return — replaced).
    - File `tests/core/score-stub.test.ts` does NOT exist (renamed/replaced).
    - File `tests/core/score-pipeline.test.ts` exists and contains `score() — full pipeline integration`.
    - File `tests/core/format.test.ts` exists with at least 12 `it(` declarations.
    - Running `npm run test` (full suite) exits 0.
    - Running `npm run package` exits 0 and produces `dist/index.js` of at least 1000 bytes.
    - Hexagonal invariant: `grep -rE "from ['\\\"](@octokit|@actions|fs|https|@anthropic-ai/sdk|openai)" src/core/` returns 0 lines.
  </acceptance_criteria>
  <done>
CORE-01 final delivery complete: score() runs the real pipeline. CORE-05 (format) renders the D-07 structure. CORE-06 tone enforced by tests. ACT-05 idempotency marker emitted by format(). dist/index.js rebuilt with full pipeline; bundle size verified non-trivial. Hexagonal boundary preserved.
  </done>
</task>

</tasks>

<verification>
End-to-end verification of Plan 04:

```bash
# CHECK-01 strategy chain
grep "ChecklistStrategy" src/core/types.ts
grep "STRATEGIES" src/core/checklist/generator.ts
grep "BaselineStrategy" src/core/checklist/strategies/baseline.ts

# CHECK-02 baselines (3 types)
grep "bug:" src/core/checklist/baselines.ts
grep "feature:" src/core/checklist/baselines.ts
grep "question:" src/core/checklist/baselines.ts

# CORE-04 weights
grep "GRAY_ZONE_LOW = 4" src/core/score/weights.ts
grep "GRAY_ZONE_HIGH = 6" src/core/score/weights.ts

# CORE-05 format with marker
grep "signal-oss:v1" src/core/format/markdown.ts

# CORE-06 tone — no forbidden words
grep -rE "(Required:|\\bMust\\b|\\bInvalid\\b)" src/core/format/markdown.ts src/core/checklist/baselines.ts   # 0 lines

# CORE-01 real score()
grep "extractSignals" src/core/index.ts
grep "computeScore" src/core/index.ts

# Hexagonal invariant
grep -rE "from ['\"](@octokit|@actions|fs|https|@anthropic-ai/sdk|openai)" src/core/   # 0 lines

# Bundle rebuilt
npm run package
test -f dist/index.js

# All tests pass
npm run test
```
</verification>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| GitHub webhook → main.ts | Issue body is untrusted user input |
| main.ts → score() (CORE) | Issue body still untrusted; CORE treats as opaque data |
| format() output → comment | Comment string contains user input; rendered in GitHub markdown |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-01-01 | Tampering | format() output | mitigate | Format ONLY emits static strings + the score number. Issue body is NEVER interpolated into the formatted comment in Phase 1 (only score, item texts, marker — all internally produced). Verified by inspection of format() source. |
| T-01-02 | Information Disclosure | format() output | accept | No PII or secrets exist in Phase 1 (no LLM, no API keys). Phase 4 will add LLM rationale sanitization. |
| T-01-03 | Denial of Service | extractSignals on huge body | accept | Body size unbounded in Phase 1; remark-parse on a 1MB body completes in <100ms (verified by RESEARCH). Phase 2 introduces `max-body-bytes` action input. |
| T-01-04 | Elevation of Privilege | core imports | mitigate | Hexagonal boundary verified by grep gate: zero @octokit / @actions / fs / https / LLM SDK imports inside src/core/. Enforced in every plan's verification step. |
</threat_model>

<success_criteria>
- CHECK-01 (strategy chain) delivered. CHECK-02 (Tier-4 baseline) delivered, always non-empty for the type when no signals satisfy items.
- CORE-04 delivered: weighted-sum score 0-10 with gray-zone band 4-6. CORE-05 delivered: markdown comment per D-07. CORE-06 delivered: tone enforced by tests.
- CORE-01 delivered: real pipeline replaces stub.
- D-07 comment structure rendered in correct order. D-08 meta-nudge present. D-09 hero-output-always invariant: comment posts even when checklist is empty.
- ACT-05 marker `<!-- signal-oss:v1 -->` emitted by format().
- 40+ tests across checklist, score, format, score-pipeline files. All passing.
- dist/index.js rebuilt with full pipeline.
- Hexagonal invariant preserved (zero side-effecting imports in src/core/).
</success_criteria>

<output>
After completion, create `.planning/phases/01-skeleton-heuristic-spine-first-comment/01-04-SUMMARY.md` documenting:
- Confirmed: real score() pipeline replaces Plan 02 stub
- Confirmed: D-07 comment structure rendered in correct order (intro/checklist/badge/nudge/closing/marker)
- Confirmed: D-09 hero-output-always invariant — empty-items branch tested
- The dist/index.js byte size after Plan 04 build
- Sample format() output for a high-quality bug + a low-quality bug — committed to SUMMARY for visual review
- Tone guide: confirmed grep for Required/Must/Invalid returns 0 in `src/core/`
</output>

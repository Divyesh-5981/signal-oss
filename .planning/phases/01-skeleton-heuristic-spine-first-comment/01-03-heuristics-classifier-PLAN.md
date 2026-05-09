---
id: 01-03-heuristics-classifier
phase: 01-skeleton-heuristic-spine-first-comment
plan: 03
type: execute
wave: 3
depends_on: [01-02-dtos-stub]
files_modified:
  - src/core/heuristics/extractor.ts
  - src/core/classifier/issue-type.ts
  - tests/core/heuristics.test.ts
  - tests/core/classifier.test.ts
  - tests/fixtures/issues/bug-with-stack.md
  - tests/fixtures/issues/feature-request.md
  - tests/fixtures/issues/question.md
  - tests/fixtures/issues/image-only.md
  - tests/fixtures/issues/empty.md
requirements:
  - CORE-02
  - CORE-03
autonomous: true
tags: [heuristics, classifier, ast, remark]

must_haves:
  truths:
    - "extractSignals(issue) returns a Signals DTO with all 7 booleans correctly populated based on issue body content"
    - "Signals are derived from mdast AST traversal via remark-parse + unist-util-visit (NOT raw regex on the markdown string)"
    - "classifyType(issue, signals) returns one of 'bug' | 'feature' | 'question' using precedence: existing labels first → title patterns → body keywords → default 'bug'"
    - "extractor and classifier are pure functions with zero I/O imports"
    - "Both modules are independently unit-testable with no mocks"
  artifacts:
    - path: "src/core/heuristics/extractor.ts"
      provides: "extractSignals(issue) → Signals — 7 boolean flags via mdast AST walk"
      contains: "export function extractSignals"
    - path: "src/core/classifier/issue-type.ts"
      provides: "classifyType(issue, signals) → IssueType — pure precedence-based classifier"
      contains: "export function classifyType"
    - path: "tests/fixtures/issues/"
      provides: "5 issue body fixtures covering bug/feature/question/image-only/empty cases"
      min_lines: 5
  key_links:
    - from: "src/core/heuristics/extractor.ts"
      to: "remark-parse + unist-util-visit"
      via: "ESM imports"
      pattern: "import remarkParse from 'remark-parse'|import \\{ visit \\} from 'unist-util-visit'"
    - from: "src/core/classifier/issue-type.ts"
      to: "src/core/types.ts (Issue, Signals, IssueType)"
      via: "type-only import"
      pattern: "import type \\{ Issue, Signals, IssueType \\}"
---

<objective>
Implement the two pure components that drive every Phase 1 score: the **heuristics extractor** (`extractSignals`) and the **issue-type classifier** (`classifyType`). The extractor walks the mdast AST of the issue body (via `remark-parse` + `unist-util-visit`) and emits the 7-boolean `Signals` DTO. The classifier picks the issue type from existing labels → title patterns → body keywords. Both are pure functions, fully unit-tested against fixture issue bodies. **No I/O. No Octokit. No filesystem. Heuristic logic only.**

**Purpose:** These two functions are the spine of the score. Plan 04 wires them together with the checklist generator and score computer; Plan 05 calls the result from `main.ts`. By isolating extraction + classification into one plan, the AST walk logic is fully testable before any wiring concerns enter the picture.

**Output:** Two TS modules in `src/core/`, two test files with comprehensive coverage of all 7 signals + classifier precedence cases, and 5 fixture issue body files in `tests/fixtures/issues/`.
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
@src/core/index.ts

<interfaces>
<!-- Already-defined types from Plan 02. Implementer uses these AS-IS. -->

```typescript
// src/core/types.ts (existing — DO NOT MODIFY)
export interface Issue { title: string; body: string; labels: string[] }
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
```

<!-- Detection rules per RESEARCH.md (Pattern 1) — implementer follows these exactly -->
| Signal | Detection logic |
|--------|-----------------|
| hasCodeBlock | Any mdast `code` node (fenced or indented) |
| hasStackTrace | A `code` node with `lang` empty/null AND value matches `/\s+at\s+[\w.<>]+\s*\(|^Error:/m` |
| hasVersionMention | Concatenated `text` node values match `/\bv?\d+\.\d+\.\d+\b\|\bnode\s*v?\d\|\bnpm\s+v?\d\|\bpython\s+\d/i` |
| hasReproKeywords | Any heading (toString) matches `/repro\|steps to\|to reproduce/i` |
| hasExpectedActual | One heading matches /expected/i AND another matches /actual/i |
| hasMinimalExample | A `code` node where `lang` is non-empty (e.g., `js`, `ts`, `python`) |
| hasImageOnly | image count > 0 AND code count == 0 |
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Implement extractSignals + 5 fixture issue bodies + comprehensive heuristics tests</name>
  <read_first>
    - F:\Hackathon ideas\signal-oss\src\core\types.ts (Signals DTO shape)
    - F:\Hackathon ideas\signal-oss\.planning\phases\01-skeleton-heuristic-spine-first-comment\01-RESEARCH.md (Pattern 1 — full extractSignals reference; Code Examples — full implementation)
    - F:\Hackathon ideas\signal-oss\.planning\phases\01-skeleton-heuristic-spine-first-comment\01-CONTEXT.md (D-10, D-11, D-12)
  </read_first>
  <files>
    - src/core/heuristics/extractor.ts
    - tests/core/heuristics.test.ts
    - tests/fixtures/issues/bug-with-stack.md
    - tests/fixtures/issues/feature-request.md
    - tests/fixtures/issues/question.md
    - tests/fixtures/issues/image-only.md
    - tests/fixtures/issues/empty.md
  </files>
  <behavior>
    For each of the 7 signals, write at least one positive (true) and one negative (false) test. Include edge cases:
    - Empty body → all 7 signals false
    - Image-only body (no code) → hasImageOnly=true, hasCodeBlock=false
    - Fenced code without lang containing "at foo.bar (file.js:10)" → hasStackTrace=true, hasMinimalExample=false
    - Fenced code with lang `js` → hasMinimalExample=true, hasStackTrace=false
    - Body containing "v1.2.3" → hasVersionMention=true
    - Body containing only "version 2 of the docs" with no semver → hasVersionMention=false (per Pitfall 7 in RESEARCH)
    - Heading "## Steps to Reproduce" → hasReproKeywords=true
    - Headings "## Expected" + "## Actual" → hasExpectedActual=true
    - Heading "## Expected" alone (no "actual") → hasExpectedActual=false
  </behavior>
  <action>
1. **Create the 5 fixture files** in `tests/fixtures/issues/` (these are committed test data — keep small and realistic):

   `tests/fixtures/issues/bug-with-stack.md`:
   ```markdown
   ## Steps to Reproduce

   1. Run `npm install`
   2. Call `myFunc()`
   3. See error

   ## Expected

   No error.

   ## Actual

   ```
   TypeError: Cannot read properties of undefined (reading 'foo')
       at myFunc (src/index.js:42:15)
       at Object.<anonymous> (src/main.js:10:5)
   ```

   ## Environment

   - Node v18.16.0
   - npm 9.5.1
   ```

   `tests/fixtures/issues/feature-request.md`:
   ```markdown
   It would be great to have a way to configure the timeout per request.

   Currently the only way is to set the global default, which affects everything.
   ```

   `tests/fixtures/issues/question.md`:
   ```markdown
   How do I configure the logger to write to a file instead of stdout?

   I tried setting `logger.transport = 'file'` but nothing happens.
   ```

   `tests/fixtures/issues/image-only.md`:
   ```markdown
   Look at this:

   ![screenshot](https://example.com/screenshot.png)
   ```

   `tests/fixtures/issues/empty.md`:
   ```markdown
   ```

   (Last fixture is intentionally empty — represents the worst-case low-quality issue.)

2. **Create `src/core/heuristics/extractor.ts`** — copy the full implementation from RESEARCH.md "Full extractSignals Implementation Reference" section, with one important detail change: the version regex MUST require `\d+\.\d+\.\d+` (semver, three parts) OR a context keyword like `node v?\d` to avoid the "version 2 of the docs" false positive (Pitfall 7).

   ```typescript
   // src/core/heuristics/extractor.ts
   // CORE-02: Heuristics extractor that walks mdast AST of issue body and emits Signals.
   // Pure function — zero I/O. NEVER add fs/octokit imports here.

   import remarkParse from 'remark-parse'
   import { unified } from 'unified'
   import { visit } from 'unist-util-visit'
   import { toString } from 'mdast-util-to-string'
   import type { Root, Code, Heading, Text } from 'mdast'
   import type { Issue, Signals } from '../types.js'

   const VERSION_REGEX = /\bv?\d+\.\d+\.\d+\b|\bnode\s+v?\d|\bnpm\s+v?\d|\bpython\s+\d|\bruby\s+\d|\bgo\s+\d/i
   const STACK_TRACE_REGEX = /^Error\b|\s+at\s+[\w.<>$[\]]+\s*\(/m
   const REPRO_HEADING_REGEX = /repro|steps to|to reproduce/i
   const EXPECTED_REGEX = /expected/i
   const ACTUAL_REGEX = /actual/i

   export function extractSignals(issue: Issue): Signals {
     const body = issue.body ?? ''
     const tree = unified().use(remarkParse).parse(body) as Root

     const codeNodes: Code[] = []
     const headingTexts: string[] = []
     let imageCount = 0
     let textBlob = ''

     visit(tree, 'code', (n: Code) => {
       codeNodes.push(n)
     })
     visit(tree, 'image', () => {
       imageCount++
     })
     visit(tree, 'heading', (n: Heading) => {
       headingTexts.push(toString(n).toLowerCase())
     })
     visit(tree, 'text', (n: Text) => {
       textBlob += ` ${n.value}`
     })

     const hasCodeBlock = codeNodes.length > 0
     const hasStackTrace = codeNodes.some(
       (n) => (!n.lang || n.lang.length === 0) && STACK_TRACE_REGEX.test(n.value),
     )
     const hasMinimalExample = codeNodes.some((n) => n.lang !== null && n.lang !== undefined && n.lang.length > 0)
     const hasVersionMention = VERSION_REGEX.test(textBlob)
     const hasReproKeywords = headingTexts.some((t) => REPRO_HEADING_REGEX.test(t))
     const hasExpectedActual =
       headingTexts.some((t) => EXPECTED_REGEX.test(t)) &&
       headingTexts.some((t) => ACTUAL_REGEX.test(t))
     const hasImageOnly = imageCount > 0 && codeNodes.length === 0

     return {
       hasCodeBlock,
       hasStackTrace,
       hasVersionMention,
       hasReproKeywords,
       hasExpectedActual,
       hasMinimalExample,
       hasImageOnly,
     }
   }
   ```

   Notes:
   - The version regex requires `\d+\.\d+\.\d+` (full semver) OR an explicit language keyword + digit. "version 2 of the docs" → no match.
   - Stack trace requires either a leading "Error" or "at <symbol> (" pattern.
   - The hexagonal boundary holds: imports are only `remark-parse`, `unified`, `unist-util-visit`, `mdast-util-to-string`, `mdast` types, and our own `types.js` — no I/O.

3. **Create `tests/core/heuristics.test.ts`** with comprehensive coverage:

   ```typescript
   import { describe, it, expect } from 'vitest'
   import { readFileSync } from 'node:fs'
   import { join } from 'node:path'
   import { extractSignals } from '../../src/core/heuristics/extractor.js'
   import type { Issue } from '../../src/core/types.js'

   function fixture(name: string): string {
     return readFileSync(join(__dirname, '..', 'fixtures', 'issues', name), 'utf8')
   }

   function makeIssue(body: string): Issue {
     return { title: 't', body, labels: [] }
   }

   describe('extractSignals — basic shape', () => {
     it('returns all 7 signal keys', () => {
       const s = extractSignals(makeIssue(''))
       expect(Object.keys(s).sort()).toEqual([
         'hasCodeBlock',
         'hasExpectedActual',
         'hasImageOnly',
         'hasMinimalExample',
         'hasReproKeywords',
         'hasStackTrace',
         'hasVersionMention',
       ])
     })

     it('empty body → all signals false', () => {
       const s = extractSignals(makeIssue(''))
       expect(s).toEqual({
         hasCodeBlock: false,
         hasStackTrace: false,
         hasVersionMention: false,
         hasReproKeywords: false,
         hasExpectedActual: false,
         hasMinimalExample: false,
         hasImageOnly: false,
       })
     })
   })

   describe('extractSignals — hasCodeBlock', () => {
     it('detects fenced code block', () => {
       expect(extractSignals(makeIssue('```\nfoo\n```')).hasCodeBlock).toBe(true)
     })
     it('detects fenced code with lang', () => {
       expect(extractSignals(makeIssue('```js\nfoo()\n```')).hasCodeBlock).toBe(true)
     })
     it('false when only prose', () => {
       expect(extractSignals(makeIssue('hello world')).hasCodeBlock).toBe(false)
     })
   })

   describe('extractSignals — hasStackTrace', () => {
     it('detects stack-trace pattern in unfenced-lang code block', () => {
       const body = '```\nTypeError: foo\n    at bar (src/x.js:1:1)\n```'
       expect(extractSignals(makeIssue(body)).hasStackTrace).toBe(true)
     })
     it('detects "Error:" prefix', () => {
       const body = '```\nError: something\n```'
       expect(extractSignals(makeIssue(body)).hasStackTrace).toBe(true)
     })
     it('false when code is normal lang-tagged snippet (no Error/at-pattern)', () => {
       const body = '```js\nconst x = 1\n```'
       expect(extractSignals(makeIssue(body)).hasStackTrace).toBe(false)
     })
   })

   describe('extractSignals — hasMinimalExample', () => {
     it('true when code block has lang', () => {
       expect(extractSignals(makeIssue('```js\nfoo()\n```')).hasMinimalExample).toBe(true)
     })
     it('false when code block has no lang', () => {
       expect(extractSignals(makeIssue('```\nfoo\n```')).hasMinimalExample).toBe(false)
     })
   })

   describe('extractSignals — hasVersionMention', () => {
     it('detects semver v1.2.3', () => {
       expect(extractSignals(makeIssue('Using v1.2.3')).hasVersionMention).toBe(true)
     })
     it('detects "Node v18"', () => {
       expect(extractSignals(makeIssue('Running on Node v18')).hasVersionMention).toBe(true)
     })
     it('detects "node 20.5.0"', () => {
       expect(extractSignals(makeIssue('node 20.5.0')).hasVersionMention).toBe(true)
     })
     it('false on "version 2 of the docs" (no semver, no lang keyword + digit)', () => {
       expect(extractSignals(makeIssue('See version 2 of the docs')).hasVersionMention).toBe(false)
     })
     it('false on bare "v2"', () => {
       expect(extractSignals(makeIssue('See v2 docs')).hasVersionMention).toBe(false)
     })
   })

   describe('extractSignals — hasReproKeywords', () => {
     it('detects "## Steps to Reproduce"', () => {
       expect(extractSignals(makeIssue('## Steps to Reproduce\n\n1. Click x')).hasReproKeywords).toBe(true)
     })
     it('detects "## Reproduction"', () => {
       expect(extractSignals(makeIssue('## Reproduction\n\nfoo')).hasReproKeywords).toBe(true)
     })
     it('false on "## Description"', () => {
       expect(extractSignals(makeIssue('## Description\n\nfoo')).hasReproKeywords).toBe(false)
     })
   })

   describe('extractSignals — hasExpectedActual', () => {
     it('true when both Expected and Actual headings present', () => {
       const body = '## Expected\nfoo\n\n## Actual\nbar'
       expect(extractSignals(makeIssue(body)).hasExpectedActual).toBe(true)
     })
     it('false when only Expected', () => {
       expect(extractSignals(makeIssue('## Expected\nfoo')).hasExpectedActual).toBe(false)
     })
     it('false when only Actual', () => {
       expect(extractSignals(makeIssue('## Actual\nbar')).hasExpectedActual).toBe(false)
     })
   })

   describe('extractSignals — hasImageOnly', () => {
     it('true when image present and no code', () => {
       const body = '![screenshot](https://example.com/x.png)'
       expect(extractSignals(makeIssue(body)).hasImageOnly).toBe(true)
     })
     it('false when image AND code present', () => {
       const body = '![screenshot](https://example.com/x.png)\n\n```\nlog\n```'
       expect(extractSignals(makeIssue(body)).hasImageOnly).toBe(false)
     })
     it('false when neither', () => {
       expect(extractSignals(makeIssue('hello')).hasImageOnly).toBe(false)
     })
   })

   describe('extractSignals — fixture-driven (cross-check on real-shaped bodies)', () => {
     it('bug-with-stack.md hits all 6 quality signals (no image-only)', () => {
       const s = extractSignals(makeIssue(fixture('bug-with-stack.md')))
       expect(s.hasCodeBlock).toBe(true)
       expect(s.hasStackTrace).toBe(true)
       expect(s.hasReproKeywords).toBe(true)
       expect(s.hasExpectedActual).toBe(true)
       expect(s.hasVersionMention).toBe(true)
       expect(s.hasImageOnly).toBe(false)
     })

     it('feature-request.md hits no quality signals', () => {
       const s = extractSignals(makeIssue(fixture('feature-request.md')))
       expect(s.hasCodeBlock).toBe(false)
       expect(s.hasStackTrace).toBe(false)
       expect(s.hasReproKeywords).toBe(false)
       expect(s.hasExpectedActual).toBe(false)
       expect(s.hasImageOnly).toBe(false)
     })

     it('image-only.md hits hasImageOnly only', () => {
       const s = extractSignals(makeIssue(fixture('image-only.md')))
       expect(s.hasImageOnly).toBe(true)
       expect(s.hasCodeBlock).toBe(false)
     })

     it('empty.md hits no signals', () => {
       const s = extractSignals(makeIssue(fixture('empty.md')))
       Object.values(s).forEach((v) => expect(v).toBe(false))
     })
   })
   ```
  </action>
  <verify>
    <automated>npm run test -- tests/core/heuristics.test.ts</automated>
  </verify>
  <acceptance_criteria>
    - File `src/core/heuristics/extractor.ts` exists and contains `export function extractSignals`.
    - File `src/core/heuristics/extractor.ts` contains `import remarkParse from 'remark-parse'` and `import { visit } from 'unist-util-visit'`.
    - File `src/core/heuristics/extractor.ts` does NOT contain `from '@octokit'`, `from '@actions'`, `from 'fs'`, or `from 'https'` (run: `grep -E "from ['\\\"](@octokit|@actions|fs|https)" src/core/heuristics/extractor.ts` returns 0 lines).
    - All 5 fixture files exist in `tests/fixtures/issues/`.
    - File `tests/core/heuristics.test.ts` exists and contains at least 25 `it(` declarations (run: `grep -c "it('" tests/core/heuristics.test.ts` returns ≥ 25).
    - Running `npm run test -- tests/core/heuristics.test.ts` exits 0 and reports all tests passing.
    - Hexagonal invariant still holds: `grep -rE "from ['\\\"](@octokit|@actions|fs|https|@anthropic-ai/sdk|openai)" src/core/` returns 0 lines.
  </acceptance_criteria>
  <done>
extractSignals is implemented as a pure function backed by mdast AST traversal. All 7 signals are tested with positive + negative cases plus 4 fixture-driven cross-checks. Hexagonal boundary preserved.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Implement classifyType + comprehensive classifier tests</name>
  <read_first>
    - F:\Hackathon ideas\signal-oss\src\core\types.ts (IssueType, Signals)
    - F:\Hackathon ideas\signal-oss\src\core\heuristics\extractor.ts (Task 1 — extractSignals)
    - F:\Hackathon ideas\signal-oss\.planning\phases\01-skeleton-heuristic-spine-first-comment\01-RESEARCH.md (Component 3 — IssueType Classifier)
    - F:\Hackathon ideas\signal-oss\.planning\phases\01-skeleton-heuristic-spine-first-comment\01-CONTEXT.md (CORE-03 spec)
  </read_first>
  <files>
    - src/core/classifier/issue-type.ts
    - tests/core/classifier.test.ts
  </files>
  <behavior>
    Precedence (highest wins):
    1. Existing labels (case-insensitive). If a label matches `bug|crash|defect`, return 'bug'. If matches `feat|feature|enhancement`, return 'feature'. If matches `question|support|help`, return 'question'.
    2. Title regex patterns. `[BUG]` / `bug:` / `crash` → 'bug'. `feat:` / `feature request` / `would be nice` → 'feature'. `how do i` / `how to` / starts with `?` → 'question'.
    3. Body keyword weighting. `hasStackTrace` or `hasExpectedActual` → 'bug'. Body contains "would be nice" / "feature request" → 'feature'. Body starts with "How do I" → 'question'.
    4. Default: 'bug' (per RESEARCH Component 3 + Pitfall 18).

    Tests:
    - Label `bug` → 'bug' (label wins over body)
    - Label `enhancement` → 'feature'
    - Label `question` → 'question'
    - No label, title `[BUG] crash on save` → 'bug'
    - No label, title `feat: support dark mode` → 'feature'
    - No label, title `How do I configure X?` → 'question'
    - No label, no title pattern, body has stack trace → 'bug'
    - No label, no title pattern, body says "would be nice if" → 'feature'
    - Empty issue → 'bug' (default)
    - Label precedence: label `feature` + title `[BUG] foo` → 'feature' (label wins)
  </behavior>
  <action>
1. **Create `src/core/classifier/issue-type.ts`**:

   ```typescript
   // src/core/classifier/issue-type.ts
   // CORE-03: Pure issue-type classifier.
   // Precedence: existing labels → title regex → body keyword/signals → default 'bug'.
   // No LLM. No I/O.

   import type { Issue, IssueType, Signals } from '../types.js'

   const LABEL_BUG     = /^(bug|crash|defect|regression)$/i
   const LABEL_FEATURE = /^(feat(ure)?|enhancement|improvement)$/i
   const LABEL_QUESTION = /^(question|support|help|q&a|discussion)$/i

   const TITLE_BUG_PATTERNS     = [/^\s*\[bug\]/i, /^bug:/i, /\bcrash(es|ing)?\b/i, /\bbroken\b/i, /\bregression\b/i]
   const TITLE_FEATURE_PATTERNS = [/^feat(ure)?:/i, /^\[(feat|feature|rfc)\]/i, /\bfeature request\b/i, /\bwould be (nice|great)\b/i, /\benhancement\b/i]
   const TITLE_QUESTION_PATTERNS = [/^how (do i|to|can i)\b/i, /^why\b/i, /^what\b/i, /^\?/, /\bquestion\b.*[?:]/i]

   const BODY_FEATURE_KEYWORDS = /\bwould be (nice|great)\b|\bfeature request\b|\bplease add\b|\bsupport for\b/i
   const BODY_QUESTION_KEYWORDS = /^how (do i|to|can i)\b/i

   export function classifyType(issue: Issue, signals: Signals): IssueType {
     // 1. Label precedence (case-insensitive trim)
     for (const labelRaw of issue.labels ?? []) {
       const label = labelRaw.trim()
       if (LABEL_BUG.test(label))      return 'bug'
       if (LABEL_FEATURE.test(label))  return 'feature'
       if (LABEL_QUESTION.test(label)) return 'question'
     }

     // 2. Title patterns
     const title = issue.title ?? ''
     if (TITLE_BUG_PATTERNS.some((re) => re.test(title)))      return 'bug'
     if (TITLE_FEATURE_PATTERNS.some((re) => re.test(title)))  return 'feature'
     if (TITLE_QUESTION_PATTERNS.some((re) => re.test(title))) return 'question'

     // 3. Body keyword + signal weighting
     const body = issue.body ?? ''
     if (signals.hasStackTrace || signals.hasExpectedActual) return 'bug'
     if (BODY_FEATURE_KEYWORDS.test(body))  return 'feature'
     if (BODY_QUESTION_KEYWORDS.test(body)) return 'question'

     // 4. Default
     return 'bug'
   }
   ```

2. **Create `tests/core/classifier.test.ts`**:

   ```typescript
   import { describe, it, expect } from 'vitest'
   import { classifyType } from '../../src/core/classifier/issue-type.js'
   import type { Issue, Signals } from '../../src/core/types.js'

   const ZERO_SIGNALS: Signals = {
     hasCodeBlock: false,
     hasStackTrace: false,
     hasVersionMention: false,
     hasReproKeywords: false,
     hasExpectedActual: false,
     hasMinimalExample: false,
     hasImageOnly: false,
   }

   function issue(over: Partial<Issue>): Issue {
     return { title: '', body: '', labels: [], ...over }
   }

   describe('classifyType — label precedence', () => {
     it('label "bug" → bug', () => {
       expect(classifyType(issue({ labels: ['bug'] }), ZERO_SIGNALS)).toBe('bug')
     })
     it('label "enhancement" → feature', () => {
       expect(classifyType(issue({ labels: ['enhancement'] }), ZERO_SIGNALS)).toBe('feature')
     })
     it('label "question" → question', () => {
       expect(classifyType(issue({ labels: ['question'] }), ZERO_SIGNALS)).toBe('question')
     })
     it('label "feat" → feature', () => {
       expect(classifyType(issue({ labels: ['feat'] }), ZERO_SIGNALS)).toBe('feature')
     })
     it('case-insensitive: label "BUG" → bug', () => {
       expect(classifyType(issue({ labels: ['BUG'] }), ZERO_SIGNALS)).toBe('bug')
     })
     it('label wins over conflicting title: label=feature + title="[BUG] foo" → feature', () => {
       expect(classifyType(issue({ labels: ['feature'], title: '[BUG] foo' }), ZERO_SIGNALS)).toBe('feature')
     })
     it('first matching label wins (multiple labels)', () => {
       expect(classifyType(issue({ labels: ['needs-triage', 'bug', 'enhancement'] }), ZERO_SIGNALS)).toBe('bug')
     })
     it('non-matching label falls through to title', () => {
       expect(classifyType(issue({ labels: ['needs-triage'], title: '[BUG] crash' }), ZERO_SIGNALS)).toBe('bug')
     })
   })

   describe('classifyType — title patterns', () => {
     it('title "[BUG] crash on save" → bug', () => {
       expect(classifyType(issue({ title: '[BUG] crash on save' }), ZERO_SIGNALS)).toBe('bug')
     })
     it('title "feat: dark mode support" → feature', () => {
       expect(classifyType(issue({ title: 'feat: dark mode support' }), ZERO_SIGNALS)).toBe('feature')
     })
     it('title "feature request: dark mode" → feature', () => {
       expect(classifyType(issue({ title: 'feature request: dark mode' }), ZERO_SIGNALS)).toBe('feature')
     })
     it('title "How do I configure X?" → question', () => {
       expect(classifyType(issue({ title: 'How do I configure X?' }), ZERO_SIGNALS)).toBe('question')
     })
     it('title "why does this happen?" → question', () => {
       expect(classifyType(issue({ title: 'why does this happen?' }), ZERO_SIGNALS)).toBe('question')
     })
     it('title "App crashes when clicking save" → bug (crash pattern)', () => {
       expect(classifyType(issue({ title: 'App crashes when clicking save' }), ZERO_SIGNALS)).toBe('bug')
     })
   })

   describe('classifyType — body & signal weighting', () => {
     it('signals.hasStackTrace=true (no label/title) → bug', () => {
       const sig = { ...ZERO_SIGNALS, hasStackTrace: true }
       expect(classifyType(issue({ title: 'something happens' }), sig)).toBe('bug')
     })
     it('signals.hasExpectedActual=true → bug', () => {
       const sig = { ...ZERO_SIGNALS, hasExpectedActual: true }
       expect(classifyType(issue({ title: 'something' }), sig)).toBe('bug')
     })
     it('body "would be nice if" → feature', () => {
       expect(
         classifyType(issue({ title: 'thoughts', body: 'would be nice if X' }), ZERO_SIGNALS),
       ).toBe('feature')
     })
     it('body "How do I do X" → question', () => {
       expect(
         classifyType(issue({ title: '', body: 'How do I do X?' }), ZERO_SIGNALS),
       ).toBe('question')
     })
   })

   describe('classifyType — default', () => {
     it('empty issue with no signals → bug (default)', () => {
       expect(classifyType(issue({}), ZERO_SIGNALS)).toBe('bug')
     })
     it('vague title with no signals → bug', () => {
       expect(classifyType(issue({ title: 'something happens' }), ZERO_SIGNALS)).toBe('bug')
     })
   })
   ```
  </action>
  <verify>
    <automated>npm run test -- tests/core/classifier.test.ts</automated>
  </verify>
  <acceptance_criteria>
    - File `src/core/classifier/issue-type.ts` exists and contains `export function classifyType`.
    - File `src/core/classifier/issue-type.ts` does NOT contain any of: `from '@octokit'`, `from '@actions'`, `from 'fs'`, `from 'https'` (run: `grep -E "from ['\\\"](@octokit|@actions|fs|https)" src/core/classifier/issue-type.ts` returns 0 lines).
    - File `src/core/classifier/issue-type.ts` contains the exact precedence keywords: `LABEL_BUG`, `LABEL_FEATURE`, `LABEL_QUESTION`, `TITLE_BUG_PATTERNS`, `TITLE_FEATURE_PATTERNS`, `TITLE_QUESTION_PATTERNS`.
    - File `tests/core/classifier.test.ts` exists with at least 18 `it(` declarations (run: `grep -c "it('" tests/core/classifier.test.ts` returns ≥ 18).
    - Running `npm run test -- tests/core/classifier.test.ts` exits 0 with all tests passing.
    - Running `npm run test` (full suite) exits 0 — Plan 01 + 02 + 03 tests all pass.
    - Hexagonal invariant still holds: `grep -rE "from ['\\\"](@octokit|@actions|fs|https|@anthropic-ai/sdk|openai)" src/core/` returns 0 lines.
  </acceptance_criteria>
  <done>
classifyType is implemented as a pure precedence-based classifier (label → title → signals/body → default). 18+ tests cover all four precedence tiers including label-wins-over-title and case-insensitivity. Hexagonal boundary preserved.
  </done>
</task>

</tasks>

<verification>
End-to-end verification of Plan 03:

```bash
# extractor exists with mdast AST imports
grep "export function extractSignals" src/core/heuristics/extractor.ts
grep "remark-parse" src/core/heuristics/extractor.ts
grep "unist-util-visit" src/core/heuristics/extractor.ts

# classifier exists with precedence implementation
grep "export function classifyType" src/core/classifier/issue-type.ts

# Hexagonal invariant
grep -rE "from ['\"](@octokit|@actions|fs|https|@anthropic-ai/sdk|openai)" src/core/   # 0 lines

# Fixtures exist
ls tests/fixtures/issues/   # 5 files

# All tests pass
npm run test    # types(5) + score-stub(6) + heuristics(25+) + classifier(18+) = 54+ passing
```
</verification>

<success_criteria>
- CORE-02 delivered: `extractSignals` implements all 7 signals via mdast AST traversal.
- CORE-03 delivered: `classifyType` implements label → title → body precedence.
- 5 fixture issue bodies committed to `tests/fixtures/issues/`.
- 25+ heuristic tests + 18+ classifier tests all passing.
- Hexagonal boundary preserved (zero side-effecting imports in `src/core/`).
- Pitfall 7 (version false positives) addressed by requiring full semver or language keyword + digit.
- Pitfall 18 (misclassified type) addressed by label precedence + default-to-bug fallback.
</success_criteria>

<output>
After completion, create `.planning/phases/01-skeleton-heuristic-spine-first-comment/01-03-SUMMARY.md` documenting:
- Confirmed: 7/7 signals implemented; tests cover positive+negative for each
- Confirmed: 4-tier classifier precedence (label/title/body/default) with all branches tested
- Any signals that proved noisy on the 5 fixtures and the threshold tuning applied
- Whether `mdast-util-to-string` extraction worked correctly on nested heading content
</output>

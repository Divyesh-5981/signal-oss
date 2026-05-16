// src/core/heuristics/extractor.ts
// CORE-02: Heuristics extractor that walks mdast AST of issue body and emits Signals.
// Pure function — zero I/O. NEVER add fs/octokit imports here.
//
// Phase 3 rebuild: tightened content thresholds. Signals must reflect what a maintainer
// would actually USE, not just what a template auto-injected:
//   - Code blocks whose content is a single `<placeholder>` token don't count
//   - Stack-trace detection accepts more languages (rust E\d+, python Traceback, panic at)
//   - Lang-tagged code blocks must have at least a small amount of real content
// All 7 Signal keys preserved (Phase 1 lock). Detection logic refined only.

import type { Code, Heading, Root, Text } from 'mdast'
import { toString as mdastToString } from 'mdast-util-to-string'
import remarkParse from 'remark-parse'
import { unified } from 'unified'
import { visit } from 'unist-util-visit'
import type { Issue, Signals } from '../types.js'

const VERSION_REGEX =
  /\bv?\d+\.\d+\.\d+\b|\bnode\s+v?\d|\bnpm\s+v?\d|\bpython\s+\d|\bruby\s+\d|\bgo\s+\d|\brustc?\s+v?\d/i

// Stack-trace detectors. Any one match is enough; the patterns cover JS/TS, Python,
// Rust (E\d+, panic at, "N: 0x..." frame), Java/Kotlin, .NET.
const STACK_TRACE_PATTERNS: RegExp[] = [
  /^Error\b/m,
  /\s+at\s+[\w.<>$[\]]+\s*\(/,
  /^\s*Traceback\s*\(/m,
  /^\s*File\s+"[^"]+",\s+line\s+\d+/m,
  /\berror\[E\d{2,5}\]/,
  /^\s*panicked\s+at/m,
  /^\s*\d+:\s+0x[0-9a-f]+\s+-/m,
  /^Exception\s+in\s+thread/m,
  /^\s*Caused\s+by:/m,
]

const _REPRO_HEADING_REGEX = /repro|steps to|to reproduce/i
const EXPECTED_REGEX = /expected/i
const ACTUAL_REGEX = /actual/i

// A code-block content is a "placeholder" if it's just one or two angle-bracketed tokens
// like `<version>`, `<backtrace>`, `<insert code here>`. Templates leave these in the body
// when the reporter doesn't fill them out, and they should NOT count as a minimal example
// or as evidence of a stack trace.
function isPlaceholderContent(content: string): boolean {
  const trimmed = content.trim()
  if (trimmed.length === 0) return true
  if (/^<[^>]+>$/.test(trimmed)) return true
  if (/^(<[^>]+>\s*){1,3}$/.test(trimmed)) return true
  return false
}

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
    headingTexts.push(mdastToString(n).toLowerCase())
  })
  visit(tree, 'text', (n: Text) => {
    textBlob += ` ${n.value}`
  })

  // Code-block content excluding placeholder-only blocks
  const realCodeNodes = codeNodes.filter((n) => !isPlaceholderContent(n.value ?? ''))
  const realCodeBlob = realCodeNodes.map((n) => n.value).join(' ')

  const hasCodeBlock = realCodeNodes.length > 0

  const hasStackTrace =
    STACK_TRACE_PATTERNS.some((re) => re.test(realCodeBlob)) ||
    STACK_TRACE_PATTERNS.some((re) => re.test(textBlob))

  // Minimal example: lang-tagged AND content is not a placeholder AND has at least 5 chars
  // of real content (avoids `<placeholder>` and similar fillers).
  const hasMinimalExample = codeNodes.some((n) => {
    if (n.lang === null || n.lang === undefined || n.lang.length === 0) return false
    const content = (n.value ?? '').trim()
    if (content.length < 5) return false
    if (isPlaceholderContent(content)) return false
    return true
  })

  const hasVersionMention = VERSION_REGEX.test(textBlob) || VERSION_REGEX.test(realCodeBlob)

  // Repro heading: present AND the section under the heading has non-trivial content
  // (filters auto-generated empty "## Steps to Reproduce" with nothing below).
  const hasReproKeywords = detectReproSection(body)

  const hasExpectedActual =
    headingTexts.some((t) => EXPECTED_REGEX.test(t)) &&
    headingTexts.some((t) => ACTUAL_REGEX.test(t))

  const hasImageOnly = imageCount > 0 && hasCodeBlock === false

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

// Heading match alone fires too often on auto-generated templates ("## Steps to Reproduce"
// with HTML-comment-only body). Accept ANY of: (a) repro heading followed by ANY non-comment
// content, (b) "Steps to reproduce:" label followed by >=3 newlined lines.
function detectReproSection(body: string): boolean {
  // (a) Markdown heading with non-comment content beneath
  const headingMatch = body.match(/^#{1,6}\s+(.*(?:repro|steps to|to reproduce).*)$/im)
  if (headingMatch) {
    const start = (headingMatch.index ?? 0) + headingMatch[0].length
    const sectionEnd = findNextSectionBoundary(body, start)
    const sectionRaw = body.slice(start, sectionEnd)
    const sectionStripped = sectionRaw.replace(/<!--[\s\S]*?-->/g, '').trim()
    if (sectionStripped.length > 0) return true
  }
  // (b) Plain "Steps to reproduce:" label followed by content lines
  const labelMatch = body.match(
    /(?:^|\n)\s*(?:steps?\s+to\s+reproduce|reproduction\s+steps?|to\s+reproduce|how\s+to\s+reproduce)\s*[:：]\s*\n/i,
  )
  if (labelMatch) {
    const start = (labelMatch.index ?? 0) + labelMatch[0].length
    const window = body.slice(start, start + 400)
    const lines = window.split('\n')
    let count = 0
    for (const line of lines) {
      const t = line.trim()
      if (t === '') break
      if (/^#{1,6}\s/.test(t)) break
      if (/^<\w/.test(t)) break
      if (t.length < 3) continue
      count++
      if (count >= 3) return true
    }
  }
  return false
}

function findNextSectionBoundary(body: string, from: number): number {
  // Next heading or end of body
  const rest = body.slice(from)
  const next = rest.match(/\n#{1,6}\s/)
  if (next && next.index !== undefined) return from + next.index
  return body.length
}

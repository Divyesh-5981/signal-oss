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

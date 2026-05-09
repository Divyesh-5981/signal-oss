import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { extractSignals } from '../../src/core/heuristics/extractor.js'
import type { Issue } from '../../src/core/types.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

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

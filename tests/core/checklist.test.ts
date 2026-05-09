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

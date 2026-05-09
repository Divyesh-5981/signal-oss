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

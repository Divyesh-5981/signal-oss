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

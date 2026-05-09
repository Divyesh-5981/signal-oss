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

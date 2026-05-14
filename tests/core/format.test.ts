import { describe, it, expect } from 'vitest'
import { format, MARKER } from '../../src/core/format/markdown.js'
import type { RepoContext, ScoredIssue, Signals } from '../../src/core/types.js'

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
    const nudgeIdx = md.indexOf('**Tip:**')
    const closingIdx = md.indexOf('Once these are added')
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
    expect(md).not.toContain('Once these are added')
  })

  it('still emits score badge, meta-nudge, marker (hero-output-always invariant)', () => {
    const md = format(makeScored({ items: [], score: 9 }))
    expect(md).toContain('Actionability score: 9/10')
    expect(md).toContain('**Tip:**')
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

// ============================================================
// format() — meta-nudge gating (CHECK-06) — Plan 04 tests
// ============================================================

describe('format() — meta-nudge gating (CHECK-06)', () => {
  it('F1: format(scored) without repoContext still shows META_NUDGE (backwards-compatible)', () => {
    const md = format(makeScored({ items: [], score: 5 }))
    expect(md).toContain('**Tip:**')
  })

  it('F2: format(scored, ctx) with hasIssueForms=true → no META_NUDGE', () => {
    const ctx: RepoContext = {
      hasIssueForms: true,
      hasMdTemplates: false,
      hasContributing: false,
      templates: [],
    }
    const md = format(makeScored({ items: [], score: 5 }), ctx)
    expect(md).not.toContain('**Tip:**')
  })

  it('F3: format(scored, ctx) with hasMdTemplates=true → no META_NUDGE', () => {
    const ctx: RepoContext = {
      hasIssueForms: false,
      hasMdTemplates: true,
      hasContributing: false,
      templates: [],
    }
    const md = format(makeScored({ items: [], score: 5 }), ctx)
    expect(md).not.toContain('**Tip:**')
  })

  it('F4: format(scored, ctx) with both flags false → META_NUDGE present', () => {
    const ctx: RepoContext = {
      hasIssueForms: false,
      hasMdTemplates: false,
      hasContributing: false,
      templates: [],
    }
    const md = format(makeScored({ items: [], score: 5 }), ctx)
    expect(md).toContain('**Tip:**')
  })
})

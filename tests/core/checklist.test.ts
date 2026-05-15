import { describe, it, expect } from 'vitest'
import { generateChecklist } from '../../src/core/checklist/generator.js'
import { IssueFormStrategy } from '../../src/core/checklist/strategies/issue-form.js'
import { TemplateMdStrategy } from '../../src/core/checklist/strategies/template-md.js'
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

// ============================================================
// IssueFormStrategy (Tier 1) — Plan 04 tests (A1–A15)
// ============================================================

describe('IssueFormStrategy — applies()', () => {
  it('A1: returns false when hasIssueForms=false even if form template exists', () => {
    const strategy = new IssueFormStrategy()
    const ctx: RepoContext = {
      hasIssueForms: false,
      hasMdTemplates: true,
      hasContributing: false,
      templates: [{ filename: 'x.yml', type: 'form', fields: ['a'] }],
    }
    expect(strategy.applies(ctx)).toBe(false)
  })

  it('A2: returns false when hasIssueForms=true but no form template has fields (D-06)', () => {
    const strategy = new IssueFormStrategy()
    const ctx: RepoContext = {
      hasIssueForms: true,
      hasMdTemplates: false,
      hasContributing: false,
      templates: [{ filename: 'bug_report.yml', type: 'form', fields: [] }],
    }
    expect(strategy.applies(ctx)).toBe(false)
  })

  it('A3: returns true when hasIssueForms=true and at least one form template has fields', () => {
    const strategy = new IssueFormStrategy()
    const ctx: RepoContext = {
      hasIssueForms: true,
      hasMdTemplates: false,
      hasContributing: false,
      templates: [{ filename: 'bug_report.yml', type: 'form', fields: ['Version'] }],
    }
    expect(strategy.applies(ctx)).toBe(true)
  })
})

describe('IssueFormStrategy — generate()', () => {
  const strategy = new IssueFormStrategy()

  it('A4: bug type matches bug_report.yml filename — returns fields from matched template', () => {
    const ctx: RepoContext = {
      hasIssueForms: true,
      hasMdTemplates: false,
      hasContributing: false,
      templates: [
        { filename: 'bug_report.yml', type: 'form', fields: ['Reproduction URL', 'Version'] },
        { filename: 'feature_request.yml', type: 'form', fields: ['Use case'] },
      ],
    }
    const items = strategy.generate('bug', ZERO_SIGNALS, ctx)
    expect(items).toHaveLength(2)
    const texts = items.map((i) => i.text.toLowerCase())
    expect(texts.some((t) => t.includes('reproduction url'))).toBe(true)
    expect(texts.some((t) => t.includes('version'))).toBe(true)
  })

  it('A5: no filename match for type → deduplicated union of all form templates fields', () => {
    const ctx: RepoContext = {
      hasIssueForms: true,
      hasMdTemplates: false,
      hasContributing: false,
      templates: [
        { filename: 'bug_report.yml', type: 'form', fields: ['Steps', 'Version'] },
        { filename: 'feature_request.yml', type: 'form', fields: ['Use case', 'Steps'] },
      ],
    }
    // 'question' matches none, so union: Steps, Version, Use case (deduplicated)
    const items = strategy.generate('question', ZERO_SIGNALS, ctx)
    expect(items).toHaveLength(3) // Steps + Version + Use case (Steps deduplicated)
  })

  it('A6: caps at 5 items even when template has 7 fields', () => {
    const ctx: RepoContext = {
      hasIssueForms: true,
      hasMdTemplates: false,
      hasContributing: false,
      templates: [
        {
          filename: 'bug_report.yml',
          type: 'form',
          fields: ['F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7'],
        },
      ],
    }
    const items = strategy.generate('bug', ZERO_SIGNALS, ctx)
    expect(items).toHaveLength(5)
  })

  it('A7: every returned item.text starts with "Could you share "', () => {
    const ctx: RepoContext = {
      hasIssueForms: true,
      hasMdTemplates: false,
      hasContributing: false,
      templates: [
        { filename: 'bug_report.yml', type: 'form', fields: ['Repro steps', 'Version'] },
      ],
    }
    const items = strategy.generate('bug', ZERO_SIGNALS, ctx)
    items.forEach((i) => expect(i.text).toMatch(/^Could you share /))
  })

  it('A15: sanitizes @mentions in field labels — text must not contain "@"', () => {
    const ctx: RepoContext = {
      hasIssueForms: true,
      hasMdTemplates: false,
      hasContributing: false,
      templates: [
        {
          filename: 'bug_report.yml',
          type: 'form',
          fields: ['Tag @maintainer for help'],
        },
      ],
    }
    const items = strategy.generate('bug', ZERO_SIGNALS, ctx)
    expect(items).toHaveLength(1)
    expect(items[0].text).not.toContain('@')
  })

  it('A16: filters out fields when corresponding signal is satisfied', () => {
    const ctx: RepoContext = {
      hasIssueForms: true,
      hasMdTemplates: false,
      hasContributing: false,
      templates: [
        {
          filename: 'bug_report.yml',
          type: 'form',
          fields: ['Version', 'Steps to Reproduce', 'Error message'],
        },
      ],
    }
    const allSignals: Signals = {
      ...ZERO_SIGNALS,
      hasVersionMention: true,
      hasReproKeywords: true,
      hasStackTrace: true,
    }
    const items = strategy.generate('bug', allSignals, ctx)
    expect(items).toHaveLength(0)
  })

  it('A17: only filters matched fields — unmatched fields remain', () => {
    const ctx: RepoContext = {
      hasIssueForms: true,
      hasMdTemplates: false,
      hasContributing: false,
      templates: [
        {
          filename: 'bug_report.yml',
          type: 'form',
          fields: ['Version', 'Browser', 'Steps to Reproduce'],
        },
      ],
    }
    const partialSignals: Signals = {
      ...ZERO_SIGNALS,
      hasVersionMention: true, // matches "Version"
      // hasReproKeywords is false — "Steps to Reproduce" should remain
    }
    const items = strategy.generate('bug', partialSignals, ctx)
    // "Version" filtered, "Browser" has no signal match so stays, "Steps to Reproduce" stays
    expect(items).toHaveLength(2)
    const texts = items.map((i) => i.text.toLowerCase())
    expect(texts.some((t) => t.includes('browser'))).toBe(true)
    expect(texts.some((t) => t.includes('steps to reproduce'))).toBe(true)
  })
})

// ============================================================
// TemplateMdStrategy (Tier 2) — Plan 04 tests (A8–A11)
// ============================================================

describe('TemplateMdStrategy — applies()', () => {
  it('A8: returns false when hasMdTemplates=false even if md template is in templates array', () => {
    const strategy = new TemplateMdStrategy()
    const ctx: RepoContext = {
      hasIssueForms: false,
      hasMdTemplates: false,
      hasContributing: false,
      templates: [{ filename: 'bug_report.md', type: 'md', fields: ['Steps'] }],
    }
    expect(strategy.applies(ctx)).toBe(false)
  })

  it('A9: returns true when hasMdTemplates=true and at least one md template has fields', () => {
    const strategy = new TemplateMdStrategy()
    const ctx: RepoContext = {
      hasIssueForms: false,
      hasMdTemplates: true,
      hasContributing: false,
      templates: [{ filename: 'bug_report.md', type: 'md', fields: ['Steps to Reproduce'] }],
    }
    expect(strategy.applies(ctx)).toBe(true)
  })
})

describe('TemplateMdStrategy — generate()', () => {
  const strategy = new TemplateMdStrategy()

  it('A10: selects md template by filename for bug type', () => {
    const ctx: RepoContext = {
      hasIssueForms: false,
      hasMdTemplates: true,
      hasContributing: false,
      templates: [
        { filename: 'bug_report.md', type: 'md', fields: ['Steps to Reproduce', 'Environment'] },
        { filename: 'feature_request.md', type: 'md', fields: ['Use case'] },
      ],
    }
    const items = strategy.generate('bug', ZERO_SIGNALS, ctx)
    expect(items).toHaveLength(2)
    const texts = items.map((i) => i.text.toLowerCase())
    expect(texts.some((t) => t.includes('steps to reproduce'))).toBe(true)
    expect(texts.some((t) => t.includes('environment'))).toBe(true)
  })

  it('A11: caps at 5 items and uses Could you share framing', () => {
    const ctx: RepoContext = {
      hasIssueForms: false,
      hasMdTemplates: true,
      hasContributing: false,
      templates: [
        {
          filename: 'bug_report.md',
          type: 'md',
          fields: ['F1', 'F2', 'F3', 'F4', 'F5', 'F6'],
        },
      ],
    }
    const items = strategy.generate('bug', ZERO_SIGNALS, ctx)
    expect(items).toHaveLength(5)
    items.forEach((i) => expect(i.text).toMatch(/^Could you share /))
  })

  it('A18: filters out fields when corresponding signal is satisfied', () => {
    const ctx: RepoContext = {
      hasIssueForms: false,
      hasMdTemplates: true,
      hasContributing: false,
      templates: [
        {
          filename: 'bug_report.md',
          type: 'md',
          fields: ['Steps to Reproduce', 'Expected Behavior', 'Version'],
        },
      ],
    }
    const allSignals: Signals = {
      ...ZERO_SIGNALS,
      hasReproKeywords: true,
      hasExpectedActual: true,
      hasVersionMention: true,
    }
    const items = strategy.generate('bug', allSignals, ctx)
    expect(items).toHaveLength(0)
  })
})

// ============================================================
// generateChecklist — strategy chain priority (A12–A14)
// ============================================================

describe('generateChecklist — strategy chain priority', () => {
  it('A12: IssueFormStrategy wins when form templates apply', () => {
    const ctx: RepoContext = {
      hasIssueForms: true,
      hasMdTemplates: true,
      hasContributing: false,
      templates: [
        { filename: 'bug_report.yml', type: 'form', fields: ['Version'] },
        { filename: 'bug_report.md', type: 'md', fields: ['Steps'] },
      ],
    }
    const r = generateChecklist(ZERO_SIGNALS, 'bug', ctx)
    expect(r.tierUsed).toBe('issue-form')
  })

  it('A13: TemplateMdStrategy wins when no forms but md templates apply', () => {
    const ctx: RepoContext = {
      hasIssueForms: false,
      hasMdTemplates: true,
      hasContributing: false,
      templates: [
        { filename: 'bug_report.md', type: 'md', fields: ['Steps to Reproduce'] },
      ],
    }
    const r = generateChecklist(ZERO_SIGNALS, 'bug', ctx)
    expect(r.tierUsed).toBe('template-md')
  })

  it('A14: falls through to baseline when neither strategy applies', () => {
    const ctx: RepoContext = {
      hasIssueForms: false,
      hasMdTemplates: false,
      hasContributing: false,
      templates: [],
    }
    const r = generateChecklist(ZERO_SIGNALS, 'bug', ctx)
    expect(r.tierUsed).toBe('baseline')
  })
})

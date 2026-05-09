import { describe, it, expect, expectTypeOf } from 'vitest'
import type {
  Issue,
  Signals,
  IssueType,
  RepoContext,
  ChecklistItem,
  ScoredIssue,
} from '../../src/core/types.js'
import type { LLMPort, LLMRequest, LLMVerdict } from '../../src/core/llm/port.js'

describe('Phase 1 DTO shapes', () => {
  it('Signals has exactly the 7 expected boolean keys', () => {
    const s: Signals = {
      hasCodeBlock: false,
      hasStackTrace: false,
      hasVersionMention: false,
      hasReproKeywords: false,
      hasExpectedActual: false,
      hasMinimalExample: false,
      hasImageOnly: false,
    }
    const keys = Object.keys(s).sort()
    expect(keys).toEqual([
      'hasCodeBlock',
      'hasExpectedActual',
      'hasImageOnly',
      'hasMinimalExample',
      'hasReproKeywords',
      'hasStackTrace',
      'hasVersionMention',
    ])
  })

  it('IssueType accepts only bug | feature | question', () => {
    const types: IssueType[] = ['bug', 'feature', 'question']
    expect(types).toHaveLength(3)
  })

  it('Issue, RepoContext, ChecklistItem, ScoredIssue compile with full shape', () => {
    const issue: Issue = { title: 't', body: 'b', labels: [] }
    const ctx: RepoContext = {
      hasIssueForms: false,
      hasMdTemplates: false,
      hasContributing: false,
      templates: [],
    }
    const item: ChecklistItem = { text: 'x', signalKey: 'hasCodeBlock' }
    const scored: ScoredIssue = {
      score: 5,
      missing: [],
      signals: {
        hasCodeBlock: false,
        hasStackTrace: false,
        hasVersionMention: false,
        hasReproKeywords: false,
        hasExpectedActual: false,
        hasMinimalExample: false,
        hasImageOnly: false,
      },
      issueType: 'bug',
      isGrayZone: true,
      items: [item],
      tierUsed: 'baseline',
    }
    expect(issue.body).toBe('b')
    expect(ctx.templates).toEqual([])
    expect(scored.score).toBe(5)
  })

  it('LLMPort interface is satisfied by a mock object', () => {
    const mockLLM: LLMPort = {
      async adjudicate(req: LLMRequest): Promise<LLMVerdict> {
        return { score: 5, rationale: 'mock', missing: [] }
      },
    }
    expectTypeOf(mockLLM.adjudicate).toBeFunction()
    expect(typeof mockLLM.adjudicate).toBe('function')
  })

  it('IssueType narrows correctly in switch', () => {
    function describe(t: IssueType): string {
      switch (t) {
        case 'bug': return 'b'
        case 'feature': return 'f'
        case 'question': return 'q'
      }
    }
    expect(describe('bug')).toBe('b')
    expect(describe('feature')).toBe('f')
    expect(describe('question')).toBe('q')
  })
})

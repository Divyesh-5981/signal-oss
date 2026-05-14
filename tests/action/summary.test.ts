import { beforeEach, describe, expect, it, vi } from 'vitest'

// Use vi.hoisted so the mock factory can reference these before imports are resolved
const { mockSummary, mockWarning } = vi.hoisted(() => {
  const buffer: string[] = []
  const ms = {
    addRaw: vi.fn((s: string) => { buffer.push(s); return ms }),
    addTable: vi.fn((rows: unknown[]) => { buffer.push(JSON.stringify(rows)); return ms }),
    addEOL: vi.fn(() => ms),
    write: vi.fn().mockResolvedValue(undefined),
    _buffer: buffer,
  }
  return { mockSummary: ms, mockWarning: vi.fn() }
})

vi.mock('@actions/core', () => ({
  warning: mockWarning,
  info: vi.fn(),
  summary: mockSummary,
}))

import type { SummaryData } from '../../src/action/summary.js'
import { writeSummary, writeSkipSummary } from '../../src/action/summary.js'

function makeData(overrides: Partial<SummaryData> = {}): SummaryData {
  return {
    issue: { title: 'Sample bug', body: 'foo', labels: [] },
    issueNumber: 42,
    scored: {
      score: 6,
      missing: [],
      signals: {
        hasCodeBlock: true,
        hasStackTrace: false,
        hasVersionMention: true,
        hasReproKeywords: false,
        hasExpectedActual: true,
        hasMinimalExample: false,
        hasImageOnly: false,
      },
      issueType: 'bug',
      isGrayZone: true,
      items: [{ text: 'Could you share the version?' }],
      tierUsed: 'baseline',
    },
    labelAction: 'applied',
    commentUrl: 'https://github.com/o/r/issues/42#issuecomment-123',
    repoContext: { hasIssueForms: false, hasMdTemplates: false, hasContributing: false, templates: [] },
    dryRun: false,
    ...overrides,
  }
}

beforeEach(() => {
  mockSummary._buffer.length = 0
  vi.clearAllMocks()
  mockSummary.write.mockResolvedValue(undefined)
  // Re-wire addRaw/addTable after clearAllMocks (restore side effects)
  mockSummary.addRaw.mockImplementation((s: string) => { mockSummary._buffer.push(s); return mockSummary })
  mockSummary.addTable.mockImplementation((rows: unknown[]) => { mockSummary._buffer.push(JSON.stringify(rows)); return mockSummary })
  mockSummary.addEOL.mockImplementation(() => mockSummary)
})

describe('writeSummary', () => {
  it('S1: renders header line with issue # and title', async () => {
    await writeSummary(makeData())
    const out = mockSummary._buffer.join('')
    expect(out).toContain('#42')
    expect(out).toContain('Sample bug')
  })

  it('S2: renders signals table with all 7 signals', async () => {
    await writeSummary(makeData())
    const out = mockSummary._buffer.join('')
    expect(out).toContain('Code block')
    expect(out).toContain('Stack trace')
    expect(out).toContain('Version mention')
    expect(out).toContain('Repro keywords')
    expect(out).toContain('Expected/actual')
    expect(out).toContain('Minimal example')
    expect(out).toContain('Image only')
    expect(out).toMatch(/[✓✗]/)
  })

  it('S3: renders tier used, score, and type', async () => {
    await writeSummary(makeData())
    const out = mockSummary._buffer.join('')
    expect(out).toContain('baseline')
    expect(out).toContain('6/10')
    expect(out).toContain('bug')
  })

  it('S4: dry-run banner appears when dryRun=true', async () => {
    await writeSummary(makeData({ dryRun: true }))
    const out = mockSummary._buffer.join('')
    expect(out).toContain('Dry-run mode')
  })

  it('S5: comment URL rendered when commentUrl is non-null', async () => {
    await writeSummary(makeData({ commentUrl: 'https://github.com/o/r/issues/42#issuecomment-123' }))
    const out = mockSummary._buffer.join('')
    expect(out).toContain('https://github.com/o/r/issues/42#issuecomment-123')
  })

  it('S6: label action line present', async () => {
    await writeSummary(makeData({ labelAction: 'applied' }))
    const out = mockSummary._buffer.join('')
    expect(out).toContain('applied')
  })

  it('S7: GITHUB_STEP_SUMMARY missing → core.warning called, no throw', async () => {
    mockSummary.write.mockRejectedValueOnce(new Error('GITHUB_STEP_SUMMARY not set'))
    await expect(writeSummary(makeData())).resolves.toBeUndefined()
    expect(mockWarning).toHaveBeenCalledWith(
      expect.stringContaining('GITHUB_STEP_SUMMARY not set'),
    )
  })

  it('S4b: no dry-run banner when dryRun=false', async () => {
    await writeSummary(makeData({ dryRun: false }))
    const out = mockSummary._buffer.join('')
    expect(out).not.toContain('⚠️ Dry-run mode')
  })
})

describe('writeSkipSummary', () => {
  it('S8: single line with reason, no signals table', async () => {
    await writeSkipSummary('signal-oss-ignore label present')
    const out = mockSummary._buffer.join('')
    expect(out).toContain('signal-oss-ignore label present')
    expect(out).not.toContain('Code block')
    expect(out).not.toContain('Stack trace')
  })
})

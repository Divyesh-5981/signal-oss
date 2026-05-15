// src/core/checklist/strategies/shared.ts
// WR-04: shared logic extracted from IssueFormStrategy and TemplateMdStrategy.
// Pure — no Octokit, no fs, no adapters. Hexagonal invariant holds.

import type { IssueType, ParsedTemplate, Signals } from '../../types.js'

export const TYPE_KEYWORDS: Record<IssueType, string> = {
  bug: 'bug_report',
  feature: 'feature_request',
  question: 'question',
}

export const MAX_ITEMS = 5

// Maps common template field labels to signal keys for filtering.
// If a signal is true, the corresponding field is already provided — skip it.
export const FIELD_SIGNAL_MAP: Array<{ pattern: RegExp; signalKey: keyof Signals }> = [
  { pattern: /version|environment|env|platform|os/i, signalKey: 'hasVersionMention' },
  { pattern: /repro|steps to reproduce|how to reproduce/i, signalKey: 'hasReproKeywords' },
  { pattern: /stack\s*trace|error\s*(message|output|log)/i, signalKey: 'hasStackTrace' },
  { pattern: /expected|actual/i, signalKey: 'hasExpectedActual' },
  { pattern: /code|snippet|example|minimal/i, signalKey: 'hasMinimalExample' },
]

export function isFieldSatisfied(label: string, signals: Signals): boolean {
  for (const { pattern, signalKey } of FIELD_SIGNAL_MAP) {
    if (pattern.test(label) && signals[signalKey]) return true
  }
  return false
}

export function sanitizeFieldLabel(label: string): string {
  // T-02-09 follow-up: defang @mentions in user-authored template field labels
  // so they don't tag arbitrary users when rendered as comment text.
  return label.replace(/@/g, '(at)').trim()
}

// D-05 fallback: select fields by type keyword match, or deduplicated union of all templates.
export function selectByTypeOrUnion(type: IssueType, templates: ParsedTemplate[]): string[] {
  const keyword = TYPE_KEYWORDS[type]
  const matched = templates.find((t) => t.filename.toLowerCase().includes(keyword))
  if (matched) return matched.fields
  const seen = new Set<string>()
  const union: string[] = []
  for (const t of templates) {
    for (const f of t.fields) {
      if (!seen.has(f)) {
        seen.add(f)
        union.push(f)
      }
    }
  }
  return union
}

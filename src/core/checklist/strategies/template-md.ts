// src/core/checklist/strategies/template-md.ts
// Tier 2 (CHECK-04): consumes ParsedTemplate[] (type: 'md') from RepoContext.templates.
// Same selection rules as Tier 1 but only operates on markdown templates.

import type {
  ChecklistItem,
  ChecklistStrategy,
  IssueType,
  ParsedTemplate,
  RepoContext,
  Signals,
} from '../../types.js'

const TYPE_KEYWORDS: Record<IssueType, string> = {
  bug: 'bug_report',
  feature: 'feature_request',
  question: 'question',
}

const MAX_ITEMS = 5

// Maps common template field labels to signal keys for filtering.
// If a signal is true, the corresponding field is already provided — skip it.
const FIELD_SIGNAL_MAP: Array<{ pattern: RegExp; signalKey: keyof Signals }> = [
  { pattern: /version|environment|env|platform|os/i, signalKey: 'hasVersionMention' },
  { pattern: /repro|steps to reproduce|how to reproduce/i, signalKey: 'hasReproKeywords' },
  { pattern: /stack\s*trace|error\s*(message|output|log)/i, signalKey: 'hasStackTrace' },
  { pattern: /expected|actual/i, signalKey: 'hasExpectedActual' },
  { pattern: /code|snippet|example|minimal/i, signalKey: 'hasMinimalExample' },
]

function isFieldSatisfied(label: string, signals: Signals): boolean {
  for (const { pattern, signalKey } of FIELD_SIGNAL_MAP) {
    if (pattern.test(label) && signals[signalKey]) return true
  }
  return false
}

function sanitizeFieldLabel(label: string): string {
  return label.replace(/@/g, '(at)').trim()
}

function selectMdFields(type: IssueType, mds: ParsedTemplate[]): string[] {
  const keyword = TYPE_KEYWORDS[type]
  const matched = mds.find((t) => t.filename.toLowerCase().includes(keyword))
  if (matched) return matched.fields
  const seen = new Set<string>()
  const union: string[] = []
  for (const t of mds) {
    for (const f of t.fields) {
      if (!seen.has(f)) {
        seen.add(f)
        union.push(f)
      }
    }
  }
  return union
}

export class TemplateMdStrategy implements ChecklistStrategy {
  name = 'template-md'

  applies(ctx: RepoContext): boolean {
    if (!ctx.hasMdTemplates) return false
    return ctx.templates.some((t) => t.type === 'md' && t.fields.length > 0)
  }

  generate(type: IssueType, signals: Signals, ctx?: RepoContext): ChecklistItem[] {
    if (!ctx) return []
    const mds = ctx.templates.filter((t) => t.type === 'md')
    const fields = selectMdFields(type, mds)
    return fields
      .filter((label) => !isFieldSatisfied(label, signals))
      .map((label) => ({
        text: `Could you share the ${sanitizeFieldLabel(label).toLowerCase()}?`,
      }))
      .slice(0, MAX_ITEMS)
  }
}

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

  generate(type: IssueType, _signals: Signals, ctx?: RepoContext): ChecklistItem[] {
    if (!ctx) return []
    const mds = ctx.templates.filter((t) => t.type === 'md')
    const fields = selectMdFields(type, mds)
    return fields
      .map((label) => ({
        text: `Could you share the ${sanitizeFieldLabel(label).toLowerCase()}?`,
      }))
      .slice(0, MAX_ITEMS)
  }
}

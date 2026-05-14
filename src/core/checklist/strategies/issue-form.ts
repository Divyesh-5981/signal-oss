// src/core/checklist/strategies/issue-form.ts
// Tier 1 (CHECK-03): consumes ParsedTemplate[] (type: 'form') from RepoContext.templates.
// Pure — no Octokit, no fs. Templates are produced by src/adapters/github/templates.ts.

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
  // T-02-09 follow-up: defang @mentions in user-authored template field labels
  // so they don't tag arbitrary users when rendered as comment text.
  return label.replace(/@/g, '(at)').trim()
}

function selectFormFields(type: IssueType, forms: ParsedTemplate[]): string[] {
  const keyword = TYPE_KEYWORDS[type]
  const matched = forms.find((t) => t.filename.toLowerCase().includes(keyword))
  if (matched) return matched.fields
  // D-05 fallback: deduplicated union of all form templates' fields, preserving first-seen order
  const seen = new Set<string>()
  const union: string[] = []
  for (const t of forms) {
    for (const f of t.fields) {
      if (!seen.has(f)) {
        seen.add(f)
        union.push(f)
      }
    }
  }
  return union
}

export class IssueFormStrategy implements ChecklistStrategy {
  name = 'issue-form'

  applies(ctx: RepoContext): boolean {
    if (!ctx.hasIssueForms) return false
    return ctx.templates.some((t) => t.type === 'form' && t.fields.length > 0)
  }

  generate(type: IssueType, _signals: Signals, ctx?: RepoContext): ChecklistItem[] {
    if (!ctx) return []
    const forms = ctx.templates.filter((t) => t.type === 'form')
    const fields = selectFormFields(type, forms)
    return fields
      .map((label) => ({
        text: `Could you share the ${sanitizeFieldLabel(label).toLowerCase()}?`,
      }))
      .slice(0, MAX_ITEMS)
  }
}

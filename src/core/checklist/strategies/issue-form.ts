// src/core/checklist/strategies/issue-form.ts
// Tier 1 (CHECK-03): consumes ParsedTemplate[] (type: 'form') from RepoContext.templates.
// Pure — no Octokit, no fs. Templates are produced by src/adapters/github/templates.ts.

import type {
  ChecklistItem,
  ChecklistStrategy,
  IssueType,
  RepoContext,
  Signals,
} from '../../types.js'
import { MAX_ITEMS, isFieldSatisfied, sanitizeFieldLabel, selectByTypeOrUnion } from './shared.js'

export class IssueFormStrategy implements ChecklistStrategy {
  name = 'issue-form'

  applies(ctx: RepoContext): boolean {
    if (!ctx.hasIssueForms) return false
    return ctx.templates.some((t) => t.type === 'form' && t.fields.length > 0)
  }

  generate(type: IssueType, signals: Signals, ctx?: RepoContext): ChecklistItem[] {
    if (!ctx) return []
    const forms = ctx.templates.filter((t) => t.type === 'form')
    const fields = selectByTypeOrUnion(type, forms)
    return fields
      .filter((label) => !isFieldSatisfied(label, signals))
      .map((label) => ({
        text: `Could you share the ${sanitizeFieldLabel(label).toLowerCase()}?`,
      }))
      .slice(0, MAX_ITEMS)
  }
}

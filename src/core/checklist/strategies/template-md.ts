// src/core/checklist/strategies/template-md.ts
// Tier 2 (CHECK-04): consumes ParsedTemplate[] (type: 'md') from RepoContext.templates.
// Same selection rules as Tier 1 but only operates on markdown templates.

import type {
  ChecklistItem,
  ChecklistStrategy,
  IssueType,
  RepoContext,
  Signals,
} from '../../types.js'
import {
  MAX_ITEMS,
  isFieldSatisfied,
  sanitizeFieldLabel,
  selectByTypeOrUnion,
} from './shared.js'

export class TemplateMdStrategy implements ChecklistStrategy {
  name = 'template-md'

  applies(ctx: RepoContext): boolean {
    if (!ctx.hasMdTemplates) return false
    return ctx.templates.some((t) => t.type === 'md' && t.fields.length > 0)
  }

  generate(type: IssueType, signals: Signals, ctx?: RepoContext): ChecklistItem[] {
    if (!ctx) return []
    const mds = ctx.templates.filter((t) => t.type === 'md')
    const fields = selectByTypeOrUnion(type, mds)
    return fields
      .filter((label) => !isFieldSatisfied(label, signals))
      .map((label) => ({
        text: `Could you share the ${sanitizeFieldLabel(label).toLowerCase()}?`,
      }))
      .slice(0, MAX_ITEMS)
  }
}

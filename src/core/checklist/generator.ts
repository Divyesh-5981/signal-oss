// src/core/checklist/generator.ts
// CHECK-01: Strategy chain runner. First-applies-wins.

import type { ChecklistItem, ChecklistStrategy, IssueType, RepoContext, Signals } from '../types.js'
import { BaselineStrategy } from './strategies/baseline.js'
import { IssueFormStrategy } from './strategies/issue-form.js'
import { TemplateMdStrategy } from './strategies/template-md.js'

const STRATEGIES: ChecklistStrategy[] = [
  new IssueFormStrategy(), // Tier 1
  new TemplateMdStrategy(), // Tier 2
  // Phase 4 will prepend: ContributingStrategy (Tier 3)
  new BaselineStrategy(), // Tier 4 — always applies; must stay last
]

export function generateChecklist(
  signals: Signals,
  type: IssueType,
  ctx: RepoContext,
): { items: ChecklistItem[]; tierUsed: string } {
  for (const s of STRATEGIES) {
    if (s.applies(ctx)) {
      return { items: s.generate(type, signals, ctx), tierUsed: s.name }
    }
  }
  // Unreachable: BaselineStrategy.applies() always returns true.
  throw new Error('No checklist strategy applied — BaselineStrategy must always apply')
}

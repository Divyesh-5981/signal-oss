// src/core/checklist/generator.ts
// CHECK-01: Strategy chain runner. First-applies-wins.

import type { ChecklistItem, ChecklistStrategy, IssueType, RepoContext, Signals } from '../types.js'
import { BaselineStrategy } from './strategies/baseline.js'

const STRATEGIES: ChecklistStrategy[] = [
  // Phase 2 prepends: IssueFormStrategy, TemplateMdStrategy
  // Phase 4 prepends:  ContributingStrategy
  new BaselineStrategy(),
]

export function generateChecklist(
  signals: Signals,
  type: IssueType,
  ctx: RepoContext,
): { items: ChecklistItem[]; tierUsed: string } {
  for (const s of STRATEGIES) {
    if (s.applies(ctx)) {
      return { items: s.generate(type, signals), tierUsed: s.name }
    }
  }
  // Unreachable: BaselineStrategy.applies() always returns true.
  throw new Error('No checklist strategy applied — BaselineStrategy must always apply')
}

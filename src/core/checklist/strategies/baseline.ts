// src/core/checklist/strategies/baseline.ts
// Tier 4: Universal Baseline Strategy. Always applies (last in chain).

import type {
  ChecklistItem,
  ChecklistStrategy,
  IssueType,
  RepoContext,
  Signals,
} from '../../types.js'
import { BASELINE_ITEMS } from '../baselines.js'

export class BaselineStrategy implements ChecklistStrategy {
  name = 'baseline'

  applies(_ctx: RepoContext): boolean {
    return true
  }

  generate(type: IssueType, signals: Signals): ChecklistItem[] {
    const items = BASELINE_ITEMS[type]
    // Filter out items already satisfied by signals (per RESEARCH "Filtering logic")
    return items.filter((item) => {
      if (!item.signalKey) return true
      return signals[item.signalKey] === false
    })
  }
}

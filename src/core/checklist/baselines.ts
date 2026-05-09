// src/core/checklist/baselines.ts
// Tier-4 (CHECK-02) baseline checklist content per IssueType.
// 3-4 items each (D-05). 'Could you share...' question framing (D-06, CORE-06).
// Each item has a signalKey so satisfied items can be filtered out.

import type { ChecklistItem, IssueType } from '../types.js'

export const BASELINE_ITEMS: Record<IssueType, readonly ChecklistItem[]> = {
  bug: [
    { text: 'Could you share the steps to reproduce the issue?', signalKey: 'hasReproKeywords' },
    {
      text: "Could you share the version of the library/tool you're using?",
      signalKey: 'hasVersionMention',
    },
    {
      text: 'Could you share any error messages or stack traces you saw?',
      signalKey: 'hasStackTrace',
    },
    {
      text: 'Could you provide a minimal reproduction (a small code snippet)?',
      signalKey: 'hasMinimalExample',
    },
  ],
  feature: [
    { text: 'Could you describe the problem this feature would solve?' },
    {
      text: "Could you share example code showing how you'd expect to use it?",
      signalKey: 'hasMinimalExample',
    },
    { text: "Could you describe any alternatives you've considered?" },
  ],
  question: [
    { text: "Could you share what you've already tried?" },
    {
      text: 'Could you share the relevant version or environment details?',
      signalKey: 'hasVersionMention',
    },
    {
      text: 'Could you provide a minimal example that shows your setup?',
      signalKey: 'hasMinimalExample',
    },
  ],
}

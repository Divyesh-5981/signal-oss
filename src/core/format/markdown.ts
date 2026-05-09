// src/core/format/markdown.ts
// CORE-05: markdown comment formatter per D-07.
// CORE-06: tone style guide enforced by no 'Required:' / 'Must:' / 'Invalid' static strings here.
// ACT-05: emits the <!-- signal-oss:v1 --> idempotency marker.

import type { ScoredIssue } from '../types.js'

export const MARKER = '<!-- signal-oss:v1 -->'

const INTRO_HAS_ITEMS =
  'Thanks for opening this issue! To help us investigate, a few things seem to be missing:'
const INTRO_NO_ITEMS = 'This issue looks well-formed — no missing info detected.'
const META_NUDGE =
  '> **Tip:** adding an issue template to `.github/ISSUE_TEMPLATE/` helps reporters include the right information upfront.'
const CLOSING_HAS_ITEMS =
  "Once these are added, we'll take another look. Thanks for helping make this actionable!"

export function format(scored: ScoredIssue): string {
  const { items, score } = scored
  const hasItems = items.length > 0

  const intro = hasItems ? INTRO_HAS_ITEMS : INTRO_NO_ITEMS
  const checklist = hasItems ? items.map((i) => `- [ ] ${i.text}`).join('\n') : ''
  const badge = `**Actionability score: ${score}/10**`
  const closing = hasItems ? CLOSING_HAS_ITEMS : ''

  // Filter empty sections; preserve D-07 ordering.
  const sections = [intro, checklist, badge, META_NUDGE, closing, MARKER].filter(
    (s) => s.length > 0,
  )

  return sections.join('\n\n')
}

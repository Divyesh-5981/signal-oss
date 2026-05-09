// src/core/classifier/issue-type.ts
// CORE-03: Pure issue-type classifier.
// Precedence: existing labels → title regex → body keyword/signals → default 'bug'.
// No LLM. No I/O.

import type { Issue, IssueType, Signals } from '../types.js'

const LABEL_BUG     = /^(bug|crash|defect|regression)$/i
const LABEL_FEATURE = /^(feat(ure)?|enhancement|improvement)$/i
const LABEL_QUESTION = /^(question|support|help|q&a|discussion)$/i

const TITLE_BUG_PATTERNS     = [/^\s*\[bug\]/i, /^bug:/i, /\bcrash(es|ing)?\b/i, /\bbroken\b/i, /\bregression\b/i]
const TITLE_FEATURE_PATTERNS = [/^feat(ure)?:/i, /^\[(feat|feature|rfc)\]/i, /\bfeature request\b/i, /\bwould be (nice|great)\b/i, /\benhancement\b/i]
const TITLE_QUESTION_PATTERNS = [/^how (do i|to|can i)\b/i, /^why\b/i, /^what\b/i, /^\?/, /\bquestion\b.*[?:]/i]

const BODY_FEATURE_KEYWORDS = /\bwould be (nice|great)\b|\bfeature request\b|\bplease add\b|\bsupport for\b/i
const BODY_QUESTION_KEYWORDS = /^how (do i|to|can i)\b/i

export function classifyType(issue: Issue, signals: Signals): IssueType {
  // 1. Label precedence (case-insensitive trim)
  for (const labelRaw of issue.labels ?? []) {
    const label = labelRaw.trim()
    if (LABEL_BUG.test(label))      return 'bug'
    if (LABEL_FEATURE.test(label))  return 'feature'
    if (LABEL_QUESTION.test(label)) return 'question'
  }

  // 2. Title patterns
  const title = issue.title ?? ''
  if (TITLE_BUG_PATTERNS.some((re) => re.test(title)))      return 'bug'
  if (TITLE_FEATURE_PATTERNS.some((re) => re.test(title)))  return 'feature'
  if (TITLE_QUESTION_PATTERNS.some((re) => re.test(title))) return 'question'

  // 3. Body keyword + signal weighting
  const body = issue.body ?? ''
  if (signals.hasStackTrace || signals.hasExpectedActual) return 'bug'
  if (BODY_FEATURE_KEYWORDS.test(body))  return 'feature'
  if (BODY_QUESTION_KEYWORDS.test(body)) return 'question'

  // 4. Default
  return 'bug'
}

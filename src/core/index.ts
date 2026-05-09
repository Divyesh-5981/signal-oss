// src/core/index.ts
// CORE-01: pure score() entrypoint. Real pipeline (no longer Plan 02 stub).
// PHASE 1: llm parameter is accepted but always passed null. Phase 4 wires it.
// CRITICAL: This file MUST NOT import from @octokit, @actions, fs, https, or any LLM SDK.

import { generateChecklist } from './checklist/generator.js'
import { classifyType } from './classifier/issue-type.js'
import { extractSignals } from './heuristics/extractor.js'
import type { LLMPort } from './llm/port.js'
import { computeScore } from './score/compute.js'
import type { Issue, RepoContext, ScoredIssue } from './types.js'

export function score(
  issue: Issue,
  repoContext: RepoContext,
  llm: LLMPort | null = null,
): ScoredIssue {
  // Phase 1: llm is always null. Phase 4 will wire gray-zone adjudication here.
  void llm

  const signals = extractSignals(issue)
  const issueType = classifyType(issue, signals)
  const { items, tierUsed } = generateChecklist(signals, issueType, repoContext)
  const { score: scoreValue, isGrayZone } = computeScore(signals)

  return {
    score: scoreValue,
    missing: items.map((i) => i.text),
    signals,
    issueType,
    isGrayZone,
    items,
    tierUsed,
  }
}

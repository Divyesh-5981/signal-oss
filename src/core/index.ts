// The pure score() entrypoint. PHASE 1: returns hardcoded values (Walking Skeleton stub).
// Plan 04 replaces the stub body with the real heuristic pipeline.
// CRITICAL: This file MUST NOT import from @octokit, @actions, fs, https, or any LLM SDK.

import type { Issue, RepoContext, ScoredIssue, Signals } from './types.js'
import type { LLMPort } from './llm/port.js'

export function score(
  issue: Issue,
  repoContext: RepoContext,
  llm: LLMPort | null = null,
): ScoredIssue {
  // Phase 1 stub — Plan 04 replaces this body with extractSignals + classifyType + generateChecklist + computeScore.
  // The hardcoded values exist solely to prove the wiring works end-to-end (Walking Skeleton Stage A).
  // The fact that `repoContext` and `llm` parameters are accepted-but-unused is intentional: the signature is locked.
  void issue
  void repoContext
  void llm

  const signals: Signals = {
    hasCodeBlock: false,
    hasStackTrace: false,
    hasVersionMention: false,
    hasReproKeywords: false,
    hasExpectedActual: false,
    hasMinimalExample: false,
    hasImageOnly: false,
  }

  return {
    score: 5,
    missing: ['version'],
    signals,
    issueType: 'bug',
    isGrayZone: true,
    items: [{ text: 'Could you share your version?', signalKey: 'hasVersionMention' }],
    tierUsed: 'baseline-stub',
  }
}

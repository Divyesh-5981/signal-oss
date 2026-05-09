import type { Issue, RepoContext, Signals } from '../types.js'

export interface LLMRequest {
  issue: Issue
  signals: Signals
  repoContext: RepoContext
}

export interface LLMVerdict {
  score: number
  rationale: string
  missing: string[]
}

export interface LLMPort {
  adjudicate(req: LLMRequest): Promise<LLMVerdict>
}

// Phase 1 DTOs — locked in SKELETON.md section A6.
// DO NOT add fields without updating SKELETON.md and notifying downstream phases.
// Phase 2+ may EXTEND these types, but Phase 1 plans MUST NOT change their shape.

export interface Issue {
  title: string
  body: string
  labels: string[]
}

export interface Signals {
  hasCodeBlock: boolean
  hasStackTrace: boolean
  hasVersionMention: boolean
  hasReproKeywords: boolean
  hasExpectedActual: boolean
  hasMinimalExample: boolean
  hasImageOnly: boolean
}

export type IssueType = 'bug' | 'feature' | 'question'

export interface RepoContext {
  hasIssueForms: boolean
  hasMdTemplates: boolean
  hasContributing: boolean
  templates: unknown[]
}

export interface ChecklistItem {
  text: string
  signalKey?: keyof Signals
}

export interface ScoredIssue {
  score: number
  missing: string[]
  signals: Signals
  issueType: IssueType
  isGrayZone: boolean
  items: ChecklistItem[]
  tierUsed: string
}

// src/action/summary.ts
// ACT-09: rich workflow-run UI report via core.summary. Per D-09 (full report), D-10 (dry-run
// banner), D-11 (one-line skip-summary on early exit). $GITHUB_STEP_SUMMARY may be absent in
// local-action testing — wrap writes in try/catch and surface failures via core.warning.

import * as core from '@actions/core'
import type { LabelAction } from '../adapters/github/labels.js'
import type { Issue, RepoContext, ScoredIssue } from '../core/types.js'

export interface SummaryData {
  issue: Issue
  issueNumber: number
  scored: ScoredIssue
  labelAction: LabelAction
  commentUrl: string | null
  repoContext: RepoContext
  dryRun: boolean
}

type SignalKey = keyof ScoredIssue['signals']

const SIGNAL_LABELS: Array<[SignalKey, string]> = [
  ['hasCodeBlock', 'Code block'],
  ['hasStackTrace', 'Stack trace'],
  ['hasVersionMention', 'Version mention'],
  ['hasReproKeywords', 'Repro keywords'],
  ['hasExpectedActual', 'Expected/actual'],
  ['hasMinimalExample', 'Minimal example'],
  ['hasImageOnly', 'Image only'],
]

export async function writeSummary(data: SummaryData): Promise<void> {
  try {
    if (data.dryRun) {
      core.summary.addRaw(
        '⚠️ **Dry-run mode** — no comment was posted, no labels were changed.\n\n',
        true,
      )
    }
    core.summary.addRaw(`## Signal-OSS: #${data.issueNumber} ${data.issue.title}\n\n`, true)
    core.summary.addRaw(
      `**Type:** ${data.scored.issueType} | **Score:** ${data.scored.score}/10 | **Tier:** ${data.scored.tierUsed} | **Templates:** ${data.repoContext.templates.length}\n\n`,
      true,
    )

    const rows: Array<Array<string | { data: string; header: true }>> = [
      [
        { data: 'Signal', header: true },
        { data: 'Detected', header: true },
      ],
      ...SIGNAL_LABELS.map(([key, label]) => [label, data.scored.signals[key] ? '✓' : '✗']),
    ]
    core.summary.addTable(rows)

    core.summary.addRaw(`\n**Label:** ${data.labelAction}\n`, true)
    if (data.commentUrl) {
      core.summary.addRaw(`**Comment:** ${data.commentUrl}\n`, true)
    }
    await core.summary.write()
  } catch (err: unknown) {
    core.warning(`Could not write workflow summary: ${(err as Error).message}`)
  }
}

export async function writeSkipSummary(reason: string): Promise<void> {
  try {
    core.summary.addRaw(`Signal-OSS: Skipped — reason: ${reason}\n`, true)
    await core.summary.write()
  } catch (err: unknown) {
    core.warning(`Could not write skip summary: ${(err as Error).message}`)
  }
}

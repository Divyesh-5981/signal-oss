// src/action/main.ts
// ACT-04: bot-loop guard. ACT-02: only listens to issues events (workflow scopes triggers).
// ACT-07: reads all 8 inputs. ACT-08: signal-oss-ignore skip-label. ACT-09: rich core.summary.
// ACT-06: label management runs after hero comment; never blocks it.
// The orchestrator is intentionally thin — all logic lives in src/core/ and src/adapters/.

import * as core from '@actions/core'
import * as github from '@actions/github'
import { postOrUpdateComment } from '../adapters/github/io.js'
import type { LabelAction } from '../adapters/github/labels.js'
import { applyLabel, ensureLabel, removeLabel } from '../adapters/github/labels.js'
import { loadRepoContext } from '../adapters/github/templates.js'
import { format } from '../core/format/markdown.js'
import { score } from '../core/index.js'
import type { Issue } from '../core/types.js'
import { writeSkipSummary, writeSummary } from './summary.js'

export async function run(): Promise<void> {
  // ACT-04: belt-and-suspenders bot-loop guard (workflow YAML has its own if: condition).
  // WR-01: block all [bot] actors (dependabot[bot], renovate[bot], etc.), not just github-actions[bot].
  if (github.context.actor.endsWith('[bot]')) {
    core.info(`Skipping — triggered by bot actor: ${github.context.actor}`)
    return
  }

  const payload = github.context.payload
  if (!payload.issue) {
    core.info('Skipping — not an issue event (no payload.issue).')
    return
  }

  const issue: Issue = {
    title: typeof payload.issue.title === 'string' ? payload.issue.title : '',
    body: typeof payload.issue.body === 'string' ? payload.issue.body : '',
    labels: Array.isArray(payload.issue.labels)
      ? payload.issue.labels
          .map((l: { name?: string } | string) =>
            typeof l === 'string' ? l : typeof l?.name === 'string' ? l.name : '',
          )
          .filter((s: string) => s.length > 0)
      : [],
  }

  // WR-02: safe integer parser — returns fallback when parseInt yields NaN or non-positive value.
  function parsePositiveInt(raw: string, fallback: number): number {
    const v = parseInt(raw, 10)
    return Number.isFinite(v) && v > 0 ? v : fallback
  }

  // ACT-07: Read all 8 inputs
  const dryRun = core.getBooleanInput('dry-run')
  const enableComments = core.getBooleanInput('enable-comments')
  const enableLabels = core.getBooleanInput('enable-labels')
  const labelName = core.getInput('label-name') || 'needs-info'
  const _model = core.getInput('model') // consumed by Phase 4
  const _grayZoneLow = parsePositiveInt(core.getInput('gray-zone-low') || '4', 4) // consumed by Phase 3
  const _grayZoneHigh = parsePositiveInt(core.getInput('gray-zone-high') || '6', 6) // consumed by Phase 3
  const maxBodyBytes = parsePositiveInt(core.getInput('max-body-bytes') || '10000', 10000)

  // ACT-08: Skip-label check — earliest exit before any I/O (D-11)
  if (issue.labels.includes('signal-oss-ignore')) {
    await writeSkipSummary('signal-oss-ignore label present')
    return
  }

  // Octokit + repo setup
  const token = core.getInput('github-token') || process.env.GITHUB_TOKEN
  if (!token) {
    throw new Error('Missing GITHUB_TOKEN — set GITHUB_TOKEN env or github-token input.')
  }
  const octokit = github.getOctokit(token)
  const { owner, repo } = github.context.repo
  const issueNumber = payload.issue.number as number
  const defaultBranch =
    (payload.repository as { default_branch?: string } | undefined)?.default_branch ?? 'main'

  // Phase 2: real template loading (replaces Phase 1 stub)
  const repoContext = await loadRepoContext(octokit, owner, repo, defaultBranch)

  // T-02-21: Truncate oversized issue body before scoring (mitigates DoS via large pastes)
  if (issue.body.length > maxBodyBytes) {
    issue.body = issue.body.slice(0, maxBodyBytes)
  }

  const scored = score(issue, repoContext, null)
  const body = format(scored, repoContext)

  // Hero comment — always first; label/summary failures cannot block it
  let commentResult: { commentId: number; action: 'created' | 'updated' } | null = null
  if (!dryRun && enableComments) {
    commentResult = await postOrUpdateComment(octokit, owner, repo, issueNumber, body)
  }

  // ACT-06: Label management after hero comment
  let labelAction: LabelAction = 'disabled'
  if (dryRun) {
    labelAction = 'dry-run'
  } else if (enableLabels) {
    await ensureLabel(
      octokit,
      owner,
      repo,
      labelName,
      '#e4e669',
      'Waiting for more information from the issue author',
    )
    if (scored.items.length > 0) {
      labelAction = await applyLabel(octokit, owner, repo, issueNumber, labelName)
    } else {
      labelAction = await removeLabel(octokit, owner, repo, issueNumber, labelName)
    }
  }

  const commentUrl =
    commentResult !== null
      ? `https://github.com/${owner}/${repo}/issues/${issueNumber}#issuecomment-${commentResult.commentId}`
      : null

  // ACT-09: Rich summary report
  await writeSummary({ issue, issueNumber, scored, labelAction, commentUrl, repoContext, dryRun })

  core.info(
    `Signal-OSS: issue #${issueNumber} scored=${scored.score}, type=${scored.issueType}, ` +
      `tier=${scored.tierUsed}, items=${scored.items.length}, label=${labelAction}.`,
  )
}

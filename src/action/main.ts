// src/action/main.ts
// ACT-04: bot-loop guard. ACT-02: only listens to issues events (workflow scopes triggers).
// The orchestrator is intentionally thin — all logic lives in src/core/ and src/adapters/.

import * as core from '@actions/core'
import * as github from '@actions/github'
import { postOrUpdateComment } from '../adapters/github/io.js'
import { format } from '../core/format/markdown.js'
import { score } from '../core/index.js'
import type { Issue, RepoContext } from '../core/types.js'

export async function run(): Promise<void> {
  // ACT-04: belt-and-suspenders bot-loop guard (workflow YAML has its own if: condition).
  if (github.context.actor === 'github-actions[bot]') {
    core.info('Skipping — triggered by github-actions[bot] actor (bot-loop guard).')
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

  // Phase 1 stub repo context — Phase 2 implements real template loading.
  const repoContext: RepoContext = {
    hasIssueForms: false,
    hasMdTemplates: false,
    hasContributing: false,
    templates: [],
  }

  const scored = score(issue, repoContext, null)
  const body = format(scored)

  const token = core.getInput('github-token') || process.env.GITHUB_TOKEN
  if (!token) {
    throw new Error('Missing GITHUB_TOKEN — set GITHUB_TOKEN env or github-token input.')
  }
  const octokit = github.getOctokit(token)
  const { owner, repo } = github.context.repo
  const issueNumber = payload.issue.number as number

  const result = await postOrUpdateComment(octokit, owner, repo, issueNumber, body)

  core.info(
    `Signal-OSS comment ${result.action} on issue #${issueNumber} ` +
      `(commentId=${result.commentId}, score=${scored.score}, type=${scored.issueType}, ` +
      `tier=${scored.tierUsed}, items=${scored.items.length}).`,
  )
}

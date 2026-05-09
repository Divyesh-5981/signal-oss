// Phase 1 stub — Plan 05 replaces this body with real Octokit calls + bot-loop guard + payload parsing.
// For now: import score(), call it with a synthetic Issue, log the result, exit cleanly.
// This proves the Walking Skeleton: ESM imports resolve, Rollup bundles, dist/index.js exists.

import * as core from '@actions/core'
import { score } from '../core/index.js'
import type { Issue, RepoContext } from '../core/types.js'

async function run(): Promise<void> {
  const stubIssue: Issue = {
    title: 'Stub issue (Plan 02 — replaced in Plan 05)',
    body: '',
    labels: [],
  }
  const stubRepoContext: RepoContext = {
    hasIssueForms: false,
    hasMdTemplates: false,
    hasContributing: false,
    templates: [],
  }

  const result = score(stubIssue, stubRepoContext, null)
  core.info(
    `Signal-OSS stub run — score=${result.score} type=${result.issueType} items=${result.items.length}`,
  )
}

run().catch((err) => {
  core.setFailed(err instanceof Error ? err.message : String(err))
})

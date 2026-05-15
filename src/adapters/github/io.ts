// src/adapters/github/io.ts
// ACT-05: comment idempotency. Find-existing-by-marker → update OR create.
// Adapters layer: Octokit lives here. NEVER imported by src/core/.

import type * as github from '@actions/github'
import { MARKER } from '../../core/format/markdown.js'

type OctokitInstance = ReturnType<typeof github.getOctokit>

export async function postOrUpdateComment(
  octokit: OctokitInstance,
  owner: string,
  repo: string,
  issueNumber: number,
  body: string,
): Promise<{ commentId: number; action: 'created' | 'updated' }> {
  // Step 1: paginate all comments to find existing Signal-OSS marker (CR-01).
  // Single-page fetch misses the marker when an issue has >100 comments, causing
  // duplicate comments on every re-triage. octokit.paginate walks all pages.
  const comments = await octokit.paginate(octokit.rest.issues.listComments, {
    owner,
    repo,
    issue_number: issueNumber,
    per_page: 100,
  })

  // Step 2: find a Signal-OSS comment by literal marker substring.
  const existing = comments.find((c) => typeof c.body === 'string' && c.body.includes(MARKER))

  if (existing) {
    // Step 3a: update in place.
    await octokit.rest.issues.updateComment({
      owner,
      repo,
      comment_id: existing.id,
      body,
    })
    return { commentId: existing.id, action: 'updated' }
  }

  // Step 3b: create a new comment.
  const result = await octokit.rest.issues.createComment({
    owner,
    repo,
    issue_number: issueNumber,
    body,
  })
  return { commentId: result.data.id, action: 'created' }
}

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
  // Step 1: list existing comments. Phase 1 reads first page only (per_page: 100).
  // Phase 2 may add pagination if it ever matters.
  const { data: comments } = await octokit.rest.issues.listComments({
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

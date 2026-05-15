// src/adapters/github/labels.ts
// ACT-06: label management adapter. Three idempotent operations:
//   ensureLabel  — D-13: create if missing, silent succeed if exists (no overwrite)
//   applyLabel   — D-14: add label to issue (unconditional re-apply allowed)
//   removeLabel  — Pitfall 7: 404 is silent success
// All errors caught + surfaced via core.warning; label failure NEVER blocks the hero comment.

import * as core from '@actions/core'
import type * as github from '@actions/github'

type OctokitInstance = ReturnType<typeof github.getOctokit>

export type LabelAction = 'applied' | 'removed' | 'skipped' | 'error' | 'disabled' | 'dry-run'

export async function ensureLabel(
  octokit: OctokitInstance,
  owner: string,
  repo: string,
  name: string,
  color: string,
  description: string,
): Promise<void> {
  try {
    await octokit.rest.issues.getLabel({ owner, repo, name })
    // D-13: exists → silent succeed, do NOT overwrite color/description
    return
  } catch (err: unknown) {
    const status = (err as { status?: number }).status
    if (status !== 404) {
      core.warning(`Could not check label "${name}": ${(err as Error).message}`)
      return
    }
  }
  try {
    await octokit.rest.issues.createLabel({
      owner,
      repo,
      name,
      color: color.replace(/^#/, ''),
      description,
    })
  } catch (createErr: unknown) {
    core.warning(`Could not create label "${name}": ${(createErr as Error).message}`)
  }
}

export async function applyLabel(
  octokit: OctokitInstance,
  owner: string,
  repo: string,
  issueNumber: number,
  name: string,
): Promise<'applied' | 'error'> {
  try {
    await octokit.rest.issues.addLabels({
      owner,
      repo,
      issue_number: issueNumber,
      labels: [name],
    })
    return 'applied'
  } catch (err: unknown) {
    core.warning(`Could not apply label "${name}": ${(err as Error).message}`)
    return 'error'
  }
}

export async function removeLabel(
  octokit: OctokitInstance,
  owner: string,
  repo: string,
  issueNumber: number,
  name: string,
): Promise<'removed' | 'skipped' | 'error'> {
  try {
    await octokit.rest.issues.removeLabel({
      owner,
      repo,
      issue_number: issueNumber,
      name,
    })
    return 'removed'
  } catch (err: unknown) {
    const status = (err as { status?: number }).status
    // Pitfall 7: 404 means label wasn't on the issue — desired state already achieved
    if (status === 404) {
      return 'skipped'
    }
    core.warning(`Could not remove label "${name}": ${(err as Error).message}`)
    return 'error'
  }
}

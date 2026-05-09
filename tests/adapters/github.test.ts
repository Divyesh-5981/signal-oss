import { describe, it, expect, vi } from 'vitest'
import { postOrUpdateComment } from '../../src/adapters/github/io.js'
import { MARKER } from '../../src/core/format/markdown.js'

function makeOctokit(comments: Array<{ id: number; body?: string }>) {
  const listComments = vi.fn().mockResolvedValue({ data: comments })
  const createComment = vi.fn().mockResolvedValue({ data: { id: 9999 } })
  const updateComment = vi.fn().mockResolvedValue({ data: {} })
  const octokit = {
    rest: {
      issues: { listComments, createComment, updateComment },
    },
  } as unknown as Parameters<typeof postOrUpdateComment>[0]
  return { octokit, listComments, createComment, updateComment }
}

describe('postOrUpdateComment — create branch (no existing marker)', () => {
  it('listComments returns empty → createComment is called once with body', async () => {
    const { octokit, listComments, createComment, updateComment } = makeOctokit([])
    const result = await postOrUpdateComment(octokit, 'owner', 'repo', 42, `hello ${MARKER}`)
    expect(listComments).toHaveBeenCalledTimes(1)
    expect(listComments).toHaveBeenCalledWith({
      owner: 'owner', repo: 'repo', issue_number: 42, per_page: 100,
    })
    expect(createComment).toHaveBeenCalledTimes(1)
    expect(createComment).toHaveBeenCalledWith({
      owner: 'owner', repo: 'repo', issue_number: 42, body: `hello ${MARKER}`,
    })
    expect(updateComment).not.toHaveBeenCalled()
    expect(result.action).toBe('created')
  })

  it('listComments returns comments without marker → still createComment', async () => {
    const { octokit, createComment, updateComment } = makeOctokit([
      { id: 1, body: 'random comment' },
      { id: 2, body: 'another comment with no marker' },
    ])
    await postOrUpdateComment(octokit, 'owner', 'repo', 42, `body ${MARKER}`)
    expect(createComment).toHaveBeenCalledTimes(1)
    expect(updateComment).not.toHaveBeenCalled()
  })

  it('listComments called with per_page: 100', async () => {
    const { octokit, listComments } = makeOctokit([])
    await postOrUpdateComment(octokit, 'owner', 'repo', 1, 'body')
    expect(listComments).toHaveBeenCalledWith(expect.objectContaining({ per_page: 100 }))
  })
})

describe('postOrUpdateComment — update branch (marker found)', () => {
  it('single marker comment → updateComment is called with that id', async () => {
    const { octokit, createComment, updateComment } = makeOctokit([
      { id: 7, body: `existing signal-oss comment ${MARKER}` },
    ])
    const result = await postOrUpdateComment(octokit, 'owner', 'repo', 42, `new ${MARKER}`)
    expect(updateComment).toHaveBeenCalledTimes(1)
    expect(updateComment).toHaveBeenCalledWith({
      owner: 'owner', repo: 'repo', comment_id: 7, body: `new ${MARKER}`,
    })
    expect(createComment).not.toHaveBeenCalled()
    expect(result).toEqual({ commentId: 7, action: 'updated' })
  })

  it('marker comment among other bot comments → only marker comment is updated', async () => {
    const { octokit, updateComment } = makeOctokit([
      { id: 1, body: 'other bot comment' },
      { id: 2, body: `signal-oss ${MARKER}` },
      { id: 3, body: 'yet another comment' },
    ])
    await postOrUpdateComment(octokit, 'owner', 'repo', 42, `new ${MARKER}`)
    expect(updateComment).toHaveBeenCalledWith(expect.objectContaining({ comment_id: 2 }))
  })

  it('first marker wins when multiple marker comments exist', async () => {
    const { octokit, updateComment } = makeOctokit([
      { id: 5, body: `first ${MARKER}` },
      { id: 6, body: `second ${MARKER}` },
    ])
    await postOrUpdateComment(octokit, 'owner', 'repo', 42, `new ${MARKER}`)
    expect(updateComment).toHaveBeenCalledWith(expect.objectContaining({ comment_id: 5 }))
  })

  it('comment with marker as substring still triggers update', async () => {
    const { octokit, updateComment } = makeOctokit([
      { id: 11, body: `prefix\n${MARKER}\nsuffix` },
    ])
    await postOrUpdateComment(octokit, 'owner', 'repo', 42, `body ${MARKER}`)
    expect(updateComment).toHaveBeenCalledWith(expect.objectContaining({ comment_id: 11 }))
  })
})

describe('postOrUpdateComment — Octokit error propagation', () => {
  it('listComments rejection bubbles up', async () => {
    const listComments = vi.fn().mockRejectedValue(new Error('boom'))
    const octokit = { rest: { issues: { listComments } } } as unknown as Parameters<typeof postOrUpdateComment>[0]
    await expect(postOrUpdateComment(octokit, 'o', 'r', 1, 'b')).rejects.toThrow('boom')
  })

  it('createComment rejection bubbles up', async () => {
    const listComments = vi.fn().mockResolvedValue({ data: [] })
    const createComment = vi.fn().mockRejectedValue(new Error('network error'))
    const octokit = { rest: { issues: { listComments, createComment } } } as unknown as Parameters<typeof postOrUpdateComment>[0]
    await expect(postOrUpdateComment(octokit, 'o', 'r', 1, 'b')).rejects.toThrow('network error')
  })
})

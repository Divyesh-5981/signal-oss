import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mocks must be declared at module scope (vi.mock is hoisted).
const mockListComments = vi.fn()
const mockCreateComment = vi.fn()
const mockUpdateComment = vi.fn()
const mockGetOctokit = vi.fn(() => ({
  rest: {
    issues: {
      listComments: mockListComments,
      createComment: mockCreateComment,
      updateComment: mockUpdateComment,
    },
  },
}))
const mockInfo = vi.fn()
const mockSetFailed = vi.fn()
const mockGetInput = vi.fn().mockReturnValue('')

const mockContext = {
  actor: 'test-user',
  repo: { owner: 'test-user', repo: 'signal-oss-sandbox' },
  payload: {
    issue: { number: 42, title: 'crash', body: '', labels: [] },
  },
}

vi.mock('@actions/github', () => ({
  context: mockContext,
  getOctokit: mockGetOctokit,
}))

vi.mock('@actions/core', () => ({
  info: mockInfo,
  setFailed: mockSetFailed,
  getInput: mockGetInput,
  debug: vi.fn(),
}))

beforeEach(() => {
  vi.clearAllMocks()
  process.env.GITHUB_TOKEN = 'test-token'
  mockContext.actor = 'test-user'
  mockContext.payload = { issue: { number: 42, title: 'crash', body: '', labels: [] } }
  mockListComments.mockResolvedValue({ data: [] })
  mockCreateComment.mockResolvedValue({ data: { id: 999 } })
})

describe('main.ts orchestrator', () => {
  it('happy path: posts a new comment when no marker exists', async () => {
    await import('../../src/action/main.js')
    // run() is invoked at module top — wait a tick for the promise chain.
    await new Promise((r) => setTimeout(r, 50))
    expect(mockListComments).toHaveBeenCalledWith(
      expect.objectContaining({
        owner: 'test-user', repo: 'signal-oss-sandbox', issue_number: 42, per_page: 100,
      }),
    )
    expect(mockCreateComment).toHaveBeenCalledTimes(1)
    const callArg = mockCreateComment.mock.calls[0][0]
    expect(callArg.body).toContain('<!-- signal-oss:v1 -->')
    expect(callArg.body).toContain('Actionability score:')
    expect(mockSetFailed).not.toHaveBeenCalled()
  })

  // Note: re-importing main.js in the same test process re-runs run() — vitest's module cache
  // means only the first import fires run(). Bot-actor and missing-issue branches are exercised
  // via the in-process logic and verified at the human-verify checkpoint (Task 3).
  // Phase 2 may export run() for cleaner isolation.
})

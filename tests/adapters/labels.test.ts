import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as core from '@actions/core'
import {
  ensureLabel,
  applyLabel,
  removeLabel,
  type LabelAction,
} from '../../src/adapters/github/labels.js'

vi.mock('@actions/core', () => ({
  warning: vi.fn(),
  info: vi.fn(),
}))

type Fn = ReturnType<typeof vi.fn>

function makeOctokit(overrides: {
  getLabel?: Fn
  createLabel?: Fn
  addLabels?: Fn
  removeLabel?: Fn
}) {
  const getLabel = overrides.getLabel ?? vi.fn().mockResolvedValue({ data: {} })
  const createLabel = overrides.createLabel ?? vi.fn().mockResolvedValue({ data: {} })
  const addLabels = overrides.addLabels ?? vi.fn().mockResolvedValue({ data: {} })
  const remove = overrides.removeLabel ?? vi.fn().mockResolvedValue({ data: {} })
  const octokit = {
    rest: {
      issues: { getLabel, createLabel, addLabels, removeLabel: remove },
    },
  } as unknown as Parameters<typeof ensureLabel>[0]
  return { octokit, getLabel, createLabel, addLabels, removeLabel: remove }
}

function httpError(status: number, message = 'err'): Error & { status: number } {
  return Object.assign(new Error(message), { status })
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('ensureLabel — label exists (D-13: no overwrite)', () => {
  it('Test 1: getLabel resolves → createLabel NOT called, no warning', async () => {
    const { octokit, getLabel, createLabel } = makeOctokit({
      getLabel: vi.fn().mockResolvedValue({ data: { name: 'needs-info' } }),
    })
    await ensureLabel(octokit, 'o', 'r', 'needs-info', '#e4e669', 'desc')
    expect(getLabel).toHaveBeenCalledTimes(1)
    expect(createLabel).not.toHaveBeenCalled()
    expect(core.warning).not.toHaveBeenCalled()
  })
})

describe('ensureLabel — label missing (404 → create)', () => {
  it('Test 2: getLabel 404 → createLabel called with stripped color (no #)', async () => {
    const { octokit, createLabel } = makeOctokit({
      getLabel: vi.fn().mockRejectedValue(httpError(404, 'not found')),
      createLabel: vi.fn().mockResolvedValue({ data: {} }),
    })
    await ensureLabel(octokit, 'o', 'r', 'needs-info', '#e4e669', 'Waiting for more info')
    expect(createLabel).toHaveBeenCalledTimes(1)
    expect(createLabel).toHaveBeenCalledWith({
      owner: 'o',
      repo: 'r',
      name: 'needs-info',
      color: 'e4e669',
      description: 'Waiting for more info',
    })
    expect(core.warning).not.toHaveBeenCalled()
  })
})

describe('ensureLabel — non-404 getLabel error', () => {
  it('Test 3: getLabel 500 → warning with label name + createLabel NOT called', async () => {
    const { octokit, createLabel } = makeOctokit({
      getLabel: vi.fn().mockRejectedValue(httpError(500, 'server error')),
    })
    await ensureLabel(octokit, 'o', 'r', 'needs-info', '#e4e669', 'desc')
    expect(createLabel).not.toHaveBeenCalled()
    expect(core.warning).toHaveBeenCalledTimes(1)
    expect((core.warning as Fn).mock.calls[0][0]).toContain('needs-info')
  })
})

describe('ensureLabel — createLabel fails after 404 getLabel', () => {
  it('Test 4: getLabel 404 then createLabel rejects → warning, no throw', async () => {
    const { octokit } = makeOctokit({
      getLabel: vi.fn().mockRejectedValue(httpError(404, 'not found')),
      createLabel: vi.fn().mockRejectedValue(new Error('create failed')),
    })
    await expect(
      ensureLabel(octokit, 'o', 'r', 'needs-info', '#e4e669', 'desc'),
    ).resolves.toBeUndefined()
    expect(core.warning).toHaveBeenCalledTimes(1)
    expect((core.warning as Fn).mock.calls[0][0]).toContain('needs-info')
  })
})

describe('applyLabel', () => {
  it('Test 5: addLabels resolves → returns "applied", called with correct params', async () => {
    const { octokit, addLabels } = makeOctokit({
      addLabels: vi.fn().mockResolvedValue({ data: {} }),
    })
    const result = await applyLabel(octokit, 'o', 'r', 42, 'needs-info')
    expect(result).toBe('applied')
    expect(addLabels).toHaveBeenCalledTimes(1)
    expect(addLabels).toHaveBeenCalledWith({
      owner: 'o',
      repo: 'r',
      issue_number: 42,
      labels: ['needs-info'],
    })
  })

  it('Test 6: addLabels rejects → returns "error" + warning called', async () => {
    const { octokit } = makeOctokit({
      addLabels: vi.fn().mockRejectedValue(new Error('forbidden')),
    })
    const result = await applyLabel(octokit, 'o', 'r', 42, 'needs-info')
    expect(result).toBe('error')
    expect(core.warning).toHaveBeenCalledTimes(1)
  })
})

describe('removeLabel', () => {
  it('Test 7: removeLabel resolves → returns "removed", no warning', async () => {
    const { octokit } = makeOctokit({
      removeLabel: vi.fn().mockResolvedValue({ data: {} }),
    })
    const result = await removeLabel(octokit, 'o', 'r', 42, 'needs-info')
    expect(result).toBe('removed')
    expect(core.warning).not.toHaveBeenCalled()
  })

  it('Test 8: removeLabel 404 → returns "skipped" silently (no warning — Pitfall 7)', async () => {
    const { octokit } = makeOctokit({
      removeLabel: vi.fn().mockRejectedValue(httpError(404, 'not found')),
    })
    const result = await removeLabel(octokit, 'o', 'r', 42, 'needs-info')
    expect(result).toBe('skipped')
    expect(core.warning).not.toHaveBeenCalled()
  })

  it('Test 9: removeLabel non-404 error → returns "error" + warning called', async () => {
    const { octokit } = makeOctokit({
      removeLabel: vi.fn().mockRejectedValue(httpError(500, 'server error')),
    })
    const result = await removeLabel(octokit, 'o', 'r', 42, 'needs-info')
    expect(result).toBe('error')
    expect(core.warning).toHaveBeenCalledTimes(1)
  })
})

describe('ensureLabel — color without # prefix', () => {
  it('Test 10: color without # → createLabel called with same color (replace is a no-op)', async () => {
    const { octokit, createLabel } = makeOctokit({
      getLabel: vi.fn().mockRejectedValue(httpError(404, 'not found')),
      createLabel: vi.fn().mockResolvedValue({ data: {} }),
    })
    await ensureLabel(octokit, 'o', 'r', 'needs-info', 'e4e669', 'desc')
    expect(createLabel).toHaveBeenCalledWith(
      expect.objectContaining({ color: 'e4e669' }),
    )
  })
})

describe('LabelAction type check', () => {
  it('type-checks all valid LabelAction variants', () => {
    // Compile-only checks — this test just verifies the type is exported with all variants
    const _a: LabelAction = 'applied'
    const _b: LabelAction = 'removed'
    const _c: LabelAction = 'skipped'
    const _d: LabelAction = 'disabled'
    const _e: LabelAction = 'dry-run'
    const _f: LabelAction = 'error'
    expect(_a).toBe('applied')
    expect(_b).toBe('removed')
    expect(_c).toBe('skipped')
    expect(_d).toBe('disabled')
    expect(_e).toBe('dry-run')
    expect(_f).toBe('error')
  })
})

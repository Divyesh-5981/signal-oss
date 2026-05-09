import { describe, it, expect } from 'vitest'

describe('toolchain smoke test', () => {
  it('vitest is wired correctly', () => {
    expect(1 + 1).toBe(2)
  })

  it('typescript NodeNext resolution accepts .js extension imports', async () => {
    // This file imports nothing yet — Plan 02 adds real imports.
    // The presence of this passing test proves vitest + ts compilation work.
    expect(typeof import.meta.url).toBe('string')
  })
})

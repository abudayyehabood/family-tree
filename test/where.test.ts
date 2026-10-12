import { afterEach, describe, expect, it, vi } from 'vitest'
import { STORAGE_KEY } from '../src/model/types'

describe('storage key per build', () => {
  afterEach(() => { vi.unstubAllEnvs(); vi.resetModules() })

  it('the real app uses the real key', async () => {
    const w = await import('../src/model/where')
    expect(w.IS_PREVIEW).toBe(false)
    expect(w.ACTIVE_KEY).toBe(STORAGE_KEY)
  })

  it('the preview build never uses the real key', async () => {
    vi.stubEnv('VITE_PREVIEW', '1')
    vi.resetModules()
    const w = await import('../src/model/where')
    expect(w.IS_PREVIEW).toBe(true)
    expect(w.ACTIVE_KEY).not.toBe(STORAGE_KEY)
  })
})

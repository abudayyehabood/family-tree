import { describe, expect, it } from 'vitest'
import { countNodes, validateTree } from '../src/model/validate'
import { loadTree, saveTree } from '../src/model/storage'
import { exportJson, importJson } from '../src/model/transfer'
import { generateTree } from '../src/synthetic/generator'
import { STORAGE_KEY, type TreeNode } from '../src/model/types'
import { CASES } from './fixtures'

function memStore(init: Record<string, string> = {}) {
  const data = { ...init }
  return {
    data,
    getItem: (k: string) => (k in data ? data[k] : null),
    setItem: (k: string, v: string) => { data[k] = v },
  }
}

const tiny = (): TreeNode => ({
  id: 'a', type: 'member', name: 'جد', gender: 'male', generation: 1, children: [
    { id: 'w', type: 'wife', name: 'غير معروفة', unknown: true, gender: 'female', generation: 1, children: [
      { id: 'd', type: 'member', name: 'بنت', gender: 'female', generation: 2, husband: 'زوج', children: [] },
    ] },
  ],
})

describe('synthetic generator', () => {
  it.each(CASES)('$name is valid with no warnings and the right size', ({ root, size }) => {
    expect(validateTree(root)).toEqual({ errors: [], warnings: [] })
    const n = countNodes(root)
    expect(n).toBeLessThanOrEqual(size)
    expect(n).toBeGreaterThanOrEqual(size * 0.95)
  })

  it('is deterministic', () => {
    expect(generateTree({ size: 300, shape: 'deep', seed: 7 })).toEqual(generateTree({ size: 300, shape: 'deep', seed: 7 }))
  })

  it('deep trees reach 15 generations, wide trees stay shallow', () => {
    const maxGen = (t: TreeNode): number => Math.max(t.generation, ...t.children.map(maxGen))
    expect(maxGen(generateTree({ size: 1500, shape: 'deep' }))).toBe(15)
    expect(maxGen(generateTree({ size: 1500, shape: 'wide' }))).toBeLessThanOrEqual(6)
  })
})

describe('validation', () => {
  it('refuses broken shapes', () => {
    expect(validateTree(null).errors.length).toBe(1)
    expect(validateTree({ ...tiny(), children: 'x' }).errors[0]).toMatch(/children/)
    const dup = tiny(); dup.children[0].id = 'a'
    expect(validateTree(dup).errors[0]).toMatch(/duplicate id/)
  })

  it('only warns when a family rule is bent, so real data still loads', () => {
    const t = tiny()
    t.children[0].children[0].children.push({ id: 'x', type: 'member', name: 'x', gender: 'male', generation: 3, children: [] })
    const r = validateTree(t)
    expect(r.errors).toEqual([])
    expect(r.warnings[0]).toMatch(/daughters have no children/)
  })
})

describe('storage', () => {
  it('empty storage is "empty", not an error', () => {
    expect(loadTree(memStore())).toEqual({ status: 'empty' })
  })

  it('round-trips the bare root under the exact key', () => {
    const s = memStore()
    saveTree(s, tiny())
    expect(Object.keys(s.data)).toEqual([STORAGE_KEY])
    expect(loadTree(s)).toMatchObject({ status: 'ok', root: tiny(), shape: 'bare' })
  })

  it('reads a wrapped { root } and writes it back wrapped', () => {
    const s = memStore({ [STORAGE_KEY]: JSON.stringify({ root: tiny() }) })
    const r = loadTree(s)
    expect(r).toMatchObject({ status: 'ok', shape: 'wrapped' })
    if (r.status === 'ok') saveTree(s, r.root, r.shape)
    expect(JSON.parse(s.data[STORAGE_KEY])).toEqual({ root: tiny() })
  })

  it('bad data is reported and left untouched', () => {
    const raw = '{"id": 1'
    const s = memStore({ [STORAGE_KEY]: raw })
    expect(loadTree(s)).toMatchObject({ status: 'error', raw })
    expect(s.data[STORAGE_KEY]).toBe(raw)
  })

  it('never saves an invalid tree', () => {
    const s = memStore()
    expect(() => saveTree(s, { ...tiny(), id: '' })).toThrow()
    expect(s.data).toEqual({})
  })
})

describe('import / export', () => {
  it('round-trips', () => {
    const root = generateTree({ size: 300, shape: 'wide' })
    const text = exportJson(root, new Date('2026-01-01T00:00:00Z'))
    expect(JSON.parse(text)).toMatchObject({ app: 'arabic-family-tree', version: 1, exportedAt: '2026-01-01T00:00:00.000Z' })
    expect(importJson(text)).toEqual({ ok: true, root, warnings: [] })
  })

  it('rejects other files', () => {
    expect(importJson('nope').ok).toBe(false)
    expect(importJson('{"app":"other","version":1,"root":{}}').ok).toBe(false)
    expect(importJson('{"app":"arabic-family-tree","version":2,"root":{}}').ok).toBe(false)
  })
})

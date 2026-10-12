import { describe, expect, it } from 'vitest'
import { estimate, layoutTree } from '../src/layout/layout'
import { LABEL_FONT, LABEL_H, pickLabels } from '../src/layout/labels'
import { CASES } from './fixtures'

describe.each(CASES.filter((c) => c.size >= 300))('zoomed-out names: $name', ({ root }) => {
  const L = layoutTree(root)
  for (const k of [0.02, 0.05, 0.1, 0.3]) {
    it(`at ${k * 100}% no two shown names overlap, and the founder is shown`, () => {
      const t = performance.now()
      const labels = pickLabels(L.boxes, k, estimate)
      const ms = performance.now() - t
      expect(ms).toBeLessThan(100)
      expect(labels[0].id).toBe(root.id)
      const r = labels.map((l) => [l.x * k - l.w / 2, l.y * k - LABEL_H / 2, l.x * k + l.w / 2, l.y * k + LABEL_H / 2])
      for (let i = 0; i < r.length; i++) for (let j = i + 1; j < r.length; j++) {
        const a = r[i], b = r[j]
        expect(a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3]).toBe(false)
      }
    })
  }

  it('the selected person always gets a name', () => {
    const deep = L.boxes.find((b) => b.node.generation >= 3 && b.kind !== 'knot')!
    expect(pickLabels(L.boxes, 0.02, estimate, deep.id).some((l) => l.id === deep.id)).toBe(true)
    expect(LABEL_FONT).toContain('12px')
  })
})

it('a highlighted generation gets its names first', () => {
  const { root } = CASES.find((c) => c.name === 'wide-800')!
  const L = layoutTree(root)
  const count = (ls: { id: string }[]) => ls.filter((l) => L.byId.get(l.id)!.node.generation === 3).length
  expect(count(pickLabels(L.boxes, 0.05, estimate, null, 3))).toBeGreaterThan(count(pickLabels(L.boxes, 0.05, estimate)))
})

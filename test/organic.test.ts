import { describe, expect, it } from 'vitest'
import { layoutTree, type Box } from '../src/layout/layout'
import { BARK, branchWidth, carried, crown, MAX_BRANCH, ROOT_W, TRUNK_W } from '../src/layout/organic'
import { branchPieces, sample } from '../src/layout/branches'
import { CASES } from './fixtures'

// The painted branches are thick. Check the thick stroke (not just its centre
// line) stays off every card it does not belong to, and that painting changes
// no position.

type P = [number, number]
function hitsGrown(a: P, b: P, box: Box, grow: number): boolean {
  const x0 = box.x - box.w / 2 - grow + 0.01, x1 = box.x + box.w / 2 + grow - 0.01
  const y0 = box.y - box.h / 2 - grow + 0.01, y1 = box.y + box.h / 2 + grow - 0.01
  let t0 = 0, t1 = 1
  const dx = b[0] - a[0], dy = b[1] - a[1]
  for (const [p, q] of [[-dx, a[0] - x0], [dx, x1 - a[0]], [-dy, a[1] - y0], [dy, y1 - a[1]]]) {
    if (p === 0) { if (q <= 0) return false; continue }
    const t = q / p
    if (p < 0) t0 = Math.max(t0, t); else t1 = Math.min(t1, t)
    if (t0 >= t1) return false
  }
  return true
}

describe.each(CASES)('organic look: $name', ({ root }) => {
  const L = layoutTree(root)
  const size = carried(L)

  it('counts carried people right: the founder carries everyone', () => {
    expect(size.get(root.id)).toBe(L.boxes.length)
  })

  it('thick branches (with bark) stay off cards they do not belong to', () => {
    const bad: string[] = []
    for (const e of L.edges) {
      const half = branchWidth(size.get(e.to)!) / 2 + BARK
      for (let i = 1; i < e.points.length; i++) for (const box of L.boxes) {
        if (box.id === e.from || box.id === e.to) continue
        // only the twig-free middle part matters for the stem's own siblings: they hang from it
        if (box.parent === e.from) continue
        if (hitsGrown(e.points[i - 1], e.points[i], box, half)) bad.push(`${e.to} near ${box.id}`)
      }
    }
    expect(bad).toEqual([])
  })

  it('curved, tapered branches (with bark) stay off cards they do not belong to', () => {
    const bad: string[] = []
    for (const p of branchPieces(L)) {
      // the trunk's line is painted thicker than the gap and hides partly under the
      // cards beside it, on purpose: check its core keeps the normal clearance
      const pts = sample(p), g = Math.min(p.w, p.main ? MAX_BRANCH : Infinity) / 2 + BARK
      const xs = pts.map((q) => q[0]), ys = pts.map((q) => q[1])
      const near = L.boxes.filter((b) => b.x + b.w / 2 + g > Math.min(...xs) && b.x - b.w / 2 - g < Math.max(...xs)
        && b.y + b.h / 2 + g > Math.min(...ys) && b.y - b.h / 2 - g < Math.max(...ys))
      for (let i = 1; i < pts.length; i++) for (const box of near) {
        if (box.id === p.from || box.id === p.to) continue
        // stems and husband-to-wife curves pass the siblings that hang from them, as before
        if (!p.twig && box.parent === p.from) continue
        if (hitsGrown(pts[i - 1], pts[i], box, g)) bad.push(`${p.key} near ${box.id}`)
      }
    }
    expect(bad).toEqual([])
  })

  it('generation 1 as thick as the trunk top, 2-4 one even trunk, 5-6 thick limbs, 7 on thin twigs', () => {
    const pieces = branchPieces(L)
    const gen = (id: string) => L.byId.get(id)!.node.generation
    const kind = (p: (typeof pieces)[0]) => (p.main ? 0 : p.w >= 7 ? 1 : 2)
    for (const p of pieces) if (p.to) expect(kind(p)).toBe(gen(p.to) <= 4 ? 0 : gen(p.to) <= 6 ? 1 : 2)
    for (const p of pieces) if (p.to) expect(p.w).toBe(gen(p.to) === 1 ? ROOT_W : gen(p.to) <= 4 ? TRUNK_W : p.w)
    const limbs = pieces.filter((p) => kind(p) === 1).map((p) => p.w)
    if (limbs.length) expect(Math.max(...limbs)).toBeLessThan(TRUNK_W)
  })

  it('the crown dome is one closed shape', () => {
    const c = crown(L, 40)
    expect(c.d).toMatch(/^M.*Z$/)
    expect(c.d).not.toContain('NaN')
    // it reaches past every card, so "show all" (which frames the dome) shows them all
    expect(c.minX).toBeLessThanOrEqual(L.minX)
    expect(c.maxX).toBeGreaterThanOrEqual(L.maxX)
    expect(c.minY).toBeLessThanOrEqual(L.minY)
  })

  it('curves never reach past the old square lines: the tree is no bigger', () => {
    for (const p of branchPieces(L)) for (const [x, y] of sample(p)) {
      expect(x).toBeGreaterThanOrEqual(L.minX - 0.01)
      expect(x).toBeLessThanOrEqual(L.maxX + 0.01)
      expect(y).toBeGreaterThanOrEqual(L.minY - 0.01)
      expect(y).toBeLessThanOrEqual(L.maxY + 0.01)
    }
  })
})

it('painting is separate from layout: same positions with or without it', () => {
  const { root } = CASES[0]
  const a = layoutTree(root), b = layoutTree(root)
  carried(b)
  expect(b.boxes.map((x) => [x.x, x.y])).toEqual(a.boxes.map((x) => [x.x, x.y]))
})

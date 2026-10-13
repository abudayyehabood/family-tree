import { describe, expect, it } from 'vitest'
import { layoutTree, type Box, type Edge } from '../src/layout/layout'
import type { TreeNode } from '../src/model/types'
import { CASES } from './fixtures'

// Hard layout rules from the brief, checked on every synthetic tree.

type P = [number, number]
const EPS = 0.01

function segments(e: Edge): [P, P][] {
  return e.points.slice(1).map((p, i) => [e.points[i], p])
}

const orient = (p: P, q: P, r: P) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0])

// Proper crossing, or two collinear pieces lying on top of each other.
function clash(a: P, b: P, c: P, d: P): boolean {
  const d1 = orient(c, d, a), d2 = orient(c, d, b), d3 = orient(a, b, c), d4 = orient(a, b, d)
  if (((d1 > EPS && d2 < -EPS) || (d1 < -EPS && d2 > EPS)) && ((d3 > EPS && d4 < -EPS) || (d3 < -EPS && d4 > EPS))) return true
  if ([d1, d2, d3, d4].every((v) => Math.abs(v) <= EPS)) {
    const ax = a[0] === b[0] ? 1 : 0 // compare along the axis the segment runs
    const lo = Math.max(Math.min(a[ax], b[ax]), Math.min(c[ax], d[ax]))
    const hi = Math.min(Math.max(a[ax], b[ax]), Math.max(c[ax], d[ax]))
    return hi - lo > EPS
  }
  return false
}

// Does the segment enter the inside of the card? (touching the edge is fine)
function hitsBox(a: P, b: P, box: Box): boolean {
  const x0 = box.x - box.w / 2 + EPS, x1 = box.x + box.w / 2 - EPS
  const y0 = box.y - box.h / 2 + EPS, y1 = box.y + box.h / 2 - EPS
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

const bbox = (s: [P, P]) => [Math.min(s[0][0], s[1][0]), Math.max(s[0][0], s[1][0]), Math.min(s[0][1], s[1][1]), Math.max(s[0][1], s[1][1])]

describe.each(CASES)('layout rules: $name', ({ root }) => {
  const L = layoutTree(root)

  it('lays out every person once', () => {
    let n = 0
    const walk = (t: TreeNode) => { n++; t.children.forEach(walk) }
    walk(root)
    expect(L.boxes.length).toBe(n)
    expect(L.byId.size).toBe(n)
    expect(L.edges.length).toBe(n - 1)
  })

  it('every child is above its parent', () => {
    const bad = L.boxes.filter((b) => {
      if (!b.parent) return false
      const p = L.byId.get(b.parent)!
      return b.y + b.h / 2 > p.y - p.h / 2 + EPS
    })
    expect(bad.map((b) => b.id)).toEqual([])
  })

  it('no two cards overlap', () => {
    const bad: string[] = []
    const s = [...L.boxes].sort((a, b) => a.x - a.w / 2 - (b.x - b.w / 2))
    for (let i = 0; i < s.length; i++) for (let j = i + 1; j < s.length; j++) {
      const a = s[i], b = s[j]
      if (b.x - b.w / 2 >= a.x + a.w / 2 - EPS) break
      if (Math.abs(a.y - b.y) < (a.h + b.h) / 2 - EPS) bad.push(`${a.id}/${b.id}`)
    }
    expect(bad).toEqual([])
  })

  it('no two branches cross or run on top of each other', () => {
    const segs = L.edges.flatMap((e) => segments(e).map((s) => ({ e, s, b: bbox(s) })))
    segs.sort((p, q) => p.b[0] - q.b[0])
    const bad = new Set<string>()
    for (let i = 0; i < segs.length; i++) for (let j = i + 1; j < segs.length; j++) {
      const A = segs[i], B = segs[j]
      if (B.b[0] > A.b[1] + EPS) break
      if (A.e.from === B.e.from) continue // one family shares its branch
      if (B.b[2] > A.b[3] + EPS || A.b[2] > B.b[3] + EPS) continue
      if (clash(A.s[0], A.s[1], B.s[0], B.s[1])) bad.add(`${A.e.to}x${B.e.to}`)
    }
    expect([...bad]).toEqual([])
  })

  it('no branch passes through a card it does not belong to', () => {
    const bad: string[] = []
    for (const e of L.edges) for (const [a, b] of segments(e)) for (const box of L.boxes) {
      if (box.id === e.from || box.id === e.to) continue
      if (hitsBox(a, b, box)) bad.push(`${e.to} through ${box.id}`)
    }
    expect(bad).toEqual([])
  })

  it('every branch starts at its parent and ends at its own child', () => {
    for (const e of L.edges) {
      const p = L.byId.get(e.from)!, c = L.byId.get(e.to)!
      expect(e.points[0]).toEqual([p.x, p.y - p.h / 2]) // top of the parent
      const [x, y] = e.points[e.points.length - 1]
      const onEdge = Math.abs(Math.abs(x - c.x) - c.w / 2) < EPS && Math.abs(y - c.y) <= c.h / 2 + EPS
      const onBottom = Math.abs(y - (c.y + c.h / 2)) < EPS && Math.abs(x - c.x) <= c.w / 2 + EPS
      expect(onEdge || onBottom).toBe(true)
    }
  })

  it('wives sit close above their husband (the founder leaves room for limbs)', () => {
    for (const b of L.boxes) {
      if (b.kind !== 'wife' && b.kind !== 'knot') continue
      const p = L.byId.get(b.parent!)!
      expect((p.y - p.h / 2) - (b.y + b.h / 2)).toBeLessThanOrEqual(p.parent === null ? 60 : 20)
    }
  })

  it('a mother\'s eldest child on each side sits right next to her', () => {
    const firstGap = new Map<string, number>()
    for (const b of L.boxes) {
      if (!b.parent || L.byId.get(b.parent)!.kind === 'man') continue
      const p = L.byId.get(b.parent)!
      const gap = (p.y - p.h / 2) - (b.y + b.h / 2)
      firstGap.set(b.parent, Math.min(firstGap.get(b.parent) ?? Infinity, gap))
    }
    expect(Math.max(...firstGap.values())).toBeLessThanOrEqual(20)
  })

  it('is deterministic', () => {
    const again = layoutTree(structuredClone(root))
    expect(again.boxes.map((b) => [b.id, b.x, b.y])).toEqual(L.boxes.map((b) => [b.id, b.x, b.y]))
  })

  it('takes under 300 ms', () => {
    const t = performance.now()
    layoutTree(root)
    const ms = performance.now() - t
    const w = L.maxX - L.minX, h = L.maxY - L.minY
    const branch = L.edges.reduce((s, e) => s + segments(e).reduce((t, [a, b]) => t + Math.hypot(b[0] - a[0], b[1] - a[1]), 0), 0) / L.edges.length
    console.log(`${L.boxes.length} people: ${ms.toFixed(1)} ms, ${Math.round(w)} x ${Math.round(h)} px, avg branch ${Math.round(branch)} px`)
    expect(ms).toBeLessThan(300)
  })

  it('folding a branch: the rest still lays out and nothing outside it is lost', () => {
    const t = structuredClone(root)
    const son = t.children[0]?.children.find((c) => c.children.length)
    if (!son) return
    son.collapsed = true
    const F = layoutTree(t)
    expect(F.byId.has(son.id)).toBe(true)
    expect(F.boxes.every((b) => b.parent === null || F.byId.has(b.parent))).toBe(true)
  })
})

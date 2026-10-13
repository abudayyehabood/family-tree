import type { Layout } from './layout'

// The organic look is drawing only: these numbers decide how thick and how
// green things are painted. Nothing here moves a card.

export const MAX_BRANCH = 14 // px; half of it + bark must stay inside the 10px gap beside a stem
export const TRUNK_GENS = 4 // generations 1-4 are drawn as one even trunk, 5 on as branches
export const ROOT_W = 32 // px; generation 1 (founder to his wives): as thick as the top of the drawn trunk
export const TRUNK_W = ROOT_W // generations 2-4: as thick as the trunk, all the way up
export const BARK = 1.5 // dark outline on each side
export const TRUNK_H = 150

// People carried by each branch (the child and everyone above it).
export function carried(layout: Layout): Map<string, number> {
  const size = new Map<string, number>()
  // boxes come parent-first, so walking backwards finishes children before parents
  for (let i = layout.boxes.length - 1; i >= 0; i--) {
    const b = layout.boxes[i]
    const s = (size.get(b.id) ?? 0) + 1
    size.set(b.id, s)
    if (b.parent) size.set(b.parent, (size.get(b.parent) ?? 0) + s)
  }
  return size
}

// Thicker toward the trunk, like a real tree: grows with the square root of
// the people the branch carries.
export function branchWidth(people: number, max = MAX_BRANCH): number {
  return Math.min(max, 2 + 1.1 * Math.sqrt(people))
}

// Small deterministic jitter so leaf clouds do not look stamped.
export function jitter(id: string): number {
  let h = 2166136261
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619)
  return ((h >>> 0) % 1000) / 1000
}

// One smooth dome around every card: the convex hull, padded and rounded.
export function crown(layout: Layout, pad: number): { d: string; minX: number; maxX: number; minY: number } {
  const pts: [number, number][] = []
  for (const b of layout.boxes) for (const sx of [-1, 1]) for (const sy of [-1, 1]) pts.push([b.x + sx * b.w / 2, b.y + sy * b.h / 2])
  pts.sort((a, b) => a[0] - b[0] || a[1] - b[1])
  const cross = (o: number[], a: number[], b: number[]) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
  const half = (list: [number, number][]) => {
    const h: [number, number][] = []
    for (const p of list) {
      while (h.length >= 2 && cross(h[h.length - 2], h[h.length - 1], p) <= 0) h.pop()
      h.push(p)
    }
    return h.slice(0, -1)
  }
  const hull = [...half(pts), ...half([...pts].reverse())]
  // push each corner out from the centre, then round the corners off
  const cx = hull.reduce((t, p) => t + p[0], 0) / hull.length, cy = hull.reduce((t, p) => t + p[1], 0) / hull.length
  const grown = hull.map(([x, y]) => { const d = Math.hypot(x - cx, y - cy) || 1; return [x + ((x - cx) / d) * pad, y + ((y - cy) / d) * pad] })
  // long straight sides bulge outward, so the crown reads as a dome, not a kite
  const out = grown.flatMap((a, i) => {
    const b = grown[(i + 1) % grown.length]
    const len = Math.hypot(b[0] - a[0], b[1] - a[1])
    const nx = (b[1] - a[1]) / (len || 1), ny = -(b[0] - a[0]) / (len || 1) // outward for this winding
    const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
    const side = (m[0] - cx) * nx + (m[1] - cy) * ny < 0 ? -1 : 1
    return len > 4 * pad ? [a, [m[0] + side * nx * len * 0.18, m[1] + side * ny * len * 0.18]] : [a]
  })
  const mid = (i: number) => { const a = out[i], b = out[(i + 1) % out.length]; return `${(a[0] + b[0]) / 2},${(a[1] + b[1]) / 2}` }
  const d = `M${mid(out.length - 1)}` + out.map((p, i) => `Q${p[0]},${p[1]} ${mid(i)}`).join('') + 'Z'
  return { d, minX: Math.min(...out.map((p) => p[0])), maxX: Math.max(...out.map((p) => p[0])), minY: Math.min(...out.map((p) => p[1])) }
}

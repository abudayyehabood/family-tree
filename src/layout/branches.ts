import { BARK, branchWidth, carried, jitter, MAX_TRUNK } from './organic'
import type { Layout } from './layout'

// Drawing only: turns the layout's square branch lines into wood. Stems get
// thinner as children leave them, twigs leave the stem at a slant and curve
// into the card, and long stems bend a little. Every curve stays inside the
// empty space the layout already keeps, so nothing moves and no length grows.

type P = [number, number]
export interface Piece {
  key: string
  from: string
  to: string | null // null: a stretch of stem shared by several children
  pts: P[] // 2 = straight, 3 = quadratic, 4 = cubic bezier
  w: number
  twig: boolean // leaves a stem sideways (the rest run along stems)
  main: boolean // part of the trunk's line: drawn thicker, partly under the cards beside it
}

const STEM_CLEAR = 10 // same as layout.ts: empty space beside a stem
const MIN_W = 1.5

export function branchPieces(layout: Layout): Piece[] {
  const size = carried(layout)
  const out: Piece[] = []
  // The trunk carries on up: from the founder, always into the biggest family.
  const kids = new Map<string, string[]>()
  for (const e of layout.edges) kids.set(e.from, [...(kids.get(e.from) ?? []), e.to])
  const main = new Set<string>()
  for (let id: string | undefined = layout.boxes[0]?.id; id; ) {
    main.add(id)
    id = (kids.get(id) ?? []).reduce<string | undefined>((a, b) => (a && size.get(a)! >= size.get(b)! ? a : b), undefined)
  }
  const root = layout.boxes[0]?.id
  // every limb leaving the founder is thick too, like the trunk forking
  const isMain = (from: string, to: string | null) => from === root || (main.has(from) && (to === null || main.has(to)))
  const width = (people: number, from: string, to: string | null) => branchWidth(people, isMain(from, to) ? MAX_TRUNK : undefined)
  const stems = new Map<string, { x: number; y0: number; leave: { y: number; carry: number }[] }>()

  for (const e of layout.edges) {
    const p = e.points
    const carry = size.get(e.to)!
    const w = width(carry, e.from, e.to)
    if (p.length === 4) {
      // husband to wife: one smooth S instead of up, across, up
      const [a, , , d] = p
      split(out, e.from, e.to, [a, [a[0], p[1][1]], [d[0], p[2][1]], d], w, false, isMain(e.from, e.to))
      continue
    }
    const stem = stems.get(e.from) ?? { x: p[0][0], y0: p[0][1], leave: [] }
    stems.set(e.from, stem)
    if (p.length === 2) { stem.leave.push({ y: p[1][1], carry }); continue }
    // twig: start a little below the card, slant up, arrive level
    const [, [sx, ty], [ex]] = p
    const card = layout.byId.get(e.to)!
    const sy = ty + card.h * 0.4
    const dx = ex - sx
    stem.leave.push({ y: sy, carry })
    split(out, e.from, e.to, [[sx, sy], [sx + dx * 0.25, ty + (sy - ty) * 0.35], [sx + dx * 0.55, ty], [ex, ty]], w, true, isMain(e.from, e.to))
  }

  // Each stretch of stem carries everyone who leaves it higher up.
  for (const [id, s] of stems) {
    const leave = s.leave.sort((a, b) => b.y - a.y) // lowest first (y grows down)
    let y = s.y0
    let above = leave.reduce((t, l) => t + l.carry, 0)
    leave.forEach((l, i) => {
      if (l.y < y) {
        const w = width(above, id, null)
        const len = y - l.y
        // long stretches bend a little, never past the empty space beside the stem
        const room = Math.max(0, STEM_CLEAR - w / 2 - BARK - 0.5)
        const bend = len > 40 ? Math.min(3, room) * (jitter(id + i) < 0.5 ? -2 : 2) : 0
        out.push({ key: `${id}:${i}`, from: id, to: null, w, twig: false, main: isMain(id, null), pts: bend ? [[s.x, y], [s.x + bend, (y + l.y) / 2], [s.x, l.y]] : [[s.x, y], [s.x, l.y]] })
        y = l.y
      }
      above -= l.carry
    })
  }
  // thick first, so thin twigs sit on top of the stem they leave
  return out.sort((a, b) => b.w - a.w)
}

// Two halves, the outer one thinner: a branch tapers toward its card.
function split(out: Piece[], from: string, to: string, [a, b, c, d]: P[], w: number, twig: boolean, main: boolean) {
  const m = (u: P, v: P): P => [(u[0] + v[0]) / 2, (u[1] + v[1]) / 2]
  const ab = m(a, b), bc = m(b, c), cd = m(c, d), abc = m(ab, bc), bcd = m(bc, cd), mid = m(abc, bcd)
  out.push({ key: `${to}a`, from, to, w, twig, main, pts: [a, ab, abc, mid] })
  out.push({ key: `${to}b`, from, to, w: Math.max(MIN_W, w * 0.7), twig, main, pts: [mid, bcd, cd, d] })
}

export function pieceD({ pts }: Piece): string {
  const [a, ...rest] = pts
  const cmd = rest.length === 1 ? 'L' : rest.length === 2 ? 'Q' : 'C'
  return `M${a}${cmd}${rest.join(' ')}`
}

// Points along the curve, for tests.
export function sample({ pts }: Piece, n = 16): P[] {
  const at = (t: number): P => {
    let q = pts
    while (q.length > 1) q = q.slice(1).map((p, i) => [q[i][0] + (p[0] - q[i][0]) * t, q[i][1] + (p[1] - q[i][1]) * t] as P)
    return q[0]
  }
  return Array.from({ length: n + 1 }, (_, i) => at(i / n))
}

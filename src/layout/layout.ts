import type { TreeNode } from '../model/types'

// Crown layout: every parent has a stem going up. Its children (a man's
// wives, a wife's children) sit along the stem, on the right or left.
// Each child brings its whole subtree as one rectangle; rectangles on one side
// are stacked one above the other, never side by side, and never cross the
// stem. That is the whole trick, and it is why nothing can overlap or cross:
// every branch is a piece of stem plus one horizontal twig, and the twig runs
// along the bottom row of its own child's rectangle.
//
// A man's wives sit in one row right above him; their children climb the
// wife's stem.

export type Kind = 'man' | 'woman' | 'wife' | 'knot'

export interface Box {
  id: string
  node: TreeNode
  kind: Kind
  parent: string | null
  x: number // centre
  y: number // centre; smaller y = higher on screen
  w: number
  h: number
}

export interface Edge {
  from: string
  to: string
  points: [number, number][] // polyline, parent end first
}

export interface Layout {
  boxes: Box[]
  byId: Map<string, Box>
  edges: Edge[]
  minX: number; maxX: number; minY: number; maxY: number
}

export type Measure = (text: string, font: string) => number

export const FONT_NAME = '700 14px system-ui, sans-serif'
export const FONT_SUB = '400 11px system-ui, sans-serif'
export const FONT_WIFE = '700 12px system-ui, sans-serif'

export const MEMBER_H = 40
export const WIFE_H = 22
export const KNOT_W = 12

const STEM_CLEAR = 10 // empty space on each side of a stem
const FIRST_GAP = 12 // parent card -> first child on the stem
const ONE_WIFE_GAP = 12 // man -> his wives, right above him
const WIFE_GAP = 16 // between two wives' families in the row
const STACK_GAP = 10 // between two rectangles on the same side
// How a child's side is chosen (see place). Tuned on the synthetic trees.
export const TUNING = {
  aspect: 1.2, // target crown shape, width / height
  lean: 2, // cost of growing back toward the parent's stem (= long twig above)
  reach: 0.5, // cost of hanging a child high up the stem (= long stem)
  balance: 1, // main line only: cost of one side outgrowing the other
}
export const LEADER = { share: 0.6 } // a child carrying more than this share of the family continues the stem

// Rough width for tests / no-canvas. The browser passes a real measurer.
export const estimate: Measure = (text, font) => {
  const px = Number(/(\d+)px/.exec(font)?.[1] ?? 14)
  return text.length * px * 0.58
}

export function kindOf(n: TreeNode): Kind {
  if (n.type === 'wife') return n.unknown ? 'knot' : 'wife'
  return n.gender === 'male' ? 'man' : 'woman'
}

export function yearsText(n: TreeNode): string {
  if (n.born === undefined && n.died === undefined) return ''
  // LRI ... PDI: keep "born–died" in reading order inside Arabic text
  return `⁦${n.born ?? '?'}–${n.died ?? ''}⁩`
}

export function subText(n: TreeNode): string {
  const parts = [yearsText(n)]
  if (n.husband) parts.push(`زوجها: ${n.husband}`)
  return parts.filter(Boolean).join(' · ')
}

function cardSize(n: TreeNode, measure: Measure): [number, number] {
  switch (kindOf(n)) {
    case 'knot': return [KNOT_W, WIFE_H]
    case 'wife': return [Math.max(40, Math.ceil(measure(n.name, FONT_WIFE)) + 16), WIFE_H]
    default: return [Math.max(56, Math.ceil(Math.max(measure(n.name, FONT_NAME), measure(subText(n), FONT_SUB))) + 20), MEMBER_H]
  }
}

// A placed subtree in local coordinates: its stem at x = 0, its card's
// bottom at y = 0, y growing UP. left/right/top bound everything in it.
interface Shape {
  boxes: Box[]
  edges: Edge[]
  left: number // distance from stem to the left edge (positive)
  right: number
  top: number
}

function move(s: Shape, dx: number, dy: number): void {
  for (const b of s.boxes) { b.x += dx; b.y += dy }
  for (const e of s.edges) for (const p of e.points) { p[0] += dx; p[1] += dy }
}

// Flip left <-> right, so a subtree can grow away from the stem it hangs on.
function mirror(s: Shape): void {
  for (const b of s.boxes) b.x = -b.x
  for (const e of s.edges) for (const p of e.points) p[0] = -p[0]
  ;[s.left, s.right] = [s.right, s.left]
}

// Every subtree is built leaning right (outward); the parent mirrors it when
// it hangs on the left. `lean` is how much growing back toward the parent's
// stem costs: that growth is exactly what makes the twig to this child long.
function place(n: TreeNode, parent: string | null, measure: Measure, lean = TUNING.lean): Shape {
  const [w, h] = cardSize(n, measure)
  const me: Box = { id: n.id, node: n, kind: kindOf(n), parent, x: 0, y: h / 2, w, h }
  const shape: Shape = { boxes: [me], edges: [], left: w / 2, right: w / 2, top: h }
  const kids = n.collapsed ? [] : n.children
  if (!kids.length) return shape

  const absorb = (s: Shape) => { shape.boxes.push(...s.boxes); shape.edges.push(...s.edges) }

  if (kids.length === 1) {
    // an only wife or an only child: straight up, like a trunk
    const gap = n.type === 'member' ? ONE_WIFE_GAP : FIRST_GAP
    const sh = place(kids[0], n.id, measure, lean)
    move(sh, 0, h + gap)
    absorb(sh)
    shape.edges.push({ from: n.id, to: kids[0].id, points: [[0, h], [0, h + gap]] })
    shape.left = Math.max(shape.left, sh.left)
    shape.right = Math.max(shape.right, sh.right)
    shape.top = h + gap + sh.top
    return shape
  }

  if (n.type === 'member') {
    // Wives sit in one row right above their husband, joined by a short bar.
    const bar = h + ONE_WIFE_GAP / 2
    const y0 = h + ONE_WIFE_GAP
    const sizes = kids.map(visibleCount)
    const total = sizes.reduce((x, y) => x + y, 0)
    const big = sizes.indexOf(Math.max(...sizes))
    // Main line (lean 0, above the trunk): the wife with most of the family
    // sits straight above him and keeps the line going; the others go to her
    // sides, first wife's side first, and lean outward.
    const leaderIdx = lean === 0 && sizes[big] > total * LEADER.share ? big : -1
    const shapes = kids.map((k, i) => place(k, n.id, measure, i === leaderIdx ? lean : TUNING.lean))
    const dxs: number[] = []
    if (leaderIdx >= 0) {
      // Side families sit low, so they only need to clear the big family's
      // outline at their own height, not its widest point up in the crown.
      const lead = shapes[leaderIdx]
      let r = -Infinity, l = -Infinity, right = true
      shapes.forEach((sh, i) => {
        if (i === leaderIdx) return void (dxs[i] = 0)
        if (!right) mirror(sh)
        // margin: painted branches are up to 14px thick (see organic.ts)
        const reach = extentOver(lead, -16, sh.top + 16, right ? 'right' : 'left')
        if (right) { dxs[i] = Math.max(r, reach) + WIFE_GAP + sh.left; r = dxs[i] + sh.right }
        else { dxs[i] = -(Math.max(l, reach) + WIFE_GAP + sh.right); l = -dxs[i] + sh.left }
        right = !right
      })
    } else {
      // The founder sits in the middle of the row (right half leans right,
      // left half leans left). Everyone else leans right: he sits under his
      // first wife and the others follow outward, so the twig to him is short.
      const centred = lean === 0
      if (centred) shapes.forEach((sh, i) => { if (i >= shapes.length / 2) mirror(sh) })
      const width = shapes.reduce((t, sh) => t + sh.left + sh.right, 0) + WIFE_GAP * (shapes.length - 1)
      let x = centred ? width / 2 : -shapes[0].left // centred: right edge of the row; else left edge
      for (const sh of shapes) {
        dxs.push(centred ? x - sh.right : x + sh.left)
        x = centred ? x - (sh.left + sh.right + WIFE_GAP) : x + sh.left + sh.right + WIFE_GAP
      }
      // centred: the founder sits halfway between the outermost wives' stems
      const off = centred ? (Math.min(...dxs) + Math.max(...dxs)) / 2 : 0
      for (let i = 0; i < dxs.length; i++) dxs[i] -= off
    }
    for (const [i, sh] of shapes.entries()) {
      const dx = dxs[i]
      move(sh, dx, y0)
      absorb(sh)
      shape.edges.push({ from: n.id, to: kids[i].id, points: dx === 0 ? [[0, h], [0, y0]] : [[0, h], [0, bar], [dx, bar], [dx, y0]] })
      shape.left = Math.max(shape.left, -(dx - sh.left))
      shape.right = Math.max(shape.right, dx + sh.right)
      shape.top = Math.max(shape.top, y0 + sh.top)
    }
    return shape
  }

  // Main stem: a child who carries most of the family keeps growing straight
  // up, above everyone else, like a real tree's leader. Without this, deep
  // family lines walk off sideways and the crown drifts away from the trunk.
  const sizes = kids.map(visibleCount)
  const total = sizes.reduce((a, b) => a + b, 0)
  const big = sizes.indexOf(Math.max(...sizes))
  const leader = sizes[big] > total * LEADER.share && kids[big].children.length > 0 && !kids[big].collapsed ? kids[big] : null

  // Stack the other children along the stem, oldest lowest. Each child goes
  // to the side that keeps this subtree closest to the crown shape (width ~
  // ASPECT x height); stacking on one side adds height, both sides add width.
  let rightY = h + FIRST_GAP, leftY = h + FIRST_GAP
  for (const kid of kids) {
    if (kid === leader) continue
    const s = place(kid, n.id, measure)
    const kidCard = s.boxes[0]
    const cost = (right: boolean) => {
      const l = right ? shape.left : Math.max(shape.left, STEM_CLEAR + s.left + s.right)
      const r = right ? Math.max(shape.right, STEM_CLEAR + s.left + s.right) : shape.right
      const y = right ? rightY : leftY
      const t = Math.max(shape.top, y + s.top)
      // the main line (lean 0, under the trunk) also keeps its two sides even
      const balance = lean === 0 ? TUNING.balance * Math.abs(r - l) : 0
      return Math.max((l + r) / TUNING.aspect, t) + lean * l + TUNING.reach * y + balance
    }
    const right = cost(true) <= cost(false) // tie: right first, Arabic reads right to left
    if (!right) mirror(s) // grow away from this stem
    const y0 = right ? rightY : leftY
    const dx = right ? STEM_CLEAR + s.left : -(STEM_CLEAR + s.right)
    move(s, dx, y0)
    absorb(s)
    const twigY = kidCard.y // mid-height of the child's card
    const edgeX = right ? kidCard.x - kidCard.w / 2 : kidCard.x + kidCard.w / 2
    shape.edges.push({ from: n.id, to: kid.id, points: [[0, h], [0, twigY], [edgeX, twigY]] })
    if (right) { rightY = y0 + s.top + STACK_GAP; shape.right = Math.max(shape.right, dx + s.right) }
    else { leftY = y0 + s.top + STACK_GAP; shape.left = Math.max(shape.left, -dx + s.left) }
    shape.top = Math.max(shape.top, y0 + s.top)
  }
  if (leader) {
    const s = place(leader, n.id, measure, lean)
    const y0 = Math.max(rightY, leftY)
    move(s, 0, y0)
    absorb(s)
    shape.edges.push({ from: n.id, to: leader.id, points: [[0, h], [0, y0]] })
    shape.left = Math.max(shape.left, s.left)
    shape.right = Math.max(shape.right, s.right)
    shape.top = y0 + s.top
  }
  return shape
}

// How far a placed shape reaches to one side between heights y0 and y1
// (local coordinates, y up), counting its cards and its branches.
function extentOver(s: Shape, y0: number, y1: number, side: 'left' | 'right'): number {
  let m = 0
  const take = (x: number) => { m = Math.max(m, side === 'right' ? x : -x) }
  for (const b of s.boxes) {
    if (b.y + b.h / 2 < y0 || b.y - b.h / 2 > y1) continue
    take(side === 'right' ? b.x + b.w / 2 : b.x - b.w / 2)
  }
  for (const e of s.edges) for (let i = 1; i < e.points.length; i++) {
    const [a, b] = [e.points[i - 1], e.points[i]]
    if (Math.max(a[1], b[1]) < y0 || Math.min(a[1], b[1]) > y1) continue
    take(a[0]); take(b[0])
  }
  return m
}

function visibleCount(n: TreeNode): number {
  if (n.collapsed) return 1
  let k = 1
  for (const c of n.children) k += visibleCount(c)
  return k
}

export function layoutTree(root: TreeNode, measure: Measure = estimate): Layout {
  const s = place(root, null, measure, 0) // the founder has no parent stem to lean from
  // to screen: y down
  for (const b of s.boxes) b.y = -b.y
  for (const e of s.edges) for (const p of e.points) p[1] = -p[1]
  const byId = new Map(s.boxes.map((b) => [b.id, b]))
  return { boxes: s.boxes, byId, edges: s.edges, minX: -s.left, maxX: s.right, minY: -s.top, maxY: 0 }
}

// Polyline with softly rounded corners.
export function edgePath(e: Edge, r = 8): string {
  const p = e.points
  let d = `M${p[0][0]},${p[0][1]}`
  for (let i = 1; i < p.length - 1; i++) {
    const [ax, ay] = p[i - 1], [bx, by] = p[i], [cx, cy] = p[i + 1]
    const l1 = Math.hypot(bx - ax, by - ay), l2 = Math.hypot(cx - bx, cy - by)
    if (!l1 || !l2) continue
    const k = Math.min(r, l1 / 2, l2 / 2)
    d += `L${bx - ((bx - ax) / l1) * k},${by - ((by - ay) / l1) * k}Q${bx},${by} ${bx + ((cx - bx) / l2) * k},${by + ((cy - by) / l2) * k}`
  }
  const last = p[p.length - 1]
  return d + `L${last[0]},${last[1]}`
}

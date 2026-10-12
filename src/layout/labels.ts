import type { Box, Measure } from './layout'

// Zoomed far out, cards become dots and names are drawn at a fixed screen
// size. Names that would overlap are hidden: older generations win, then
// blood relatives over wives. `must` (the selected person) always shows, and
// a highlighted generation (`prefer`) goes before the others.

export const LABEL_FONT = '700 12px system-ui, sans-serif'
export const LABEL_H = 15
const GAP = 2 // px between labels on screen
export const DOT_R = 4 // screen px

export interface Label { id: string; x: number; y: number; w: number } // screen-size w, world x/y of the label centre

export function pickLabels(boxes: Box[], k: number, measure: Measure, must: string | null = null, prefer: number | null = null): Label[] {
  const order = [...boxes].sort((a, b) =>
    (b.id === must ? 1 : 0) - (a.id === must ? 1 : 0) ||
    (b.node.generation === prefer ? 1 : 0) - (a.node.generation === prefer ? 1 : 0) ||
    a.node.generation - b.node.generation ||
    (a.node.type === 'wife' ? 1 : 0) - (b.node.type === 'wife' ? 1 : 0))
  const cell = 64
  const grid = new Map<string, [number, number, number, number][]>()
  const out: Label[] = []
  for (const b of order) {
    if (b.kind === 'knot') continue
    const w = measure(b.node.name, LABEL_FONT) + 6
    const sx = b.x * k, sy = b.y * k - DOT_R - 2 - LABEL_H / 2 // screen: just above the dot
    const r: [number, number, number, number] = [sx - w / 2 - GAP, sy - LABEL_H / 2 - GAP, sx + w / 2 + GAP, sy + LABEL_H / 2 + GAP]
    const keys: string[] = []
    for (let gx = Math.floor(r[0] / cell); gx <= Math.floor(r[2] / cell); gx++)
      for (let gy = Math.floor(r[1] / cell); gy <= Math.floor(r[3] / cell); gy++) keys.push(`${gx},${gy}`)
    const hit = keys.some((key) => grid.get(key)?.some((o) => r[0] < o[2] && o[0] < r[2] && r[1] < o[3] && o[1] < r[3]))
    if (hit) continue
    for (const key of keys) (grid.get(key) ?? grid.set(key, []).get(key)!).push(r)
    out.push({ id: b.id, x: b.x, y: sy / k, w })
  }
  return out
}

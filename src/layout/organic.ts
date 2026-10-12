import type { Layout } from './layout'

// The organic look is drawing only: these numbers decide how thick and how
// green things are painted. Nothing here moves a card.

export const MAX_BRANCH = 14 // px; half of it + bark must stay inside the 10px gap beside a stem
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
export function branchWidth(people: number): number {
  return Math.min(MAX_BRANCH, 2 + 1.1 * Math.sqrt(people))
}

// Small deterministic jitter so leaf clouds do not look stamped.
export function jitter(id: string): number {
  let h = 2166136261
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619)
  return ((h >>> 0) % 1000) / 1000
}

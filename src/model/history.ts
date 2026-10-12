import type { TreeNode } from './types'

export interface History {
  past: TreeNode[]
  present: TreeNode
  future: TreeNode[]
}

const LIMIT = 200

export const startHistory = (present: TreeNode): History => ({ past: [], present, future: [] })

export function commit(h: History, next: TreeNode): History {
  if (next === h.present) return h
  return { past: [...h.past, h.present].slice(-LIMIT), present: next, future: [] }
}

export function undo(h: History): History {
  if (!h.past.length) return h
  return { past: h.past.slice(0, -1), present: h.past[h.past.length - 1], future: [h.present, ...h.future] }
}

export function redo(h: History): History {
  if (!h.future.length) return h
  return { past: [...h.past, h.present], present: h.future[0], future: h.future.slice(1) }
}

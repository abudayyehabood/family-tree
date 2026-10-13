import { MAX_GENERATIONS, MAX_WIVES, type TreeNode } from './types'

// Two levels, because the real tree must never be locked out over a small quirk:
// - errors: the shape is broken, the tree cannot be drawn. Load is refused.
// - warnings: a family rule is bent (5 wives, a daughter with children...).
//   The tree still loads and the warnings are shown.
export interface ValidationResult {
  errors: string[]
  warnings: string[]
}

const MAX_REPORTED = 20

export function validateTree(value: unknown): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  const ids = new Set<string>()

  const err = (m: string) => { if (errors.length < MAX_REPORTED) errors.push(m) }
  const warn = (m: string) => { if (warnings.length < MAX_REPORTED) warnings.push(m) }

  // Iterative walk: 1500 people and 15 generations are fine either way, but a
  // corrupt file could be arbitrarily deep.
  const stack: { node: unknown; path: string; parent: TreeNode | null }[] = [
    { node: value, path: 'root', parent: null },
  ]
  while (stack.length) {
    const { node, path, parent } = stack.pop()!
    if (!isObject(node)) { err(`${path}: not an object`); continue }
    const n = node as Record<string, unknown>

    if (typeof n.id !== 'string' || !n.id) err(`${path}: missing id`)
    else if (ids.has(n.id)) err(`${path}: duplicate id "${n.id}"`)
    else ids.add(n.id)

    if (n.type !== 'member' && n.type !== 'wife') err(`${path}: type must be "member" or "wife"`)
    if (typeof n.name !== 'string') err(`${path}: name must be text`)
    if (n.gender !== 'male' && n.gender !== 'female') err(`${path}: gender must be "male" or "female"`)
    if (!Number.isInteger(n.generation) || (n.generation as number) < 1) err(`${path}: generation must be a whole number >= 1`)
    if (!Array.isArray(n.children)) { err(`${path}: children must be a list`); continue }
    for (const k of ['born', 'died'] as const) {
      if (n[k] !== undefined && !Number.isInteger(n[k])) err(`${path}: ${k} must be a year`)
    }
    for (const k of ['collapsed', 'unknown', 'dead'] as const) {
      if (n[k] !== undefined && typeof n[k] !== 'boolean') err(`${path}: ${k} must be true/false`)
    }
    if (n.husband !== undefined && typeof n.husband !== 'string') err(`${path}: husband must be text`)
    if (errors.length) { if (errors.length >= MAX_REPORTED) break; continue }

    const t = node as TreeNode
    const label = `${path} (${t.name})`

    if (!parent) {
      if (t.type !== 'member') err('root: the founder must be a member, not a wife')
      if (t.generation !== 1) warn('root: the founder should be generation 1')
      if (t.gender !== 'male') warn('root: the founder should be a man')
    } else if (t.type === 'wife') {
      if (parent.type !== 'member' || parent.gender !== 'male') warn(`${label}: a wife must hang under a man`)
      if (t.generation !== parent.generation) warn(`${label}: a wife shares her husband's generation`)
    } else {
      if (parent.type !== 'wife') warn(`${label}: a child must hang under a wife`)
      if (t.generation !== parent.generation + 1) warn(`${label}: generation should be ${parent.generation + 1}`)
    }

    if (t.type === 'wife' && t.gender !== 'female') warn(`${label}: a wife must be female`)
    if (t.husband !== undefined && !(t.type === 'member' && t.gender === 'female')) warn(`${label}: only daughters have a husband tag`)
    if (t.type === 'member' && t.gender === 'female' && t.children.length) warn(`${label}: daughters have no children in this tree`)
    if (t.type === 'member' && t.gender === 'male' && t.children.length > MAX_WIVES) warn(`${label}: more than ${MAX_WIVES} wives`)
    if (t.generation > MAX_GENERATIONS) warn(`${label}: deeper than ${MAX_GENERATIONS} generations`)
    if (t.born !== undefined && t.died !== undefined && t.died < t.born) warn(`${label}: died before born`)

    for (let i = t.children.length - 1; i >= 0; i--) {
      stack.push({ node: t.children[i], path: `${path}.${i}`, parent: t })
    }
  }

  return { errors, warnings }
}

function isObject(v: unknown): v is object {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

export function countNodes(root: TreeNode): number {
  let n = 0
  const stack = [root]
  while (stack.length) {
    const t = stack.pop()!
    n++
    for (const c of t.children) stack.push(c)
  }
  return n
}

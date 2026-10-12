import { MAX_WIVES, UNKNOWN_WIFE_NAME, type TreeNode } from './types'

// Pure edits: each returns a new root and shares every untouched branch.

export function newId(): string {
  return crypto.randomUUID()
}

export function findNode(root: TreeNode, id: string): TreeNode | null {
  const stack = [root]
  while (stack.length) {
    const n = stack.pop()!
    if (n.id === id) return n
    stack.push(...n.children)
  }
  return null
}

// Root first, the node itself last.
export function pathTo(root: TreeNode, id: string): TreeNode[] | null {
  if (root.id === id) return [root]
  for (const c of root.children) {
    const p = pathTo(c, id)
    if (p) return [root, ...p]
  }
  return null
}

export function countSubtree(n: TreeNode): number {
  let k = 1
  for (const c of n.children) k += countSubtree(c)
  return k
}

function mapAt(root: TreeNode, id: string, fn: (n: TreeNode) => TreeNode): TreeNode {
  if (root.id === id) return fn(root)
  let changed = false
  const children = root.children.map((c) => {
    const m = mapAt(c, id, fn)
    if (m !== c) changed = true
    return m
  })
  return changed ? { ...root, children } : root
}

export interface PersonPatch {
  name?: string
  born?: number | null
  died?: number | null
  gender?: 'male' | 'female'
  husband?: string | null
}

export function updatePerson(root: TreeNode, id: string, patch: PersonPatch): TreeNode {
  return mapAt(root, id, (n) => {
    const m: TreeNode = { ...n }
    if (patch.name !== undefined && patch.name.trim()) m.name = patch.name.trim()
    for (const k of ['born', 'died'] as const) {
      if (patch[k] === null) delete m[k]
      else if (patch[k] !== undefined) m[k] = patch[k]
    }
    if (n.type === 'member' && patch.gender && patch.gender !== n.gender) {
      if (!canChangeGender(n)) throw new Error('a man with wives cannot become a daughter')
      m.gender = patch.gender
      if (m.gender === 'male') delete m.husband
    }
    if (m.type === 'member' && m.gender === 'female' && patch.husband !== undefined) {
      if (patch.husband === null || !patch.husband.trim()) delete m.husband
      else m.husband = patch.husband.trim()
    }
    if (m.unknown && patch.name !== undefined && patch.name.trim() && patch.name.trim() !== UNKNOWN_WIFE_NAME) delete m.unknown
    return m
  })
}

export const canChangeGender = (n: TreeNode) => n.type === 'member' && n.children.length === 0
export const canAddWife = (n: TreeNode) => n.type === 'member' && n.gender === 'male' && n.children.length < MAX_WIVES
export const canAddChild = (n: TreeNode) => n.type === 'wife' || (n.type === 'member' && n.gender === 'male')

export function addWife(root: TreeNode, manId: string, name: string): { root: TreeNode; id: string } {
  const id = newId()
  const next = mapAt(root, manId, (man) => {
    if (!canAddWife(man)) throw new Error('cannot add a wife here')
    const wife: TreeNode = { id, type: 'wife', name: name.trim() || UNKNOWN_WIFE_NAME, gender: 'female', generation: man.generation, children: [] }
    if (!name.trim()) wife.unknown = true
    return { ...unfolded(man), children: [...man.children, wife] }
  })
  return { root: next, id }
}

// parentId is a wife, or a man: then the child goes under `motherId`, or under
// his only wife, or under a new "unknown" wife if he has none.
export function addChild(
  root: TreeNode, parentId: string, gender: 'male' | 'female', name: string, motherId?: string,
): { root: TreeNode; id: string } {
  const parent = findNode(root, parentId)
  if (!parent || !canAddChild(parent)) throw new Error('cannot add a child here')
  let r = root
  let mother = parent.type === 'wife' ? parent.id : motherId
  if (!mother) {
    if (parent.children.length === 1) mother = parent.children[0].id
    else if (parent.children.length === 0) {
      const w = addWife(r, parent.id, '')
      r = w.root
      mother = w.id
    } else throw new Error('choose the mother')
  }
  const motherNode = findNode(r, mother)
  if (!motherNode || motherNode.type !== 'wife') throw new Error('mother not found')
  const id = newId()
  const child: TreeNode = { id, type: 'member', name: name.trim(), gender, generation: motherNode.generation + 1, children: [] }
  r = mapAt(r, mother, (w) => ({ ...unfolded(w), children: [...w.children, child] }))
  return { root: reveal(r, id), id }
}

function unfolded(n: TreeNode): TreeNode {
  const m = { ...n }
  delete m.collapsed
  return m
}

export function deletePerson(root: TreeNode, id: string): TreeNode {
  if (root.id === id) throw new Error('the founder cannot be deleted')
  const path = pathTo(root, id)
  if (!path) return root
  const parent = path[path.length - 2]
  return mapAt(root, parent.id, (p) => ({ ...p, children: p.children.filter((c) => c.id !== id) }))
}

export function setCollapsed(root: TreeNode, id: string, collapsed: boolean): TreeNode {
  return mapAt(root, id, (n) => (collapsed ? { ...n, collapsed: true } : unfolded(n)))
}

// Unfold every ancestor of id, so it can be seen.
export function reveal(root: TreeNode, id: string): TreeNode {
  const path = pathTo(root, id)
  if (!path) return root
  let r = root
  for (const n of path.slice(0, -1)) if (n.collapsed) r = setCollapsed(r, n.id, false)
  return r
}

// People hidden under a folded card (not counting the card itself).
export function hiddenCount(n: TreeNode): number {
  return countSubtree(n) - 1
}

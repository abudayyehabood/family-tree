import { MAX_WIVES, UNKNOWN_WIFE_NAME, type TreeNode } from '../model/types'

// Synthetic trees for tests and screenshots. Never real family data.
// Same options -> same tree (seeded random).

export type Shape = 'deep' | 'wide'

export interface GenOptions {
  size: number // target number of nodes (members + wives)
  shape: Shape
  seed?: number
}

const MEN = ['محمد', 'أحمد', 'علي', 'عمر', 'خالد', 'يوسف', 'إبراهيم', 'حسن', 'حسين', 'عبد الله', 'سليمان', 'مصطفى', 'إسماعيل', 'عبد الرحمن', 'طارق', 'زياد', 'سامي', 'ماهر', 'نبيل', 'فادي']
const WOMEN = ['فاطمة', 'عائشة', 'مريم', 'زينب', 'خديجة', 'آمنة', 'سارة', 'هدى', 'ليلى', 'نور', 'رقية', 'سلمى', 'هالة', 'رنا', 'دعاء', 'إيمان', 'أسماء', 'منى', 'سعاد', 'ريم']

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function generateTree({ size, shape, seed = 1 }: GenOptions): TreeNode {
  const rnd = mulberry32(seed)
  const int = (lo: number, hi: number) => lo + Math.floor(rnd() * (hi - lo + 1))
  const pick = <T,>(xs: T[]) => xs[Math.floor(rnd() * xs.length)]

  // deep: few children, goes all 15 generations. wide: big families, few generations.
  const maxGen = shape === 'deep' ? 15 : 6
  const wives = shape === 'deep' ? [1, 2] : [1, 4]
  const kids = shape === 'deep' ? [1, 3] : [2, 7]

  let next = 0
  let count = 0
  const id = () => `n${++next}`

  const person = (gender: 'male' | 'female', generation: number): TreeNode => {
    count++
    const p: TreeNode = { id: id(), type: 'member', name: pick(gender === 'male' ? MEN : WOMEN), gender, generation, children: [] }
    if (rnd() < 0.5) p.born = 1850 + generation * 25 + int(0, 15)
    if (p.born && rnd() < 0.4) p.died = p.born + int(30, 90)
    if (gender === 'female' && rnd() < 0.4) p.husband = pick(MEN)
    return p
  }

  const root = person('male', 1)
  // deep grows depth-first (stack), wide grows breadth-first (queue).
  const todo: TreeNode[] = [root]

  while (todo.length && count < size) {
    const man = shape === 'deep' ? todo.pop()! : todo.shift()!
    if (man.generation >= maxGen) continue
    const nWives = Math.min(MAX_WIVES, int(wives[0], wives[1]))
    for (let w = 0; w < nWives && count < size; w++) {
      const unknown = rnd() < 0.15
      const wife: TreeNode = {
        id: id(), type: 'wife', name: unknown ? UNKNOWN_WIFE_NAME : pick(WOMEN),
        gender: 'female', generation: man.generation, children: [],
      }
      if (unknown) wife.unknown = true
      count++
      man.children.push(wife)
      const nKids = int(kids[0], kids[1])
      for (let k = 0; k < nKids && count < size; k++) {
        // First child is a son so every line keeps going.
        const child = person(k === 0 || rnd() < 0.5 ? 'male' : 'female', man.generation + 1)
        wife.children.push(child)
        if (child.gender === 'male') todo.push(child)
      }
    }
  }
  return root
}

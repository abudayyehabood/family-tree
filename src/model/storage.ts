import { STORAGE_KEY, type TreeNode } from './types'
import { validateTree } from './validate'

// What is already saved on abudayyehabood.github.io could be the bare root
// or wrapped as { root }. We read both and write back the same way we found it.
export type Shape = 'bare' | 'wrapped'

export type LoadResult =
  | { status: 'empty' }
  | { status: 'ok'; root: TreeNode; warnings: string[]; shape: Shape }
  | { status: 'error'; errors: string[]; raw: string }

type KV = Pick<Storage, 'getItem' | 'setItem'>

export function loadTree(store: KV, key = STORAGE_KEY): LoadResult {
  let raw: string | null
  try {
    raw = store.getItem(key)
  } catch (e) {
    return { status: 'error', errors: [`cannot read storage: ${String(e)}`], raw: '' }
  }
  if (raw === null || raw === '') return { status: 'empty' }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return { status: 'error', errors: ['saved data is not valid JSON'], raw }
  }

  const shape: Shape = isWrapped(parsed) ? 'wrapped' : 'bare'
  const root = shape === 'wrapped' ? (parsed as { root: unknown }).root : parsed
  const { errors, warnings } = validateTree(root)
  if (errors.length) return { status: 'error', errors, raw }
  return { status: 'ok', root: root as TreeNode, warnings, shape }
}

export function saveTree(store: KV, root: TreeNode, shape: Shape = 'bare', key = STORAGE_KEY): void {
  // Never write something that would fail to load next time.
  const { errors } = validateTree(root)
  if (errors.length) throw new Error(`refusing to save an invalid tree: ${errors[0]}`)
  const value = shape === 'wrapped' ? { root } : root
  store.setItem(key, JSON.stringify(value))
}

function isWrapped(v: unknown): boolean {
  return typeof v === 'object' && v !== null && !('type' in v) && 'root' in v
}

export async function requestPersistentStorage(): Promise<boolean> {
  try {
    return (await navigator.storage?.persist?.()) ?? false
  } catch {
    return false
  }
}

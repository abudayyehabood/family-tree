import type { TreeNode } from '../model/types'

// Arabic-aware matching: ignore diacritics and tatweel, and treat
// أ/إ/آ/ٱ/ا, ة/ه and ى/ي as the same letter.
export function normalize(s: string): string {
  return s
    .normalize('NFC')
    .replace(/[ً-ٰٟـ]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

export interface Hit {
  node: TreeNode
  path: TreeNode[] // root .. node
}

// Every person whose name contains the query; folded branches included.
export function search(root: TreeNode, query: string, limit = 30): Hit[] {
  const q = normalize(query)
  if (!q) return []
  const hits: Hit[] = []
  const walk = (n: TreeNode, path: TreeNode[]) => {
    if (hits.length >= limit) return
    const p = [...path, n]
    if (normalize(n.name).includes(q)) hits.push({ node: n, path: p })
    for (const c of n.children) walk(c, p)
  }
  walk(root, [])
  return hits
}

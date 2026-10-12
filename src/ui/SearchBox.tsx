import { useMemo, useState } from 'react'
import type { TreeNode } from '../model/types'
import { search } from '../search/normalize'

export function SearchBox({ root, onPick }: { root: TreeNode; onPick(id: string): void }) {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const hits = useMemo(() => search(root, q), [root, q])

  // "son of X" context so two people with the same name can be told apart
  const context = (path: TreeNode[]) => {
    const n = path[path.length - 1]
    if (n.type === 'wife') return `زوجة ${path[path.length - 2]?.name ?? ''}`
    const father = path[path.length - 3]
    return father ? `${n.gender === 'male' ? 'ابن' : 'بنت'} ${father.name}` : 'المؤسس'
  }

  return (
    <div className="relative min-w-0 flex-1 basis-40">
      <input type="search" value={q} placeholder="ابحث عن شخص..." aria-label="بحث"
        className="w-full rounded-full bg-[#f8f1e4] px-4 py-1.5 text-[#3b2a1e] placeholder:text-stone-500"
        onChange={(e) => { setQ(e.target.value); setOpen(true) }} onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => { if (e.key === 'Enter' && hits[0]) { onPick(hits[0].node.id); setOpen(false) } }} />
      {open && q.trim() && (
        <ul className="absolute inset-x-0 top-full z-20 mt-1 max-h-80 overflow-y-auto rounded-xl bg-white text-[#3b2a1e] shadow-xl">
          {hits.length === 0 && <li className="px-4 py-2 text-stone-500">لا يوجد</li>}
          {hits.map((h) => (
            <li key={h.node.id}>
              <button className="block w-full px-4 py-2 text-start hover:bg-amber-50"
                onMouseDown={(e) => e.preventDefault()} onClick={() => { onPick(h.node.id); setOpen(false) }}>
                <span className="font-bold">{h.node.name}</span>
                <span className="ms-2 text-sm text-stone-500">{context(h.path)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

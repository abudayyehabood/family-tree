import { useEffect, useState } from 'react'
import type { TreeNode } from '../model/types'
import { canAddChild, canAddWife, canChangeGender, countSubtree, hiddenCount, type PersonPatch } from '../model/mutations'

interface Props {
  node: TreeNode
  path: TreeNode[] // root .. node
  onPatch(p: PersonPatch): void
  onAddChild(gender: 'male' | 'female', name: string, motherId?: string): void
  onAddWife(name: string): void
  onDelete(): void
  onToggleFold(): void
  onClose(): void
}

type Adding = null | { what: 'son' | 'daughter' | 'wife' }

const input = 'mt-1 block w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-base'
const btn = 'rounded-lg px-3 py-2 font-bold active:opacity-80 disabled:opacity-40'

export function EditPanel({ node, path, onPatch, onAddChild, onAddWife, onDelete, onToggleFold, onClose }: Props) {
  const [name, setName] = useState(node.name)
  const [born, setBorn] = useState(node.born?.toString() ?? '')
  const [died, setDied] = useState(node.died?.toString() ?? '')
  const [husband, setHusband] = useState(node.husband ?? '')
  const [adding, setAdding] = useState<Adding>(null)
  const [newName, setNewName] = useState('')
  const [mother, setMother] = useState(node.children[0]?.id ?? '')
  const [confirmDelete, setConfirmDelete] = useState(false)

  // follow outside changes (undo, redo) to the same person
  useEffect(() => setName(node.name), [node.name])
  useEffect(() => setBorn(node.born?.toString() ?? ''), [node.born])
  useEffect(() => setDied(node.died?.toString() ?? ''), [node.died])
  useEffect(() => setHusband(node.husband ?? ''), [node.husband])

  const isRoot = path.length === 1
  const daughter = node.type === 'member' && node.gender === 'female'
  const year = (s: string) => (s.trim() === '' ? null : Number.isInteger(Number(s)) ? Number(s) : undefined)
  const save = (p: PersonPatch) => onPatch(p)
  const enter = (e: React.KeyboardEvent<HTMLInputElement>) => { if (e.key === 'Enter') e.currentTarget.blur() }

  const relation = relationOf(node, path)

  const confirmAdd = () => {
    if (!adding) return
    if (adding.what === 'wife') onAddWife(newName)
    else {
      if (!newName.trim()) return
      onAddChild(adding.what === 'son' ? 'male' : 'female', newName, node.type === 'member' && node.children.length > 1 ? mother : undefined)
    }
    setAdding(null)
    setNewName('')
  }

  return (
    <aside className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4" onClick={(e) => e.stopPropagation()}>
      <Head node={node} relation={relation} onClose={onClose} />

      <div className="space-y-3">
        <label className="block text-sm font-bold">الاسم
          <input className={input} value={name} onChange={(e) => setName(e.target.value)} onKeyDown={enter}
            onBlur={() => (name.trim() ? save({ name }) : setName(node.name))} />
        </label>

        {node.type === 'member' && (
          <div className="flex gap-2">
            <label className="block flex-1 text-sm font-bold">سنة الولادة
              <input className={input} inputMode="numeric" dir="ltr" value={born} onChange={(e) => setBorn(e.target.value)} onKeyDown={enter}
                onBlur={() => { const y = year(born); if (y !== undefined) save({ born: y }); else setBorn(node.born?.toString() ?? '') }} />
            </label>
            <label className="block flex-1 text-sm font-bold">سنة الوفاة
              <input className={input} inputMode="numeric" dir="ltr" value={died} onChange={(e) => setDied(e.target.value)} onKeyDown={enter}
                onBlur={() => { const y = year(died); if (y !== undefined) save({ died: y }); else setDied(node.died?.toString() ?? '') }} />
            </label>
          </div>
        )}

        {!node.unknown && (
          <label className="flex cursor-pointer items-center justify-between rounded-lg bg-stone-100 px-3 py-2 text-sm font-bold">
            <span>{node.gender === 'female' ? 'متوفاة' : 'متوفى'}</span>
            <input type="checkbox" role="switch" className="peer sr-only" checked={!!node.dead}
              onChange={(e) => save({ dead: e.target.checked })} />
            <span className="relative h-6 w-11 rounded-full bg-stone-300 transition-colors peer-checked:bg-stone-700
              after:absolute after:top-0.5 after:start-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all
              peer-checked:after:start-[1.375rem]" aria-hidden />
          </label>
        )}

        {node.type === 'member' && !isRoot && (
          <div className="text-sm font-bold">
            <span>الجنس</span>
            <div className="mt-1 flex gap-2">
              {(['male', 'female'] as const).map((g) => (
                <button key={g} disabled={node.gender !== g && !canChangeGender(node)}
                  className={`${btn} flex-1 ${node.gender === g ? 'bg-[#1f6f6b] text-white' : 'bg-stone-200'}`}
                  onClick={() => node.gender !== g && save({ gender: g })}>{g === 'male' ? 'ذكر' : 'أنثى'}</button>
              ))}
            </div>
            {!canChangeGender(node) && <p className="mt-1 font-normal text-stone-500">لا يمكن تغيير الجنس لرجل له زوجات.</p>}
          </div>
        )}

        {daughter && (
          <label className="block text-sm font-bold">اسم الزوج (يظهر كملاحظة فقط)
            <input className={input} value={husband} onChange={(e) => setHusband(e.target.value)} onKeyDown={enter}
              onBlur={() => save({ husband: husband.trim() || null })} />
          </label>
        )}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        {canAddChild(node) && <>
          <button className={`${btn} bg-[#1f6f6b] text-white`} onClick={() => setAdding({ what: 'son' })}>+ ابن</button>
          <button className={`${btn} bg-pink-600 text-white`} onClick={() => setAdding({ what: 'daughter' })}>+ بنت</button>
        </>}
        {node.type === 'member' && node.gender === 'male' && (
          <button className={`${btn} bg-amber-400 text-[#3b2a1e]`} disabled={!canAddWife(node)} onClick={() => setAdding({ what: 'wife' })}>+ زوجة</button>
        )}
        {node.children.length > 0 && (
          <button className={`${btn} bg-stone-200`} onClick={onToggleFold}>
            {node.collapsed ? `فتح الفرع (${hiddenCount(node)})` : 'طي الفرع'}
          </button>
        )}
      </div>

      {adding && (
        <div className="mt-3 space-y-2 rounded-lg border border-stone-300 bg-white p-3">
          <label className="block text-sm font-bold">
            {adding.what === 'wife' ? 'اسم الزوجة (اتركه فارغاً إن كان غير معروف)' : adding.what === 'son' ? 'اسم الابن' : 'اسم البنت'}
            <input className={input} autoFocus value={newName} onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && confirmAdd()} />
          </label>
          {adding.what !== 'wife' && node.type === 'member' && node.children.length > 1 && (
            <div className="text-sm font-bold">الأم
              <div className="mt-1 flex flex-wrap gap-2">
                {node.children.map((w) => (
                  <button key={w.id} className={`${btn} ${mother === w.id ? 'bg-amber-400' : 'bg-stone-200'}`} onClick={() => setMother(w.id)}>{w.name}</button>
                ))}
              </div>
            </div>
          )}
          <div className="flex gap-2">
            <button className={`${btn} flex-1 bg-[#3b2a1e] text-white`} disabled={adding.what !== 'wife' && !newName.trim()} onClick={confirmAdd}>إضافة</button>
            <button className={`${btn} bg-stone-200`} onClick={() => { setAdding(null); setNewName('') }}>إلغاء</button>
          </div>
        </div>
      )}

      {!isRoot && (
        <div className="mt-6 border-t border-stone-300 pt-3">
          {!confirmDelete ? (
            <button className={`${btn} w-full border border-red-600 text-red-700`} onClick={() => setConfirmDelete(true)}>حذف</button>
          ) : (
            <div className="space-y-2 rounded-lg bg-red-50 p-3">
              <p className="font-bold text-red-800">
                {countSubtree(node) === 1 ? `سيتم حذف ${node.name}.` : `سيتم حذف ${countSubtree(node)} شخص (${node.name} وكل فرعه).`}
                {' '}يمكنك التراجع بعدها.
              </p>
              <div className="flex gap-2">
                <button className={`${btn} flex-1 bg-red-600 text-white`} onClick={onDelete}>نعم، احذف</button>
                <button className={`${btn} bg-stone-200`} onClick={() => setConfirmDelete(false)}>إلغاء</button>
              </div>
            </div>
          )}
        </div>
      )}
    </aside>
  )
}

// who this person is, in words
function relationOf(node: TreeNode, path: TreeNode[]): string {
  const parent = path[path.length - 2]
  const grand = path[path.length - 3]
  return node.type === 'wife'
    ? `زوجة ${parent?.name ?? ''}`
    : path.length === 1 ? 'المؤسس'
    : `${node.gender === 'male' ? 'ابن' : 'بنت'} ${grand?.name ?? ''}${parent && !parent.unknown ? ` و${parent.name}` : ''}`
}

// name and close stay on top while the rest scrolls
function Head({ node, relation, onClose }: { node: TreeNode; relation: string; onClose(): void }) {
  return (
    <div className="sticky top-0 z-10 -mx-4 mb-3 flex items-start gap-2 bg-[#fffaf0] px-4 pt-2 pb-2">
      <div className="min-w-0 flex-1">
        <h2 className="truncate text-xl font-bold">{node.name}</h2>
        <p className="text-sm text-stone-600">{relation}</p>
      </div>
      <button className="grid h-10 w-10 place-items-center rounded-full bg-stone-200 text-xl" onClick={onClose} aria-label="إغلاق">×</button>
    </div>
  )
}

// Relatives with the view link: the same facts, nothing to change.
export function ViewPanel({ node, path, onToggleFold, onClose }: Pick<Props, 'node' | 'path' | 'onToggleFold' | 'onClose'>) {
  const years = node.born || node.died ? `${node.born ?? '؟'} – ${node.died ?? ''}` : ''
  const facts = [
    years && ['السنوات', years],
    node.dead && ['', node.gender === 'female' ? 'متوفاة' : 'متوفى'],
    node.husband && ['الزوج', node.husband],
  ].filter(Boolean) as [string, string][]
  return (
    <aside className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4" onClick={(e) => e.stopPropagation()}>
      <Head node={node} relation={relationOf(node, path)} onClose={onClose} />
      {facts.length > 0 && (
        <dl className="space-y-1 text-sm">
          {facts.map(([k, v]) => <div key={k + v} className="flex gap-2">{k && <dt className="font-bold">{k}:</dt>}<dd dir="auto">{v}</dd></div>)}
        </dl>
      )}
      {node.children.length > 0 && (
        <button className={`${btn} mt-4 w-full bg-stone-200`} onClick={onToggleFold}>
          {node.collapsed ? `فتح الفرع (${hiddenCount(node)})` : 'طي الفرع'}
        </button>
      )}
    </aside>
  )
}

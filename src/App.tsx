import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { loadTree, saveTree, type LoadResult, type Shape as SaveShape } from './model/storage'
import { downloadJson, importJson } from './model/transfer'
import { countNodes } from './model/validate'
import type { TreeNode } from './model/types'
import { commit, redo, startHistory, undo, type History } from './model/history'
import { addChild, addWife, deletePerson, findNode, pathTo, reveal, setCollapsed, updatePerson, type PersonPatch } from './model/mutations'
import { generateTree, type Shape } from './synthetic/generator'
import { layoutTree } from './layout/layout'
import { TreeView, type TreeViewHandle } from './ui/TreeView'
import { EditPanel } from './ui/EditPanel'
import { SearchBox } from './ui/SearchBox'
import { measureText } from './ui/measure'
import { ACTIVE_KEY, IS_PREVIEW } from './model/where'
import { STORAGE_KEY } from './model/types'

// ?demo=800-deep shows a synthetic tree and never touches storage.
function demoFromUrl(): TreeNode | null {
  const m = /^(\d+)-(deep|wide)$/.exec(new URLSearchParams(location.search).get('demo') ?? '')
  return m ? generateTree({ size: Number(m[1]), shape: m[2] as Shape }) : null
}

// The preview starts from a copy of the real tree. It only reads the real key, never writes it.
function firstLoad(): LoadResult {
  const own = loadTree(localStorage, ACTIVE_KEY)
  if (!IS_PREVIEW || own.status !== 'empty') return own
  const real = loadTree(localStorage, STORAGE_KEY)
  return real.status === 'ok' ? real : own
}

type Boot = Exclude<LoadResult, { status: 'ok' }> | { status: 'ok' }

export default function App() {
  const [demo] = useState(demoFromUrl)
  const [first] = useState<LoadResult>(() =>
    demo ? { status: 'ok', root: demo, warnings: [], shape: 'bare' } : firstLoad(),
  )
  const [boot, setBoot] = useState<Boot>(first.status === 'ok' ? { status: 'ok' } : first)
  const [hist, setHist] = useState<History | null>(first.status === 'ok' ? startHistory(first.root) : null)
  const [saveShape] = useState<SaveShape>(first.status === 'ok' ? first.shape : 'bare')
  const [warnings, setWarnings] = useState(first.status === 'ok' ? first.warnings : [])
  const [epoch, setEpoch] = useState(0) // bumps on a whole new tree: the view fits again
  const [selected, setSelected] = useState<string | null>(null)
  const [anchor, setAnchor] = useState<string | null>(null)
  const [flash, setFlash] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const fileInput = useRef<HTMLInputElement>(null)
  const view = useRef<TreeViewHandle>(null)
  const [centerReq, setCenterReq] = useState<{ id: string } | null>(null)

  const root = hist?.present ?? null

  useEffect(() => {
    if (!root || demo) return
    try {
      saveTree(localStorage, root, saveShape, ACTIVE_KEY)
    } catch (e) {
      setMessage(`لم يتم الحفظ: ${String(e)}`)
    }
  }, [root, demo, saveShape])

  const layout = useMemo(() => (root ? layoutTree(root, measureText) : null), [root])

  // after the render that unfolded the branch and opened the panel
  useEffect(() => {
    if (centerReq) view.current?.centerOn(centerReq.id)
  }, [centerReq])

  useEffect(() => {
    if (!flash) return
    const t = setTimeout(() => setFlash(null), 3000)
    return () => clearTimeout(t)
  }, [flash])

  // Every edit goes through here: one undo step, and `keep` stays still on screen.
  function edit(fn: (r: TreeNode) => TreeNode, keep: string | null) {
    if (!hist) return
    try {
      const next = fn(hist.present)
      setAnchor(keep)
      setHist(commit(hist, next))
    } catch (e) {
      setMessage(String(e instanceof Error ? e.message : e))
    }
  }

  const step = (dir: 'undo' | 'redo') => {
    if (!hist) return
    setAnchor(selected)
    setHist(dir === 'undo' ? undo(hist) : redo(hist))
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('input, textarea')) return
      if (!(e.ctrlKey || e.metaKey)) return
      const k = e.key.toLowerCase()
      if (k === 'z' && !e.shiftKey) { e.preventDefault(); step('undo') }
      else if (k === 'y' || (k === 'z' && e.shiftKey)) { e.preventDefault(); step('redo') }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const toggleFold = (id: string) => {
    const n = root && findNode(root, id)
    if (n) edit((r) => setCollapsed(r, id, !n.collapsed), id)
  }

  // stable for the tree view, so unchanged cards are not redrawn
  const toggleRef = useRef(toggleFold)
  toggleRef.current = toggleFold
  const onToggleFold = useCallback((id: string) => toggleRef.current(id), [])

  const pick = (id: string) => {
    if (!root) return
    const shown = reveal(root, id)
    if (shown !== root) edit(() => shown, null)
    setSelected(id)
    setFlash(id)
    setCenterReq({ id })
  }

  function newTree(r: TreeNode, w: string[]) {
    setHist(hist ? commit(hist, r) : startHistory(r))
    setWarnings(w)
    setBoot({ status: 'ok' })
    setSelected(null)
    setEpoch((e) => e + 1)
  }

  async function onImport(file: File) {
    const r = importJson(await file.text())
    if (!r.ok) return setMessage(`الملف غير صالح: ${r.errors[0]}`)
    if (root && !confirm(`استبدال الشجرة الحالية (${countNodes(root)} شخص) بالملف؟ يمكنك التراجع بعدها.`)) return
    newTree(r.root, r.warnings)
    setMessage(`تم الاستيراد: ${countNodes(r.root)} شخص`)
  }

  const selectedNode = root && selected ? findNode(root, selected) : null
  const selectedPath = root && selectedNode ? pathTo(root, selectedNode.id) : null
  const btn = 'rounded-full bg-white/15 px-3 py-1.5 text-sm font-bold text-white active:bg-white/30 disabled:opacity-30'

  return (
    <div className="flex h-full flex-col">
      <header className="flex flex-wrap items-center gap-2 bg-[#3b2a1e] px-3 py-2 text-white">
        <h1 className="text-lg font-bold">شجرة العائلة</h1>
        {root && <span className="text-sm opacity-80">{countNodes(root)} شخص</span>}
        {IS_PREVIEW && !demo && <span className="rounded-full bg-sky-300 px-2 text-sm text-[#3b2a1e]">نسخة تجريبية، شجرتك الأصلية لا تتغير</span>}
        {demo && <span className="rounded-full bg-amber-300 px-2 text-sm text-[#3b2a1e]">تجربة، لا يتم الحفظ</span>}
        {root && <SearchBox root={root} onPick={pick} />}
        <div className="ms-auto flex gap-2">
          {hist && <>
            <button className={btn} onClick={() => step('undo')} disabled={!hist.past.length} title="تراجع (Ctrl+Z)">↶ تراجع</button>
            <button className={btn} onClick={() => step('redo')} disabled={!hist.future.length} title="إعادة (Ctrl+Y)">↷</button>
          </>}
          {root && <button className={btn} onClick={() => downloadJson(root)}>تصدير</button>}
          {!demo && boot.status !== 'error' && <button className={btn} onClick={() => fileInput.current?.click()}>استيراد</button>}
        </div>
      </header>
      {message && (
        <p role="status" className="flex items-center bg-amber-100 px-3 py-1 text-sm">
          <span className="flex-1">{message}</span>
          <button className="px-2" onClick={() => setMessage('')} aria-label="إغلاق">×</button>
        </p>
      )}
      {warnings.length > 0 && (
        <details className="bg-amber-50 px-3 py-1 text-sm">
          <summary>ملاحظات على البيانات ({warnings.length})</summary>
          <ul dir="ltr" className="list-disc ps-5">{warnings.map((w) => <li key={w}>{w}</li>)}</ul>
        </details>
      )}

      <main className="relative min-h-0 flex-1">
        {layout && (
          <TreeView key={epoch} ref={view} layout={layout} selected={selected} flash={flash} anchor={anchor} panelOpen={!!selectedNode}
            onSelect={setSelected} onToggleFold={onToggleFold} />
        )}

        {selectedNode && selectedPath && (
          <EditPanel key={selectedNode.id} node={selectedNode} path={selectedPath}
            onClose={() => setSelected(null)}
            onPatch={(p: PersonPatch) => edit((r) => updatePerson(r, selectedNode.id, p), selectedNode.id)}
            onAddChild={(g, name, mother) => edit((r) => addChild(r, selectedNode.id, g, name, mother).root, selectedNode.id)}
            onAddWife={(name) => edit((r) => addWife(r, selectedNode.id, name).root, selectedNode.id)}
            onToggleFold={() => toggleFold(selectedNode.id)}
            onDelete={() => {
              const parent = selectedPath[selectedPath.length - 2]
              edit((r) => deletePerson(r, selectedNode.id), parent.id)
              setSelected(parent.type === 'wife' ? selectedPath[selectedPath.length - 3].id : parent.id)
            }} />
        )}

        {boot.status === 'error' && (
          <section className="m-4 max-w-xl space-y-2 rounded border border-red-400 bg-red-50 p-3">
            <p className="font-bold">البيانات المحفوظة فيها خطأ. لم يتم حذف أي شيء.</p>
            <ul dir="ltr" className="list-disc ps-5 text-sm">{boot.errors.map((e) => <li key={e}>{e}</li>)}</ul>
            <button className="rounded bg-slate-800 px-3 py-2 text-white" onClick={() => {
              const a = document.createElement('a')
              a.href = URL.createObjectURL(new Blob([boot.raw], { type: 'application/json' }))
              a.download = 'family-tree-raw-backup.json'
              a.click()
            }}>تنزيل نسخة من البيانات كما هي</button>
          </section>
        )}

        {boot.status === 'empty' && (
          <div className="m-4 max-w-xl"><NewTree onCreate={(r) => newTree(r, [])} /></div>
        )}
      </main>

      <input ref={fileInput} type="file" accept="application/json,.json" hidden
        onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void onImport(f) }} />
    </div>
  )
}

function NewTree({ onCreate }: { onCreate: (root: TreeNode) => void }) {
  const [name, setName] = useState('')
  return (
    <form className="space-y-2" onSubmit={(e) => {
      e.preventDefault()
      if (name.trim()) onCreate({ id: crypto.randomUUID(), type: 'member', name: name.trim(), gender: 'male', generation: 1, children: [] })
    }}>
      <label className="block">اسم المؤسس (الجد الأكبر)
        <input className="mt-1 block w-full rounded border p-2" value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <button className="rounded bg-slate-800 px-3 py-2 text-white">ابدأ الشجرة</button>
    </form>
  )
}

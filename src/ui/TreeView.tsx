import { memo, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState, type Ref } from 'react'
import { select } from 'd3-selection'
import { zoom, zoomIdentity, zoomTransform, type ZoomBehavior } from 'd3-zoom'
import { FONT_NAME, FONT_SUB, FONT_WIFE, subText, type Box, type Layout } from '../layout/layout'
import { hiddenCount } from '../model/mutations'
import { DOT_R, LABEL_FONT, LABEL_H, pickLabels } from '../layout/labels'
import { genColor, personColor, tint } from './colors'
import { BARK, crown, jitter, ROOT_W, TRUNK_H } from '../layout/organic'
import { branchPieces, pieceD } from '../layout/branches'
import { measureText } from './measure'

const DOTS_BELOW = 0.35 // zoom at which cards turn into dots with names
const MIN_K = 0.02
const MAX_K = 3
const BAR = 72 // room kept for the zoom bar
const KEY = 44 // room kept for the generation key at the top
const DOME = 40 // the green dome reaches this far past the outermost cards

export interface TreeViewHandle {
  fit(): void
  centerOn(id: string): void
}

interface Props {
  layout: Layout
  selected: string | null
  flash: string | null // search hit, drawn with a pulsing ring
  anchor: string | null // this card must not move on screen when the layout changes
  panelOpen: boolean // the edit panel covers the right side (wide screens) or the bottom (phones)
  onSelect(id: string | null): void
  onToggleFold(id: string): void
  ref?: Ref<TreeViewHandle>
}

const PANEL_W = 320 // md:w-80 in EditPanel
const wide = () => window.matchMedia('(min-width: 768px)').matches

export function TreeView({ layout, selected, flash, anchor, panelOpen, onSelect, onToggleFold, ref }: Props) {
  const svgRef = useRef<SVGSVGElement>(null)
  const gRef = useRef<SVGGElement>(null)
  const zoomRef = useRef<ZoomBehavior<SVGSVGElement, unknown>>(null)
  const prevLayout = useRef<Layout | null>(null)
  const [k, setK] = useState(1)

  // layout effect, so the zoom exists before the first fit below
  useLayoutEffect(() => {
    const svg = select(svgRef.current!)
    const z = zoom<SVGSVGElement, unknown>()
      .scaleExtent([MIN_K, MAX_K])
      .on('zoom', (e) => {
        gRef.current!.setAttribute('transform', e.transform.toString())
        setK(e.transform.k)
      })
    svg.call(z).on('dblclick.zoom', null)
    zoomRef.current = z
    return () => { svg.on('.zoom', null) }
  }, [])

  const size = () => svgRef.current!.getBoundingClientRect()
  const setTransform = (x: number, y: number, s: number) =>
    select(svgRef.current!).call(zoomRef.current!.transform, zoomIdentity.translate(x, y).scale(s))

  const dome = useMemo(() => crown(layout, DOME), [layout])
  const fit = () => {
    const { width, height } = size()
    const pad = 24
    // the whole tree, trunk and grass included
    const f = layout.boxes[0]
    const minX = Math.min(dome.minX, f.x - 250), maxX = Math.max(dome.maxX, f.x + 250)
    const w = maxX - minX, h = layout.maxY + TRUNK_H + 40 - dome.minY
    const s = Math.max(MIN_K, Math.min(MAX_K, (width - 2 * pad) / w, (height - 2 * pad - BAR - KEY) / h))
    setTransform(width / 2 - s * (minX + w / 2), KEY + (height - BAR - KEY) / 2 - s * (dome.minY + h / 2), s)
  }

  const centerOn = (id: string) => {
    const b = layout.byId.get(id)
    if (!b) return
    const { width, height } = size()
    const s = Math.max(zoomTransform(svgRef.current!).k, 0.8) // close enough to read
    // middle of the part of the screen the panel leaves free
    const cx = panelOpen && wide() ? (width - PANEL_W) / 2 : width / 2
    const cy = panelOpen && !wide() ? (height * 0.5) / 2 : (height - BAR) / 2
    setTransform(cx - s * b.x, cy - s * b.y, s)
  }

  useImperativeHandle(ref, () => ({ fit, centerOn }))

  // New layout: fit the first time; afterwards keep the view, and keep the
  // anchor card exactly where it was on screen (folding must not jump).
  useLayoutEffect(() => {
    const prev = prevLayout.current
    prevLayout.current = layout
    if (!prev) return fit()
    const a = anchor && prev.byId.get(anchor), b = anchor && layout.byId.get(anchor)
    if (!a || !b) return
    const t = zoomTransform(svgRef.current!)
    setTransform(t.x + t.k * (a.x - b.x), t.y + t.k * (a.y - b.y), t.k)
  }, [layout]) // eslint-disable-line react-hooks/exhaustive-deps

  // Screen changed size (phone turned, window resized): keep the middle in the middle.
  useEffect(() => {
    const svg = svgRef.current!
    let last = svg.getBoundingClientRect()
    const ro = new ResizeObserver(() => {
      const now = svg.getBoundingClientRect()
      if (!now.width || !now.height) return
      const t = zoomTransform(svg)
      setTransform(t.x + (now.width - last.width) / 2, t.y + (now.height - last.height) / 2, t.k)
      last = now
    })
    ro.observe(svg)
    return () => ro.disconnect()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const zoomTo = (next: number) => select(svgRef.current!).call(zoomRef.current!.scaleTo, next)

  // zoom in steps of ~19%, so names are re-picked only when it matters
  const kb = Math.pow(2, Math.round(Math.log2(k) * 4) / 4)
  const dots = kb < DOTS_BELOW
  const [hlGen, setHlGen] = useState<number | null>(null)
  const gens = useMemo(() => [...new Set(layout.boxes.map((b) => b.node.generation))].sort((a, b) => a - b), [layout])

  return (
    <div className="relative h-full w-full overflow-hidden bg-gradient-to-b from-[#d9eef6] via-[#eef5e4] to-[#f4f1e2]">
      <svg ref={svgRef} className="h-full w-full touch-none select-none" onClick={() => onSelect(null)}>
        <g ref={gRef}>
          <g className={hlGen ? 'gen-dim' : ''} style={{ '--minsw': `${1.2 / kb}px` } as React.CSSProperties}>
            <Canopy layout={layout} dome={dome.d} />
            <Trunk layout={layout} />
            <Edges layout={layout} />
            {dots
              ? <><Dots layout={layout} k={kb} onSelect={onSelect} /><Labels layout={layout} k={kb} must={selected} prefer={hlGen} /></>
              : <Cards layout={layout} onSelect={onSelect} onToggleFold={onToggleFold} />}
          </g>
          <Rings layout={layout} selected={selected} flash={flash} dotsAt={dots ? kb : null} />
        </g>
      </svg>
      {hlGen && <style>{`.gen-dim .gen-item:not(.g${hlGen}) { opacity: .12 }`}</style>}
      <Legend inset={panelOpen && wide() ? PANEL_W : 0} gens={gens} active={hlGen} onPick={(g) => setHlGen(g === hlGen ? null : g)} />
      <ZoomBar shift={panelOpen && wide() ? PANEL_W / 2 : 0} k={k} onZoom={zoomTo} onFit={fit} onCenter={selected ? () => centerOn(selected) : undefined} />
    </div>
  )
}

function Legend({ inset, gens, active, onPick }: { inset: number; gens: number[]; active: number | null; onPick(g: number): void }) {
  return (
    <div className="absolute top-2 flex items-center gap-1 overflow-x-auto [scrollbar-width:none] rounded-full bg-white/80 px-2 py-1 shadow" dir="rtl"
      style={{ insetInlineStart: inset + 8, maxWidth: `calc(100% - ${inset + 16}px)` }}>
      <span className="shrink-0 px-1 text-xs font-bold text-stone-700">الجيل</span>
      {gens.map((g) => (
        <button key={g} onClick={() => onPick(g)} aria-pressed={active === g} title={`الجيل ${g}`}
          className={`grid h-7 min-w-7 shrink-0 place-items-center rounded-full px-1 text-xs font-bold text-white
            ${active && active !== g ? 'opacity-30' : ''} ${active === g ? 'ring-2 ring-black ring-offset-1' : ''}`}
          style={{ background: genColor(g) }}>{g}</button>
      ))}
    </div>
  )
}

function Rings({ layout, selected, flash, dotsAt }: { layout: Layout; selected: string | null; flash: string | null; dotsAt: number | null }) {
  const ring = (id: string | null, cls: string) => {
    const b = id ? layout.byId.get(id) : undefined
    if (!b) return null
    if (dotsAt) return <circle className={cls} cx={b.x} cy={b.y} r={(DOT_R + 4) / dotsAt} fill="none" pointerEvents="none"
      style={{ strokeWidth: 4 / dotsAt }} />
    const p = 4
    return <rect className={cls} x={b.x - b.w / 2 - p} y={b.y - b.h / 2 - p} width={b.w + 2 * p} height={b.h + 2 * p}
      rx={b.kind === 'wife' ? (b.h + 2 * p) / 2 : 10} fill="none" pointerEvents="none" />
  }
  return <>{ring(selected, 'ring-selected')}{ring(flash, 'ring-flash')}</>
}

// Slider works on a log scale so both 2% and 300% are reachable.
function ZoomBar({ shift, k, onZoom, onFit, onCenter }: {
  shift: number; k: number; onZoom: (k: number) => void; onFit: () => void; onCenter?: () => void
}) {
  const toSlider = (v: number) => Math.log(v / MIN_K) / Math.log(MAX_K / MIN_K)
  const fromSlider = (s: number) => MIN_K * Math.pow(MAX_K / MIN_K, s)
  const btn = 'grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/15 text-2xl font-bold text-white active:bg-white/30 disabled:opacity-30'
  return (
    <div style={{ left: `calc(50% - ${shift}px)`, width: `min(600px, calc(100% - 32px - ${2 * shift}px))` }}
      className="absolute bottom-3 flex -translate-x-1/2 items-center gap-2 rounded-full bg-[#3b2a1e] px-3 py-2 shadow-lg" dir="ltr">
      <span className="w-11 shrink-0 text-center text-sm font-bold text-white">{Math.round(k * 100)}%</span>
      <button className={btn} onClick={() => onZoom(k / 1.4)} aria-label="تصغير">−</button>
      <input type="range" min={0} max={1} step={0.001} value={toSlider(k)} aria-label="التكبير"
        onChange={(e) => onZoom(fromSlider(Number(e.target.value)))} className="h-2 min-w-0 flex-1 accent-amber-400" />
      <button className={btn} onClick={() => onZoom(k * 1.4)} aria-label="تكبير">+</button>
      <button className={btn} onClick={onCenter} disabled={!onCenter} aria-label="توسيط المحدد" title="توسيط المحدد">◎</button>
      <button className="h-11 shrink-0 rounded-full bg-amber-500 px-3 font-bold text-[#3b2a1e] active:bg-amber-400" onClick={onFit}>الكل</button>
    </div>
  )
}

// Bark-coloured branches, thicker the more people they carry (see branches.ts).
const Edges = memo(function Edges({ layout }: { layout: Layout }) {
  const items = useMemo(() => branchPieces(layout).map((p) => ({ key: p.key, d: pieceD(p), w: p.w })), [layout])
  const width = (w: number) => ({ strokeWidth: `max(${w}px, var(--minsw))` })
  return (
    <g fill="none" strokeLinecap="round" strokeLinejoin="round">
      <g stroke="#4a2f1b">{items.map((p) => <path key={p.key} d={p.d} style={width(p.w + 2 * BARK)} />)}</g>
      <g stroke="#7a5233">{items.map((p) => <path key={p.key} d={p.d} style={width(p.w)} />)}</g>
      <g stroke="#9c7350" opacity={0.6}>{items.filter((p) => p.w > 5).map((p) => <path key={p.key} d={p.d} style={{ strokeWidth: p.w * 0.25 }} />)}</g>
    </g>
  )
})

// Soft green clouds behind the cards: one disc per person, painted as one
// layer so overlaps merge, on top of one dome around the whole crown.
const Canopy = memo(function Canopy({ layout, dome }: { layout: Layout; dome: string }) {
  const discs = useMemo(() => layout.boxes.filter((b) => b.kind !== 'knot').map((b) => {
    const j = jitter(b.id)
    return { key: b.id, x: b.x + (j - 0.5) * 16, y: b.y - 6, r: (Math.max(b.w, b.h) * 0.55 + 14) * (0.85 + 0.3 * j) }
  }), [layout])
  return (
    <>
      <path d={dome} fill="#7fb35d" opacity={0.28} />
      <g fill="#5f9a4a" opacity={0.3}>{discs.map((d) => <circle key={d.key} cx={d.x} cy={d.y} r={d.r + 22} />)}</g>
      <g fill="#86b86a" opacity={0.35}>{discs.map((d) => <circle key={d.key} cx={d.x} cy={d.y} r={d.r} />)}</g>
      <g fill="#b9dc9e" opacity={0.35}>{discs.map((d) => <circle key={d.key} cx={d.x - d.r * 0.2} cy={d.y - d.r * 0.25} r={d.r * 0.6} />)}</g>
    </>
  )
})

// Trunk, roots and a patch of grass under the founder.
function Trunk({ layout }: { layout: Layout }) {
  const f = layout.boxes[0]
  const top = f.y + f.h / 2, bot = top + TRUNK_H, x = f.x
  const tw = ROOT_W / 2 + BARK, bw = 46 // top as wide as the generation-1 wood it carries on into
  const body = `M${x - tw},${top} C${x - tw},${top + TRUNK_H * 0.4} ${x - bw * 0.7},${bot - 30} ${x - bw},${bot}
    L${x + bw},${bot} C${x + bw * 0.7},${bot - 30} ${x + tw},${top + TRUNK_H * 0.4} ${x + tw},${top} Z`
  const roots = [-1, 1].flatMap((s) => [
    `M${x + s * bw * 0.6},${bot - 4} q${s * 40},6 ${s * 90},18`,
    `M${x + s * bw * 0.3},${bot - 2} q${s * 20},12 ${s * 45},30`,
  ])
  return (
    <g pointerEvents="none">
      <ellipse cx={x} cy={bot + 14} rx={240} ry={26} fill="#7fb35d" />
      <ellipse cx={x} cy={bot + 8} rx={200} ry={16} fill="#97c873" />
      <g fill="none" stroke="#4a2f1b" strokeLinecap="round">{roots.map((d) => <path key={d} d={d} strokeWidth={9} />)}</g>
      <g fill="none" stroke="#7a5233" strokeLinecap="round">{roots.map((d) => <path key={d} d={d} strokeWidth={6} />)}</g>
      <path d={body} fill="#7a5233" stroke="#4a2f1b" strokeWidth={2} />
      <path d={`M${x - 4},${top + 20} C${x - 8},${top + 70} ${x + 2},${bot - 50} ${x - 6},${bot - 10}`} fill="none" stroke="#5c3d24" strokeWidth={2} opacity={0.6} />
      <path d={`M${x + 6},${top + 40} C${x + 9},${top + 80} ${x + 4},${bot - 40} ${x + 12},${bot - 8}`} fill="none" stroke="#5c3d24" strokeWidth={2} opacity={0.5} />
    </g>
  )
}

const Cards = memo(function Cards({ layout, onSelect, onToggleFold }: {
  layout: Layout; onSelect(id: string): void; onToggleFold(id: string): void
}) {
  return <>{layout.boxes.map((b) => <Card key={b.id} b={b} onSelect={onSelect} onToggleFold={onToggleFold} />)}</>
})

// Zoomed out: a dot per person, fixed size on screen.
const Dots = memo(function Dots({ layout, k, onSelect }: { layout: Layout; k: number; onSelect(id: string): void }) {
  return (
    <>
      {layout.boxes.map((b) => (
        <circle key={b.id} className={`gen-item g${b.node.generation} cursor-pointer`} cx={b.x} cy={b.y}
          r={Math.min(DOT_R / k, Math.max(b.w, b.h) * 0.3) * (b.node.type === 'wife' ? 0.7 : 1)} fill={personColor(b.node)}
          onClick={(e) => { e.stopPropagation(); onSelect(b.id) }} />
      ))}
    </>
  )
})

const Labels = memo(function Labels({ layout, k, must, prefer }: { layout: Layout; k: number; must: string | null; prefer: number | null }) {
  const labels = useMemo(() => pickLabels(layout.boxes, k, measureText, must, prefer), [layout, k, must, prefer])
  return (
    <g pointerEvents="none" style={{ fontSize: 12 / k, fontWeight: 700, fontFamily: LABEL_FONT.split(' ').slice(2).join(' ') }}>
      {labels.map((l) => {
        const n = layout.byId.get(l.id)!.node
        const g = n.generation
        return (
          <text key={l.id} className={`gen-item g${g}`} x={l.x} y={l.y} dy="0.35em" textAnchor="middle"
            fill={personColor(n)} stroke="#fff" strokeWidth={3 / k} paintOrder="stroke" style={{ lineHeight: LABEL_H }}>
            {n.name}
          </text>
        )
      })}
    </g>
  )
})

const font = (f: string) => {
  const [weight, size, ...family] = f.split(' ')
  return { fontWeight: weight, fontSize: size, fontFamily: family.join(' ') }
}

const Card = memo(function Card({ b, onSelect, onToggleFold }: { b: Box; onSelect(id: string): void; onToggleFold(id: string): void }) {
  const x = b.x - b.w / 2, y = b.y - b.h / 2
  const click = (e: React.MouseEvent) => { e.stopPropagation(); onSelect(b.id) }
  const n = b.node
  const c = personColor(n)
  const cls = `gen-item g${n.generation} cursor-pointer person${n.dead ? ' dead' : ''}`
  const badge = n.children.length > 0 && (
    <g className="cursor-pointer" onClick={(e) => { e.stopPropagation(); onToggleFold(b.id) }}>
      <title>{n.collapsed ? 'فتح الفرع' : 'طي الفرع'}</title>
      {n.collapsed ? (
        <>
          <rect x={x - 10} y={y - 9} width={30} height={16} rx={8} fill="#c2410c" />
          <text x={x + 5} y={y - 1} dy="0.35em" textAnchor="middle" fill="#fff" style={{ fontSize: 10, fontWeight: 700 }}>
            {`+${hiddenCount(n)}`}
          </text>
        </>
      ) : (
        <>
          <circle cx={x} cy={y} r={8} fill="#fff" stroke="#6b4a2f" />
          <text x={x} y={y} dy="0.35em" textAnchor="middle" fill="#6b4a2f" style={{ fontSize: 13, fontWeight: 700 }}>−</text>
        </>
      )}
    </g>
  )

  if (b.kind === 'knot') {
    return (
      <g className={cls} onClick={click}>
        <rect x={x - 6} y={y} width={b.w + 12} height={b.h} fill="transparent" />
        <circle cx={b.x} cy={b.y} r={5} fill={c} stroke="#6b4a2f"><title>أم غير معروفة</title></circle>
        {n.collapsed && badge}
      </g>
    )
  }
  if (b.kind === 'wife') {
    return (
      <g className={cls} onClick={click}>
        <rect x={x} y={y} width={b.w} height={b.h} rx={b.h / 2} fill={n.dead ? '#d6d3d1' : '#fcd581'} stroke={c} strokeWidth={2} />
        <text x={b.x} y={b.y} dy="0.35em" textAnchor="middle" fill="#3b2a1e" style={font(FONT_WIFE)}>{n.name}</text>
        {n.collapsed && badge}
      </g>
    )
  }
  const man = b.kind === 'man'
  const sub = subText(n)
  return (
    <g className={cls} onClick={click}>
      {/* men: solid square-ish card; daughters: light, rounder, coloured border */}
      <rect x={x} y={y} width={b.w} height={b.h} rx={man ? 6 : 14}
        fill={man ? c : tint(c, 0.88)} stroke={c} strokeWidth={man ? 1 : 2} />
      <text x={b.x} y={sub ? b.y - 4 : b.y} dy="0.35em" textAnchor="middle" fill={man ? '#fff' : c} style={font(FONT_NAME)}>
        {n.name}
      </text>
      {sub && (
        <text x={b.x} y={b.y + 11} dy="0.35em" textAnchor="middle" fill={man ? tint(c, 0.75) : c} style={font(FONT_SUB)}>{sub}</text>
      )}
      {badge}
    </g>
  )
}, (a, b) =>
  // a new layout makes new boxes; redraw only cards that really changed
  a.b.node === b.b.node && a.b.x === b.b.x && a.b.y === b.b.y && a.b.w === b.b.w &&
  a.onSelect === b.onSelect && a.onToggleFold === b.onToggleFold)

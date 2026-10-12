import { useEffect, useMemo, useState } from 'react'
import { FITTINGS, FittingDef, Group, Material, matOf, sizeMatLabel, Part, SIZES, SizeId, fittingDef, portsOf, sizeIndex, sizeLabel, sizeSpec } from './catalog'
import { Bom, bomCsv } from './bom'
import { EnvBomSection, EnvInspector, SystemPosition } from './EnvPanel'
import { Penetration, envBom } from './environment'
import { Model, portKey } from './geometry'
import { subtreeSize, useStore } from './store'
import { formatLength, parseLength } from './units'

// Иконки — линия по оси детали
const ICONS: Record<string, string> = {
  pipe: 'M2 12h20',
  ell90: 'M6 3v8a2 2 0 0 0 2 2h13',
  st90: 'M6 1v10a2 2 0 0 0 2 2h13M3 5h6',
  ell45: 'M2 16h9l9-9',
  tee: 'M3 9h18M12 9v12',
  heater: 'M7 4h10v17H7zM9 2v2M15 2v2M10 16h4',
  check: 'M2 12h4M18 12h4M6 7h12v10H6zM9 12h6M13 10l2 2-2 2',
  pump: 'M8 21h8M7 18h10v3H7zM9 8h6v10H9zM15 10h3V3M10 8V5',
  basin: 'M4 4h16M5 4l2 17h10l2-17M9 14h6v7H9z',
  tankless: 'M5 3h14v15H5zM9 18v3M12 18v3M15 18v3M9 1v2M15 1v2M9 13h6',
  xtank: 'M12 2v4M8 6h8a3 3 0 0 1 3 3v9a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3V9a3 3 0 0 1 3-3zM5 13h14',
  nohub: 'M2 12h20M6 7h12v10H6zM9 7v10M15 7v10',
  shower: 'M3 13h18M12 3v18M8 9h8v8H8z',
  bullhead: 'M3 10h18M12 10v11M7 10v-3M17 10v-3M9 21h6',
  cross: 'M3 12h18M12 3v18',
  coupling: 'M2 12h20M8 7v10M16 7v10',
  reducer: 'M2 9h8l4 2h8M2 15h8l4-2h8',
  union: 'M2 12h20M9 6h6v12H9z',
  fa: 'M2 12h9M11 7h9v10h-9zM14 7v10M17 7v10',
  ma: 'M2 12h9M11 8h3v8h-3zM14 10h7M14 14h7M17 10v4M20 10v4',
  bushing: 'M5 5h14v14H5zM9 9h6v10',
  cap: 'M2 12h10M12 6h3a6 6 0 0 1 0 12h-3z',
  plug: 'M3 12h8M11 6h4v12h-4zM15 9h4v6h-4z',
  valve: 'M2 12h20M8 8l8 8M8 16l8-8M12 3v5M7 3h10',
  bend90: 'M5 3v7a8 8 0 0 0 8 8h8',
  long90: 'M3 2v4a15 15 0 0 0 15 15h4',
  bend45: 'M2 15h8q3 0 5-2l6-6',
  st45: 'M2 15h8q3 0 5-2l6-6M5 11v8',
  bend22: 'M2 15h10l10-4',
  dbl90: 'M12 22v-8a6 6 0 0 0-6-6H2M12 14a6 6 0 0 1 6-6h4',
  santee: 'M10 2v20M22 8h-4a8 8 0 0 0-8 8',
  dblsan: 'M12 2v20M23 7h-3a8 8 0 0 0-8 8M1 7h3a8 8 0 0 1 8 8',
  cotee: 'M9 2v20M9 12h8M17 8h4v8h-4z',
  wye: 'M9 2v20M9 17l11-11',
  dblwye: 'M12 2v20M12 17l9-9M12 17l-9-9',
  combo: 'M9 2v20M9 18l6-6q2-2 6-2',
  dblcombo: 'M12 2v20M12 18l4-4q2-2 6-2M12 18l-4-4q-2-2-6-2',
  trapad: 'M12 22V12M7 12h10M8 6h8v6H8zM12 2v4',
  cleanout: 'M12 23V11M7 11h10M9.5 5h5v6h-5z',
  ptrap: 'M22 5h-7v9a4.5 4.5 0 0 1-9 0V2',
  return: 'M5 2v10a7 7 0 0 0 14 0V2',
  closet: 'M12 23V12M3 11h18'
}

const nominalLabel = (s: SizeId): string => sizeLabel(s)

function GlyphIcon({ name }: { name: string }) {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22">
      <path d={ICONS[name]} fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function KindIcon({ kind }: { kind: string }) {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22">
      <path d={ICONS[fittingDef(kind).icon] ?? ICONS.pipe} fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function SizeSelect({ value, onChange, only, disabled }: { value: SizeId; onChange: (s: SizeId) => void; only?: SizeId[]; disabled?: boolean }) {
  return (
    <select value={value} disabled={disabled} onChange={(e) => onChange(e.target.value as SizeId)}>
      {SIZES.filter((s) => !only || only.includes(s.id)).map((s, _i, list) => (
        <option key={s.id} value={s.id}>
          {list.some((x) => x.mat !== list[0].mat) ? sizeMatLabel(s.id) : sizeLabel(s.id)}
        </option>
      ))}
    </select>
  )
}

const MAT_HEAD: Record<Material, (s: SizeId) => string> = {
  pvc: (s) => `PVC Sch 40${sizeSpec(s).dwv > 0 ? ' · DWV' : ''}`,
  cu: () => 'Copper Type L · sweat',
  ci: () => 'Cast Iron No-Hub (CISPI 301)',
  gs: () => 'Galvanized Sch 40'
}
const MAT_SRC: Record<Material, string> = { pvc: 'Charlotte', cu: 'NIBCO', ci: 'Charlotte', gs: 'ASTM A53' }

const GROUPS: { id: Group; title: string }[] = [
  { id: 'pressure', title: 'Pressure Sch 40' },
  { id: 'dwv', title: 'DWV — Drain, Waste & Vent' },
  { id: 'copper', title: 'Copper — Sweat (NIBCO Wrot)' },
  { id: 'nohub', title: 'No-Hub Couplings (Transitions)' }
]
// Сантехническое оборудование — отдельный раздел, не зависит от размера трубы
const FIXTURE_GROUPS: { id: Group; title: string }[] = [
  { id: 'heater', title: 'Water Heaters & Expansion Tanks' },
  { id: 'pump', title: 'Sump & Sewage Pumps, Basins, Check Valves' }
]

function readOpen(): Record<string, boolean> {
  try {
    return JSON.parse(localStorage.getItem('pipecad.groups') ?? '{}')
  } catch {
    return {}
  }
}

export function Palette({ model }: { model: Model }) {
  const parts = useStore((s) => s.parts)
  const activePort = useStore((s) => s.activePort)
  const paletteSize = useStore((s) => s.paletteSize)
  const addPart = useStore((s) => s.addPart)
  const setPaletteSize = useStore((s) => s.setPaletteSize)
  const placing = useStore((s) => s.placing)
  const newBranch = useStore((s) => s.newBranch)
  const cancelPlacing = useStore((s) => s.cancelPlacing)
  const joining = useStore((s) => s.joining)
  const startJoin = useStore((s) => s.startJoin)
  const [step, setStep] = useState<'size' | 'catalog' | 'fixtures'>(parts.length ? 'catalog' : 'size')
  const [mat, setMat] = useState<Material>(sizeSpec(paletteSize).mat)
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState<Record<string, boolean>>(readOpen)
  const portSize = activePort ? model.ports.find((w) => portKey(w.partId, w.index) === portKey(activePort.id, activePort.port))?.size : undefined

  // Выбрали свободный конец — каталог переключается на его размер
  const portPrefersCu = activePort ? !!model.ports.find((w) => portKey(w.partId, w.index) === portKey(activePort.id, activePort.port))?.def.preferCu : false
  useEffect(() => {
    if (!portSize) return
    setPaletteSize(portPrefersCu && !portSize.startsWith('cu') ? (('cu' + portSize) as SizeId) : portSize)
    setStep('catalog')
  }, [portSize, portPrefersCu])

  const toggle = (k: string): void => {
    const next = { ...open, [k]: !(open[k] ?? true) }
    setOpen(next)
    try {
      localStorage.setItem('pipecad.groups', JSON.stringify(next))
    } catch {
      /* ignore */
    }
  }

  useEffect(() => setMat(sizeSpec(paletteSize).mat), [paletteSize])
  const chooseSize = (s: SizeId): void => {
    setPaletteSize(s)
    setStep('catalog')
  }

  if (step === 'size') {
    void 0
    return (
      <aside className="palette">
        <div className="step-title">
          <span className="step-num">1</span>Material & size
        </div>
        <div className="tabs mat-tabs">
          <button className={mat === 'pvc' ? 'on' : ''} onClick={() => setMat('pvc')}>
            PVC
          </button>
          <button className={mat === 'cu' ? 'on cu' : 'cu'} onClick={() => setMat('cu')}>
            Copper
          </button>
          <button className={mat === 'ci' ? 'on' : ''} onClick={() => setMat('ci')} title="Cast Iron No-Hub (CISPI 301)">
            Cast Iron
          </button>
          <button className={mat === 'gs' ? 'on' : ''} onClick={() => setMat('gs')} title="Galvanized steel Sch 40">
            Galv.
          </button>
        </div>
        <button className="wide fixtures-btn" onClick={() => setStep('fixtures')}>
          <GlyphIcon name="heater" /> Plumbing Fixtures
          <small>heaters, tanks, pumps, basins</small>
        </button>
        <div className="size-grid">
          {SIZES.filter((s) => s.mat === mat).map((s) => {
            const count = Object.values(FITTINGS).filter((d) => d.group !== 'common' && d.group !== 'heater' && d.group !== 'pump' && d.sizes.includes(s.id)).length
            return (
              <button key={s.id} className={`size-card${s.id === paletteSize ? ' on' : ''}`} onClick={() => chooseSize(s.id)}>
                <span className="size-big">{sizeLabel(s.id)}</span>
                <span className="size-sub">OD {s.od.toFixed(3)}"</span>
                <span className="size-tags">
                  {s.mat === 'cu' ? <span className="tag cu">Type L</span> : s.mat === 'ci' ? <span className="tag">No-Hub</span> : s.mat === 'gs' ? <span className="tag">Galv Sch 40</span> : <span className="tag">Sch 40</span>}
                  {s.dwv > 0 && <span className="tag dwv">DWV</span>}
                </span>
                <span className="size-count">{count} fittings</span>
              </button>
            )
          })}
        </div>
        <div className="help">
          <b>How to build</b>
          <p>Pick a size to open the fittings catalog for it. A part snaps to the selected (orange) end, and the next end is selected automatically.</p>
          <p>LMB — orbit, RMB — pan, wheel — zoom. R — rotate 90°, Del — delete, Ctrl+Z — undo.</p>
        </div>
      </aside>
    )
  }

  const size = paletteSize
  const q = query.trim().toLowerCase()
  const match = (d: FittingDef): boolean => !q || d.ru.toLowerCase().includes(q) || d.en.toLowerCase().includes(q) || (d.pn ?? '').toLowerCase().includes(q)
  const inSize = (d: FittingDef): boolean => d.sizes.includes(size)

  const item = (kind: string) => {
    const d = FITTINGS[kind]
    const extra = d.size2 ? d.size2.options(size).filter((x) => x !== size) : []
    return (
      <div key={kind} className="kind-row">
        <button className="kind" onClick={() => addPart(kind)} title={`${d.en}${d.pn ? ` · #${d.pn}` : ''}${d.key ? ` · key ${d.key}` : ''}`}>
          <KindIcon kind={kind} />
          <span>
            {d.ru}
            {d.pn && <small> #{d.pn}</small>}
          </span>
          {d.key && <kbd>{d.key}</kbd>}
        </button>
        {extra.length > 0 && (
          <div className="chips">
            {extra.map((x) => (
              <button key={x} className="chip" onClick={() => addPart(kind, x)} title={`${sizeLabel(size)} × ${sizeLabel(x)}`}>
                × {matOf(x) !== matOf(size) ? sizeMatLabel(x) : sizeLabel(x)}
              </button>
            ))}
          </div>
        )}
      </div>
    )
  }

  const fixtures = step === 'fixtures'
  const renderGroups = (groups: { id: Group; title: string }[]) =>
    groups.map((g) => {
      const kinds = Object.keys(FITTINGS).filter((k) => FITTINGS[k].group === g.id && (fixtures || inSize(FITTINGS[k])) && match(FITTINGS[k]))
      if (!kinds.length) return null
      const cats = [...new Set(kinds.map((k) => FITTINGS[k].cat))]
      const gOpen = q ? true : open[g.id] ?? true
      return (
        <div key={g.id} className="group">
          <button className="group-head" onClick={() => toggle(g.id)}>
            <span className="chev">{gOpen ? '▾' : '▸'}</span>
            {g.title}
            <span className="count">{kinds.length}</span>
          </button>
          {gOpen &&
            cats.map((c) => {
              const key = `${g.id}/${c}`
              const cOpen = q ? true : open[key] ?? true
              return (
                <div key={c} className="cat">
                  <button className="cat-head" onClick={() => toggle(key)}>
                    <span className="chev">{cOpen ? '▾' : '▸'}</span>
                    {c}
                  </button>
                  {cOpen && <div className="kinds">{kinds.filter((k) => FITTINGS[k].cat === c).map(item)}</div>}
                </div>
              )
            })}
        </div>
      )
    })

  return (
    <aside className="palette">
      {fixtures ? (
        <>
          <div className="step-title">Plumbing Fixtures</div>
          <div className="size-head">
            <span className="size-badge fixtures-badge">
              <GlyphIcon name="heater" />
            </span>
            <div className="size-head-text">
              <div>Heaters, tanks, pumps & basins</div>
              <div className="muted small">Any pipe size · connect with adapters</div>
            </div>
            <button className="link" onClick={() => setStep(parts.length ? 'catalog' : 'size')}>
              Back
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="step-title">
            <span className="step-num">2</span>Fittings catalog
          </div>
          <div className="size-head">
            <span className="size-badge">{sizeLabel(size)}</span>
            <div className="size-head-text">
              <div>{MAT_HEAD[sizeSpec(size).mat](size)}</div>
              <div className="muted small">OD {sizeSpec(size).od.toFixed(3)}" · {MAT_SRC[sizeSpec(size).mat]}</div>
            </div>
            <button className="link" onClick={() => setStep('size')}>
              Change
            </button>
          </div>
          <button className="wide fixtures-btn" onClick={() => setStep('fixtures')}>
            <GlyphIcon name="heater" /> Plumbing Fixtures
            <small>heaters, tanks, pumps, basins</small>
          </button>
        </>
      )}
      {parts.length > 0 && (
        <button className={'wide branch' + (placing ? ' on' : '')} onClick={() => (placing ? cancelPlacing() : newBranch())}>
          {placing ? '✕ Cancel placing' : '＋ New branch (place separately)'}
        </button>
      )}
      {portSize && (
        <button className={'wide branch' + (joining ? ' on' : '')} onClick={() => (joining ? useStore.setState({ joining: false, message: null }) : startJoin())} title="Key J">
          {joining ? '✕ Cancel join' : '🔗 Join to another end (J)'}
        </button>
      )}
      {parts.length > 0 && !portSize && !placing && <div className="hint">Pick a green ring — the open end to connect to — or start a new branch: pick a part and click the floor</div>}
      {portSize && portSize !== size && !(portPrefersCu && size === 'cu' + portSize) && (
        <div className="hint warn-box">
          Selected end is {sizeLabel(portSize)} — {sizeLabel(size)} parts will go on through a reducer if one exists
        </div>
      )}
      <input className="search" placeholder={fixtures ? "Search: 50 gal, Navien, M267…" : "Search: tee, wye, 2300…"} value={query} onChange={(e) => setQuery(e.target.value)} />
      <div className="kinds">{!fixtures && match(FITTINGS.pipe) && item('pipe')}</div>
      {renderGroups(fixtures ? FIXTURE_GROUPS : GROUPS)}
      {!fixtures && sizeSpec(size).dwv === 0 && sizeSpec(size).mat === 'pvc' && !q && <div className="muted small">No DWV fittings are made in {sizeLabel(size)}.</div>}
    </aside>
  )
}

export function LengthInput({ value, onCommit, min = 0.25 }: { value: number; onCommit: (v: number) => void; min?: number }) {
  const [text, setText] = useState(formatLength(value))
  useEffect(() => setText(formatLength(value)), [value])
  const commit = (): void => {
    const v = parseLength(text)
    if (v === null || v < min || v > 12000) setText(formatLength(value))
    else if (Math.abs(v - value) > 1e-6) onCommit(v)
    else setText(formatLength(value))
  }
  return (
    <input
      className="len"
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
        if (e.key === 'Escape') {
          setText(formatLength(value))
          ;(e.target as HTMLInputElement).blur()
        }
      }}
    />
  )
}

// Поворот детали с шагом 1°: у присоединённой — вокруг оси подключения, у первой детали ветки — вокруг вертикали
const norm360 = (v: number): number => ((Math.round(v) % 360) + 360) % 360
export const angleOf = (p: Part): number => (p.parent ? p.roll : p.rot?.[1] ?? 0)
export function withAngle(p: Part, deg: number): Part {
  const v = norm360(deg)
  if (p.parent) return { ...p, roll: v }
  const r = p.rot ?? [0, 0, 0]
  return { ...p, rot: [r[0], v, r[2]] }
}

function RotationControl({ part }: { part: Part }) {
  const updatePart = useStore((s) => s.updatePart)
  const angle = Math.round(angleOf(part) * 10) / 10
  const [text, setText] = useState(String(angle))
  useEffect(() => setText(String(angle)), [angle])
  const set = (deg: number): void => {
    const next = withAngle(part, deg)
    updatePart(part.id, part.parent ? { roll: next.roll } : { rot: next.rot })
  }
  const live = (deg: number): void => {
    const s = useStore.getState()
    s.dragTo({ parts: s.parts.map((p) => (p.id === part.id ? withAngle(p, deg) : p)) })
  }
  return (
    <>
      <label>{part.parent ? 'Rotation about connection axis' : 'Rotation about vertical'}</label>
      <div className="row rot-row">
        <button onClick={() => set(angle - 5)}>−5°</button>
        <button onClick={() => set(angle - 1)}>−1°</button>
        <input
          className="len rot-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={() => {
            const v = parseFloat(text.replace(',', '.').replace('°', ''))
            if (Number.isFinite(v)) set(v)
            else setText(String(angle))
          }}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        />
        <button onClick={() => set(angle + 1)}>+1°</button>
        <button onClick={() => set(angle + 5)}>+5°</button>
      </div>
      <input
        type="range"
        className="rot-slider"
        min={0}
        max={359}
        step={1}
        value={norm360(angle)}
        onPointerDown={() => useStore.getState().beginDrag()}
        onPointerUp={() => useStore.getState().endDrag()}
        onChange={(e) => live(Number(e.target.value))}
      />
      <div className="row">
        {[-90, -45, 45, 90].map((d) => (
          <button key={d} onClick={() => set(angle + d)}>
            {d < 0 ? '⟲' : '⟳'} {Math.abs(d)}°
          </button>
        ))}
      </div>
      <div className="muted small">Or drag the ring around the part in 3D (Shift = 15° steps)</div>
    </>
  )
}

export function Inspector({ model }: { model: Model }) {
  const parts = useStore((s) => s.parts)
  const selectedId = useStore((s) => s.selectedId)
  const updatePart = useStore((s) => s.updatePart)
  const rollPart = useStore((s) => s.rollPart)
  const rotateRoot = useStore((s) => s.rotateRoot)
  const cycleAttach = useStore((s) => s.cycleAttach)
  const deletePart = useStore((s) => s.deletePart)
  const deleteBranch = useStore((s) => s.deleteBranch)
  const setMessage = useStore((s) => s.setMessage)
  const env = useStore((s) => s.env)
  const selectedEnv = useStore((s) => s.selectedEnv)
  const part = parts.find((p) => p.id === selectedId)
  const envItem = env.find((e) => e.id === selectedEnv)
  if (envItem) return <EnvInspector it={envItem} />

  if (!part) return <div className="empty">Nothing selected. Click a part or object.</div>
  const def = fittingDef(part.kind)

  // Заход фитинга на конце трубы: проекция порта соседа на его ось (от центра до дна раструба)
  const takeoff = (port: number): number => {
    const other = model.links.get(portKey(part.id, port))
    if (!other) return 0
    const [oid, oport] = other.split(':')
    const op = parts.find((p) => p.id === oid)
    if (!op || op.kind === 'pipe') return 0
    const { pos, dir } = portsOf(op)[Number(oport)]
    return Math.max(0, pos[0] * dir[0] + pos[1] * dir[1] + pos[2] * dir[2])
  }
  const len = part.length ?? 0
  const g0 = part.kind === 'pipe' ? takeoff(0) : 0
  const g1 = part.kind === 'pipe' ? takeoff(1) : 0
  const ports = portsOf(part)
  const sub = subtreeSize(parts, part.id)

  // Смена размера не должна ломать уже подключённые концы
  const changeSizes = (patch: { size?: SizeId; size2?: SizeId }): void => {
    const next = { ...part, ...patch }
    const np = portsOf(next)
    const broken = ports.some((pt, i) => model.links.has(portKey(part.id, i)) && np[i]?.size !== pt.size)
    if (broken) {
      setMessage('This end is already connected — disconnect what\'s attached first')
      return
    }
    updatePart(part.id, patch)
  }

  const s2 = def.size2
  const s2opts = s2 ? s2.options(part.size) : []
  const title2 = part.size2 && part.size2 !== part.size ? ` × ${sizeLabel(part.size2)}` : ''
  const bull = part.kind === 'pbull' || part.kind === 'cuBull'
  // оборудование: размер детали условный, в заголовке не показываем
  const fixture = def.group === 'heater' || def.group === 'pump'

  return (
    <div className="inspector">
      <div className="insp-head">
        <KindIcon kind={part.kind} />
        <div>
          <div className="insp-title">
            {bull ? `Bullhead Tee ${nominalLabel(part.size2 ?? part.size)} × ${nominalLabel(part.size2 ?? part.size)} × ${nominalLabel(part.size)}` : fixture ? def.ru : <>{def.ru} {sizeLabel(part.size)}{title2}</>}
          </div>
          <div className="insp-sub">
            {def.en}
            {def.pn ? ` · ${def.group === 'pressure' || def.group === 'dwv' ? 'Charlotte ' : def.group === 'copper' ? 'NIBCO ' : '#'}${def.pn}` : ''}
          </div>
        </div>
      </div>

      {part.kind === 'pipe' && (
        <>
          <label>Cut length</label>
          <LengthInput value={len} onCommit={(v) => updatePart(part.id, { length: v })} />
          <label>Center to center {g0 + g1 === 0 && <span className="muted">(no fittings on ends)</span>}</label>
          <LengthInput value={len + g0 + g1} onCommit={(v) => updatePart(part.id, { length: Math.max(0.25, v - g0 - g1) })} />
          {g0 + g1 > 0 && <div className="muted small">Fitting take-offs: {formatLength(g0)} + {formatLength(g1)}</div>}
        </>
      )}

      {!part.parent && parts.length === 1 && (
        <>
          <label>Size</label>
          <SizeSelect value={part.size} only={def.sizes} onChange={(s) => updatePart(part.id, { size: s, size2: s2 ? (s2.optional ? undefined : s2.options(s)[0]) : undefined })} />
        </>
      )}

      {s2 && s2opts.length > 0 && (
        <>
          <label>{s2.label}</label>
          <SizeSelect value={part.size2 ?? (s2.optional ? part.size : s2opts[0])} only={s2opts} onChange={(s) => changeSizes({ size2: s2.optional && s === part.size ? undefined : s })} />
        </>
      )}

      <SystemPosition part={part} parts={parts} />

      <RotationControl part={part} />
      {!part.parent && (
        <div className="row">
          <button onClick={() => rotateRoot(part.id, 0, 90)}>Tilt X 90°</button>
          <button onClick={() => rotateRoot(part.id, 2, 90)}>Tilt Z 90°</button>
        </div>
      )}

      {part.parent && (ports.length > 2 || s2?.reversible) && (
        <button className="wide" onClick={() => cycleAttach(part.id)}>
          {s2?.reversible ? 'Flip (reduce ↔ increase)' : 'Connect by another end'}
        </button>
      )}

      <button className="wide danger" onClick={() => deletePart(part.id)} title="Del">
        Delete this part only
      </button>
      {sub > 1 && (
        <button className="wide danger" onClick={() => deleteBranch(part.id)} title="Shift+Del">
          Delete with everything downstream ({sub} parts)
        </button>
      )}
    </div>
  )
}

export function BomPanel({ bom, pens }: { bom: Bom; pens: Penetration[] }) {
  const envItems = useStore((s) => s.env)
  const stick = useStore((s) => s.stick)
  const setStick = useStore((s) => s.setStick)
  const setMessage = useStore((s) => s.setMessage)
  const exportCsv = async (): Promise<void> => {
    const path = await window.api.exportFile({ defaultName: 'pvc-materials.csv', content: bomCsv(bom, stick, envBom(envItems), pens), ext: 'csv', label: 'CSV (Excel)' })
    if (path) setMessage(`List saved: ${path}`)
  }
  const empty = !bom.pipes.length && !bom.fittings.length && !envItems.length
  const fitTotal = useMemo(() => bom.fittings.reduce((a, f) => a + f.qty, 0), [bom])
  return (
    <div className="bom">
      <div className="row between">
        <span className="muted">Pipe stick:</span>
        <div className="seg">
          {[120, 240].map((n) => (
            <button key={n} className={stick === n ? 'on' : ''} onClick={() => setStick(n)}>
              {n / 12}'
            </button>
          ))}
        </div>
      </div>
      {empty && <div className="empty">Empty — add some parts.</div>}
      {bom.pipes.map((p) => (
        <div key={p.size} className="bom-pipe">
          <div className="row between">
            <b>{p.name}</b>
            <span className="qty">{p.sticks} pcs</span>
          </div>
          <div className="muted small">
            Total {formatLength(p.total)} · cuts: {p.cuts.length}
          </div>
          <div className="cuts">
            {p.cuts.map((c, i) => (
              <span key={i}>{formatLength(c)}</span>
            ))}
          </div>
        </div>
      ))}
      {bom.fittings.length > 0 && (
        <table>
          <tbody>
            {[...bom.fittings]
              .sort((a, b) => a.name.localeCompare(b.name, 'en', { numeric: true }))
              .map((f) => (
                <tr key={f.key}>
                  <td>
                    {f.name}
                    <div className="muted small">
                      {f.ru}
                      {f.pn ? ` · #${f.pn}` : ''}
                    </div>
                  </td>
                  <td className="qty">{f.qty}</td>
                </tr>
              ))}
          </tbody>
        </table>
      )}
      {!empty && (
        <>
          <div className="muted small">
            Fittings: {fitTotal} · solvent welds: {bom.joints} (primer + cement){bom.solder ? ` · solder joints: ${bom.solder} (solder + flux)` : ''}{bom.mech ? ` · no-hub joints: ${bom.mech} (torque 60 in-lbs)` : ''}{bom.threads ? ` · threaded: ${bom.threads} (tape/dope)` : ''}
          </div>
          <EnvBomSection pens={pens} />
          <button className="wide" onClick={exportCsv}>
            Export to Excel (CSV)
          </button>
        </>
      )}
    </div>
  )
}

export { sizeIndex }

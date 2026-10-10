import { useEffect, useMemo, useState } from 'react'
import { FITTINGS, FittingDef, Group, SIZES, SizeId, fittingDef, portsOf, sizeIndex, sizeLabel } from './catalog'
import { Bom, bomCsv } from './bom'
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
      {SIZES.filter((s) => !only || only.includes(s.id)).map((s) => (
        <option key={s.id} value={s.id}>
          {sizeLabel(s.id)}
        </option>
      ))}
    </select>
  )
}

const GROUPS: { id: Group; title: string }[] = [
  { id: 'pressure', title: 'Напорные Sch 40' },
  { id: 'dwv', title: 'DWV — канализация' }
]

// Можно ли поставить деталь на конец данного размера (в т.ч. через второй размер переходника)
function fitsSize(def: FittingDef, size: SizeId): boolean {
  if (def.sizes.includes(size)) return true
  return !!def.size2 && def.sizes.some((s) => def.size2!.options(s).includes(size))
}

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
  const reducerTo = useStore((s) => s.reducerTo)
  const addPart = useStore((s) => s.addPart)
  const setPaletteSize = useStore((s) => s.setPaletteSize)
  const setReducerTo = useStore((s) => s.setReducerTo)
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState<Record<string, boolean>>(readOpen)
  const portSize = activePort ? model.ports.find((w) => portKey(w.partId, w.index) === portKey(activePort.id, activePort.port))?.size : undefined
  const curSize = parts.length ? portSize : paletteSize

  const toggle = (k: string): void => {
    const next = { ...open, [k]: !(open[k] ?? true) }
    setOpen(next)
    try {
      localStorage.setItem('pipecad.groups', JSON.stringify(next))
    } catch {
      /* ignore */
    }
  }

  const q = query.trim().toLowerCase()
  const match = (d: FittingDef): boolean => !q || d.ru.toLowerCase().includes(q) || d.en.toLowerCase().includes(q) || (d.pn ?? '').toLowerCase().includes(q)

  const item = (kind: string) => {
    const d = FITTINGS[kind]
    const ok = !curSize || fitsSize(d, curSize)
    return (
      <button key={kind} className="kind" disabled={!ok} onClick={() => addPart(kind)} title={`${d.en}${d.pn ? ` · Charlotte ${d.pn}` : ''}${d.key ? ` · клавиша ${d.key}` : ''}`}>
        <KindIcon kind={kind} />
        <span>{d.ru}</span>
        {d.key && <kbd>{d.key}</kbd>}
      </button>
    )
  }

  return (
    <aside className="palette">
      <div className="section-title">Размер</div>
      {parts.length === 0 ? (
        <SizeSelect value={paletteSize} onChange={setPaletteSize} />
      ) : (
        <div className="hint">
          {portSize ? (
            <>
              От выбранного конца: <b>{sizeLabel(portSize)}</b>
            </>
          ) : (
            'Выбери зелёную точку — конец, к которому присоединять'
          )}
        </div>
      )}
      <input className="search" placeholder="Поиск: тройник, wye, 2300…" value={query} onChange={(e) => setQuery(e.target.value)} />
      <div className="kinds">{match(FITTINGS.pipe) && item('pipe')}</div>
      {GROUPS.map((g) => {
        const kinds = Object.keys(FITTINGS).filter((k) => FITTINGS[k].group === g.id && match(FITTINGS[k]))
        if (!kinds.length) return null
        const cats = [...new Set(kinds.map((k) => FITTINGS[k].cat))]
        const gOpen = q ? true : open[g.id] ?? true
        return (
          <div key={g.id} className="group">
            <button className="group-head" onClick={() => toggle(g.id)}>
              <span className="chev">{gOpen ? '▾' : '▸'}</span>
              {g.title}
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
      })}
      <div className="section-title">Второй размер (переходы)</div>
      <SizeSelect value={reducerTo} onChange={setReducerTo} />
      <div className="help">
        <b>Как собирать</b>
        <p>Выбери деталь — она встанет на оранжевый конец. Следующий конец выберется сам, так можно собирать цепочкой.</p>
        <p>Зелёная точка — раструб или гладкий конец, синяя — резьба.</p>
        <p>ЛКМ — вращать, ПКМ — двигать, колесо — зум. R — повернуть на 90°, Del — удалить, Ctrl+Z — отменить.</p>
      </div>
    </aside>
  )
}

function LengthInput({ value, onCommit }: { value: number; onCommit: (v: number) => void }) {
  const [text, setText] = useState(formatLength(value))
  useEffect(() => setText(formatLength(value)), [value])
  const commit = (): void => {
    const v = parseLength(text)
    if (v === null || v < 0.25 || v > 12000) setText(formatLength(value))
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

export function Inspector({ model }: { model: Model }) {
  const parts = useStore((s) => s.parts)
  const selectedId = useStore((s) => s.selectedId)
  const updatePart = useStore((s) => s.updatePart)
  const rollPart = useStore((s) => s.rollPart)
  const rotateRoot = useStore((s) => s.rotateRoot)
  const cycleAttach = useStore((s) => s.cycleAttach)
  const deletePart = useStore((s) => s.deletePart)
  const setMessage = useStore((s) => s.setMessage)
  const part = parts.find((p) => p.id === selectedId)

  if (!part) return <div className="empty">Ничего не выбрано. Кликни по детали.</div>
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
      setMessage('Этот конец уже подключён — сначала отсоедини то, что к нему присоединено')
      return
    }
    updatePart(part.id, patch)
  }

  const s2 = def.size2
  const s2opts = s2 ? s2.options(part.size) : []
  const title2 = part.size2 && part.size2 !== part.size ? ` × ${sizeLabel(part.size2)}` : ''

  return (
    <div className="inspector">
      <div className="insp-head">
        <KindIcon kind={part.kind} />
        <div>
          <div className="insp-title">
            {def.ru} {sizeLabel(part.size)}
            {title2}
          </div>
          <div className="insp-sub">
            {def.en}
            {def.pn ? ` · Charlotte ${def.pn}` : ''}
          </div>
        </div>
      </div>

      {part.kind === 'pipe' && (
        <>
          <label>Длина отреза</label>
          <LengthInput value={len} onCommit={(v) => updatePart(part.id, { length: v })} />
          <label>Центр — центр {g0 + g1 === 0 && <span className="muted">(нет фитингов на концах)</span>}</label>
          <LengthInput value={len + g0 + g1} onCommit={(v) => updatePart(part.id, { length: Math.max(0.25, v - g0 - g1) })} />
          {g0 + g1 > 0 && <div className="muted small">Заходы фитингов: {formatLength(g0)} + {formatLength(g1)}</div>}
        </>
      )}

      {!part.parent && parts.length === 1 && (
        <>
          <label>Размер</label>
          <SizeSelect value={part.size} only={def.sizes} onChange={(s) => updatePart(part.id, { size: s, size2: s2 ? (s2.optional ? undefined : s2.options(s)[0]) : undefined })} />
        </>
      )}

      {s2 && s2opts.length > 0 && (
        <>
          <label>{s2.label}</label>
          <SizeSelect value={part.size2 ?? (s2.optional ? part.size : s2opts[0])} only={s2opts} onChange={(s) => changeSizes({ size2: s2.optional && s === part.size ? undefined : s })} />
        </>
      )}

      <label>Поворот</label>
      {part.parent ? (
        <div className="row">
          <button onClick={() => rollPart(part.id, -90)}>⟲ 90°</button>
          <button onClick={() => rollPart(part.id, -45)}>⟲ 45°</button>
          <button onClick={() => rollPart(part.id, 45)}>⟳ 45°</button>
          <button onClick={() => rollPart(part.id, 90)}>⟳ 90°</button>
        </div>
      ) : (
        <div className="row">
          <button onClick={() => rotateRoot(part.id, 0, 90)}>X 90°</button>
          <button onClick={() => rotateRoot(part.id, 1, 90)}>Y 90°</button>
          <button onClick={() => rotateRoot(part.id, 2, 90)}>Z 90°</button>
        </div>
      )}
      {part.parent && <div className="muted small">Сейчас: {part.roll}° вокруг оси подключения</div>}

      {part.parent && (ports.length > 2 || s2?.reversible) && (
        <button className="wide" onClick={() => cycleAttach(part.id)}>
          {s2?.reversible ? 'Развернуть (сужение ↔ расширение)' : 'Подключить другим концом'}
        </button>
      )}

      <button className="wide danger" onClick={() => deletePart(part.id)}>
        Удалить{sub > 1 ? ` вместе с продолжением (${sub} дет.)` : ''}
      </button>
    </div>
  )
}

export function BomPanel({ bom }: { bom: Bom }) {
  const stick = useStore((s) => s.stick)
  const setStick = useStore((s) => s.setStick)
  const setMessage = useStore((s) => s.setMessage)
  const exportCsv = async (): Promise<void> => {
    const path = await window.api.exportFile({ defaultName: 'pvc-materials.csv', content: bomCsv(bom, stick), ext: 'csv', label: 'CSV (Excel)' })
    if (path) setMessage(`Список сохранён: ${path}`)
  }
  const empty = !bom.pipes.length && !bom.fittings.length
  const fitTotal = useMemo(() => bom.fittings.reduce((a, f) => a + f.qty, 0), [bom])
  return (
    <div className="bom">
      <div className="row between">
        <span className="muted">Палка трубы:</span>
        <div className="seg">
          {[120, 240].map((n) => (
            <button key={n} className={stick === n ? 'on' : ''} onClick={() => setStick(n)}>
              {n / 12}'
            </button>
          ))}
        </div>
      </div>
      {empty && <div className="empty">Пока пусто — добавь детали.</div>}
      {bom.pipes.map((p) => (
        <div key={p.size} className="bom-pipe">
          <div className="row between">
            <b>{p.name}</b>
            <span className="qty">{p.sticks} шт.</span>
          </div>
          <div className="muted small">
            Всего {formatLength(p.total)} · отрезов: {p.cuts.length}
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
            Фитингов: {fitTotal} · склеек: {bom.joints} (праймер + клей){bom.threads ? ` · резьбовых: ${bom.threads} (лента/герметик)` : ''}
          </div>
          <button className="wide" onClick={exportCsv}>
            Экспорт в Excel (CSV)
          </button>
        </>
      )}
    </div>
  )
}

export { sizeIndex }

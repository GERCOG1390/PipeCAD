import { useEffect, useMemo, useState } from 'react'
import { KINDS, KIND_ORDER, PartKind, SIZES, SizeId, portsOf, sizeLabel } from './catalog'
import { Bom, bomCsv } from './bom'
import { Model, portKey } from './geometry'
import { subtreeSize, useStore } from './store'
import { formatLength, parseLength } from './units'

const ICONS: Record<PartKind, string> = {
  pipe: 'M3 10h18v4H3z',
  elbow90: 'M4 9h8a3 3 0 0 1 3 3v8h-4v-7H4z',
  elbow45: 'M3 10h8l6-6 3 3-7 7H3z',
  tee: 'M3 9h18v4h-7v8h-4v-8H3z',
  cross: 'M10 3h4v7h7v4h-7v7h-4v-7H3v-4h7z',
  coupling: 'M3 10h4V8h10v2h4v4h-4v2H7v-2H3z',
  reducer: 'M2 8h8l4 2h8v4h-8l-4 2H2z',
  valve: 'M2 10h6V8h8v2h6v4h-6v2H8v-2H2zM11 3h2v5h-2zM7 2h10v2H7z',
  cap: 'M3 10h10V8h4a4 4 0 0 1 0 8h-4v-2H3z'
}

export function KindIcon({ kind }: { kind: PartKind }) {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22">
      <path d={ICONS[kind]} fill="currentColor" />
    </svg>
  )
}

function SizeSelect({ value, onChange }: { value: SizeId; onChange: (s: SizeId) => void }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value as SizeId)}>
      {SIZES.map((s) => (
        <option key={s.id} value={s.id}>
          {sizeLabel(s.id)}
        </option>
      ))}
    </select>
  )
}

export function Palette({ model }: { model: Model }) {
  const parts = useStore((s) => s.parts)
  const activePort = useStore((s) => s.activePort)
  const paletteSize = useStore((s) => s.paletteSize)
  const reducerTo = useStore((s) => s.reducerTo)
  const addPart = useStore((s) => s.addPart)
  const setPaletteSize = useStore((s) => s.setPaletteSize)
  const setReducerTo = useStore((s) => s.setReducerTo)
  const portSize = activePort ? model.ports.find((w) => portKey(w.partId, w.index) === portKey(activePort.id, activePort.port))?.size : undefined

  return (
    <aside className="palette">
      <div className="section-title">Размер</div>
      {parts.length === 0 ? (
        <SizeSelect value={paletteSize} onChange={setPaletteSize} />
      ) : (
        <div className="hint">{portSize ? <>От выбранного конца: <b>{sizeLabel(portSize)}</b></> : 'Выбери зелёную точку — конец, к которому присоединять'}</div>
      )}
      <div className="section-title">Детали Sch 40</div>
      <div className="kinds">
        {KIND_ORDER.map((k) => (
          <button key={k} className="kind" onClick={() => addPart(k)} title={`${KINDS[k].en} — клавиша ${KINDS[k].key}`}>
            <KindIcon kind={k} />
            <span>{KINDS[k].ru}</span>
            <kbd>{KINDS[k].key}</kbd>
          </button>
        ))}
      </div>
      <div className="section-title">Переходник на</div>
      <SizeSelect value={reducerTo} onChange={setReducerTo} />
      <div className="help">
        <b>Как собирать</b>
        <p>Выбери деталь — она встанет на оранжевый конец. Следующий конец выберется сам, так можно собирать цепочкой.</p>
        <p>ЛКМ — вращать, ПКМ — двигать, колесо — зум.</p>
        <p>R — повернуть деталь на 90°, Del — удалить, Ctrl+Z — отменить.</p>
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
  const part = parts.find((p) => p.id === selectedId)

  if (!part) return <div className="empty">Ничего не выбрано. Кликни по детали.</div>

  // Заход фитинга на конце трубы: расстояние от центра соседа до его порта
  const takeoff = (port: number): number => {
    const other = model.links.get(portKey(part.id, port))
    if (!other) return 0
    const [oid, oport] = other.split(':')
    const op = parts.find((p) => p.id === oid)
    if (!op || op.kind === 'pipe' || op.kind === 'cap') return 0
    const [x, y, z] = portsOf(op)[Number(oport)].pos
    return Math.hypot(x, y, z)
  }
  const len = part.length ?? 0
  const g0 = part.kind === 'pipe' ? takeoff(0) : 0
  const g1 = part.kind === 'pipe' ? takeoff(1) : 0
  const nPorts = portsOf(part).length
  const sub = subtreeSize(parts, part.id)

  return (
    <div className="inspector">
      <div className="insp-head">
        <KindIcon kind={part.kind} />
        <div>
          <div className="insp-title">
            {KINDS[part.kind].ru} {sizeLabel(part.size)}
            {part.kind === 'reducer' && ` → ${sizeLabel(part.size2 ?? part.size)}`}
          </div>
          <div className="insp-sub">{KINDS[part.kind].en}</div>
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

      {part.kind === 'reducer' && (
        <>
          <label>Второй размер</label>
          <SizeSelect value={part.size2 ?? part.size} onChange={(s) => updatePart(part.id, { size2: s })} />
        </>
      )}

      {!part.parent && parts.length === 1 && part.kind !== 'reducer' && (
        <>
          <label>Размер</label>
          <SizeSelect value={part.size} onChange={(s) => updatePart(part.id, { size: s })} />
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

      {part.parent && nPorts > 2 && (
        <button className="wide" onClick={() => cycleAttach(part.id)}>
          Подключить другим концом
        </button>
      )}
      {part.parent && part.kind === 'reducer' && (
        <button className="wide" onClick={() => cycleAttach(part.id)}>
          Развернуть (сужение ↔ расширение)
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
            {bom.fittings.map((f) => (
              <tr key={f.key}>
                <td>
                  {f.name}
                  <div className="muted small">{f.ru}</div>
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
            Фитингов: {fitTotal} · склеек: {bom.joints} (праймер + клей)
          </div>
          <button className="wide" onClick={exportCsv}>
            Экспорт в Excel (CSV)
          </button>
        </>
      )}
    </div>
  )
}

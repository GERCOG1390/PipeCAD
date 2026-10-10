import { useMemo } from 'react'
import { Part, V3 } from './catalog'
import { ENV_DEFS, EnvItem, LUMBER, PRESETS, Penetration, SHEETS, SURFACES, envBom } from './environment'
import { LengthInput } from './Panels'
import { viewTarget } from './Scene'
import { EnvMode, useStore } from './store'
import { formatLength } from './units'

const SWATCH: Record<string, string> = {
  Бетон: 'linear-gradient(135deg,#a3a39e,#82827c)',
  Каркас: 'repeating-linear-gradient(90deg,#d9b77c 0 6px,#2a2e33 6px 10px)',
  Пиломатериал: 'repeating-linear-gradient(0deg,#d9b77c 0 3px,#c49a5c 3px 5px)',
  Листы: 'linear-gradient(135deg,#dcc08a,#c7a066)',
  Грунт: 'linear-gradient(180deg,#4f7f2f 0 35%,#6a4d32 35%)'
}

export function EnvModeSwitch() {
  const mode = useStore((s) => s.envMode)
  const setMode = useStore((s) => s.setEnvMode)
  const opts: [EnvMode, string][] = [
    ['solid', 'Видно'],
    ['ghost', 'Прозрачно'],
    ['hidden', 'Скрыто']
  ]
  return (
    <div className="seg">
      {opts.map(([m, l]) => (
        <button key={m} className={mode === m ? 'on' : ''} onClick={() => setMode(m)}>
          {l}
        </button>
      ))}
    </div>
  )
}

function SnapSelect() {
  const snap = useStore((s) => s.snap)
  const setSnap = useStore((s) => s.setSnap)
  return (
    <select value={snap} onChange={(e) => setSnap(Number(e.target.value))}>
      {[0.5, 1, 6, 12].map((v) => (
        <option key={v} value={v}>
          {formatLength(v)}
        </option>
      ))}
    </select>
  )
}

export function EnvPalette() {
  const addEnv = useStore((s) => s.addEnv)
  const env = useStore((s) => s.env)
  return (
    <aside className="palette">
      <div className="step-title">Стройка и окружение</div>
      <div className="row between">
        <span className="muted small">Шаг перемещения:</span>
        <div style={{ width: 90 }}>
          <SnapSelect />
        </div>
      </div>
      {PRESETS.map((g) => (
        <div key={g.cat} className="cat">
          <div className="cat-title">
            <span className="swatch" style={{ background: SWATCH[g.cat] }} />
            {g.cat}
          </div>
          <div className="kinds">
            {g.items.map((p) => (
              <button key={p.label} className="kind" onClick={() => addEnv(p, [viewTarget.x, 0, viewTarget.z])}>
                <span>{p.label}</span>
              </button>
            ))}
          </div>
        </div>
      ))}
      <div className="help">
        <b>Как ставить</b>
        <p>Объект появляется в центре экрана на уровне 0 (грунт и плита — ниже нуля). Тяни цветные стрелки, чтобы двигать, или вводи координаты справа.</p>
        <p>«Прозрачно» — видно трубы внутри стен и под полом. Оранжевые кольца — где сверлить, красные — отверстие слишком большое.</p>
        {env.length > 0 && <p>Объектов: {env.length}</p>}
      </div>
    </aside>
  )
}

function Opt({ label, value, options, onChange }: { label: string; value: string; options: [string, string][]; onChange: (v: string) => void }) {
  return (
    <>
      <label>{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </>
  )
}

const lumberOpts = (keys: string[]): [string, string][] => keys.map((k) => [k, k.replace('x', '×')])
const ocOpts: [string, string][] = [
  ['12', '12" o.c.'],
  ['16', '16" o.c.'],
  ['24', '24" o.c.']
]

export function EnvInspector({ it }: { it: EnvItem }) {
  const updateEnv = useStore((s) => s.updateEnv)
  const deleteEnv = useStore((s) => s.deleteEnv)
  const duplicateEnv = useStore((s) => s.duplicateEnv)
  const def = ENV_DEFS[it.type]
  const o = it.o
  const setO = (k: string, v: string | number | boolean): void => updateEnv(it.id, { o: { [k]: v } })
  const setPos = (i: 0 | 1 | 2, v: number): void => {
    const pos = [...it.pos] as V3
    pos[i] = v
    updateEnv(it.id, { pos })
  }

  return (
    <div className="inspector">
      <div className="insp-title">{def.ru}</div>
      <div className="insp-sub">
        {formatLength(it.L)} × {formatLength(it.W)} × {formatLength(it.H)}
      </div>

      {(Object.entries(def.fields) as ['L' | 'W' | 'H', string][]).map(([k, label]) => (
        <div key={k} className="field">
          <label>{label}</label>
          <LengthInput value={it[k]} min={0.5} onCommit={(v) => updateEnv(it.id, { [k]: v })} />
        </div>
      ))}

      {it.type === 'studWall' && (
        <>
          <Opt label="Стойки" value={String(o.lumber)} options={lumberOpts(['2x4', '2x6'])} onChange={(v) => setO('lumber', v)} />
          <Opt label="Шаг стоек" value={String(o.oc)} options={ocOpts} onChange={(v) => setO('oc', Number(v))} />
          <Opt
            label="Гипсокартон"
            value={String(o.drywall)}
            options={[
              ['none', 'Нет'],
              ['one', 'С одной стороны'],
              ['both', 'С двух сторон']
            ]}
            onChange={(v) => setO('drywall', v)}
          />
        </>
      )}
      {it.type === 'joists' && (
        <>
          <Opt label="Джойсты" value={String(o.lumber)} options={lumberOpts(['2x6', '2x8', '2x10', '2x12'])} onChange={(v) => setO('lumber', v)} />
          <Opt label="Шаг джойстов" value={String(o.oc)} options={ocOpts} onChange={(v) => setO('oc', Number(v))} />
          <Opt
            label="Черновой пол (subfloor)"
            value={String(o.sub)}
            options={[
              ['none', 'Нет'],
              ['osb-23/32', 'OSB 23/32"'],
              ['ply-3/4', 'Плайвуд 3/4"']
            ]}
            onChange={(v) => setO('sub', v)}
          />
          <label className="check">
            <input type="checkbox" checked={o.rim !== false} onChange={(e) => setO('rim', e.target.checked)} /> Обвязочные (rim) джойсты
          </label>
        </>
      )}
      {it.type === 'lumber' && (
        <>
          <Opt label="Сечение" value={String(o.lumber)} options={lumberOpts(Object.keys(LUMBER))} onChange={(v) => setO('lumber', v)} />
          <Opt
            label="Положение"
            value={String(o.orient)}
            options={[
              ['edge', 'Горизонтально, на ребро'],
              ['flat', 'Горизонтально, плашмя'],
              ['post', 'Вертикально (стойка)']
            ]}
            onChange={(v) => setO('orient', v)}
          />
        </>
      )}
      {it.type === 'sheet' && (
        <>
          <Opt label="Материал" value={String(o.sheet)} options={Object.entries(SHEETS).map(([k, v]) => [k, v.ru])} onChange={(v) => setO('sheet', v)} />
          <Opt
            label="Положение"
            value={String(o.orient)}
            options={[
              ['floor', 'Горизонтально (пол/потолок)'],
              ['wall', 'Вертикально (стена)']
            ]}
            onChange={(v) => setO('orient', v)}
          />
        </>
      )}
      {it.type === 'ground' && (
        <>
          <Opt label="Поверхность" value={String(o.surface)} options={Object.entries(SURFACES)} onChange={(v) => setO('surface', v)} />
          <label className="check">
            <input type="checkbox" checked={!!o.trench} onChange={(e) => setO('trench', e.target.checked)} /> Траншея (вдоль длины)
          </label>
          {!!o.trench && (
            <>
              <label>Отступ траншеи от края</label>
              <LengthInput value={Number(o.tOff ?? 48)} min={0} onCommit={(v) => setO('tOff', v)} />
              <label>Ширина траншеи</label>
              <LengthInput value={Number(o.tW ?? 18)} min={1} onCommit={(v) => setO('tW', v)} />
              <label>Глубина траншеи</label>
              <LengthInput value={Number(o.tD ?? 24)} min={1} onCommit={(v) => setO('tD', v)} />
            </>
          )}
        </>
      )}

      <label>Положение (угол объекта): X / Y (высота) / Z</label>
      <div className="xyz">
        {([0, 1, 2] as const).map((i) => (
          <LengthInput key={i} value={it.pos[i]} min={-12000} onCommit={(v) => setPos(i, v)} />
        ))}
      </div>
      <label>Поворот: {it.rotY}°</label>
      <div className="row">
        {[-90, -45, 45, 90].map((d) => (
          <button key={d} onClick={() => updateEnv(it.id, { rotY: (((it.rotY + d) % 360) + 360) % 360 })}>
            {d < 0 ? '⟲' : '⟳'} {Math.abs(d)}°
          </button>
        ))}
      </div>
      <div className="row" style={{ marginTop: 8 }}>
        <button onClick={() => duplicateEnv(it.id)}>Дублировать</button>
        <button className="danger" onClick={() => deleteEnv(it.id)}>
          Удалить
        </button>
      </div>
    </div>
  )
}

// Положение всей системы труб — для любой выбранной детали
export function SystemPosition({ part, parts }: { part: Part; parts: Part[] }) {
  const updatePart = useStore((s) => s.updatePart)
  const byId = new Map(parts.map((p) => [p.id, p]))
  let root = part
  while (root.parent && byId.get(root.parent.id)) root = byId.get(root.parent.id)!
  const pos = root.pos ?? [0, 0, 0]
  return (
    <>
      <label>Положение системы труб: X / Y (высота) / Z</label>
      <div className="xyz">
        {([0, 1, 2] as const).map((i) => (
          <LengthInput
            key={i}
            value={pos[i]}
            min={-12000}
            onCommit={(v) => {
              const np = [...pos] as V3
              np[i] = v
              updatePart(root.id, { pos: np })
            }}
          />
        ))}
      </div>
      {root.id === part.id ? (
        <div className="muted small">Можно тянуть стрелками в 3D.</div>
      ) : (
        <div className="muted small">Это первая деталь системы. Выбери её, чтобы тянуть стрелками.</div>
      )}
    </>
  )
}

export function EnvBomSection({ pens }: { pens: Penetration[] }) {
  const env = useStore((s) => s.env)
  const lines = useMemo(() => envBom(env), [env])
  if (!env.length) return null
  const bad = pens.filter((p) => !p.ok)
  return (
    <>
      <div className="section-title">Стройматериалы</div>
      <table>
        <tbody>
          {lines.map((l) => (
            <tr key={l.name}>
              <td>
                {l.ru}
                <div className="muted small">{l.name}</div>
              </td>
              <td className="qty">
                {l.unit === 'куб. ярд' ? l.qty.toFixed(2) : l.qty} {l.unit}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {pens.length > 0 && (
        <>
          <div className="section-title">Проходы труб ({pens.length})</div>
          {bad.length > 0 && <div className="hint warn-box">Слишком большие отверстия: {bad.length}. Нужна стена 2×6, усиление или другой путь трубы.</div>}
          <table>
            <tbody>
              {pens.map((p, i) => (
                <tr key={i}>
                  <td className={p.ok ? '' : 'bad'}>
                    {p.where}
                    <div className="muted small">{p.note}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </>
  )
}

// Быстрое меню по правому клику на свободном конце: частые детали для этого конца, недавние, действия
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { FITTINGS, SizeId, fittingDef, portsOf, sizeLabel, sizeSpec } from './catalog'
import { KindIcon } from './Panels'
import { systemFam, useStore } from './store'

// Частые детали по типу конца, в порядке «как ведут трубу»
const QUICK: Record<'pressure' | 'dwv' | 'copper' | 'nohub' | 'gas', string[]> = {
  gas: ['bi90', 'bi45', 'biTee', 'biCoupling', 'biUnion', 'biGasValve', 'biCap', 'biPlug', 'biStreet90', 'biReducer', 'biBushing'],
  pressure: ['elbow90', 'elbow45', 'tee', 'coupling', 'reducer', 'cap', 'pma', 'pfa', 'punion', 'valve'],
  dwv: ['dwv90', 'dwvLong90', 'dwv45', 'sanTee', 'wye', 'combo', 'dcoup', 'dincr', 'dcotee', 'dcap', 'ptrap'],
  copper: ['cu90', 'cu45', 'cuTee', 'cuCoupling', 'cuReducer', 'cuCap', 'cuMa', 'cuFa', 'cuUnion', 'cuValve'],
  nohub: ['nhStd', 'nhHD', 'nhTrans']
}

// Каким материалом и семейством продолжать этот конец
export function endFamily(size: SizeId, fam: 'p' | 'd', preferCu?: boolean): { group: keyof typeof QUICK; size: SizeId } {
  const mat = sizeSpec(size).mat
  if (mat === 'cu') return { group: 'copper', size }
  if (preferCu) return { group: 'copper', size: ('cu' + size) as SizeId }
  if (mat === 'bi') return { group: 'gas', size }
  if (mat === 'ci' || mat === 'gs') return { group: 'nohub', size }
  return { group: fam === 'd' ? 'dwv' : 'pressure', size }
}

export function QuickMenu() {
  const menu = useStore((s) => s.quickMenu)
  const parts = useStore((s) => s.parts)
  const recent = useStore((s) => s.recent)
  const ref = useRef<HTMLDivElement>(null)
  const [famPick, setFamPick] = useState<'p' | 'd' | null>(null)
  useEffect(() => setFamPick(null), [menu])
  // поднять меню, если не помещается снизу
  useLayoutEffect(() => {
    const el = ref.current
    if (!el || !menu) return
    const h = el.offsetHeight
    el.style.top = Math.max(8, Math.min(menu.y, window.innerHeight - h - 8)) + 'px'
  })

  useEffect(() => {
    if (!menu) return
    const close = (e: Event): void => {
      if (e instanceof KeyboardEvent && e.key !== 'Escape') return
      if (e instanceof MouseEvent && ref.current?.contains(e.target as Node)) return
      useStore.getState().closeQuickMenu()
    }
    window.addEventListener('pointerdown', close, true)
    window.addEventListener('keydown', close, true)
    window.addEventListener('wheel', close, true)
    return () => {
      window.removeEventListener('pointerdown', close, true)
      window.removeEventListener('keydown', close, true)
      window.removeEventListener('wheel', close, true)
    }
  }, [menu])

  if (!menu) return null
  const part = parts.find((p) => p.id === menu.port.id)
  const pdef = part ? portsOf(part)[menu.port.port] : undefined
  if (!part || !pdef) return null
  // семейство: у самой детали/соседей; если не понять — DWV для 1-1/2" и больше, где он есть
  const near = systemFam(parts, part.id)
  const guess: 'p' | 'd' = near ?? (sizeSpec(pdef.size).dwv > 0 && sizeSpec(pdef.size).od >= 1.9 ? 'd' : 'p')
  const fam = famPick ?? guess
  const { group, size } = endFamily(pdef.size, fam, pdef.preferCu)
  const pvc = sizeSpec(pdef.size).mat === 'pvc' && !pdef.preferCu && sizeSpec(pdef.size).dwv > 0
  const fits = (k: string): boolean => !!FITTINGS[k] && (FITTINGS[k].sizes.includes(size) || FITTINGS[k].sizes.includes(pdef.size))
  const quick = QUICK[group].filter(fits)
  const rec = recent.filter((k) => fits(k) && !quick.includes(k)).slice(0, 4)

  const add = (kind: string): void => {
    const s = useStore.getState()
    s.closeQuickMenu()
    s.selectPort(menu.port)
    s.setPaletteSize(kind === 'pipe' ? size : FITTINGS[kind].sizes.includes(size) ? size : pdef.size)
    s.addPart(kind)
  }
  const item = (kind: string) => {
    const d = fittingDef(kind)
    return (
      <button key={kind} className="qm-item" onClick={() => add(kind)} title={d.en}>
        <KindIcon kind={kind} />
        <span>{kind === 'pipe' ? 'Pipe' : d.ru}</span>
        {d.key && <kbd>{d.key}</kbd>}
      </button>
    )
  }
  // не вылезать за край окна
  const W = 260
  const x = Math.min(menu.x, window.innerWidth - W - 8)

  return (
    <div ref={ref} className="quick-menu" style={{ left: x, top: menu.y, width: W }} onContextMenu={(e) => e.preventDefault()}>
      <div className="qm-head">
        <span>
          {sizeLabel(pdef.size)} {pdef.kind === 'hub' ? 'hub' : pdef.kind === 'spigot' ? 'spigot' : pdef.kind === 'fpt' ? 'FPT' : pdef.kind === 'mpt' ? 'MPT' : pdef.kind}
        </span>
        {pvc ? (
          <span className="qm-seg">
            <button className={fam === 'p' ? 'on' : ''} onClick={() => setFamPick('p')}>
              Pressure
            </button>
            <button className={fam === 'd' ? 'on' : ''} onClick={() => setFamPick('d')}>
              DWV
            </button>
          </span>
        ) : (
          <span>{group === 'copper' ? 'Copper' : group === 'nohub' ? 'No-hub' : group === 'gas' ? 'Black iron · gas' : 'Pressure'}</span>
        )}
      </div>
      <div className="qm-list">
        {item('pipe')}
        {quick.map(item)}
      </div>
      {rec.length > 0 && (
        <>
          <div className="qm-sub">Recent</div>
          <div className="qm-list">{rec.map(item)}</div>
        </>
      )}
      <div className="qm-actions">
        <button
          onClick={() => {
            const s = useStore.getState()
            s.closeQuickMenu()
            s.selectPort(menu.port)
            s.startJoin()
          }}
        >
          🔗 Join to another end <kbd>J</kbd>
        </button>
        <button
          onClick={() => {
            const s = useStore.getState()
            s.closeQuickMenu()
            s.select(part.id)
          }}
        >
          Select this part
        </button>
      </div>
    </div>
  )
}

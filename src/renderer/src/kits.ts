// Готовые узлы: базовая деталь ставится кликом, остальное собирается автоматически (одним шагом отмены)
import { Part, SizeId, V3 } from './catalog'
import { buildModel } from './geometry'
import { PortRef, Snapshot, useStore } from './store'

export interface KitDef {
  id: string
  title: string
  sub: string
  base: string // что ставим кликом
  build: (baseId: string) => void
}

const st = () => useStore.getState()

// Добавить деталь к концу; возвращает id новой детали (переходники добавятся сами)
function addAt(from: PortRef, kind: string, size: SizeId, length?: number): string {
  useStore.setState({ activePort: from, selectedId: from.id, paletteSize: size, ...(length ? { lastPipe: length } : {}) })
  const before = st().parts.length
  st().addPart(kind)
  const parts = st().parts
  if (parts.length === before) throw new Error(st().message ?? `can't add ${kind}`)
  const id = parts[parts.length - 1].id
  if (length && kind === 'pipe') setPart(id, { length })
  return id
}

function setPart(id: string, patch: Partial<Part>): void {
  useStore.setState({ parts: st().parts.map((p) => (p.id === id ? { ...p, ...patch } : p)) })
}

// Свободный конец детали (первый или ближайший к направлению want)
function free(id: string, want?: V3): PortRef {
  const open = buildModel(st().parts).open.filter((w) => w.partId === id)
  if (!open.length) throw new Error('no open end on ' + id)
  if (!want) return { id, port: open[0].index }
  const best = open.reduce((a, b) => (b.dir.x * want[0] + b.dir.y * want[1] + b.dir.z * want[2] > a.dir.x * want[0] + a.dir.y * want[1] + a.dir.z * want[2] ? b : a))
  return { id, port: best.index }
}

// Повернуть деталь вокруг оси подключения так, чтобы свободный конец смотрел в сторону want
function orient(id: string, want: V3): void {
  let best = { roll: 0, d: -2 }
  for (let roll = 0; roll < 360; roll += 15) {
    setPart(id, { roll })
    const open = buildModel(st().parts).open.filter((w) => w.partId === id)
    for (const w of open) {
      const d = w.dir.x * want[0] + w.dir.y * want[1] + w.dir.z * want[2]
      if (d > best.d + 1e-6) best = { roll, d }
    }
  }
  setPart(id, { roll: best.roll })
}

// Конец детали с заданным индексом порта
const port = (id: string, i: number): PortRef => ({ id, port: i })

export const KITS: KitDef[] = [
  {
    id: 'sump',
    title: 'Sump pump kit',
    sub: '18×22 basin · Zoeller M53 · 1-1/2" check valve',
    base: 'pit_sump1822',
    build: (pit) => {
      const pump = addAt(port(pit, 0), 'pump_M53', '1-1/2')
      const riser = addAt(free(pump), 'pipe', '1-1/2', 30)
      const cv = addAt(free(riser, [0, 1, 0]), 'cv_sump_1-1/2', '1-1/2')
      addAt(free(cv), 'pipe', '1-1/2', 18)
    }
  },
  {
    id: 'ejector',
    title: 'Sewage ejector kit',
    sub: '18×30 sealed basin · Zoeller M267 · 2" check · vent · 4" inlet',
    base: 'pit_ej1830',
    build: (pit) => {
      const lid = st().parts.find((p) => p.parent?.id === pit && p.kind.startsWith('lid_'))
      const pump = addAt(port(pit, 0), 'pump_M267', '2')
      const riser = addAt(free(pump), 'pipe', '2', 34)
      const cv = addAt(free(riser, [0, 1, 0]), 'cv_ej_2', '2')
      addAt(free(cv), 'pipe', '2', 18)
      if (lid) addAt(free(lid.id, [0, 1, 0]), 'pipe', '2', 24)
      addAt(free(pit, [-1, 0, 0]), 'pipe', '4', 24)
    }
  },
  {
    id: 'heater',
    title: 'Water heater hookup',
    sub: '50 gal gas · dielectric unions · expansion tank · T&P drain',
    base: 'wh_RG250T6N',
    build: (wh) => {
      // порты бойлера: 1 — горячая (−X), 2 — холодная (+X), 3 — выход T&P вниз
      const hotD = addAt(port(wh, 1), 'cuDiel', 'cu3/4')
      addAt(free(hotD), 'pipe', 'cu3/4', 18)
      const coldD = addAt(port(wh, 2), 'cuDiel', 'cu3/4')
      const p1 = addAt(free(coldD), 'pipe', 'cu3/4', 6)
      const tee = addAt(free(p1), 'cuTee', 'cu3/4')
      // ветка тройника — вбок (наружу от бойлера), бак висит вниз через отвод
      orient(tee, [1, 0, 0])
      addAt(free(tee, [0, 1, 0]), 'pipe', 'cu3/4', 12)
      const br = addAt(free(tee, [1, 0, 0]), 'pipe', 'cu3/4', 12)
      const el = addAt(free(br), 'cu90', 'cu3/4')
      orient(el, [0, -1, 0])
      const drop = addAt(free(el), 'pipe', 'cu3/4', 2)
      addAt(free(drop), 'xt_PLT-5', 'cu3/4')
      // слив T&P: медь вниз, конец в 6" от пола
      const tp = st().parts.find((p) => p.id === wh)!
      const tpY = buildModel(st().parts).open.find((w) => w.partId === tp.id && w.index === 3)?.pos.y ?? 49
      addAt(port(wh, 3), 'pipe', 'cu3/4', Math.max(6, Math.round(tpY - 6 - 1.5)))
    }
  },
  {
    id: 'toilet',
    title: 'Toilet rough-in',
    sub: '4×3 closet flange · closet bend · 3" drain',
    base: 'closet',
    build: (fl) => {
      const bend = addAt(free(fl), 'closetBend', '4')
      addAt(free(bend), 'pipe', '3', 36)
    }
  },
  {
    id: 'shower',
    title: 'Shower valve rough-in',
    sub: '1/2" copper valve at 48" · riser to head · H/C supplies',
    base: 'showerCC',
    build: (v) => {
      addAt(free(v, [0, 1, 0]), 'pipe', 'cu1/2', 30)
      addAt(free(v, [0, -1, 0]), 'cuCap', 'cu1/2')
      for (const side of [-1, 1]) {
        const p = addAt(free(v, [side, 0, 0]), 'pipe', 'cu1/2', 4)
        const el = addAt(free(p), 'cu90', 'cu1/2')
        orient(el, [0, -1, 0])
        addAt(free(el), 'pipe', 'cu1/2', 36)
      }
    }
  }
]

// Собрать узел на уже поставленной базовой детали; при ошибке — откат к состоянию до узла
export function runKit(id: string, baseId: string, before: { parts: Part[]; past: Snapshot[] }): void {
  const kit = KITS.find((k) => k.id === id)
  if (!kit) return
  const recent = st().recent
  const env = st().env
  try {
    kit.build(baseId)
    // весь узел — один шаг отмены
    useStore.setState({ past: [...before.past, { parts: before.parts, env }].slice(-200), future: [], lengthEdit: null, recent, activePort: null, selectedId: baseId, message: `${kit.title} added — Ctrl+Z removes it in one step` })
  } catch (e) {
    useStore.setState({ parts: before.parts, recent, lengthEdit: null, message: `Couldn't build "${kit.title}": ${(e as Error).message}` })
  }
}

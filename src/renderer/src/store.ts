import { create } from 'zustand'
import { DEFAULT_PIPE, FITTINGS, Part, PartKind, PortDef, SizeId, V3, defaultSize2, fittingDef, mates, portsOf, sizeIndex } from './catalog'
import { buildModel, portKey } from './geometry'
import { formatLength } from './units'

// Короткий отрезок между двумя раструбами: обе глубины + 1/2" видимой трубы, с округлением до 1/4"
const nippleLength = (d1: number, d2: number): number => Math.ceil((d1 + d2 + 0.5) * 4) / 4

const matchPort = (p: Part, to: PortDef): number => portsOf(p).findIndex((pt) => mates(to.kind, pt.kind) && pt.size === to.size)

// Какими размерами деталь может встать на конец размера portSize
function sizeCandidates(kind: string, portSize: SizeId, wanted: SizeId): { size: SizeId; size2?: SizeId }[] {
  const def = fittingDef(kind)
  const out: { size: SizeId; size2?: SizeId }[] = []
  if (def.sizes.includes(portSize)) out.push({ size: portSize, size2: defaultSize2(kind, portSize, wanted) })
  if (def.size2) {
    const mains = def.sizes.filter((s) => s !== portSize && def.size2!.options(s).includes(portSize))
    mains.sort((a, b) => (a === wanted ? -1 : b === wanted ? 1 : 0))
    for (const s of mains) out.push({ size: s, size2: portSize })
  }
  return out
}

// Семейство (напорное/DWV) ближайшего фитинга по цепочке — чтобы между трубами DWV ставить муфту DWV
function famNear(parts: Part[], id: string, kind: string): 'p' | 'd' {
  if (fittingDef(kind).group !== 'common') return fittingDef(kind).group === 'dwv' ? 'd' : 'p'
  const byId = new Map(parts.map((p) => [p.id, p]))
  for (let p = byId.get(id); p; p = p.parent ? byId.get(p.parent.id) : undefined) {
    const g = fittingDef(p.kind).group
    if (g !== 'common') return g === 'dwv' ? 'd' : 'p'
  }
  return 'p'
}

// Переходная деталь, когда концы не стыкуются: раструб-раструб, труба-труба, резьба
function adapterFor(to: PortDef, nextDepth: number, target: { id: string; port: number }, famHint: 'p' | 'd'): { part: Part; free: number; note: string } | null {
  const base = { id: newId(), size: to.size, roll: 0, parent: target }
  const pick = (a: string, b: string): string => (fittingDef(a).sizes.includes(to.size) ? a : b)
  let part: Part
  let note: string
  if (to.kind === 'hub') {
    part = { ...base, kind: 'pipe', attach: 0, length: nippleLength(to.depth, nextDepth) }
    note = `раструб в раструб не клеится — добавил ниппель ${formatLength(part.length!)}`
  } else if (to.kind === 'spigot') {
    part = { ...base, kind: famHint === 'd' ? pick('dcoup', 'coupling') : pick('coupling', 'dcoup'), attach: 0 }
    note = 'труба к трубе — добавил муфту'
  } else if (to.kind === 'fpt') {
    part = { ...base, kind: pick('pma', 'dma'), attach: 0 }
    note = 'в резьбу FPT — добавил адаптер MPT'
  } else if (to.kind === 'mpt') {
    part = { ...base, kind: pick('pfa', 'dfa'), attach: 0 }
    note = 'на резьбу MPT — добавил адаптер FPT'
  } else return null
  if (!fittingDef(part.kind).sizes.includes(to.size)) return null
  part.attach = Math.max(0, matchPort(part, to))
  const free = portsOf(part).findIndex((_, i) => i !== part.attach)
  return { part, free, note }
}

export interface PortRef {
  id: string
  port: number
}

export interface ProjectFile {
  app: 'pipecad'
  version: 1
  parts: Part[]
  stick?: number
}

interface State {
  parts: Part[]
  past: Part[][]
  future: Part[][]
  selectedId: string | null
  activePort: PortRef | null
  paletteSize: SizeId
  reducerTo: SizeId
  lastPipe: number
  stick: number // длина палки трубы в продаже: 120" или 240"
  showDims: boolean
  showPorts: boolean
  filePath: string | null
  dirty: boolean
  message: string | null
  view: { tick: number; dir: V3 | null } // dir null — "показать всё" с текущего ракурса

  commit: (parts: Part[]) => void
  addPart: (kind: PartKind) => void
  updatePart: (id: string, patch: Partial<Part>) => void
  deletePart: (id: string) => void
  rollPart: (id: string, deg: number) => void
  rotateRoot: (id: string, axis: 0 | 1 | 2, deg: number) => void
  cycleAttach: (id: string) => void
  select: (id: string | null) => void
  selectPort: (ref: PortRef | null) => void
  undo: () => void
  redo: () => void
  setPaletteSize: (s: SizeId) => void
  setReducerTo: (s: SizeId) => void
  setStick: (n: number) => void
  toggleDims: () => void
  togglePorts: () => void
  setView: (dir: V3 | null) => void
  setMessage: (m: string | null) => void
  newProject: () => void
  loadProject: (f: ProjectFile, path: string | null) => void
  markSaved: (path: string) => void
}

function newId(): string {
  return Math.random().toString(36).slice(2, 10)
}

function isOpen(parts: Part[], ref: PortRef): boolean {
  return buildModel(parts).open.some((w) => w.partId === ref.id && w.index === ref.port)
}

function firstOpen(parts: Part[], id: string, except?: number): PortRef | null {
  const w = buildModel(parts).open.find((o) => o.partId === id && o.index !== except)
  return w ? { id, port: w.index } : null
}

function subtree(parts: Part[], id: string): Set<string> {
  const ids = new Set([id])
  let grew = true
  while (grew) {
    grew = false
    for (const p of parts) {
      if (p.parent && ids.has(p.parent.id) && !ids.has(p.id)) {
        ids.add(p.id)
        grew = true
      }
    }
  }
  return ids
}

export const subtreeSize = (parts: Part[], id: string): number => subtree(parts, id).size

export const useStore = create<State>((set, get) => ({
  parts: [],
  past: [],
  future: [],
  selectedId: null,
  activePort: null,
  paletteSize: '1-1/2',
  reducerTo: '1',
  lastPipe: DEFAULT_PIPE,
  stick: 120,
  showDims: true,
  showPorts: true,
  filePath: null,
  dirty: false,
  message: null,
  view: { tick: 0, dir: null },

  commit: (parts) => set((s) => ({ parts, past: [...s.past.slice(-199), s.parts], future: [], dirty: true })),

  addPart: (kind) => {
    const { parts, activePort, selectedId, paletteSize, reducerTo, lastPipe } = get()
    const def = fittingDef(kind)
    const id = newId()
    const part: Part = { id, kind, size: paletteSize, attach: 0, roll: 0 }
    if (kind === 'pipe') part.length = lastPipe

    const added: Part[] = []
    const notes: string[] = []
    if (!parts.length) {
      if (!def.sizes.includes(part.size)) {
        part.size = [...def.sizes].sort((a, b) => Math.abs(sizeIndex(a) - sizeIndex(paletteSize)) - Math.abs(sizeIndex(b) - sizeIndex(paletteSize)))[0]
        notes.push(`«${def.ru}» не бывает ${paletteSize}" — поставил ${part.size}"`)
      }
      part.size2 = defaultSize2(kind, part.size, reducerTo)
    } else {
      let target = activePort && isOpen(parts, activePort) ? activePort : null
      if (!target && selectedId) target = firstOpen(parts, selectedId)
      if (!target) {
        set({ message: 'Сначала выбери открытый конец — зелёную точку на модели' })
        return
      }
      let all = parts
      let pport = portsOf(parts.find((p) => p.id === target!.id)!)[target.port]
      for (let step = 0; ; step++) {
        if (pport.kind === 'slip') {
          set({ message: 'К этому концу подключается трубка сифона (tubular), а не PVC' })
          return
        }
        const cands = sizeCandidates(kind, pport.size, reducerTo)
        if (!cands.length) {
          set({ message: `Charlotte не выпускает «${def.ru}» под ${pport.size}"` })
          return
        }
        const hit = cands.map((c) => ({ ...part, ...c })).find((c) => matchPort(c, pport) >= 0)
        if (hit) {
          Object.assign(part, hit, { attach: matchPort(hit, pport), parent: target })
          break
        }
        const sample = { ...part, ...cands[0] }
        const adapter = adapterFor(pport, Math.max(...portsOf(sample).map((p) => p.depth)), target!, famNear(all, target!.id, kind))
        if (!adapter || step > 2) {
          set({ message: 'Эти концы нельзя соединить напрямую' })
          return
        }
        added.push(adapter.part)
        notes.push(adapter.note)
        all = [...all, adapter.part]
        target = { id: adapter.part.id, port: adapter.free }
        pport = portsOf(adapter.part)[adapter.free]
      }
    }

    const next = [...parts, ...added, part]
    get().commit(next)
    set({ selectedId: id, activePort: firstOpen(next, id, part.attach), message: notes.length ? notes.join('; ') : null })
  },

  updatePart: (id, patch) => {
    const { parts } = get()
    get().commit(parts.map((p) => (p.id === id ? { ...p, ...patch } : p)))
    if (patch.length !== undefined) set({ lastPipe: patch.length })
  },

  deletePart: (id) => {
    const { parts } = get()
    const victim = parts.find((p) => p.id === id)
    if (!victim) return
    const ids = subtree(parts, id)
    get().commit(parts.filter((p) => !ids.has(p.id)))
    set({ selectedId: victim.parent?.id ?? null, activePort: victim.parent ?? null })
  },

  rollPart: (id, deg) => {
    const p = get().parts.find((x) => x.id === id)
    if (!p) return
    if (!p.parent) return get().rotateRoot(id, 1, deg)
    get().updatePart(id, { roll: (((p.roll + deg) % 360) + 360) % 360 })
  },

  rotateRoot: (id, axis, deg) => {
    const p = get().parts.find((x) => x.id === id)
    if (!p) return
    const rot: V3 = [...(p.rot ?? [0, 0, 0])] as V3
    rot[axis] = (rot[axis] + deg) % 360
    get().updatePart(id, { rot })
  },

  // Подключить деталь другим портом (например, тройник — боковым отводом)
  cycleAttach: (id) => {
    const { parts } = get()
    const p = parts.find((x) => x.id === id)
    if (!p || !p.parent) return
    const n = portsOf(p).length
    const old = p.attach
    const next = (old + 1) % n
    const out = parts.map((x) => {
      if (x.id === id) {
        const upd: Part = { ...x, attach: next }
        if (fittingDef(x.kind).size2?.reversible && x.size2) {
          upd.size = x.size2 ?? x.size
          upd.size2 = x.size
        }
        return upd
      }
      if (x.parent?.id === id && x.parent.port === next) return { ...x, parent: { id, port: old } }
      return x
    })
    get().commit(out)
    set({ activePort: firstOpen(out, id) })
  },

  select: (id) => set({ selectedId: id, activePort: id ? get().activePort : null }),
  selectPort: (ref) => set({ activePort: ref, selectedId: ref ? ref.id : get().selectedId, message: null }),

  undo: () => {
    const { past, parts, future } = get()
    if (!past.length) return
    const prev = past[past.length - 1]
    set({ parts: prev, past: past.slice(0, -1), future: [parts, ...future], dirty: true })
    fixSelection()
  },

  redo: () => {
    const { past, parts, future } = get()
    if (!future.length) return
    set({ parts: future[0], past: [...past, parts], future: future.slice(1), dirty: true })
    fixSelection()
  },

  setPaletteSize: (paletteSize) => set({ paletteSize }),
  setReducerTo: (reducerTo) => set({ reducerTo }),
  setStick: (stick) => set({ stick }),
  toggleDims: () => set((s) => ({ showDims: !s.showDims })),
  togglePorts: () => set((s) => ({ showPorts: !s.showPorts })),
  setView: (dir) => set((s) => ({ view: { tick: s.view.tick + 1, dir } })),
  setMessage: (message) => set({ message }),

  newProject: () =>
    set({ parts: [], past: [], future: [], selectedId: null, activePort: null, filePath: null, dirty: false, message: null }),

  loadProject: (f, path) => {
    set({
      parts: f.parts,
      past: [],
      future: [],
      selectedId: null,
      activePort: null,
      filePath: path,
      dirty: false,
      stick: f.stick ?? get().stick,
      message: null
    })
    get().setView(null)
  },

  markSaved: (path) => set({ filePath: path, dirty: false })
}))

function fixSelection(): void {
  const { parts, selectedId, activePort } = useStore.getState()
  const ids = new Set(parts.map((p) => p.id))
  const sel = selectedId && ids.has(selectedId) ? selectedId : null
  let ap = activePort && ids.has(activePort.id) ? activePort : null
  if (ap && !buildModel(parts).open.some((w) => portKey(w.partId, w.index) === portKey(ap!.id, ap!.port))) ap = null
  useStore.setState({ selectedId: sel, activePort: ap })
}

export function serialize(): string {
  const { parts, stick } = useStore.getState()
  const f: ProjectFile = { app: 'pipecad', version: 1, parts, stick }
  return JSON.stringify(f, null, 1)
}

// Для автотестов через DevTools
;(window as unknown as { pipecad: typeof useStore; pipecadFittings: typeof FITTINGS }).pipecad = useStore
;(window as unknown as { pipecadFittings: typeof FITTINGS }).pipecadFittings = FITTINGS

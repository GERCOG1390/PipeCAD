import { create } from 'zustand'
import { DEFAULT_PIPE, Part, PartKind, SIZES, SizeId, V3, portsOf } from './catalog'
import { buildModel, portKey } from './geometry'

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
  setView: (dir: V3 | null) => void
  setMessage: (m: string | null) => void
  newProject: () => void
  loadProject: (f: ProjectFile, path: string | null) => void
  markSaved: (path: string) => void
}

const newId = (): string => Math.random().toString(36).slice(2, 10)

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
  filePath: null,
  dirty: false,
  message: null,
  view: { tick: 0, dir: null },

  commit: (parts) => set((s) => ({ parts, past: [...s.past.slice(-199), s.parts], future: [], dirty: true })),

  addPart: (kind) => {
    const { parts, activePort, selectedId, paletteSize, reducerTo, lastPipe } = get()
    const id = newId()
    const part: Part = { id, kind, size: paletteSize, attach: 0, roll: 0 }
    if (kind === 'pipe') part.length = lastPipe

    if (parts.length) {
      let target = activePort && isOpen(parts, activePort) ? activePort : null
      if (!target && selectedId) target = firstOpen(parts, selectedId)
      if (!target) {
        set({ message: 'Сначала выбери открытый конец — зелёную точку на модели' })
        return
      }
      const parent = parts.find((p) => p.id === target!.id)!
      part.size = portsOf(parent)[target.port].size
      part.parent = target
    }
    if (kind === 'reducer') {
      part.size2 = reducerTo !== part.size ? reducerTo : SIZES.find((s) => s.id !== part.size)!.id
    }

    const next = [...parts, part]
    get().commit(next)
    set({ selectedId: id, activePort: firstOpen(next, id, part.attach), message: null })
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
        if (x.kind === 'reducer') {
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

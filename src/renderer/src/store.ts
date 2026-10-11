import { create } from 'zustand'
import { DEFAULT_PIPE, FITTINGS, isCu, Part, PartKind, PortDef, SizeId, V3, defaultSize2, fittingDef, mates, portsOf, sizeIndex } from './catalog'
import { EnvItem, Preset, baseY, normalize } from './environment'
import { buildModel, computeTransforms, portKey } from './geometry'
import { Euler } from 'three'
import { Placing, placementFor } from './placement'
import { connectVia, joinPorts } from './join'
import { Frame, PackedTimeline, addedIn, packTimeline, unpackTimeline } from './timeline'
import { Vector3 } from 'three'
import { formatLength } from './units'

// Короткий отрезок между двумя раструбами: обе глубины + 1/2" видимой трубы, с округлением до 1/4"
const nippleLength = (d1: number, d2: number): number => Math.ceil((d1 + d2 + 0.5) * 4) / 4

const matchPort = (p: Part, to: PortDef): number => portsOf(p).findIndex((pt) => mates(to.kind, pt.kind) && pt.size === to.size)

// Какими размерами деталь может встать на конец размера portSize
function sizeCandidates(kind: string, portSize: SizeId, wanted: SizeId): { size: SizeId; size2?: SizeId }[] {
  const def = fittingDef(kind)
  const out: { size: SizeId; size2?: SizeId }[] = []
  if (def.sizes.includes(portSize)) out.push({ size: portSize, size2: defaultSize2(kind, portSize, wanted) })
  // резьба: медный адаптер того же номинала (NPT совместима)
  const cuAlt = ('cu' + portSize) as SizeId
  if (!isCu(portSize) && def.sizes.includes(cuAlt)) out.push({ size: cuAlt, size2: defaultSize2(kind, cuAlt, wanted) })
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
function adapterFor(to: PortDef, nextDepth: number, target: { id: string; port: number }, famHint: 'p' | 'd', wantCu = false): { part: Part; free: number; note: string } | null {
  const cu = isCu(to.size) || (wantCu && (to.kind === 'fpt' || to.kind === 'mpt'))
  const base = { id: newId(), size: (cu && !isCu(to.size) ? 'cu' + to.size : to.size) as SizeId, roll: 0, parent: target }
  const pick = (a: string, b: string): string => (fittingDef(a).sizes.includes(to.size) ? a : b)
  let part: Part
  let note: string
  if (to.kind === 'hub') {
    part = { ...base, kind: 'pipe', attach: 0, length: nippleLength(to.depth, nextDepth) }
    note = `hub-to-hub can't be glued — added a ${formatLength(part.length!)} nipple`
  } else if (to.kind === 'spigot' && to.size.startsWith('ci')) {
    part = { ...base, kind: 'nhStd', size2: to.size, attach: 0 }
    note = 'cast iron to cast iron — added a no-hub coupling'
  } else if (to.kind === 'spigot' && to.size.startsWith('gs')) {
    part = { ...base, kind: 'nhTrans', size2: to.size, attach: 0 }
    note = 'galvanized to galvanized — added a no-hub transition coupling'
  } else if (to.kind === 'spigot' && cu) {
    part = { ...base, kind: 'cuCoupling', attach: 0 }
    note = 'pipe to pipe — added a copper coupling'
  } else if (to.kind === 'fpt' && cu) {
    part = { ...base, kind: 'cuMa', attach: 0 }
    note = 'into FPT — added a copper MPT adapter (604)'
  } else if (to.kind === 'mpt' && cu) {
    part = { ...base, kind: 'cuFa', attach: 0 }
    note = 'onto MPT — added a copper FPT adapter (603)'
  } else if (to.kind === 'spigot') {
    part = { ...base, kind: famHint === 'd' ? pick('dcoup', 'coupling') : pick('coupling', 'dcoup'), attach: 0 }
    note = 'pipe to pipe — added a coupling'
  } else if (to.kind === 'fpt') {
    part = { ...base, kind: pick('pma', 'dma'), attach: 0 }
    note = 'into FPT — added an MPT adapter'
  } else if (to.kind === 'mpt') {
    part = { ...base, kind: pick('pfa', 'dfa'), attach: 0 }
    note = 'onto MPT — added an FPT adapter'
  } else return null
  if (!fittingDef(part.kind).sizes.includes(part.size)) return null
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
  env?: EnvItem[]
  timeline?: PackedTimeline
  stick?: number
}

interface Snapshot {
  parts: Part[]
  env: EnvItem[]
}

export type EnvMode = 'solid' | 'ghost' | 'hidden'

interface State {
  parts: Part[]
  env: EnvItem[]
  past: Snapshot[]
  future: Snapshot[]
  selectedEnv: string | null
  envMode: EnvMode
  snap: number // шаг перемещения, дюймы
  dragStart: Snapshot | null
  moveSystem: boolean // показать стрелки перемещения всей системы труб
  placing: Placing | null // режим установки новой ветки
  placeTurn: number // поворот устанавливаемой детали вокруг вертикали
  placedAt: number // время последней установки: тот же клик не должен ничего выбирать
  joining: boolean // ждём клик по второму концу для «Соединить»
  showAxes: boolean // оси свободных концов и их пересечения
  timeline: Frame[] // история постройки для повтора
  replay: { i: number; playing: boolean; speed: number; auto: boolean; record: boolean; saved: Snapshot; frames: Frame[] } | null
  recording: number // время начала записи видео (0 — не пишем)
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
  commitEnv: (env: EnvItem[]) => void
  addEnv: (p: Preset, at?: V3) => void
  updateEnv: (id: string, patch: Partial<EnvItem>) => void
  deleteEnv: (id: string) => void
  duplicateEnv: (id: string) => void
  selectEnv: (id: string | null) => void
  setEnvMode: (m: EnvMode) => void
  setSnap: (n: number) => void
  setMoveSystem: (v: boolean) => void
  startPlacing: (p: Placing) => void
  cancelPlacing: () => void
  turnPlacing: (deg: number) => void
  placeAt: (at: V3) => void
  newBranch: () => void
  startJoin: () => void
  joinTo: (b: PortRef) => void
  toggleAxes: () => void
  startReplay: (record?: boolean) => void
  stopReplay: () => void
  setReplayIndex: (i: number) => void
  setReplay: (patch: Partial<{ playing: boolean; speed: number; auto: boolean }>) => void
  setRecording: (t: number) => void
  connectAt: (a: PortRef, b: PortRef, x: V3, fitKind: string, takeoff: number) => void
  beginDrag: () => void
  dragTo: (patch: { env?: EnvItem[]; parts?: Part[] }) => void
  endDrag: () => void
  addPart: (kind: PartKind, size2?: SizeId) => void
  updatePart: (id: string, patch: Partial<Part>) => void
  deletePart: (id: string) => void // только эта деталь; присоединённое остаётся на месте
  deleteBranch: (id: string) => void // деталь вместе со всем продолжением
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

// Настройки вида, которые помним между запусками
function readPref(key: string, def: boolean): boolean {
  try {
    const v = localStorage.getItem(key)
    return v === null ? def : v === '1'
  } catch {
    return def
  }
}
function writePref(key: string, v: boolean): void {
  try {
    localStorage.setItem(key, v ? '1' : '0')
  } catch {
    /* ignore */
  }
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
  env: [],
  past: [],
  future: [],
  selectedEnv: null,
  envMode: 'solid',
  snap: 1,
  dragStart: null,
  moveSystem: false,
  placing: null,
  placeTurn: 0,
  placedAt: 0,
  joining: false,
  showAxes: false,
  timeline: [],
  replay: null,
  recording: 0,
  selectedId: null,
  activePort: null,
  paletteSize: '1-1/2',
  reducerTo: '1',
  lastPipe: DEFAULT_PIPE,
  stick: 120,
  showDims: readPref('pipecad.showDims', true),
  showPorts: true,
  filePath: null,
  dirty: false,
  message: null,
  view: { tick: 0, dir: null },

  commit: (parts) => set((s) => (s.replay ? {} : { parts, past: [...s.past.slice(-199), { parts: s.parts, env: s.env }], future: [], dirty: true, timeline: [...s.timeline.slice(-1999), { parts, env: s.env }] })),
  commitEnv: (env) => set((s) => (s.replay ? {} : { env, past: [...s.past.slice(-199), { parts: s.parts, env: s.env }], future: [], dirty: true, timeline: [...s.timeline.slice(-1999), { parts: s.parts, env }] })),

  addEnv: (p, at) => {
    const c = at ?? [0, 0, 0]
    const id = newId()
    const it = normalize({ id, type: p.type, L: p.L, W: p.W, H: p.H, o: { ...p.o }, rotY: 0, pos: [0, 0, 0] })
    const snap = (v: number): number => Math.round(v)
    it.pos = [snap(c[0] - it.L / 2), baseY(p), snap(c[2] - it.W / 2)]
    get().commitEnv([...get().env, it])
    set({ selectedEnv: id, selectedId: null, activePort: null, message: null })
  },
  updateEnv: (id, patch) => get().commitEnv(get().env.map((e) => (e.id === id ? normalize({ ...e, ...patch, o: { ...e.o, ...(patch.o ?? {}) } }) : e))),
  deleteEnv: (id) => {
    get().commitEnv(get().env.filter((e) => e.id !== id))
    set({ selectedEnv: null })
  },
  duplicateEnv: (id) => {
    const e = get().env.find((x) => x.id === id)
    if (!e) return
    const copy: EnvItem = { ...e, id: newId(), o: { ...e.o }, pos: [e.pos[0] + 12, e.pos[1], e.pos[2] + 12] }
    get().commitEnv([...get().env, copy])
    set({ selectedEnv: copy.id })
  },
  selectEnv: (id) => set({ selectedEnv: id, selectedId: id ? null : get().selectedId, activePort: id ? null : get().activePort }),
  setEnvMode: (envMode) => set({ envMode }),
  setSnap: (snap) => set({ snap }),
  setMoveSystem: (moveSystem) => set({ moveSystem }),
  startPlacing: (placing) =>
    set({ placing, selectedId: null, activePort: null, selectedEnv: null, message: 'Click the floor or a surface to place the part. R to rotate, Esc to cancel' }),
  cancelPlacing: () => set({ placing: null, message: null }),
  turnPlacing: (deg) => set((s) => ({ placeTurn: (((s.placeTurn + deg) % 360) + 360) % 360 })),
  placeAt: (at) => {
    const { placing, paletteSize, reducerTo, lastPipe, placeTurn, parts } = get()
    if (!placing) return
    const part = placementFor(placing, at, { id: newId(), size: paletteSize, reducerTo, lastPipe, turn: placeTurn })
    const next = [...parts, part]
    get().commit(next)
    set({ placing: null, placedAt: Date.now(), selectedId: part.id, activePort: firstOpen(next, part.id), message: null })
  },
  startJoin: () => {
    if (!get().activePort) {
      set({ message: 'First select an end (green ring), then "Join"' })
      return
    }
    set({ joining: true, placing: null, message: 'Click the second open end — fittings will be rotated so the ends meet. Esc to cancel' })
  },
  joinTo: (b) => {
    const { activePort: a, parts } = get()
    set({ joining: false })
    if (!a || (a.id === b.id && a.port === b.port)) return
    const res = joinPorts(parts, a, b, newId)
    if (res.parts !== parts) get().commit(res.parts)
    set({ message: res.message, selectedId: res.newId ?? get().selectedId, activePort: res.ok ? null : a })
  },
  toggleAxes: () => set((s) => ({ showAxes: !s.showAxes })),
  connectAt: (a, b, x, fitKind, takeoff) => {
    const { parts } = get()
    const res = connectVia(parts, a, b, new Vector3(...x), fitKind, takeoff, newId)
    if (res.parts !== parts) get().commit(res.parts)
    set({ message: res.message, selectedId: res.newId ?? get().selectedId, activePort: null })
  },
  startReplay: (record = false) => {
    const { timeline, parts, env } = get()
    if (!timeline.length) {
      set({ message: 'Nothing to replay — build history is empty' })
      return
    }
    const frames: Frame[] = [{ parts: [], env: [] }, ...timeline]
    // камера сначала охватывает весь готовый проект, потом начинаем с пустой сцены
    set({ replay: { i: frames.length - 1, playing: false, speed: 1, auto: true, record, saved: { parts, env }, frames }, selectedId: null, selectedEnv: null, activePort: null, placing: null, joining: false, message: null })
    get().setView(null)
    setTimeout(() => {
      if (!get().replay) return
      get().setReplayIndex(0)
      get().setReplay({ playing: true })
    }, 400)
  },
  stopReplay: () => {
    const r = get().replay
    if (!r) return
    set({ replay: null, parts: r.saved.parts, env: r.saved.env, selectedId: null, selectedEnv: null, activePort: null })
  },
  setReplayIndex: (i) => {
    const r = get().replay
    if (!r) return
    const k = Math.max(0, Math.min(r.frames.length - 1, i))
    const fr = r.frames[k]
    const hl = addedIn(r.frames[k - 1], fr)
    set({ replay: { ...r, i: k }, parts: fr.parts, env: fr.env, selectedId: hl.part ?? null, selectedEnv: hl.env ?? null })
  },
  setReplay: (patch) => set((s) => (s.replay ? { replay: { ...s.replay, ...patch } } : {})),
  setRecording: (recording) => set({ recording }),
  newBranch: () => set({ selectedId: null, activePort: null, selectedEnv: null, message: 'New branch: pick a part in the catalog and click where to place it' }),
  // Перетаскивание гизмо: живое обновление без истории, одна запись в историю по окончании
  beginDrag: () => set((s) => ({ dragStart: { parts: s.parts, env: s.env } })),
  dragTo: (patch) => set((s) => (s.replay ? {} : patch)),
  endDrag: () =>
    set((s) => (s.dragStart ? { past: [...s.past.slice(-199), s.dragStart], future: [], dragStart: null, dirty: true, timeline: [...s.timeline.slice(-1999), { parts: s.parts, env: s.env }] } : {})),

  addPart: (kind, size2) => {
    const { parts, activePort, selectedId, paletteSize, reducerTo, lastPipe } = get()
    const def = fittingDef(kind)
    const id = newId()
    const part: Part = { id, kind, size: paletteSize, attach: 0, roll: 0 }
    if (kind === 'pipe') part.length = lastPipe

    const added: Part[] = []
    const notes: string[] = []
    if (def.place?.always) {
      get().startPlacing({ kind, size2 })
      return
    }
    if (!parts.length && get().env.length) {
      get().startPlacing({ kind, size2 })
      return
    }
    if (!parts.length) {
      if (!def.sizes.includes(part.size)) {
        part.size = [...def.sizes].sort((a, b) => Math.abs(sizeIndex(a) - sizeIndex(paletteSize)) - Math.abs(sizeIndex(b) - sizeIndex(paletteSize)))[0]
        notes.push(`"${def.ru}" doesn't come in ${paletteSize}" — used ${part.size}"`)
      }
      part.size2 = defaultSize2(kind, part.size, size2 ?? reducerTo)
      part.pos = [0, 12, 0] // система труб начинается на высоте 1' над уровнем 0
    } else {
      let target = activePort && isOpen(parts, activePort) ? activePort : null
      if (!target && selectedId) target = firstOpen(parts, selectedId)
      if (!target) {
        get().startPlacing({ kind, size2 })
        return
      }
      let all = parts
      let pport = portsOf(parts.find((p) => p.id === target!.id)!)[target.port]
      for (let step = 0; ; step++) {
        if (pport.kind === 'slip') {
          set({ message: 'This end takes a tubular trap arm, not PVC' })
          return
        }
        let cands = sizeCandidates(kind, pport.size, size2 ?? reducerTo)
        // Явно выбранный второй размер (кнопка «× 3/4» в каталоге)
        if (size2) cands = cands.filter((c) => c.size2 === size2 || (c.size === size2 && c.size2 === pport.size) || (!c.size2 && size2 === c.size))
        // Каталог открыт на другом размере, чем выбранный конец: сначала варианты-переходы на этот размер
        if (paletteSize !== pport.size) cands.sort((a, b) => Number(b.size === paletteSize || b.size2 === paletteSize) - Number(a.size === paletteSize || a.size2 === paletteSize))
        if (!cands.length) {
          set({ message: `"${def.ru}" is not made for ${pport.size}"` })
          return
        }
        const hit = cands.map((c) => ({ ...part, ...c })).find((c) => matchPort(c, pport) >= 0)
        if (hit) {
          Object.assign(part, hit, { attach: matchPort(hit, pport), parent: target })
          break
        }
        const sample = { ...part, ...cands[0] }
        const wantCu = def.group === 'copper' || (def.group === 'common' && isCu(paletteSize)) || !!pport.preferCu
        const adapter = adapterFor(pport, Math.max(...portsOf(sample).map((p) => p.depth)), target!, famNear(all, target!.id, kind), wantCu)
        if (!adapter || step > 2) {
          set({ message: 'These ends can\'t be joined directly' })
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
    // детали, прикреплённые к удаляемой, становятся отдельными ветками на тех же местах
    const xfs = computeTransforms(parts)
    const next = parts
      .filter((p) => p.id !== id)
      .map((p) => {
        if (p.parent?.id !== id) return p
        const xf = xfs.get(p.id)!
        const e = new Euler().setFromQuaternion(xf.quat, 'YXZ')
        const deg = (v: number): number => Math.round(((v * 180) / Math.PI) * 1000) / 1000
        const { parent: _drop, ...rest } = p
        void _drop
        return { ...rest, roll: 0, pos: [xf.pos.x, xf.pos.y, xf.pos.z] as V3, rot: [deg(e.x), deg(e.y), deg(e.z)] as V3 }
      })
    get().commit(next)
    set({ selectedId: null, activePort: victim.parent ?? null, message: null })
  },

  deleteBranch: (id) => {
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

  select: (id) => set({ joining: false, moveSystem: false, selectedId: id, activePort: id ? get().activePort : null, selectedEnv: id ? null : get().selectedEnv }),
  selectPort: (ref) => set({ activePort: ref, selectedId: ref ? ref.id : get().selectedId, selectedEnv: ref ? null : get().selectedEnv, message: null }),

  undo: () => {
    const { past, parts, env, future } = get()
    if (!past.length) return
    const prev = past[past.length - 1]
    set((s) => ({ parts: prev.parts, env: prev.env, past: past.slice(0, -1), future: [{ parts, env }, ...future], dirty: true, timeline: s.timeline.length > 1 ? s.timeline.slice(0, -1) : [{ parts: prev.parts, env: prev.env }] }))
    fixSelection()
  },

  redo: () => {
    const { past, parts, env, future } = get()
    if (!future.length) return
    set((s) => ({ parts: future[0].parts, env: future[0].env, past: [...past, { parts, env }], future: future.slice(1), dirty: true, timeline: [...s.timeline.slice(-1999), { parts: future[0].parts, env: future[0].env }] }))
    fixSelection()
  },

  setPaletteSize: (paletteSize) => set({ paletteSize }),
  setReducerTo: (reducerTo) => set({ reducerTo }),
  setStick: (stick) => set({ stick }),
  toggleDims: () =>
    set((s) => {
      writePref('pipecad.showDims', !s.showDims)
      return { showDims: !s.showDims }
    }),
  togglePorts: () => set((s) => ({ showPorts: !s.showPorts })),
  setView: (dir) => set((s) => ({ view: { tick: s.view.tick + 1, dir } })),
  setMessage: (message) => set({ message }),

  newProject: () =>
    set({ parts: [], env: [], past: [], future: [], timeline: [], replay: null, selectedEnv: null, selectedId: null, activePort: null, filePath: null, dirty: false, message: null }),

  loadProject: (f, path) => {
    set({
      parts: f.parts,
      env: (f.env ?? []).map(normalize),
      timeline: (() => {
        const t = unpackTimeline(f.timeline)
        return t.length ? t : f.parts.length || f.env?.length ? [{ parts: f.parts, env: (f.env ?? []).map(normalize) }] : []
      })(),
      replay: null,
      selectedEnv: null,
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
  const { parts, env, selectedId, activePort, selectedEnv } = useStore.getState()
  const ids = new Set(parts.map((p) => p.id))
  const sel = selectedId && ids.has(selectedId) ? selectedId : null
  let ap = activePort && ids.has(activePort.id) ? activePort : null
  if (ap && !buildModel(parts).open.some((w) => portKey(w.partId, w.index) === portKey(ap!.id, ap!.port))) ap = null
  useStore.setState({ selectedId: sel, activePort: ap, selectedEnv: selectedEnv && env.some((e) => e.id === selectedEnv) ? selectedEnv : null })
}

export function serialize(): string {
  const { parts, env, stick, timeline, replay } = useStore.getState()
  // во время повтора на экране старый шаг — сохраняем настоящий проект
  const real = replay ? replay.saved : { parts, env }
  const f: ProjectFile = { app: 'pipecad', version: 1, parts: real.parts, env: real.env, stick, timeline: packTimeline(timeline) }
  return JSON.stringify(f, null, 1)
}

// Для автотестов через DevTools
;(window as unknown as { pipecad: typeof useStore; pipecadFittings: typeof FITTINGS }).pipecad = useStore
;(window as unknown as { pipecadFittings: typeof FITTINGS }).pipecadFittings = FITTINGS

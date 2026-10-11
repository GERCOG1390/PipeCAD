// «Соединить концы»: разворачиваем фитинги вокруг оси подключения так, чтобы два свободных конца
// смотрели друг на друга, и ставим между ними трубу точной длины.
import { Vector3 } from 'three'
import { Part, fittingDef, mates, portsOf } from './catalog'
import { computeTransforms } from './geometry'
import { formatLength } from './units'

export interface Ref {
  id: string
  port: number
}

interface PW {
  pos: Vector3
  dir: Vector3
}

function portWorld(parts: Part[], ref: Ref): PW | null {
  const p = parts.find((x) => x.id === ref.id)
  if (!p) return null
  const xf = computeTransforms(parts).get(p.id)
  const def = portsOf(p)[ref.port]
  if (!xf || !def) return null
  return { pos: new Vector3(...def.pos).applyQuaternion(xf.quat).add(xf.pos), dir: new Vector3(...def.dir).applyQuaternion(xf.quat).normalize() }
}

const withRoll = (parts: Part[], id: string, roll: number): Part[] => parts.map((p) => (p.id === id ? { ...p, roll } : p))

// Ближайшая вверх по цепочке деталь, поворот которой меняет направление конца `ref`
function rollable(parts: Part[], ref: Ref): Part | null {
  const byId = new Map(parts.map((p) => [p.id, p]))
  for (let c = byId.get(ref.id); c; c = c.parent ? byId.get(c.parent.id) : undefined) {
    if (!c.parent) return null
    const a = portWorld(withRoll(parts, c.id, c.roll), ref)
    const b = portWorld(withRoll(parts, c.id, c.roll + 90), ref)
    if (a && b && a.dir.angleTo(b.dir) > 0.02) return c
  }
  return null
}

// Повернуть подходящий фитинг так, чтобы конец `ref` смотрел на точку `target`
function aim(parts: Part[], ref: Ref, other: Ref): { parts: Part[]; part: Part | null } {
  const r = rollable(parts, ref)
  if (!r) return { parts, part: null }
  const score = (roll: number): number => {
    const ps = withRoll(parts, r.id, roll)
    const w = portWorld(ps, ref)
    const t = portWorld(ps, other)?.pos
    if (!w || !t) return -2
    const d = t.clone().sub(w.pos)
    if (d.lengthSq() < 1e-9) return 1
    return w.dir.dot(d.normalize())
  }
  let best = r.roll
  let bestS = score(best)
  for (let a = 0; a < 360; a += 2) {
    const s = score(a)
    if (s > bestS) {
      bestS = s
      best = a
    }
  }
  for (const step of [0.5, 0.05, 0.005]) {
    for (let k = -8; k <= 8; k++) {
      const a = best + k * step
      const s = score(a)
      if (s > bestS) {
        bestS = s
        best = a
      }
    }
  }
  best = ((best % 360) + 360) % 360
  return { parts: withRoll(parts, r.id, Math.round(best * 1000) / 1000), part: r }
}

export interface JoinResult {
  parts: Part[]
  ok: boolean
  message: string
  newId?: string
}

const MISS = 0.375 // допуск промаха, дюймы (труба PVC немного «играет»)
const ANGLE = 3 // допуск по углу, градусы

export function joinPorts(parts0: Part[], A: Ref, B: Ref, newId: () => string): JoinResult {
  let parts = parts0
  const rolled = new Set<string>()
  for (let i = 0; i < 14; i++) {
    const ra = aim(parts, A, B)
    parts = ra.parts
    if (ra.part) rolled.add(ra.part.id)
    const rb = aim(parts, B, A)
    parts = rb.parts
    if (rb.part) rolled.add(rb.part.id)
    if (!ra.part && !rb.part) break
  }
  const a = portWorld(parts, A)
  const b = portWorld(parts, B)
  if (!a || !b) return { parts: parts0, ok: false, message: 'Ends not found' }
  const d = b.pos.clone().sub(a.pos)
  const L = d.dot(a.dir)
  const miss = d.clone().sub(a.dir.clone().multiplyScalar(L)).length()
  const ang = (b.dir.angleTo(a.dir.clone().negate()) * 180) / Math.PI
  const names = [...rolled].map((id) => fittingDef(parts.find((p) => p.id === id)!.kind).ru)
  const rolledMsg = names.length ? `Rotated: ${names.join(', ')}. ` : ''
  if (L <= 0.25 || miss > MISS || ang > ANGLE) {
    const why = L <= 0.25 ? 'ends point away from each other' : `offset ${formatLength(miss)}, angle ${ang.toFixed(1)}°`
    return { parts, ok: false, message: `${rolledMsg}Can't line up: ${why}. Try a different fitting angle (22.5°, 45°, 60°) or move the branch` }
  }
  const pa = parts.find((p) => p.id === A.id)!
  const pb = parts.find((p) => p.id === B.id)!
  const da = portsOf(pa)[A.port]
  const db = portsOf(pb)[B.port]
  if (da.size !== db.size) return { parts, ok: false, message: `${rolledMsg}Ends line up, but sizes differ (${da.size}" and ${db.size}") — needs a reducer` }

  // раструб ↔ раструб: новая труба между доньями раструбов
  if (da.kind === 'hub' && db.kind === 'hub') {
    const id = newId()
    const pipe: Part = { id, kind: 'pipe', size: da.size, attach: 0, roll: 0, length: Math.round(L * 16) / 16, parent: { id: A.id, port: A.port }, tie: { port: 1, to: { id: B.id, port: B.port } } }
    return { parts: [...parts, pipe], ok: true, newId: id, message: `${rolledMsg}Joined with ${formatLength(pipe.length!)} of pipe` }
  }
  // гладкий конец трубы ↔ раструб: удлиняем трубу до дна раструба
  const extend = (pRef: Ref, part: Part, to: Ref): JoinResult | null => {
    if (part.kind !== 'pipe' || pRef.port === part.attach) return null
    const len = Math.round(((part.length ?? 0) + L) * 16) / 16
    return {
      parts: parts.map((p) => (p.id === part.id ? { ...p, length: len, tie: { port: pRef.port, to } } : p)),
      ok: true,
      newId: part.id,
      message: `${rolledMsg}Extended pipe to ${formatLength(len)} and joined`
    }
  }
  if (da.kind === 'spigot' && mates(da.kind, db.kind)) {
    const r = extend(A, pa, B)
    if (r) return r
  }
  if (db.kind === 'spigot' && mates(da.kind, db.kind)) {
    // тянуть конец чужой ветки нельзя — двигаем её начало (длину), это сдвинет конец к A
    const r = extend(B, pb, A)
    if (r) return r
  }
  return { parts, ok: false, message: `${rolledMsg}Ends line up, but their types can't be joined directly (needs a coupling or nipple)` }
}

// «Соединить здесь»: труба от A до точки пересечения, фитинг нужного угла, затем доводка поворотом и труба до B
export function connectVia(parts0: Part[], A: Ref, B: Ref, X: Vector3, fitKind: string, takeoff: number, newId: () => string): JoinResult {
  const a = portWorld(parts0, A)
  const pa = parts0.find((p) => p.id === A.id)
  if (!a || !pa) return { parts: parts0, ok: false, message: 'End not found' }
  const da = portsOf(pa)[A.port]
  const L = a.pos.distanceTo(X) - takeoff
  if (L < 0.5) return { parts: parts0, ok: false, message: 'Intersection is too close to the end — the fitting won\'t fit' }
  let parts = parts0
  let parentRef: Ref
  if (da.kind === 'hub') {
    const pipe: Part = { id: newId(), kind: 'pipe', size: da.size, attach: 0, roll: 0, length: Math.round(L * 16) / 16, parent: { id: A.id, port: A.port } }
    parts = [...parts, pipe]
    parentRef = { id: pipe.id, port: 1 }
  } else if (da.kind === 'spigot' && pa.kind === 'pipe' && A.port !== pa.attach) {
    parts = parts.map((p) => (p.id === pa.id ? { ...p, length: Math.round(((p.length ?? 0) + L) * 16) / 16 } : p))
    parentRef = A
  } else {
    return { parts: parts0, ok: false, message: 'Can\'t continue with pipe from this end — needs an adapter' }
  }
  const fit: Part = { id: newId(), kind: fitKind, size: da.size, attach: 0, roll: 0, parent: parentRef }
  parts = [...parts, fit]
  const res = joinPorts(parts, { id: fit.id, port: 1 }, B, newId)
  if (!res.ok) return { parts: res.parts, ok: false, message: `Placed ${fittingDef(fitKind).ru}, but couldn't finish the run: ${res.message}` }
  return { ...res, message: `Placed ${formatLength(L)} pipe + ${fittingDef(fitKind).ru}. ${res.message}` }
}

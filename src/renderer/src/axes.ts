// Оси свободных концов и их пересечения — чтобы видеть, где и каким фитингом сводить ветки
import { Vector3 } from 'three'
import { Part, SizeId, fittingDef, portsOf } from './catalog'
import { Model, WorldPort, portKey } from './geometry'

export const ANGLE_KINDS: { angle: number; dwv?: string; pressure?: string; ru: string }[] = [
  { angle: 90, dwv: 'dwv90', pressure: 'elbow90', ru: 'колено 90°' },
  { angle: 60, dwv: 'd60', ru: 'колено 60°' },
  { angle: 45, dwv: 'dwv45', pressure: 'elbow45', ru: 'колено 45°' },
  { angle: 22.5, dwv: 'dwv22', ru: 'колено 22.5°' }
]

export interface Guide {
  a: WorldPort
  b: WorldPort
  pA: Vector3 // ближайшая точка на оси A
  pB: Vector3 // ближайшая точка на оси B
  tA: number // от конца A до pA вдоль оси
  tB: number
  miss: number // расстояние между осями
  turn: number // угол поворота в точке пересечения, градусы
  fit?: { kind: string; ru: string; takeoff: number }
}

// Начало оси — торец раструба/конца, чтобы линия выходила из детали
export const mouthOf = (w: WorldPort): Vector3 => w.pos.clone().addScaledVector(w.dir, w.def.depth ? w.def.face ?? w.def.depth : 0)

// Заход (от центра до дна раструба) фитинга данного вида и размера
export function takeoffOf(kind: string, size: SizeId): number | null {
  const def = fittingDef(kind)
  if (!def.sizes.includes(size)) return null
  const p = portsOf({ id: 't', kind, size, attach: 0, roll: 0 })[0]
  return Math.abs(p.pos[0] * p.dir[0] + p.pos[1] * p.dir[1] + p.pos[2] * p.dir[2])
}

export function fittingFor(turn: number, size: SizeId, dwv: boolean): Guide['fit'] {
  const k = ANGLE_KINDS.find((x) => Math.abs(x.angle - turn) < 1.5)
  if (!k) return undefined
  if (size.startsWith('cu')) {
    const ck = k.angle === 90 ? 'cu90' : k.angle === 45 ? 'cu45' : undefined
    const t = ck ? takeoffOf(ck, size) : null
    return ck && t !== null ? { kind: ck, ru: k.ru, takeoff: t } : undefined
  }
  const kind = (dwv ? k.dwv : k.pressure) ?? (dwv ? undefined : k.dwv)
  if (!kind) return undefined
  const t = takeoffOf(kind, size)
  return t === null ? undefined : { kind, ru: k.ru, takeoff: t }
}

function closest(a: WorldPort, b: WorldPort): Guide | null {
  const oa = a.pos
  const ob = b.pos
  const da = a.dir
  const db = b.dir
  const w0 = oa.clone().sub(ob)
  const bb = da.dot(db)
  const d = da.dot(w0)
  const e = db.dot(w0)
  const den = 1 - bb * bb
  if (den < 1e-6) return null // параллельны
  const tA = (bb * e - d) / den
  const tB = (e - bb * d) / den
  if (tA <= 0.1 || tB <= 0.1) return null // точка позади одного из концов
  const pA = oa.clone().addScaledVector(da, tA)
  const pB = ob.clone().addScaledVector(db, tB)
  const turn = (da.angleTo(db.clone().negate()) * 180) / Math.PI
  return { a, b, pA, pB, tA, tB, miss: pA.distanceTo(pB), turn }
}

export function computeGuides(model: Model, parts: Part[], active: { id: string; port: number } | null): Guide[] {
  const out: Guide[] = []
  const kindOf = new Map(parts.map((p) => [p.id, p.kind]))
  const isDwv = (w: WorldPort): boolean => w.def.fam === 'd' || fittingDef(kindOf.get(w.partId) ?? 'pipe').group === 'dwv'
  const open = model.open.filter((w) => w.def.kind !== 'slip')
  const act = active ? open.find((w) => portKey(w.partId, w.index) === portKey(active.id, active.port)) : undefined
  const pairs: [WorldPort, WorldPort][] = []
  if (act) {
    for (const w of open) if (w !== act) pairs.push([act, w])
  } else {
    for (let i = 0; i < open.length; i++) for (let j = i + 1; j < open.length; j++) pairs.push([open[i], open[j]])
  }
  for (const [a, b] of pairs) {
    if (a.size !== b.size) continue
    const g = closest(a, b)
    if (!g) continue
    // без выбранного конца показываем только настоящие пересечения
    if (!act && g.miss > 0.5) continue
    if (g.miss > 24) continue
    g.fit = g.miss <= 0.5 ? fittingFor(g.turn, a.size, isDwv(a) || isDwv(b)) : undefined
    out.push(g)
  }
  return out.slice(0, 40)
}

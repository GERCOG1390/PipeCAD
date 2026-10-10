import { Euler, Quaternion, Vector3 } from 'three'
import { Part, PortDef, SizeId, portsOf } from './catalog'

export interface Xf {
  pos: Vector3
  quat: Quaternion
}

const DEG = Math.PI / 180

// Детали образуют дерево: каждая крепится своим портом attach к порту родителя.
export function computeTransforms(parts: Part[]): Map<string, Xf> {
  const byId = new Map(parts.map((p) => [p.id, p]))
  const out = new Map<string, Xf>()
  const visiting = new Set<string>()

  const calc = (p: Part): Xf => {
    const done = out.get(p.id)
    if (done) return done
    const par = p.parent ? byId.get(p.parent.id) : undefined
    let xf: Xf
    if (!par || visiting.has(p.id)) {
      const r = p.rot ?? [0, 0, 0]
      xf = { pos: new Vector3(), quat: new Quaternion().setFromEuler(new Euler(r[0] * DEG, r[1] * DEG, r[2] * DEG)) }
    } else {
      visiting.add(p.id)
      const px = calc(par)
      const pp = portsOf(par)[p.parent!.port]
      const wpos = new Vector3(...pp.pos).applyQuaternion(px.quat).add(px.pos)
      const wdir = new Vector3(...pp.dir).applyQuaternion(px.quat).normalize()
      const cp = portsOf(p)[p.attach]
      const q1 = new Quaternion().setFromUnitVectors(new Vector3(...cp.dir), wdir.clone().negate())
      const quat = new Quaternion().setFromAxisAngle(wdir, p.roll * DEG).multiply(q1)
      const pos = wpos.sub(new Vector3(...cp.pos).applyQuaternion(quat))
      xf = { pos, quat }
      visiting.delete(p.id)
    }
    out.set(p.id, xf)
    return xf
  }

  parts.forEach(calc)
  return out
}

export interface WorldPort {
  partId: string
  index: number
  pos: Vector3
  dir: Vector3
  size: SizeId
  def: PortDef
}

export const portKey = (id: string, port: number): string => `${id}:${port}`

export interface Model {
  xfs: Map<string, Xf>
  ports: WorldPort[]
  links: Map<string, string> // "id:port" -> "id:port"
  open: WorldPort[]
  bad: string[] // раструб в раструб, гладкий в гладкий или разные размеры (ключ одной стороны)
}

export function buildModel(parts: Part[]): Model {
  const xfs = computeTransforms(parts)
  const ports: WorldPort[] = []
  for (const p of parts) {
    const xf = xfs.get(p.id)!
    portsOf(p).forEach((def, index) => {
      ports.push({
        partId: p.id,
        index,
        def,
        size: def.size,
        pos: new Vector3(...def.pos).applyQuaternion(xf.quat).add(xf.pos),
        dir: new Vector3(...def.dir).applyQuaternion(xf.quat).normalize()
      })
    })
  }

  const links = new Map<string, string>()
  const ids = new Set(parts.map((p) => p.id))
  for (const p of parts) {
    if (!p.parent || !ids.has(p.parent.id)) continue
    const a = portKey(p.id, p.attach)
    const b = portKey(p.parent.id, p.parent.port)
    links.set(a, b)
    links.set(b, a)
  }

  // Замыкание контуров: свободные порты, которые совпали в пространстве, считаем соединёнными.
  const free = ports.filter((w) => !links.has(portKey(w.partId, w.index)))
  for (let i = 0; i < free.length; i++) {
    for (let j = i + 1; j < free.length; j++) {
      const a = free[i]
      const b = free[j]
      if (a.partId === b.partId || a.size !== b.size || !!a.def.spigot === !!b.def.spigot) continue
      const ka = portKey(a.partId, a.index)
      const kb = portKey(b.partId, b.index)
      if (links.has(ka) || links.has(kb)) continue
      if (a.pos.distanceTo(b.pos) < 0.06 && a.dir.dot(b.dir) < -0.99) {
        links.set(ka, kb)
        links.set(kb, ka)
      }
    }
  }

  const open = ports.filter((w) => !links.has(portKey(w.partId, w.index)))
  const byKey = new Map(ports.map((w) => [portKey(w.partId, w.index), w]))
  const bad: string[] = []
  links.forEach((b, a) => {
    if (a > b) return
    const wa = byKey.get(a)
    const wb = byKey.get(b)
    if (wa && wb && (!!wa.def.spigot === !!wb.def.spigot || wa.size !== wb.size)) bad.push(a)
  })
  return { xfs, ports, links, open, bad }
}

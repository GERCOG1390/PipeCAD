// История постройки для повтора. Детали неизменяемы, поэтому соседние шаги делят одни и те же объекты:
// в файл пишем каждый уникальный объект один раз, а шаги — списками номеров.
import type { Part } from './catalog'
import type { EnvItem } from './environment'

export interface Frame {
  parts: Part[]
  env: EnvItem[]
}

export interface PackedTimeline {
  p: Part[]
  e: EnvItem[]
  f: [number[], number[]][]
}

export function packTimeline(frames: Frame[]): PackedTimeline {
  const pIdx = new Map<Part, number>()
  const eIdx = new Map<EnvItem, number>()
  const p: Part[] = []
  const e: EnvItem[] = []
  const f = frames.map((fr) => {
    const pi = fr.parts.map((x) => {
      let i = pIdx.get(x)
      if (i === undefined) {
        i = p.length
        p.push(x)
        pIdx.set(x, i)
      }
      return i
    })
    const ei = fr.env.map((x) => {
      let i = eIdx.get(x)
      if (i === undefined) {
        i = e.length
        e.push(x)
        eIdx.set(x, i)
      }
      return i
    })
    return [pi, ei] as [number[], number[]]
  })
  return { p, e, f }
}

export function unpackTimeline(t: PackedTimeline | undefined): Frame[] {
  if (!t || !Array.isArray(t.f)) return []
  return t.f.map(([pi, ei]) => ({ parts: pi.map((i) => t.p[i]).filter(Boolean), env: ei.map((i) => t.e[i]).filter(Boolean) }))
}

// Что появилось на этом шаге — для подсветки во время повтора
export function addedIn(prev: Frame | undefined, cur: Frame): { part?: string; env?: string } {
  const pp = new Set((prev?.parts ?? []).map((x) => x.id))
  const pe = new Set((prev?.env ?? []).map((x) => x.id))
  const part = [...cur.parts].reverse().find((x) => !pp.has(x.id))?.id
  const env = [...cur.env].reverse().find((x) => !pe.has(x.id))?.id
  if (part || env) return { part, env }
  // ничего нового — подсветим изменённое
  const prevP = new Map((prev?.parts ?? []).map((x) => [x.id, x]))
  const changed = cur.parts.find((x) => prevP.get(x.id) !== x)?.id
  const prevE = new Map((prev?.env ?? []).map((x) => [x.id, x]))
  const changedE = cur.env.find((x) => prevE.get(x.id) !== x)?.id
  return { part: changed, env: changed ? undefined : changedE }
}

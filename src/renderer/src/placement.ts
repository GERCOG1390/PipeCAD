// Установка детали отдельной веткой: куда и как её поставить по точке на поверхности
import { Euler, Quaternion, Vector3 } from 'three'
import { DEFAULT_PIPE, Part, SizeId, V3, defaultSize2, fittingDef, hubR, portsOf, sizeIndex, sizeSpec } from './catalog'

export interface Placing {
  kind: string
  size2?: SizeId
  kit?: string // после установки собрать готовый узел
}

const DEG = Math.PI / 180

export function nearestSize(kind: string, want: SizeId): SizeId {
  const def = fittingDef(kind)
  if (def.sizes.includes(want)) return want
  return [...def.sizes].sort((a, b) => Math.abs(sizeIndex(a) - sizeIndex(want)) - Math.abs(sizeIndex(b) - sizeIndex(want)))[0]
}

// Корневая деталь, стоящая на поверхности в точке `at`
export function placementFor(pl: Placing, at: V3, o: { id: string; size: SizeId; reducerTo: SizeId; lastPipe: number; turn: number }): Part {
  const def = fittingDef(pl.kind)
  const size = nearestSize(pl.kind, o.size)
  const base = def.place?.rot ?? [0, 0, 0]
  const rot: V3 = [base[0], (base[1] + o.turn) % 360, base[2]]
  const part: Part = { id: o.id, kind: pl.kind, size, size2: pl.size2 ?? defaultSize2(pl.kind, size, o.reducerTo), attach: 0, roll: 0, rot }
  if (pl.kind === 'pipe') part.length = o.lastPipe || DEFAULT_PIPE
  const q = new Quaternion().setFromEuler(new Euler(rot[0] * DEG, rot[1] * DEG, rot[2] * DEG, 'YXZ'))
  let offY: number
  if (def.place?.height !== undefined) {
    // арматура в стене: центр на заданной высоте над полом (например, смеситель душа 48")
    offY = def.place.height
  } else if (def.place?.flushTop) {
    // верх (например, фланец унитаза) вровень с поверхностью, раструб уходит вниз
    offY = -new Vector3(0, 0, def.place.flushTop(part)).applyQuaternion(q).y
  } else {
    // нижняя точка детали ложится на поверхность
    const r = pl.kind === 'pipe' ? sizeSpec(size).od / 2 : hubR(size, def.group === 'dwv' ? 'd' : 'p')
    let minY = -r
    for (const pt of portsOf(part)) minY = Math.min(minY, new Vector3(...pt.pos).applyQuaternion(q).y - r)
    offY = -minY
  }
  part.pos = [at[0], at[1] + offY + 0.01, at[2]]
  return part
}

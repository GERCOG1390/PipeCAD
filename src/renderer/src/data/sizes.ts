// Размеры труб и раструбов. Все значения в дюймах.
// Трубы: ASTM D1785 Sch 40. Раструбы напорных фитингов: ASTM D2466 (Charlotte DC-PR),
// раструбы DWV: ASTM D2665 (Charlotte DC-DWV, Hub dimensions).

export type SizeId = '1/2' | '3/4' | '1' | '1-1/4' | '1-1/2' | '2' | '2-1/2' | '3' | '4' | '6'

export interface SizeSpec {
  id: SizeId
  od: number // наружный диаметр трубы
  wall: number // стенка трубы Sch 40
  socket: number // глубина раструба напорного фитинга (минимум по D2466)
  dwv: number // глубина раструба DWV (0 — DWV в этом размере нет)
  dwvWall: number // стенка раструба DWV
  tpi: number // NPT: ниток на дюйм
}

export const SIZES: SizeSpec[] = [
  { id: '1/2', od: 0.84, wall: 0.109, socket: 0.688, dwv: 0, dwvWall: 0, tpi: 14 },
  { id: '3/4', od: 1.05, wall: 0.113, socket: 0.719, dwv: 0, dwvWall: 0, tpi: 14 },
  { id: '1', od: 1.315, wall: 0.133, socket: 0.875, dwv: 0, dwvWall: 0, tpi: 11.5 },
  { id: '1-1/4', od: 1.66, wall: 0.14, socket: 0.938, dwv: 0.687, dwvWall: 0.156, tpi: 11.5 },
  { id: '1-1/2', od: 1.9, wall: 0.145, socket: 1.094, dwv: 0.687, dwvWall: 0.156, tpi: 11.5 },
  { id: '2', od: 2.375, wall: 0.154, socket: 1.156, dwv: 0.75, dwvWall: 0.156, tpi: 11.5 },
  { id: '2-1/2', od: 2.875, wall: 0.203, socket: 1.75, dwv: 0, dwvWall: 0, tpi: 8 },
  { id: '3', od: 3.5, wall: 0.216, socket: 1.875, dwv: 1.5, dwvWall: 0.218, tpi: 8 },
  { id: '4', od: 4.5, wall: 0.237, socket: 2.0, dwv: 1.75, dwvWall: 0.25, tpi: 8 },
  { id: '6', od: 6.625, wall: 0.28, socket: 3.0, dwv: 3.0, dwvWall: 0.281, tpi: 8 }
]

const BY_ID = new Map(SIZES.map((s) => [s.id, s]))
export const sizeSpec = (id: SizeId): SizeSpec => BY_ID.get(id)!
export const sizeIndex = (id: SizeId): number => SIZES.findIndex((s) => s.id === id)
export const sizeLabel = (id: SizeId): string => `${id}"`
export const ALL_SIZES: SizeId[] = SIZES.map((s) => s.id)
export const DWV_SIZES: SizeId[] = SIZES.filter((s) => s.dwv > 0).map((s) => s.id)

// Стенка раструба напорного фитинга (в каталоге не дана — по замерам типичных Sch 40)
export const pressureHubWall = (id: SizeId): number => 0.07 + sizeSpec(id).od * 0.05

// "1-19/32" → 1.59375; используется для таблиц, переписанных из каталогов
export function n(s: string): number {
  const m = s.trim().match(/^(?:(\d+)(?:-|\s+|$))?(?:(\d+)\/(\d+))?$/)
  if (!m) throw new Error(`bad number ${s}`)
  return (m[1] ? +m[1] : 0) + (m[2] ? +m[2] / +m[3] : 0)
}

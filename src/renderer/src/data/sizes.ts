// Размеры труб и раструбов. Все значения в дюймах.
// Трубы: ASTM D1785 Sch 40. Раструбы напорных фитингов: ASTM D2466 (Charlotte DC-PR),
// раструбы DWV: ASTM D2665 (Charlotte DC-DWV, Hub dimensions).

export type PvcSizeId = '1/2' | '3/4' | '1' | '1-1/4' | '1-1/2' | '2' | '2-1/2' | '3' | '4' | '6'
// Медь (номинальный размер водяной трубы): отдельные id, чтобы медь 1/2" (OD 5/8") не стыковалась с PVC 1/2"
export type CuSizeId = 'cu1/2' | 'cu3/4' | 'cu1' | 'cu1-1/4' | 'cu1-1/2' | 'cu2' | 'cu2-1/2' | 'cu3' | 'cu4'
// Чугун no-hub (CISPI 301) и оцинкованная сталь Sch 40 (OD как у PVC Sch 40, IPS)
export type CiSizeId = 'ci1-1/2' | 'ci2' | 'ci3' | 'ci4' | 'ci6'
export type GsSizeId = 'gs1/2' | 'gs3/4' | 'gs1' | 'gs1-1/4' | 'gs1-1/2' | 'gs2' | 'gs3' | 'gs4'
export type SizeId = PvcSizeId | CuSizeId | CiSizeId | GsSizeId
export type Material = 'pvc' | 'cu' | 'ci' | 'gs'

export interface SizeSpec {
  id: SizeId
  od: number // наружный диаметр трубы
  wall: number // стенка трубы Sch 40
  socket: number // глубина раструба напорного фитинга (минимум по D2466)
  dwv: number // глубина раструба DWV (0 — DWV в этом размере нет)
  dwvWall: number // стенка раструба DWV
  tpi: number // NPT: ниток на дюйм
  mat: Material
}

export const SIZES: SizeSpec[] = [
  { id: '1/2', od: 0.84, wall: 0.109, socket: 0.688, dwv: 0, dwvWall: 0, tpi: 14, mat: 'pvc' },
  { id: '3/4', od: 1.05, wall: 0.113, socket: 0.719, dwv: 0, dwvWall: 0, tpi: 14, mat: 'pvc' },
  { id: '1', od: 1.315, wall: 0.133, socket: 0.875, dwv: 0, dwvWall: 0, tpi: 11.5, mat: 'pvc' },
  { id: '1-1/4', od: 1.66, wall: 0.14, socket: 0.938, dwv: 0.687, dwvWall: 0.156, tpi: 11.5, mat: 'pvc' },
  { id: '1-1/2', od: 1.9, wall: 0.145, socket: 1.094, dwv: 0.687, dwvWall: 0.156, tpi: 11.5, mat: 'pvc' },
  { id: '2', od: 2.375, wall: 0.154, socket: 1.156, dwv: 0.75, dwvWall: 0.156, tpi: 11.5, mat: 'pvc' },
  { id: '2-1/2', od: 2.875, wall: 0.203, socket: 1.75, dwv: 0, dwvWall: 0, tpi: 8, mat: 'pvc' },
  { id: '3', od: 3.5, wall: 0.216, socket: 1.875, dwv: 1.5, dwvWall: 0.218, tpi: 8, mat: 'pvc' },
  { id: '4', od: 4.5, wall: 0.237, socket: 2.0, dwv: 1.75, dwvWall: 0.25, tpi: 8, mat: 'pvc' },
  { id: '6', od: 6.625, wall: 0.28, socket: 3.0, dwv: 3.0, dwvWall: 0.281, tpi: 8, mat: 'pvc' },
  // Медная труба ASTM B88 Type L (OD = номинал + 1/8"), глубина пайки — NIBCO, Chart 1 «Solder Cup Depth»
  { id: 'cu1/2', od: 0.625, wall: 0.04, socket: 0.5, dwv: 0, dwvWall: 0, tpi: 14, mat: 'cu' },
  { id: 'cu3/4', od: 0.875, wall: 0.045, socket: 0.75, dwv: 0, dwvWall: 0, tpi: 14, mat: 'cu' },
  { id: 'cu1', od: 1.125, wall: 0.05, socket: 0.91, dwv: 0, dwvWall: 0, tpi: 11.5, mat: 'cu' },
  { id: 'cu1-1/4', od: 1.375, wall: 0.055, socket: 0.97, dwv: 0, dwvWall: 0, tpi: 11.5, mat: 'cu' },
  { id: 'cu1-1/2', od: 1.625, wall: 0.06, socket: 1.09, dwv: 0, dwvWall: 0, tpi: 11.5, mat: 'cu' },
  { id: 'cu2', od: 2.125, wall: 0.07, socket: 1.34, dwv: 0, dwvWall: 0, tpi: 11.5, mat: 'cu' },
  { id: 'cu2-1/2', od: 2.625, wall: 0.08, socket: 1.47, dwv: 0, dwvWall: 0, tpi: 8, mat: 'cu' },
  { id: 'cu3', od: 3.125, wall: 0.09, socket: 1.66, dwv: 0, dwvWall: 0, tpi: 8, mat: 'cu' },
  { id: 'cu4', od: 4.125, wall: 0.11, socket: 2.16, dwv: 0, dwvWall: 0, tpi: 8, mat: 'cu' },
  // Чугун no-hub: наружный диаметр и стенка ствола — Charlotte Cast Iron No-Hub Submittal (CISPI 301 / ASTM A888)
  { id: 'ci1-1/2', od: 1.9, wall: 0.16, socket: 0, dwv: 0, dwvWall: 0, tpi: 11.5, mat: 'ci' },
  { id: 'ci2', od: 2.35, wall: 0.16, socket: 0, dwv: 0, dwvWall: 0, tpi: 11.5, mat: 'ci' },
  { id: 'ci3', od: 3.35, wall: 0.16, socket: 0, dwv: 0, dwvWall: 0, tpi: 8, mat: 'ci' },
  { id: 'ci4', od: 4.38, wall: 0.19, socket: 0, dwv: 0, dwvWall: 0, tpi: 8, mat: 'ci' },
  { id: 'ci6', od: 6.3, wall: 0.19, socket: 0, dwv: 0, dwvWall: 0, tpi: 8, mat: 'ci' },
  // Оцинкованная сталь Sch 40 (ASTM A53): OD и стенка как у Sch 40
  { id: 'gs1/2', od: 0.84, wall: 0.109, socket: 0, dwv: 0, dwvWall: 0, tpi: 14, mat: 'gs' },
  { id: 'gs3/4', od: 1.05, wall: 0.113, socket: 0, dwv: 0, dwvWall: 0, tpi: 14, mat: 'gs' },
  { id: 'gs1', od: 1.315, wall: 0.133, socket: 0, dwv: 0, dwvWall: 0, tpi: 11.5, mat: 'gs' },
  { id: 'gs1-1/4', od: 1.66, wall: 0.14, socket: 0, dwv: 0, dwvWall: 0, tpi: 11.5, mat: 'gs' },
  { id: 'gs1-1/2', od: 1.9, wall: 0.145, socket: 0, dwv: 0, dwvWall: 0, tpi: 11.5, mat: 'gs' },
  { id: 'gs2', od: 2.375, wall: 0.154, socket: 0, dwv: 0, dwvWall: 0, tpi: 11.5, mat: 'gs' },
  { id: 'gs3', od: 3.5, wall: 0.216, socket: 0, dwv: 0, dwvWall: 0, tpi: 8, mat: 'gs' },
  { id: 'gs4', od: 4.5, wall: 0.237, socket: 0, dwv: 0, dwvWall: 0, tpi: 8, mat: 'gs' }
]

const BY_ID = new Map(SIZES.map((s) => [s.id, s]))
export const sizeSpec = (id: SizeId): SizeSpec => BY_ID.get(id)!
export const sizeIndex = (id: SizeId): number => SIZES.findIndex((s) => s.id === id)
export const nominal = (id: SizeId): string => id.replace(/^(cu|ci|gs)/, '')
export const MAT_NAME: Record<Material, { ru: string; short: string }> = {
  pvc: { ru: 'PVC', short: 'PVC' },
  cu: { ru: 'Copper', short: 'Cu' },
  ci: { ru: 'Cast iron no-hub', short: 'CI' },
  gs: { ru: 'Galvanized', short: 'galv.' }
}
export const matOf = (id: SizeId): Material => BY_ID.get(id)!.mat
// «3" чугун» — когда рядом размеры разных материалов
export const sizeMatLabel = (id: SizeId): string => `${nominal(id)}" ${MAT_NAME[matOf(id)].short}`
export const sizeLabel = (id: SizeId): string => `${nominal(id)}"`
export const isCu = (id: SizeId): boolean => id.startsWith('cu')
export const CU_SIZES: SizeId[] = SIZES.filter((s) => s.mat === 'cu').map((s) => s.id)
export const PVC_SIZES: SizeId[] = SIZES.filter((s) => s.mat === 'pvc').map((s) => s.id)
// Резьба NPT меди и PVC одного номинала совместима: резьбовой конец медного адаптера имеет PVC-номинал
export const threadSize = (id: SizeId): PvcSizeId => nominal(id) as PvcSizeId
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

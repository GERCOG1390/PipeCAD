// Справочник PVC Schedule 40 (ASTM D1785 трубы, D2466 фитинги). Все размеры в дюймах.
// od — наружный диаметр трубы, socket — глубина раструба,
// g90/g45/gCoup — от центра фитинга до дна раструба (заход, "take-off").
// Заходы примерные, у разных производителей отличаются на 1/16–1/8".

export type SizeId = '1/2' | '3/4' | '1' | '1-1/4' | '1-1/2' | '2' | '3' | '4' | '6'
export type V3 = [number, number, number]

export interface SizeSpec {
  id: SizeId
  od: number
  socket: number
  g90: number
  g45: number
  gCoup: number
}

export const SIZES: SizeSpec[] = [
  { id: '1/2', od: 0.84, socket: 0.688, g90: 0.5, g45: 0.19, gCoup: 0.0625 },
  { id: '3/4', od: 1.05, socket: 0.719, g90: 0.59, g45: 0.25, gCoup: 0.0625 },
  { id: '1', od: 1.315, socket: 0.875, g90: 0.69, g45: 0.31, gCoup: 0.0625 },
  { id: '1-1/4', od: 1.66, socket: 0.938, g90: 0.94, g45: 0.38, gCoup: 0.0625 },
  { id: '1-1/2', od: 1.9, socket: 1.094, g90: 1.06, g45: 0.44, gCoup: 0.0625 },
  { id: '2', od: 2.375, socket: 1.156, g90: 1.31, g45: 0.56, gCoup: 0.0625 },
  { id: '3', od: 3.5, socket: 1.75, g90: 1.94, g45: 0.75, gCoup: 0.094 },
  { id: '4', od: 4.5, socket: 2.0, g90: 2.38, g45: 0.94, gCoup: 0.094 },
  { id: '6', od: 6.625, socket: 3.0, g90: 3.5, g45: 1.4, gCoup: 0.125 }
]

export const sizeSpec = (id: SizeId): SizeSpec => SIZES.find((s) => s.id === id)!
export const hubRadius = (id: SizeId): number => {
  const s = sizeSpec(id)
  return s.od / 2 + Math.max(0.1, s.od * 0.07)
}

export type PartKind = 'pipe' | 'elbow90' | 'elbow45' | 'tee' | 'cross' | 'coupling' | 'reducer' | 'valve' | 'cap'

export const KINDS: Record<PartKind, { ru: string; en: string; key: string }> = {
  pipe: { ru: 'Труба', en: 'Pipe', key: 'P' },
  elbow90: { ru: 'Отвод 90°', en: '90° Elbow', key: 'E' },
  elbow45: { ru: 'Отвод 45°', en: '45° Elbow', key: 'F' },
  tee: { ru: 'Тройник', en: 'Tee', key: 'T' },
  cross: { ru: 'Крестовина', en: 'Cross', key: 'X' },
  coupling: { ru: 'Муфта', en: 'Coupling', key: 'C' },
  reducer: { ru: 'Переходник', en: 'Reducing Coupling', key: 'D' },
  valve: { ru: 'Шаровый кран', en: 'Ball Valve', key: 'V' },
  cap: { ru: 'Заглушка', en: 'Cap', key: 'K' }
}

export const KIND_ORDER: PartKind[] = ['pipe', 'elbow90', 'elbow45', 'tee', 'cross', 'coupling', 'reducer', 'valve', 'cap']

export interface Part {
  id: string
  kind: PartKind
  size: SizeId
  size2?: SizeId // второй размер у переходника
  length?: number // длина отреза трубы
  parent?: { id: string; port: number }
  attach: number // каким своим портом деталь подключена к родителю
  roll: number // поворот вокруг оси подключения, градусы
  rot?: V3 // ориентация корневой детали (градусы по X/Y/Z)
}

export interface PortDef {
  pos: V3 // точка, где заканчивается вставленная труба (дно раструба) или конец трубы
  dir: V3 // наружу
  size: SizeId
}

export const DEFAULT_PIPE = 24

export function portsOf(p: Part): PortDef[] {
  const s = sizeSpec(p.size)
  const size = p.size
  const c = Math.SQRT1_2
  switch (p.kind) {
    case 'pipe':
      return [
        { pos: [0, 0, 0], dir: [0, 0, -1], size },
        { pos: [0, 0, p.length ?? DEFAULT_PIPE], dir: [0, 0, 1], size }
      ]
    case 'elbow90':
      return [
        { pos: [0, 0, -s.g90], dir: [0, 0, -1], size },
        { pos: [s.g90, 0, 0], dir: [1, 0, 0], size }
      ]
    case 'elbow45':
      return [
        { pos: [0, 0, -s.g45], dir: [0, 0, -1], size },
        { pos: [s.g45 * c, 0, s.g45 * c], dir: [c, 0, c], size }
      ]
    case 'tee':
      return [
        { pos: [0, 0, -s.g90], dir: [0, 0, -1], size },
        { pos: [0, 0, s.g90], dir: [0, 0, 1], size },
        { pos: [s.g90, 0, 0], dir: [1, 0, 0], size }
      ]
    case 'cross':
      return [
        { pos: [0, 0, -s.g90], dir: [0, 0, -1], size },
        { pos: [0, 0, s.g90], dir: [0, 0, 1], size },
        { pos: [s.g90, 0, 0], dir: [1, 0, 0], size },
        { pos: [-s.g90, 0, 0], dir: [-1, 0, 0], size }
      ]
    case 'coupling':
      return [
        { pos: [0, 0, -s.gCoup], dir: [0, 0, -1], size },
        { pos: [0, 0, s.gCoup], dir: [0, 0, 1], size }
      ]
    case 'reducer': {
      const s2 = sizeSpec(p.size2 ?? p.size)
      const g = Math.max(s.od, s2.od) * 0.2 + 0.15
      return [
        { pos: [0, 0, -g], dir: [0, 0, -1], size },
        { pos: [0, 0, g], dir: [0, 0, 1], size: s2.id }
      ]
    }
    case 'valve': {
      const g = s.od * 0.9 + 0.4
      return [
        { pos: [0, 0, -g], dir: [0, 0, -1], size },
        { pos: [0, 0, g], dir: [0, 0, 1], size }
      ]
    }
    case 'cap':
      return [{ pos: [0, 0, 0], dir: [0, 0, -1], size }]
  }
}

export const sizeLabel = (id: SizeId): string => `${id}"`

export function englishName(p: Part): string {
  const sz = sizeLabel(p.size)
  switch (p.kind) {
    case 'pipe':
      return `${sz} PVC Sch 40 Pipe`
    case 'reducer':
      return `${sz} x ${sizeLabel(p.size2 ?? p.size)} PVC Sch 40 Reducing Coupling`
    case 'valve':
      return `${sz} PVC Ball Valve (Slip x Slip)`
    default:
      return `${sz} PVC Sch 40 ${KINDS[p.kind].en}`
  }
}

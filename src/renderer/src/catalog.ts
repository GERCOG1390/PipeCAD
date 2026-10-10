// Справочник PVC Schedule 40. Все размеры в дюймах.
// Напорные: трубы ASTM D1785, фитинги D2466. Канализация: DWV, ASTM D2665.
// od — наружный диаметр трубы, socket/dwv — глубина раструба напорного/DWV фитинга,
// g90/g45/gCoup — от центра фитинга до дна раструба (заход, "take-off").
// Заходы примерные, у разных производителей отличаются на 1/16–1/8".

export type SizeId = '1/2' | '3/4' | '1' | '1-1/4' | '1-1/2' | '2' | '3' | '4' | '6'
export type V3 = [number, number, number]

export interface SizeSpec {
  id: SizeId
  od: number
  socket: number
  dwv: number
  g90: number
  g45: number
  gCoup: number
}

export const SIZES: SizeSpec[] = [
  { id: '1/2', od: 0.84, socket: 0.688, dwv: 0, g90: 0.5, g45: 0.19, gCoup: 0.0625 },
  { id: '3/4', od: 1.05, socket: 0.719, dwv: 0, g90: 0.59, g45: 0.25, gCoup: 0.0625 },
  { id: '1', od: 1.315, socket: 0.875, dwv: 0, g90: 0.69, g45: 0.31, gCoup: 0.0625 },
  { id: '1-1/4', od: 1.66, socket: 0.938, dwv: 0.688, g90: 0.94, g45: 0.38, gCoup: 0.0625 },
  { id: '1-1/2', od: 1.9, socket: 1.094, dwv: 0.688, g90: 1.06, g45: 0.44, gCoup: 0.0625 },
  { id: '2', od: 2.375, socket: 1.156, dwv: 0.75, g90: 1.31, g45: 0.56, gCoup: 0.0625 },
  { id: '3', od: 3.5, socket: 1.75, dwv: 1.5, g90: 1.94, g45: 0.75, gCoup: 0.094 },
  { id: '4', od: 4.5, socket: 2.0, dwv: 1.75, g90: 2.38, g45: 0.94, gCoup: 0.094 },
  { id: '6', od: 6.625, socket: 3.0, dwv: 3.0, g90: 3.5, g45: 1.4, gCoup: 0.125 }
]

export const DWV_SIZES: SizeId[] = ['1-1/4', '1-1/2', '2', '3', '4', '6']
export const CLOSET_SIZES: SizeId[] = ['3', '4']

export const sizeSpec = (id: SizeId): SizeSpec => SIZES.find((s) => s.id === id)!
export const hubRadius = (id: SizeId): number => {
  const s = sizeSpec(id)
  return s.od / 2 + Math.max(0.1, s.od * 0.07)
}
export const bodyRadius = (id: SizeId): number => {
  const s = sizeSpec(id)
  return s.od / 2 + Math.max(0.07, s.od * 0.045)
}

export type PressureKind = 'pipe' | 'elbow90' | 'elbow45' | 'tee' | 'cross' | 'coupling' | 'reducer' | 'valve' | 'cap'
export type DwvKind =
  | 'dwv90'
  | 'dwvLong90'
  | 'dwv45'
  | 'dwv22'
  | 'st90'
  | 'st45'
  | 'sanTee'
  | 'dblSanTee'
  | 'wye'
  | 'combo'
  | 'cleanout'
  | 'closet'
  | 'ptrap'
export type PartKind = PressureKind | DwvKind

export const KINDS: Record<PartKind, { ru: string; en: string; key: string }> = {
  pipe: { ru: 'Труба', en: 'Pipe', key: 'P' },
  elbow90: { ru: 'Отвод 90°', en: '90° Elbow', key: 'E' },
  elbow45: { ru: 'Отвод 45°', en: '45° Elbow', key: 'F' },
  tee: { ru: 'Тройник', en: 'Tee', key: 'T' },
  cross: { ru: 'Крестовина', en: 'Cross', key: 'X' },
  coupling: { ru: 'Муфта', en: 'Coupling', key: 'C' },
  reducer: { ru: 'Переходник', en: 'Reducing Coupling', key: 'D' },
  valve: { ru: 'Шаровый кран', en: 'Ball Valve', key: 'V' },
  cap: { ru: 'Заглушка', en: 'Cap', key: 'K' },
  dwv90: { ru: 'Колено 90°', en: '1/4 Bend', key: '' },
  dwvLong90: { ru: 'Колено 90° длинное', en: 'Long Sweep 1/4 Bend', key: '' },
  dwv45: { ru: 'Колено 45°', en: '1/8 Bend', key: '' },
  dwv22: { ru: 'Колено 22.5°', en: '1/16 Bend', key: '' },
  st90: { ru: 'Колено 90° street', en: 'Street 1/4 Bend (Spigot x Hub)', key: '' },
  st45: { ru: 'Колено 45° street', en: 'Street 1/8 Bend (Spigot x Hub)', key: '' },
  sanTee: { ru: 'Санитарный тройник', en: 'Sanitary Tee', key: '' },
  dblSanTee: { ru: 'Двойной сан. тройник', en: 'Double Sanitary Tee', key: '' },
  wye: { ru: 'Косой тройник (Wye)', en: 'Wye', key: '' },
  combo: { ru: 'Комбо (Wye + 45°)', en: 'Combination Wye & 1/8 Bend', key: '' },
  cleanout: { ru: 'Ревизия с пробкой', en: 'Cleanout Adapter w/ Plug', key: '' },
  closet: { ru: 'Фланец унитаза', en: 'Closet Flange', key: '' },
  ptrap: { ru: 'Сифон (P-trap)', en: 'P-Trap', key: '' }
}

export const KIND_ORDER: PressureKind[] = ['pipe', 'elbow90', 'elbow45', 'tee', 'cross', 'coupling', 'reducer', 'valve', 'cap']
export const DWV_ORDER: DwvKind[] = [
  'dwv90',
  'dwvLong90',
  'dwv45',
  'dwv22',
  'st90',
  'st45',
  'sanTee',
  'dblSanTee',
  'wye',
  'combo',
  'cleanout',
  'closet',
  'ptrap'
]
const DWV_SET = new Set<PartKind>(DWV_ORDER)
export const isDwv = (k: PartKind): k is DwvKind => DWV_SET.has(k)

// У этих фитингов size2 — размер бокового отвода (например, 3" x 3" x 2" сантройник)
export const BRANCH_KINDS = new Set<PartKind>(['sanTee', 'dblSanTee', 'wye', 'combo'])
export const branchPorts = (k: PartKind): number[] => (k === 'dblSanTee' ? [2, 3] : BRANCH_KINDS.has(k) ? [2] : [])

export interface Part {
  id: string
  kind: PartKind
  size: SizeId
  size2?: SizeId // второй размер у переходника / размер отвода у тройников DWV
  length?: number // длина отреза трубы
  parent?: { id: string; port: number }
  attach: number // каким своим портом деталь подключена к родителю
  roll: number // поворот вокруг оси подключения, градусы
  rot?: V3 // ориентация корневой детали (градусы по X/Y/Z)
}

export interface PortDef {
  pos: V3 // раструб: дно раструба; гладкий конец: его торец
  dir: V3 // наружу
  size: SizeId
  depth: number // глубина раструба (0 у гладкого конца)
  spigot?: boolean // гладкий конец (труба, street-фитинг) — вставляется в раструб
}

export const DEFAULT_PIPE = 24

const hub = (pos: V3, dir: V3, size: SizeId): PortDef => ({ pos, dir, size, depth: sizeSpec(size).socket })
const dwvHub = (pos: V3, dir: V3, size: SizeId): PortDef => ({ pos, dir, size, depth: sizeSpec(size).dwv })
const spigot = (pos: V3, dir: V3, size: SizeId): PortDef => ({ pos, dir, size, depth: 0, spigot: true })

export function portsOf(p: Part): PortDef[] {
  if (isDwv(p.kind)) return dwvLayout(p).ports
  const s = sizeSpec(p.size)
  const size = p.size
  const c = Math.SQRT1_2
  switch (p.kind) {
    case 'pipe':
      return [spigot([0, 0, 0], [0, 0, -1], size), spigot([0, 0, p.length ?? DEFAULT_PIPE], [0, 0, 1], size)]
    case 'elbow90':
      return [hub([0, 0, -s.g90], [0, 0, -1], size), hub([s.g90, 0, 0], [1, 0, 0], size)]
    case 'elbow45':
      return [hub([0, 0, -s.g45], [0, 0, -1], size), hub([s.g45 * c, 0, s.g45 * c], [c, 0, c], size)]
    case 'tee':
      return [hub([0, 0, -s.g90], [0, 0, -1], size), hub([0, 0, s.g90], [0, 0, 1], size), hub([s.g90, 0, 0], [1, 0, 0], size)]
    case 'cross':
      return [
        hub([0, 0, -s.g90], [0, 0, -1], size),
        hub([0, 0, s.g90], [0, 0, 1], size),
        hub([s.g90, 0, 0], [1, 0, 0], size),
        hub([-s.g90, 0, 0], [-1, 0, 0], size)
      ]
    case 'coupling':
      return [hub([0, 0, -s.gCoup], [0, 0, -1], size), hub([0, 0, s.gCoup], [0, 0, 1], size)]
    case 'reducer': {
      const s2 = sizeSpec(p.size2 ?? p.size)
      const g = Math.max(s.od, s2.od) * 0.2 + 0.15
      return [hub([0, 0, -g], [0, 0, -1], size), hub([0, 0, g], [0, 0, 1], s2.id)]
    }
    case 'valve': {
      const g = s.od * 0.9 + 0.4
      return [hub([0, 0, -g], [0, 0, -1], size), hub([0, 0, g], [0, 0, 1], size)]
    }
    case 'cap':
      return [hub([0, 0, 0], [0, 0, -1], size)]
  }
}

// ---- DWV: геометрия задаётся осевой линией (отрезки и дуги), из неё и порты, и 3D ----

export type PathSeg = { t: 'line'; a: V3; b: V3 } | { t: 'arc'; a: V3; t0: V3; n: V3; r: number; ang: number }
export interface Tube {
  segs: PathSeg[]
  r: number
}
export interface Extra {
  shape: 'disc' | 'plug'
  pos: V3 // низ
  r: number
  h: number
}
export interface Layout {
  ports: PortDef[]
  tubes: Tube[]
  extras: Extra[]
}

const mul = (v: V3, k: number): V3 => [v[0] * k, v[1] * k, v[2] * k]
const plus = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
export const arcEnd = (s: Extract<PathSeg, { t: 'arc' }>): V3 =>
  plus(s.a, plus(mul(s.t0, s.r * Math.sin(s.ang)), mul(s.n, s.r * (1 - Math.cos(s.ang)))))

const DWV_G: Partial<Record<DwvKind, [number, number, number]>> = {
  // [k·od + b, доля дуги в заходе]
  dwv90: [0.8, 0.2, 0.75],
  st90: [0.8, 0.2, 0.75],
  dwvLong90: [1.6, 0.5, 0.92],
  dwv45: [0.38, 0.2, 0.6],
  st45: [0.38, 0.2, 0.6],
  dwv22: [0.2, 0.15, 0.5]
}
const BEND_ANG: Partial<Record<DwvKind, number>> = {
  dwv90: 90,
  st90: 90,
  dwvLong90: 90,
  dwv45: 45,
  st45: 45,
  dwv22: 22.5
}

export function dwvLayout(p: Part): Layout {
  const kind = p.kind as DwvKind
  const size = p.size
  const s = sizeSpec(size)
  const od = s.od
  const br = bodyRadius(size)
  const bsize = p.size2 ?? size
  const bod = sizeSpec(bsize).od
  const bbr = bodyRadius(bsize)
  const c = Math.SQRT1_2

  const g = DWV_G[kind]
  if (g) {
    const ang = (BEND_ANG[kind]! * Math.PI) / 180
    const G = g[0] * od + g[1]
    const T = G * g[2]
    const R = T / Math.tan(ang / 2)
    const u: V3 = [Math.sin(ang), 0, Math.cos(ang)]
    const tubes: Tube[] = [
      {
        r: br,
        segs: [
          { t: 'line', a: [0, 0, -G], b: [0, 0, -T] },
          { t: 'arc', a: [0, 0, -T], t0: [0, 0, 1], n: [1, 0, 0], r: R, ang },
          { t: 'line', a: mul(u, T), b: mul(u, G) }
        ]
      }
    ]
    const street = kind === 'st90' || kind === 'st45'
    if (street) tubes.push({ r: od / 2, segs: [{ t: 'line', a: [0, 0, -G], b: [0, 0, -(G + s.dwv)] }] })
    const p0 = street ? spigot([0, 0, -(G + s.dwv)], [0, 0, -1], size) : dwvHub([0, 0, -G], [0, 0, -1], size)
    return { ports: [p0, dwvHub(mul(u, G), u, size)], tubes, extras: [] }
  }

  switch (kind) {
    case 'sanTee':
    case 'dblSanTee': {
      const G = 0.75 * od + 0.25
      const Gb = Math.max(0.75 * bod + 0.25, od / 2 + 0.6)
      const Rs = Math.min(bod * 0.55, Gb * 0.8)
      const ports = [dwvHub([0, 0, -G], [0, 0, -1], size), dwvHub([0, 0, G], [0, 0, 1], size), dwvHub([Gb, 0, 0], [1, 0, 0], bsize)]
      const tubes: Tube[] = [
        { r: br, segs: [{ t: 'line', a: [0, 0, -G], b: [0, 0, G] }] },
        {
          r: bbr,
          segs: [
            { t: 'line', a: [Gb, 0, 0], b: [Rs, 0, 0] },
            { t: 'arc', a: [Rs, 0, 0], t0: [-1, 0, 0], n: [0, 0, -1], r: Rs, ang: Math.PI / 2 }
          ]
        }
      ]
      if (kind === 'dblSanTee') {
        ports.push(dwvHub([-Gb, 0, 0], [-1, 0, 0], bsize))
        tubes.push({
          r: bbr,
          segs: [
            { t: 'line', a: [-Gb, 0, 0], b: [-Rs, 0, 0] },
            { t: 'arc', a: [-Rs, 0, 0], t0: [1, 0, 0], n: [0, 0, -1], r: Rs, ang: Math.PI / 2 }
          ]
        })
      }
      return { ports, tubes, extras: [] }
    }
    case 'wye': {
      const G0 = 0.55 * od + 0.2
      const G1 = 1.15 * od + 0.3
      const Gb = Math.max(1.15 * bod + 0.3, od * 0.9 + 0.5)
      const d: V3 = [c, 0, c]
      return {
        ports: [dwvHub([0, 0, -G0], [0, 0, -1], size), dwvHub([0, 0, G1], [0, 0, 1], size), dwvHub(mul(d, Gb), d, bsize)],
        tubes: [
          { r: br, segs: [{ t: 'line', a: [0, 0, -G0], b: [0, 0, G1] }] },
          { r: bbr, segs: [{ t: 'line', a: [0, 0, 0], b: mul(d, Gb) }] }
        ],
        extras: []
      }
    }
    case 'combo': {
      const G0 = 0.55 * od + 0.2
      const G1 = 1.15 * od + 0.3
      const d: V3 = [c, 0, c]
      const start: V3 = [0, 0, -0.2 * od]
      const a = plus(start, mul(d, 0.6 * od + 0.2))
      const arc = { t: 'arc' as const, a, t0: d, n: [c, 0, -c] as V3, r: 0.9 * bod, ang: Math.PI / 4 }
      const e = arcEnd(arc)
      const end = plus(e, [0.35 * bod + 0.2, 0, 0])
      return {
        ports: [dwvHub([0, 0, -G0], [0, 0, -1], size), dwvHub([0, 0, G1], [0, 0, 1], size), dwvHub(end, [1, 0, 0], bsize)],
        tubes: [
          { r: br, segs: [{ t: 'line', a: [0, 0, -G0], b: [0, 0, G1] }] },
          { r: bbr, segs: [{ t: 'line', a: start, b: a }, arc, { t: 'line', a: e, b: end }] }
        ],
        extras: []
      }
    }
    case 'cleanout': {
      const h = 0.5 * od + 0.3
      return {
        ports: [dwvHub([0, 0, 0], [0, 0, -1], size)],
        tubes: [{ r: hubRadius(size), segs: [{ t: 'line', a: [0, 0, 0], b: [0, 0, h] }] }],
        extras: [{ shape: 'plug', pos: [0, 0, h], r: od * 0.22, h: 0.3 * od }]
      }
    }
    case 'closet':
      return {
        ports: [dwvHub([0, 0, 0], [0, 0, -1], size)],
        tubes: [],
        extras: [{ shape: 'disc', pos: [0, 0, 0], r: Math.max(3.5, od * 0.85), h: 0.3 }]
      }
    case 'ptrap': {
      // порт 0 — выход (в стену, на trap arm), порт 1 — вход сверху (от раковины)
      const R = 0.7 * od
      const Tb = 0.6 * od
      const Hr = 0.9 * od
      const H = 1.6 * od
      const outX = 2 * R + Tb + 0.4 * od
      return {
        ports: [dwvHub([outX, Hr, 0], [1, 0, 0], size), dwvHub([0, H, 0], [0, 1, 0], size)],
        tubes: [
          {
            r: br,
            segs: [
              { t: 'line', a: [outX, Hr, 0], b: [2 * R + Tb, Hr, 0] },
              { t: 'arc', a: [2 * R + Tb, Hr, 0], t0: [-1, 0, 0], n: [0, -1, 0], r: Tb, ang: Math.PI / 2 },
              { t: 'line', a: [2 * R, Hr - Tb, 0], b: [2 * R, 0, 0] },
              { t: 'arc', a: [2 * R, 0, 0], t0: [0, -1, 0], n: [-1, 0, 0], r: R, ang: Math.PI },
              { t: 'line', a: [0, 0, 0], b: [0, H, 0] }
            ]
          }
        ],
        extras: []
      }
    }
  }
  throw new Error(`unknown DWV kind ${kind}`)
}

export const sizeLabel = (id: SizeId): string => `${id}"`

export function englishName(p: Part): string {
  const sz = sizeLabel(p.size)
  if (BRANCH_KINDS.has(p.kind) && p.size2 && p.size2 !== p.size) {
    const b = sizeLabel(p.size2)
    const dims = p.kind === 'dblSanTee' ? `${sz} x ${sz} x ${b} x ${b}` : `${sz} x ${sz} x ${b}`
    return `${dims} PVC DWV ${KINDS[p.kind].en}`
  }
  if (isDwv(p.kind)) return `${sz} PVC DWV ${KINDS[p.kind].en}`
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

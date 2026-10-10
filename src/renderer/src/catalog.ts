// Справочник PVC Schedule 40. Все размеры в дюймах.
// Напорные: трубы ASTM D1785, фитинги D2466. Канализация: DWV, ASTM D2665, размеры Charlotte Pipe.
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

// Размеры Charlotte Pipe PVC DWV (каталог DC-DWV609). Все расстояния — до дна раструба.
// bend90/long90/b45/b22: A — от центра до дна раструба.
// st90/st45: [A — сторона раструба, B — от центра до торца гладкого конца].
// san/dbl: [A — от оси ствола до дна бокового раструба = от оси отвода до дна нижнего, B — между доньями верхнего и нижнего].
// wye: [A — между доньями верх/низ, B — от пересечения осей до дна нижнего, C — от пересечения по оси отвода].
// combo: [A — от оси ствола до дна отвода, B — между доньями верх/низ, C — высота оси отвода над дном нижнего].
// trap: [A — от оси входа до дна выхода, B — высота оси выхода над низом колена, C — высота дна входа над низом колена].
// wall — толщина стенки раструба (Hub dimensions, D).
type DwvSizeId = '1-1/4' | '1-1/2' | '2' | '3' | '4' | '6'
interface ChRow {
  bend90: number
  st90: [number, number]
  long90?: number
  b45: number
  st45: [number, number]
  b22?: number
  san: [number, number]
  dbl?: [number, number]
  wye: [number, number, number]
  combo?: [number, number, number]
  trap?: [number, number, number]
  wall: number
}
export const CHARLOTTE: Record<DwvSizeId, ChRow> = {
  '1-1/4': {
    bend90: 1.5625,
    st90: [1.625, 2.3125],
    b45: 1,
    st45: [1, 1.75],
    san: [1.5625, 2.3125],
    wye: [3.625, 1.0625, 2.5625],
    wall: 0.156
  },
  '1-1/2': {
    bend90: 1.75,
    st90: [1.75, 2.5],
    long90: 2.75,
    b45: 1.125,
    st45: [1.125, 1.875],
    b22: 0.5,
    san: [1.75, 2.75],
    dbl: [1.75, 2.75],
    wye: [4, 1.125, 2.875],
    combo: [3.9375, 3.5, 3.9375],
    trap: [4.625, 3.859, 1.484],
    wall: 0.156
  },
  '2': {
    bend90: 2.3125,
    st90: [2.3125, 3.1875],
    long90: 3.25,
    b45: 1.5,
    st45: [1.5, 2.1875],
    b22: 0.6875,
    san: [2.3125, 3.6875],
    dbl: [2.3125, 3.6875],
    wye: [5, 1.375, 3.625],
    combo: [5.125, 4.4375, 5.125],
    trap: [6.594, 4.75, 2.25],
    wall: 0.156
  },
  '3': {
    bend90: 3.0625,
    st90: [3.0625, 4.5625],
    long90: 4.0625,
    b45: 1.75,
    st45: [1.75, 3.25],
    b22: 0.8125,
    san: [3.0625, 4.875],
    dbl: [3.0625, 4.875],
    wye: [6.625, 1.625, 5],
    combo: [7.5625, 6.5, 7.5625],
    trap: [8.9375, 6.844, 3.0625],
    wall: 0.218
  },
  '4': {
    bend90: 3.875,
    st90: [3.875, 5.625],
    long90: 4.9375,
    b45: 2.1875,
    st45: [2.1875, 3.9375],
    b22: 1,
    san: [3.875, 6.125],
    dbl: [3.875, 6.125],
    wye: [8.25, 1.875, 6.375],
    combo: [10, 8.5, 10],
    trap: [11.203, 8.1875, 3.6875],
    wall: 0.25
  },
  '6': {
    bend90: 5,
    st90: [5.1875, 8.125],
    long90: 9,
    b45: 2.0625,
    st45: [2.0625, 5.078],
    b22: 1.5,
    san: [5, 8.5],
    wye: [10.1875, 1.75, 8.4375],
    trap: [18.53, 12.9375, 5.4375],
    wall: 0.281
  }
}

const ch = (size: SizeId): ChRow | undefined => CHARLOTTE[size as DwvSizeId]

// Выпускает ли Charlotte такой фитинг в этом размере
export function dwvAvailable(kind: DwvKind, size: SizeId): boolean {
  const r = ch(size)
  if (!r) return false
  switch (kind) {
    case 'dwvLong90':
      return !!r.long90
    case 'dwv22':
      return !!r.b22
    case 'dblSanTee':
      return !!r.dbl
    case 'combo':
      return !!r.combo
    case 'ptrap':
      return !!r.trap
    case 'closet':
      return CLOSET_SIZES.includes(size)
    default:
      return true
  }
}

export const dwvHubRadius = (size: SizeId): number => sizeSpec(size).od / 2 + (ch(size)?.wall ?? 0.15) + 0.02

function bend(size: SizeId, angDeg: number, G: number, f: number, streetB?: number): Layout {
  const s = sizeSpec(size)
  const ang = (angDeg * Math.PI) / 180
  const T = G * f
  const R = T / Math.tan(ang / 2)
  const u: V3 = [Math.sin(ang), 0, Math.cos(ang)]
  const tubes: Tube[] = [
    {
      r: bodyRadius(size),
      segs: [
        { t: 'line', a: [0, 0, -G], b: [0, 0, -T] },
        { t: 'arc', a: [0, 0, -T], t0: [0, 0, 1], n: [1, 0, 0], r: R, ang },
        { t: 'line', a: mul(u, T), b: mul(u, G) }
      ]
    }
  ]
  let p0 = dwvHub([0, 0, -G], [0, 0, -1], size)
  if (streetB !== undefined) {
    // У street-колена сторона гладкого конца: от центра до торца B
    tubes[0].segs[0] = { t: 'line', a: [0, 0, -Math.max(G, streetB - s.dwv)], b: [0, 0, -T] }
    tubes.push({ r: s.od / 2, segs: [{ t: 'line', a: [0, 0, -Math.max(G, streetB - s.dwv)], b: [0, 0, -streetB] }] })
    p0 = spigot([0, 0, -streetB], [0, 0, -1], size)
  }
  return { ports: [p0, dwvHub(mul(u, G), u, size)], tubes, extras: [] }
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
  const r = ch(size) ?? CHARLOTTE['2']

  switch (kind) {
    case 'dwv90':
      return bend(size, 90, r.bend90, 0.75)
    case 'st90':
      return bend(size, 90, r.st90[0], 0.75, r.st90[1])
    case 'dwvLong90':
      return bend(size, 90, r.long90 ?? r.bend90 * 1.5, 0.92)
    case 'dwv45':
      return bend(size, 45, r.b45, 0.6)
    case 'st45':
      return bend(size, 45, r.st45[0], 0.6, r.st45[1])
    case 'dwv22':
      return bend(size, 22.5, r.b22 ?? r.b45 * 0.45, 0.5)
    case 'sanTee':
    case 'dblSanTee': {
      const [A, B] = (kind === 'dblSanTee' ? r.dbl : undefined) ?? r.san
      const Rs = Math.min(bod * 0.55, A * 0.8)
      const ports = [dwvHub([0, 0, -A], [0, 0, -1], size), dwvHub([0, 0, B - A], [0, 0, 1], size), dwvHub([A, 0, 0], [1, 0, 0], bsize)]
      const tubes: Tube[] = [
        { r: br, segs: [{ t: 'line', a: [0, 0, -A], b: [0, 0, B - A] }] },
        {
          r: bbr,
          segs: [
            { t: 'line', a: [A, 0, 0], b: [Rs, 0, 0] },
            { t: 'arc', a: [Rs, 0, 0], t0: [-1, 0, 0], n: [0, 0, -1], r: Rs, ang: Math.PI / 2 }
          ]
        }
      ]
      if (kind === 'dblSanTee') {
        ports.push(dwvHub([-A, 0, 0], [-1, 0, 0], bsize))
        tubes.push({
          r: bbr,
          segs: [
            { t: 'line', a: [-A, 0, 0], b: [-Rs, 0, 0] },
            { t: 'arc', a: [-Rs, 0, 0], t0: [1, 0, 0], n: [0, 0, -1], r: Rs, ang: Math.PI / 2 }
          ]
        })
      }
      return { ports, tubes, extras: [] }
    }
    case 'wye': {
      const [A, B, C] = r.wye
      const d: V3 = [c, 0, c]
      return {
        ports: [dwvHub([0, 0, -B], [0, 0, -1], size), dwvHub([0, 0, A - B], [0, 0, 1], size), dwvHub(mul(d, C), d, bsize)],
        tubes: [
          { r: br, segs: [{ t: 'line', a: [0, 0, -B], b: [0, 0, A - B] }] },
          { r: bbr, segs: [{ t: 'line', a: [0, 0, 0], b: mul(d, C) }] }
        ],
        extras: []
      }
    }
    case 'combo': {
      // начало координат — на оси ствола на высоте оси отвода
      const [A, B, C] = r.combo ?? [CHARLOTTE['2'].combo![0] * (od / 2.375), 0, 0]
      const d: V3 = [c, 0, c]
      const n: V3 = [c, 0, -c]
      const R = 0.45 * A
      const L2 = 0.15 * A
      const e: V3 = [A - L2, 0, 0]
      const pa = plus(e, mul(plus(mul(d, R * Math.sin(Math.PI / 4)), mul(n, R * (1 - Math.cos(Math.PI / 4)))), -1))
      const L = pa[0] / c
      const start: V3 = [0, 0, Math.max(-C + 0.2, pa[2] - L * c)]
      const arc = { t: 'arc' as const, a: pa, t0: d, n, r: R, ang: Math.PI / 4 }
      return {
        ports: [dwvHub([0, 0, -C], [0, 0, -1], size), dwvHub([0, 0, B - C], [0, 0, 1], size), dwvHub([A, 0, 0], [1, 0, 0], bsize)],
        tubes: [
          { r: br, segs: [{ t: 'line', a: [0, 0, -C], b: [0, 0, B - C] }] },
          { r: bbr, segs: [{ t: 'line', a: start, b: pa }, arc, { t: 'line', a: e, b: [A, 0, 0] }] }
        ],
        extras: []
      }
    }
    case 'cleanout': {
      const h = 0.5 * od + 0.3
      return {
        ports: [dwvHub([0, 0, 0], [0, 0, -1], size)],
        tubes: [{ r: dwvHubRadius(size), segs: [{ t: 'line', a: [0, 0, 0], b: [0, 0, h] }] }],
        extras: [{ shape: 'plug', pos: [0, 0, h], r: od * 0.22, h: 0.3 * od }]
      }
    }
    case 'closet':
      // Charlotte 800: фланец Ø7", толщина 7/16"
      return {
        ports: [dwvHub([0, 0, 0], [0, 0, -1], size)],
        tubes: [],
        extras: [{ shape: 'disc', pos: [0, 0, 0], r: 3.5, h: 0.4375 }]
      }
    case 'ptrap': {
      // порт 0 — выход (в стену, на trap arm), порт 1 — вход сверху (от раковины).
      // Начало координат — на оси входа, на уровне низа колена.
      const [A, B, C] = r.trap ?? CHARLOTTE['1-1/2'].trap!
      const R = Math.min(0.9 * C, 0.27 * A)
      const Tb = Math.min(B - R - 0.1, A - 2 * R - 0.2) * 0.8
      return {
        ports: [dwvHub([A, B, 0], [1, 0, 0], size), dwvHub([0, C, 0], [0, 1, 0], size)],
        tubes: [
          {
            r: br,
            segs: [
              { t: 'line', a: [A, B, 0], b: [2 * R + Tb, B, 0] },
              { t: 'arc', a: [2 * R + Tb, B, 0], t0: [-1, 0, 0], n: [0, -1, 0], r: Tb, ang: Math.PI / 2 },
              { t: 'line', a: [2 * R, B - Tb, 0], b: [2 * R, R, 0] },
              { t: 'arc', a: [2 * R, R, 0], t0: [0, -1, 0], n: [-1, 0, 0], r: R, ang: Math.PI },
              { t: 'line', a: [0, R, 0], b: [0, C, 0] }
            ]
          }
        ],
        extras: []
      }
    }
  }
}

export const sizeLabel = (id: SizeId): string => `${id}"`

export function englishName(p: Part): string {
  const sz = sizeLabel(p.size)
  if (BRANCH_KINDS.has(p.kind) && p.size2 && p.size2 !== p.size) {
    const b = sizeLabel(p.size2)
    const dims = p.kind === 'dblSanTee' ? `${sz} x ${sz} x ${b} x ${b}` : `${sz} x ${sz} x ${b}`
    return `${dims} PVC DWV ${KINDS[p.kind].en}`
  }
  if (p.kind === 'closet') return `4" x ${sz} PVC DWV Closet Flange`
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

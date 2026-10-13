// Общие типы и строительные блоки для деталей: порты, профили, формы.
import * as DW from '../data/charlotteDwv'
import * as PR from '../data/charlottePressure'
import * as NB from '../data/nibcoCopper'
import * as MV from '../data/muellerValves'
import * as NHD from '../data/noHub'
import * as WH from '../data/waterHeaters'
import { ALL_SIZES, CU_SIZES, DWV_SIZES, SIZES, SizeId, n, pressureHubWall, sizeIndex, sizeLabel, sizeMatLabel, sizeSpec, threadSize } from '../data/sizes'

export type V3 = [number, number, number]
export type PortKind = 'hub' | 'spigot' | 'fpt' | 'mpt' | 'slip' | 'seat' | 'lid'
export type Fam = 'p' | 'd'

export interface PortDef {
  pos: V3 // раструб/FPT: дно; spigot/MPT: торец
  dir: V3 // наружу
  size: SizeId
  kind: PortKind
  depth: number // глубина раструба или резьбы (0 у spigot/MPT)
  fam: Fam
  face?: number // длина раструба от дна до торца (по умолчанию depth + чуть-чуть)
  stub?: number // длина видимого гладкого/резьбового конца
  R?: number // наружный радиус раструба
  bare?: boolean // форму для порта рисует сам фитинг
  mech?: boolean // механическое соединение (no-hub хомут), не клей и не пайка
  preferCu?: boolean // к этому концу обычно подключают медь (вода у бойлера)
}

export type PathSeg = { t: 'line'; a: V3; b: V3 } | { t: 'arc'; a: V3; t0: V3; n: V3; r: number; ang: number }
export type Shape =
  | { t: 'tube'; segs: PathSeg[]; r: number; color?: string; metal?: boolean }
  | { t: 'lathe'; at: V3; dir: V3; prof: [number, number][]; color?: string; metal?: boolean; seg?: number; phi?: [number, number]; flat?: boolean }
  // коробка со скруглёнными рёбрами; yaw — поворот вокруг оси dir, градусы
  | { t: 'rbox'; at: V3; dir: V3; size: V3; r: number; yaw?: number; color?: string; metal?: boolean }
  // гайка с фасками: r — до грани (под ключ/2), h — высота, ch — фаска
  | { t: 'nut'; at: V3; dir: V3; sides: number; r: number; h: number; ch?: number; color?: string; metal?: boolean }
  // протяжка скруглённого прямоугольного сечения w×th вдоль кривой; side — направление ширины
  | { t: 'sweep'; path: V3[]; w: number; th: number; rad?: number; side: V3; color?: string; metal?: boolean }
  | { t: 'prism'; at: V3; dir: V3; sides: number; r: number; h: number; color?: string }
  | { t: 'knurl'; at: V3; dir: V3; r: number; h: number; ribs: number; color?: string }
  | { t: 'box'; at: V3; dir: V3; size: V3; color?: string; metal?: boolean }
  | { t: 'pipe'; size: SizeId; len: number }

export interface Built {
  ports: PortDef[]
  shapes: Shape[]
}

export interface Part {
  id: string
  kind: string
  size: SizeId
  size2?: SizeId
  length?: number
  parent?: { id: string; port: number }
  attach: number
  roll: number
  rot?: V3
  pos?: V3 // положение корневой детали (вся система труб)
  tie?: { port: number; to: { id: string; port: number } } // соединение этого конца с концом другой ветки
  slope?: number // уклон трубы, дюймов на фут: + вверх, − вниз от начала трубы (конца подключения)
}

export type Group = 'common' | 'pressure' | 'dwv' | 'copper' | 'nohub' | 'gas' | 'heater' | 'pump'
export interface FittingDef {
  ru: string
  en: string
  group: Group
  cat: string
  icon: string
  key?: string
  pn?: string // номер детали Charlotte
  sizes: SizeId[]
  size2?: { label: string; options: (s: SizeId) => SizeId[]; optional?: boolean; reversible?: boolean }
  build: (p: Part) => Built
  // установка отдельной веткой: поворот (градусы, порядок YXZ) и «верх вровень с поверхностью» (локальная Z верхней плоскости)
  place?: { rot: V3; flushTop?: (p: Part) => number; height?: number; always?: boolean }
  bom?: (p: Part) => { name: string; pn?: string }[]
}

// ---------- векторы ----------
export const add = (a: V3, b: V3, k = 1): V3 => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k]
export const mul = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k]
export const C = Math.SQRT1_2
export const Z: V3 = [0, 0, 1]
export const NZ: V3 = [0, 0, -1]
export const X: V3 = [1, 0, 0]
export const NX: V3 = [-1, 0, 0]
export const Y: V3 = [0, 1, 0]
export const O: V3 = [0, 0, 0]
export const arcEnd = (s: Extract<PathSeg, { t: 'arc' }>): V3 =>
  add(add(s.a, s.t0, s.r * Math.sin(s.ang)), s.n, s.r * (1 - Math.cos(s.ang)))

// ---------- размеры ----------
export const sp = sizeSpec
// у медного фитинга раструб тонкий, корпус того же диаметра, что раструб
export const cuWall = (s: SizeId): number => Math.max(0.035, sp(s).wall * 1.1)
export const hubWall = (s: SizeId, fam: Fam): number => (sp(s).mat === 'cu' ? cuWall(s) : fam === 'd' && sp(s).dwvWall ? sp(s).dwvWall : pressureHubWall(s))
export const hubR = (s: SizeId, fam: Fam): number => sp(s).od / 2 + hubWall(s, fam)
export const bodyR = (s: SizeId, fam: Fam): number => sp(s).od / 2 + hubWall(s, fam) * (sp(s).mat === 'cu' ? 1 : 0.45)
export const sockDepth = (s: SizeId, fam: Fam): number => (fam === 'd' ? sp(s).dwv : sp(s).socket)
// длина резьбы NPT (приблизительно L2 по ASME B1.20.1)
export const NPT_T: Partial<Record<SizeId, number>> = { '1/2': 0.53, '3/4': 0.55, '1': 0.68, '1-1/4': 0.71, '1-1/2': 0.72, '2': 0.76, '2-1/2': 1.14, '3': 1.2, '4': 1.3, '6': 1.4 }
// длина резьбы по номиналу (у медных — по резьбовому номиналу)
export const NPT = new Proxy(NPT_T as Record<SizeId, number>, { get: (t, k: string) => t[k as SizeId] ?? t[threadSize(k as SizeId)] ?? 0.55 })

// ---------- порты ----------
export const hub = (pos: V3, dir: V3, size: SizeId, fam: Fam, o: Partial<PortDef> = {}): PortDef => ({ pos, dir, size, kind: 'hub', depth: sockDepth(size, fam), fam, ...o })
export const fpt = (pos: V3, dir: V3, size: SizeId, fam: Fam, depth = NPT[size], o: Partial<PortDef> = {}): PortDef => ({ pos, dir, size, kind: 'fpt', depth, fam, ...o })
export const spig = (pos: V3, dir: V3, size: SizeId, fam: Fam, stub: number, o: Partial<PortDef> = {}): PortDef => ({ pos, dir, size, kind: 'spigot', depth: 0, fam, stub, ...o })
export const mpt = (pos: V3, dir: V3, size: SizeId, fam: Fam, stub = NPT[size], o: Partial<PortDef> = {}): PortDef => ({ pos, dir, size, kind: 'mpt', depth: 0, fam, stub, ...o })

export const mates = (a: PortKind, b: PortKind): boolean =>
  (a === 'hub' && b === 'spigot') || (a === 'spigot' && b === 'hub') || (a === 'fpt' && b === 'mpt') || (a === 'mpt' && b === 'fpt') || (a === 'seat' && b === 'seat') || (a === 'lid' && b === 'lid')

// ---------- профили (r, z): z — вдоль оси порта наружу, 0 — дно раструба / торец ----------
export const pitchOf = (s: SizeId): number => 1 / sp(s).tpi

export function sawtooth(r0: number, r1: number, z0: number, z1: number, pitch: number): [number, number][] {
  const out: [number, number][] = []
  const steps = Math.max(2, Math.round(Math.abs(z1 - z0) / (pitch / 2)))
  for (let i = 0; i <= steps; i++) out.push([i % 2 ? r1 : r0, z0 + ((z1 - z0) * i) / steps])
  return out
}

export function hubProfile(p: PortDef): [number, number][] {
  const s = sp(p.size)
  const o = s.od / 2
  const ri = o - s.wall
  const R = p.R ?? hubR(p.size, p.fam)
  const br = bodyR(p.size, p.fam)
  const face = p.face ?? p.depth + 0.04 + s.od * 0.01
  const c = 0.02 + s.od * 0.012
  const lip = 0.01 + s.od * 0.007
  const tap = 0.08 + s.od * 0.06
  if (s.mat === 'cu' && p.kind === 'hub') {
    // медный раструб: гладкий, с лёгким раструбом на входе, без бурта
    const fl = 0.012 + s.od * 0.006
    return [[ri, -tap - 0.05], [ri, 0], [o, 0], [o, face - c], [o + fl, face], [R + fl * 0.6, face], [R + fl, face - c], [R, face - c * 3], [R, -tap - 0.05]]
  }
  const inner: [number, number][] =
    p.kind === 'fpt' ? sawtooth(o, o - 0.6 * pitchOf(p.size), 0, face - c, pitchOf(p.size)) : [[o, 0], [o, face - c]]
  return [
    [ri, -tap - 0.05],
    [ri, 0],
    ...inner,
    [o + c, face],
    [R + lip - c * 0.6, face],
    [R + lip, face - c * 0.6],
    [R + lip, face - 0.05 - s.od * 0.02],
    [R, face - 0.08 - s.od * 0.03],
    [R, 0],
    [br, -tap],
    [br, -tap - 0.05]
  ]
}

export function stubProfile(p: PortDef): [number, number][] {
  const s = sp(p.size)
  const o = s.od / 2
  const ri = o - s.wall
  const L = p.stub ?? s.dwv
  const c = 0.02 + s.od * 0.01
  if (p.kind === 'mpt') {
    const h = 0.6 * pitchOf(p.size)
    return [[ri, -L - 0.05], [ri, 0], [o - h - c, 0], ...sawtooth(o - h, o, -c, -L, pitchOf(p.size)), [o, -L - 0.05]]
  }
  return [[ri, -L - 0.05], [ri, 0], [o - c, 0], [o, -c], [o, -L - 0.05]]
}

// Формы для портов, которые фитинг не нарисовал сам
export function finalize(b: Built): Built {
  const shapes = [...b.shapes]
  for (const p of b.ports) {
    if (p.bare || p.kind === 'slip') continue
    const prof = p.kind === 'hub' || p.kind === 'fpt' ? hubProfile(p) : stubProfile(p)
    shapes.push({ t: 'lathe', at: p.pos, dir: p.dir, prof })
  }
  return { ports: b.ports, shapes }
}

// ---------- строительные блоки ----------
export const line = (a: V3, b: V3): PathSeg => ({ t: 'line', a, b })

// Отвод: вход по -Z, выход под углом ang; e0/e1 — расстояние от центра до конца тела
export function bendPath(ang: number, e0: number, e1: number, f: number): PathSeg[] {
  const T = Math.min(e0, e1) * f
  const R = T / Math.tan(ang / 2)
  const u: V3 = [Math.sin(ang), 0, Math.cos(ang)]
  return [line([0, 0, -e0], [0, 0, -T]), { t: 'arc', a: [0, 0, -T], t0: Z, n: X, r: R, ang }, line(mul(u, T), mul(u, e1))]
}
export const outDir = (ang: number): V3 => [Math.sin(ang), 0, Math.cos(ang)]

// Санитарный (плавный) вход отвода: с +X дугой вниз в ствол
export function sweepIn(sideDir: V3, A: number, r: number): PathSeg[] {
  const rs = Math.min(r, A * 0.8)
  const start = mul(sideDir, A)
  const a = mul(sideDir, rs)
  return [line(start, a), { t: 'arc', a, t0: mul(sideDir, -1), n: NZ, r: rs, ang: Math.PI / 2 }]
}

// Комбо: от ствола по 45°, затем дуга 45° в горизонталь к (A,0,0); side = ±1
export function comboBranch(A: number, C0: number, side: 1 | -1): { segs: PathSeg[] } {
  const d: V3 = [C * side, 0, C]
  const nn: V3 = [C * side, 0, -C]
  const R = 0.45 * A
  const L2 = 0.15 * A
  const e: V3 = [(A - L2) * side, 0, 0]
  const pa = add(e, add(mul(d, R * Math.sin(Math.PI / 4)), mul(nn, R * (1 - Math.cos(Math.PI / 4)))), -1)
  const L = Math.abs(pa[0]) / C
  const start: V3 = [0, 0, Math.max(-C0 + 0.2, pa[2] - L * C)]
  return { segs: [line(start, pa), { t: 'arc', a: pa, t0: d, n: nn, r: R, ang: Math.PI / 4 }, line(e, [A * side, 0, 0])] }
}

// Колено-сифон: выход (A,B) по +X, вход (0,C) по +Y; низ колена на y=0
export function trapPath(A: number, B: number, Cc: number, bodyTo = 0): PathSeg[] {
  const R = Math.min(0.9 * Cc, 0.27 * A)
  const Tb = Math.min(B - R - 0.1, A - 2 * R - 0.2) * 0.8
  return [
    line([A - bodyTo, B, 0], [2 * R + Tb, B, 0]),
    { t: 'arc', a: [2 * R + Tb, B, 0], t0: NX, n: [0, -1, 0], r: Tb, ang: Math.PI / 2 },
    line([2 * R, B - Tb, 0], [2 * R, R, 0]),
    { t: 'arc', a: [2 * R, R, 0], t0: [0, -1, 0], n: NX, r: R, ang: Math.PI },
    line([0, R, 0], [0, Cc, 0])
  ]
}

export const tube = (r: number, ...segs: PathSeg[]): Shape => ({ t: 'tube', r, segs })
export const lathe = (at: V3, dir: V3, prof: [number, number][], o: { color?: string; metal?: boolean; seg?: number; phi?: [number, number]; flat?: boolean } = {}): Shape => ({ t: 'lathe', at, dir, prof, ...o })

// Скругляет углы профиля (r, z): каждый внутренний угол заменяется дугой радиуса rad
export function rounded(prof: [number, number][], rad: number, k = 6): [number, number][] {
  const out: [number, number][] = [prof[0]]
  for (let i = 1; i < prof.length - 1; i++) {
    const [p0, p1, p2] = [prof[i - 1], prof[i], prof[i + 1]]
    const a = [p0[0] - p1[0], p0[1] - p1[1]]
    const b = [p2[0] - p1[0], p2[1] - p1[1]]
    const la = Math.hypot(a[0], a[1])
    const lb = Math.hypot(b[0], b[1])
    const t = Math.min(rad, la * 0.45, lb * 0.45)
    if (t < 1e-4) {
      out.push(p1)
      continue
    }
    const s: [number, number] = [p1[0] + (a[0] / la) * t, p1[1] + (a[1] / la) * t]
    const e: [number, number] = [p1[0] + (b[0] / lb) * t, p1[1] + (b[1] / lb) * t]
    // квадратичная Безье через угол — плавная дуга
    for (let j = 0; j <= k; j++) {
      const u = j / k
      out.push([(1 - u) * (1 - u) * s[0] + 2 * u * (1 - u) * p1[0] + u * u * e[0], (1 - u) * (1 - u) * s[1] + 2 * u * (1 - u) * p1[1] + u * u * e[1]])
    }
  }
  out.push(prof[prof.length - 1])
  return out
}

// Колпак-купол (заглушка) поверх раструба: от z0 до z1 по оси dir
export function domeProfile(R: number, z0: number, z1: number, o: number, inner = true): [number, number][] {
  const h = z1 - z0
  const pts: [number, number][] = []
  if (inner) pts.push([o, z0])
  pts.push([R, z0])
  const flat = h * 0.55
  pts.push([R, z0 + flat])
  for (let i = 1; i <= 8; i++) {
    const a = (i / 8) * (Math.PI / 2)
    pts.push([R * Math.cos(a) * 0.98 + 0.02 * R, z0 + flat + (h - flat) * Math.sin(a)])
  }
  pts.push([0.001, z1])
  return pts
}

// ---------- перечни размеров ----------
export const keysOf = (t: object): SizeId[] => ALL_SIZES.filter((s) => s in t)
export const pairOpts = (m: Map<string, unknown>, main: SizeId, side: 'a' | 'b' = 'a'): SizeId[] =>
  [...m.keys()].map((k) => k.split('|') as [SizeId, SizeId]).filter((p) => (side === 'a' ? p[0] : p[1]) === main).map((p) => (side === 'a' ? p[1] : p[0]))
export const incrPartners = (s: SizeId): SizeId[] => [...pairOpts(DW.D_INCREASER, s, 'a'), ...pairOpts(DW.D_INCREASER, s, 'b')]
export const smaller = (s: SizeId, pool: SizeId[]): SizeId[] => pool.filter((x) => sizeIndex(x) < sizeIndex(s))
// bullhead: ключи таблицы "ствол|отвод"; в каталоге деталь живёт под размером отвода
export const bullBranches = (m: Map<string, unknown>): SizeId[] => ALL_SIZES.filter((s) => [...m.keys()].some((k) => k.split('|')[1] === s))
export const bullRuns = (m: Map<string, unknown>, branch: SizeId): SizeId[] => [...m.keys()].map((k) => k.split('|') as [SizeId, SizeId]).filter((x) => x[1] === branch).map((x) => x[0])
export const cuKeys = (t: object): SizeId[] => CU_SIZES.filter((s) => s in t)
export const cuRedPartners = (s: SizeId): SizeId[] => [...pairOpts(NB.CU_REDUCER, s, 'a'), ...pairOpts(NB.CU_REDUCER, s, 'b')]
export const BRASS = '#c9a64a'
export const RUBBER = '#1d1e20'
export const STEEL = '#c6cacf'
// Реестр фитингов: для каждого вида — порты (куда и чем подключается) и 3D-формы.
// Размеры берутся из каталогов Charlotte Pipe (data/charlotte*.ts).
import * as DW from './data/charlotteDwv'
import * as PR from './data/charlottePressure'
import * as NB from './data/nibcoCopper'
import { ALL_SIZES, CU_SIZES, DWV_SIZES, SizeId, n, pressureHubWall, sizeIndex, sizeLabel, sizeSpec, threadSize } from './data/sizes'

export type V3 = [number, number, number]
export type PortKind = 'hub' | 'spigot' | 'fpt' | 'mpt' | 'slip'
type Fam = 'p' | 'd'

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
}

export type PathSeg = { t: 'line'; a: V3; b: V3 } | { t: 'arc'; a: V3; t0: V3; n: V3; r: number; ang: number }
export type Shape =
  | { t: 'tube'; segs: PathSeg[]; r: number }
  | { t: 'lathe'; at: V3; dir: V3; prof: [number, number][]; color?: string; metal?: boolean }
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
}

export type Group = 'common' | 'pressure' | 'dwv' | 'copper'
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
  place?: { rot: V3; flushTop?: (p: Part) => number }
  bom?: (p: Part) => { name: string; pn?: string }[]
}

// ---------- векторы ----------
const add = (a: V3, b: V3, k = 1): V3 => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k]
const mul = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k]
const C = Math.SQRT1_2
const Z: V3 = [0, 0, 1]
const NZ: V3 = [0, 0, -1]
const X: V3 = [1, 0, 0]
const NX: V3 = [-1, 0, 0]
const Y: V3 = [0, 1, 0]
const O: V3 = [0, 0, 0]
export const arcEnd = (s: Extract<PathSeg, { t: 'arc' }>): V3 =>
  add(add(s.a, s.t0, s.r * Math.sin(s.ang)), s.n, s.r * (1 - Math.cos(s.ang)))

// ---------- размеры ----------
const sp = sizeSpec
// у медного фитинга раструб тонкий, корпус того же диаметра, что раструб
const cuWall = (s: SizeId): number => Math.max(0.035, sp(s).wall * 1.1)
export const hubWall = (s: SizeId, fam: Fam): number => (sp(s).mat === 'cu' ? cuWall(s) : fam === 'd' && sp(s).dwvWall ? sp(s).dwvWall : pressureHubWall(s))
export const hubR = (s: SizeId, fam: Fam): number => sp(s).od / 2 + hubWall(s, fam)
export const bodyR = (s: SizeId, fam: Fam): number => sp(s).od / 2 + hubWall(s, fam) * (sp(s).mat === 'cu' ? 1 : 0.45)
const sockDepth = (s: SizeId, fam: Fam): number => (fam === 'd' ? sp(s).dwv : sp(s).socket)
// длина резьбы NPT (приблизительно L2 по ASME B1.20.1)
const NPT_T: Partial<Record<SizeId, number>> = { '1/2': 0.53, '3/4': 0.55, '1': 0.68, '1-1/4': 0.71, '1-1/2': 0.72, '2': 0.76, '2-1/2': 1.14, '3': 1.2, '4': 1.3, '6': 1.4 }
// длина резьбы по номиналу (у медных — по резьбовому номиналу)
const NPT = new Proxy(NPT_T as Record<SizeId, number>, { get: (t, k: string) => t[k as SizeId] ?? t[threadSize(k as SizeId)] ?? 0.55 })

// ---------- порты ----------
const hub = (pos: V3, dir: V3, size: SizeId, fam: Fam, o: Partial<PortDef> = {}): PortDef => ({ pos, dir, size, kind: 'hub', depth: sockDepth(size, fam), fam, ...o })
const fpt = (pos: V3, dir: V3, size: SizeId, fam: Fam, depth = NPT[size], o: Partial<PortDef> = {}): PortDef => ({ pos, dir, size, kind: 'fpt', depth, fam, ...o })
const spig = (pos: V3, dir: V3, size: SizeId, fam: Fam, stub: number, o: Partial<PortDef> = {}): PortDef => ({ pos, dir, size, kind: 'spigot', depth: 0, fam, stub, ...o })
const mpt = (pos: V3, dir: V3, size: SizeId, fam: Fam, stub = NPT[size], o: Partial<PortDef> = {}): PortDef => ({ pos, dir, size, kind: 'mpt', depth: 0, fam, stub, ...o })

export const mates = (a: PortKind, b: PortKind): boolean =>
  (a === 'hub' && b === 'spigot') || (a === 'spigot' && b === 'hub') || (a === 'fpt' && b === 'mpt') || (a === 'mpt' && b === 'fpt')

// ---------- профили (r, z): z — вдоль оси порта наружу, 0 — дно раструба / торец ----------
const pitchOf = (s: SizeId): number => 1 / sp(s).tpi

function sawtooth(r0: number, r1: number, z0: number, z1: number, pitch: number): [number, number][] {
  const out: [number, number][] = []
  const steps = Math.max(2, Math.round(Math.abs(z1 - z0) / (pitch / 2)))
  for (let i = 0; i <= steps; i++) out.push([i % 2 ? r1 : r0, z0 + ((z1 - z0) * i) / steps])
  return out
}

function hubProfile(p: PortDef): [number, number][] {
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

function stubProfile(p: PortDef): [number, number][] {
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
function finalize(b: Built): Built {
  const shapes = [...b.shapes]
  for (const p of b.ports) {
    if (p.bare || p.kind === 'slip') continue
    const prof = p.kind === 'hub' || p.kind === 'fpt' ? hubProfile(p) : stubProfile(p)
    shapes.push({ t: 'lathe', at: p.pos, dir: p.dir, prof })
  }
  return { ports: b.ports, shapes }
}

// ---------- строительные блоки ----------
const line = (a: V3, b: V3): PathSeg => ({ t: 'line', a, b })

// Отвод: вход по -Z, выход под углом ang; e0/e1 — расстояние от центра до конца тела
function bendPath(ang: number, e0: number, e1: number, f: number): PathSeg[] {
  const T = Math.min(e0, e1) * f
  const R = T / Math.tan(ang / 2)
  const u: V3 = [Math.sin(ang), 0, Math.cos(ang)]
  return [line([0, 0, -e0], [0, 0, -T]), { t: 'arc', a: [0, 0, -T], t0: Z, n: X, r: R, ang }, line(mul(u, T), mul(u, e1))]
}
const outDir = (ang: number): V3 => [Math.sin(ang), 0, Math.cos(ang)]

// Санитарный (плавный) вход отвода: с +X дугой вниз в ствол
function sweepIn(sideDir: V3, A: number, r: number): PathSeg[] {
  const rs = Math.min(r, A * 0.8)
  const start = mul(sideDir, A)
  const a = mul(sideDir, rs)
  return [line(start, a), { t: 'arc', a, t0: mul(sideDir, -1), n: NZ, r: rs, ang: Math.PI / 2 }]
}

// Комбо: от ствола по 45°, затем дуга 45° в горизонталь к (A,0,0); side = ±1
function comboBranch(A: number, C0: number, side: 1 | -1): { segs: PathSeg[] } {
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
function trapPath(A: number, B: number, Cc: number, bodyTo = 0): PathSeg[] {
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

const tube = (r: number, ...segs: PathSeg[]): Shape => ({ t: 'tube', r, segs })
const lathe = (at: V3, dir: V3, prof: [number, number][], o: { color?: string; metal?: boolean } = {}): Shape => ({ t: 'lathe', at, dir, prof, ...o })

// Колпак-купол (заглушка) поверх раструба: от z0 до z1 по оси dir
function domeProfile(R: number, z0: number, z1: number, o: number, inner = true): [number, number][] {
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
const keysOf = (t: object): SizeId[] => ALL_SIZES.filter((s) => s in t)
const pairOpts = (m: Map<string, unknown>, main: SizeId, side: 'a' | 'b' = 'a'): SizeId[] =>
  [...m.keys()].map((k) => k.split('|') as [SizeId, SizeId]).filter((p) => (side === 'a' ? p[0] : p[1]) === main).map((p) => (side === 'a' ? p[1] : p[0]))
const incrPartners = (s: SizeId): SizeId[] => [...pairOpts(DW.D_INCREASER, s, 'a'), ...pairOpts(DW.D_INCREASER, s, 'b')]
const smaller = (s: SizeId, pool: SizeId[]): SizeId[] => pool.filter((x) => sizeIndex(x) < sizeIndex(s))
const cuKeys = (t: object): SizeId[] => CU_SIZES.filter((s) => s in t)
const cuRedPartners = (s: SizeId): SizeId[] => [...pairOpts(NB.CU_REDUCER, s, 'a'), ...pairOpts(NB.CU_REDUCER, s, 'b')]
const BRASS = '#c9a64a'

// Медное колено: C — от оси до упора; street: B — от оси до торца гладкого (Ftg) конца
function cuBend(size: SizeId, angDeg: number, Cc: number, f: number, B?: number): Built {
  const ang = (angDeg * Math.PI) / 180
  const u = outDir(ang)
  const br = bodyR(size, 'p')
  const face = sp(size).socket + 0.04
  if (B === undefined) return finalize({ ports: [hub(mul(NZ, Cc), NZ, size, 'p', { face }), hub(mul(u, Cc), u, size, 'p', { face })], shapes: [tube(br, ...bendPath(ang, Cc, Cc, f))] })
  const stub = Math.min(sp(size).socket + 0.05, B * 0.8)
  return finalize({
    ports: [spig(mul(NZ, B), NZ, size, 'p', stub), hub(mul(u, Cc), u, size, 'p', { face })],
    shapes: [tube(br, ...bendPath(ang, Math.max(Cc, B - stub), Cc, f))]
  })
}

const PRESSURE_SIZES: SizeId[] = ['1/2', '3/4', '1', '1-1/4', '1-1/2', '2', '2-1/2', '3', '4', '6']

// =====================================================================
//                               ФИТИНГИ
// =====================================================================
export const DEFAULT_PIPE = 24

const pressureBend = (size: SizeId, ang: number, G: number, H: number, f = 0.9): Built => {
  const u = outDir(ang)
  const face = H - G
  return finalize({
    ports: [hub(mul(NZ, G), NZ, size, 'p', { face }), hub(mul(u, G), u, size, 'p', { face })],
    shapes: [tube(bodyR(size, 'p'), ...bendPath(ang, G, G, f))]
  })
}

// DWV-отвод; street: B — от центра до торца гладкого конца
function dwvBend(size: SizeId, angDeg: number, A: number, f: number, B?: number): Built {
  const ang = (angDeg * Math.PI) / 180
  const u = outDir(ang)
  const s = sp(size)
  const br = bodyR(size, 'd')
  if (B === undefined) {
    return finalize({ ports: [hub(mul(NZ, A), NZ, size, 'd'), hub(mul(u, A), u, size, 'd')], shapes: [tube(br, ...bendPath(ang, A, A, f))] })
  }
  const bodyTo = Math.max(A * 0.6, B - s.dwv - 0.12)
  return finalize({
    ports: [spig(mul(NZ, B), NZ, size, 'd', B - bodyTo), hub(mul(u, A), u, size, 'd')],
    shapes: [tube(br, ...bendPath(ang, bodyTo, A, f))]
  })
}

function teeLike(size: SizeId, fam: Fam, gBottom: number, gTop: number, branches: { dir: V3; G: number; size: SizeId; kind?: 'fpt'; face?: number; sweep?: boolean; segs?: PathSeg[] }[], bottomSpigot?: number, faces?: [number?, number?]): Built {
  const ports: PortDef[] = []
  const br = bodyR(size, fam)
  const bodyBottom = bottomSpigot !== undefined ? Math.max(gBottom * 0.5, bottomSpigot - sp(size).dwv - 0.12) : gBottom
  ports.push(bottomSpigot !== undefined ? spig([0, 0, -bottomSpigot], NZ, size, fam, bottomSpigot - bodyBottom) : hub([0, 0, -gBottom], NZ, size, fam, { face: faces?.[0] }))
  ports.push(hub([0, 0, gTop], Z, size, fam, { face: faces?.[1] }))
  const shapes: Shape[] = [tube(br, line([0, 0, -bodyBottom], [0, 0, gTop]))]
  for (const b of branches) {
    const pos = mul(b.dir, b.G)
    ports.push(b.kind === 'fpt' ? fpt(pos, b.dir, b.size, fam, NPT[b.size], { face: b.face }) : hub(pos, b.dir, b.size, fam, { face: b.face }))
    const segs = b.segs ?? (b.sweep ? sweepIn(b.dir, b.G, sp(b.size).od * 0.55) : [line(O, pos)])
    shapes.push(tube(bodyR(b.size, fam), ...segs))
  }
  return finalize({ ports, shapes })
}

// Соосная деталь (муфты, адаптеры): порт 0 вниз (-Z), порт 1 вверх (+Z)
function coaxial(ports: PortDef[], shapes: Shape[]): Built {
  return finalize({ ports, shapes })
}

// Крышка-купол с раструбом/резьбой внутри
function capBuilt(size: SizeId, fam: Fam, L: number, S: number, threaded: boolean): Built {
  const s = sp(size)
  const o = s.od / 2
  const R = hubR(size, fam) + 0.02
  const p = threaded ? fpt(O, NZ, size, fam, S, { bare: true }) : hub(O, NZ, size, fam, { bare: true, depth: S })
  const c = 0.02 + s.od * 0.012
  const inner: [number, number][] = threaded ? sawtooth(o, o - 0.6 * pitchOf(size), 0, -S + c, pitchOf(size)) : [[o, 0], [o, -S + c]]
  // профиль по оси +Z (купол сверху), дно раструба на z=0, торец на z=-S
  const prof: [number, number][] = [
    [0.001, 0.02],
    [o, 0.02],
    ...inner,
    [o + c, -S],
    [R - c, -S],
    [R, -S + c],
    ...domeProfile(R, -S + c * 2, L - S, o, false).slice(1)
  ]
  return { ports: [p], shapes: [lathe(O, Z, prof)] }
}

const P = 'pressure'
const D = 'dwv'
const CU = 'copper'

export const FITTINGS: Record<string, FittingDef> = {
  pipe: {
    ru: 'Труба',
    en: 'Pipe',
    group: 'common',
    cat: 'Труба',
    icon: 'pipe',
    key: 'P',
    sizes: [...PRESSURE_SIZES, ...CU_SIZES],
    build: (p) => ({
      ports: [spig(O, NZ, p.size, 'p', 0, { bare: true }), spig([0, 0, p.length ?? DEFAULT_PIPE], Z, p.size, 'p', 0, { bare: true })],
      shapes: [{ t: 'pipe', size: p.size, len: p.length ?? DEFAULT_PIPE }]
    }),
    bom: (p) => [{ name: sp(p.size).mat === 'cu' ? `${sizeLabel(p.size)} Type L Copper Tube (ASTM B88)` : `${sizeLabel(p.size)} PVC Sch 40 Pipe` }]
  },
  // ----------------------------- МЕДЬ (NIBCO Wrot, пайка) -----------------------------
  cu90: {
    ru: 'Колено 90°',
    en: '90° Elbow C x C',
    group: CU,
    cat: 'Колена',
    icon: 'ell90',
    pn: '607',
    sizes: cuKeys(NB.CU_90),
    build: (p) => cuBend(p.size, 90, NB.CU_90[p.size]![0], 0.85)
  },
  cu90lr: {
    ru: 'Колено 90° длинное',
    en: '90° Elbow Long Radius C x C',
    group: CU,
    cat: 'Колена',
    icon: 'long90',
    pn: '607-LT',
    sizes: cuKeys(NB.CU_90_LR),
    build: (p) => cuBend(p.size, 90, NB.CU_90_LR[p.size]![0], 0.95)
  },
  cu90st: {
    ru: 'Колено 90° street (Ftg × C)',
    en: '90° Fitting Elbow Ftg x C',
    group: CU,
    cat: 'Колена',
    icon: 'st90',
    pn: '607-2',
    sizes: cuKeys(NB.CU_90_ST),
    build: (p) => {
      const [B, Cc] = NB.CU_90_ST[p.size]!
      return cuBend(p.size, 90, Cc, 0.85, B)
    }
  },
  cu45: {
    ru: 'Колено 45°',
    en: '45° Elbow C x C',
    group: CU,
    cat: 'Колена',
    icon: 'ell45',
    pn: '606',
    sizes: cuKeys(NB.CU_45),
    build: (p) => cuBend(p.size, 45, NB.CU_45[p.size]![0], 0.8)
  },
  cu45st: {
    ru: 'Колено 45° street (Ftg × C)',
    en: '45° Fitting Elbow Ftg x C',
    group: CU,
    cat: 'Колена',
    icon: 'st45',
    pn: '606-2',
    sizes: cuKeys(NB.CU_45_ST),
    build: (p) => {
      const [B, Cc] = NB.CU_45_ST[p.size]!
      return cuBend(p.size, 45, Cc, 0.8, B)
    }
  },
  cuTee: {
    ru: 'Тройник',
    en: 'Tee C x C x C',
    group: CU,
    cat: 'Тройники',
    icon: 'tee',
    pn: '611',
    sizes: cuKeys(NB.CU_TEE),
    size2: { label: 'Размер отвода', optional: true, options: (s) => [s, ...pairOpts(NB.CU_TEE_RED, s)] },
    build: (p) => {
      const s = p.size
      const b = p.size2 ?? s
      const red = b !== s ? NB.CU_TEE_RED.get(`${s}|${b}`) : undefined
      const [Cc, G] = red ?? NB.CU_TEE[s]!
      return teeLike(s, 'p', Cc, Cc, [{ dir: X, G, size: b }])
    },
    bom: (p) => {
      const b = p.size2 && p.size2 !== p.size ? p.size2 : undefined
      return [{ name: b ? `${sizeLabel(p.size)} x ${sizeLabel(p.size)} x ${sizeLabel(b)} Wrot Copper Tee C x C x C` : `${sizeLabel(p.size)} Wrot Copper Tee C x C x C`, pn: '611' }]
    }
  },
  cuCross: {
    ru: 'Крестовина (литая)',
    en: 'Cross C x C x C x C - Cast',
    group: CU,
    cat: 'Тройники',
    icon: 'cross',
    pn: '735',
    sizes: cuKeys(NB.CU_CROSS),
    build: (p) => {
      const A = NB.CU_CROSS[p.size]![0]
      return teeLike(p.size, 'p', A, A, [{ dir: X, G: A, size: p.size }, { dir: NX, G: A, size: p.size }])
    }
  },
  cuCoupling: {
    ru: 'Муфта (с упором)',
    en: 'Coupling with Dimpled Tube Stop C x C',
    group: CU,
    cat: 'Муфты и адаптеры',
    icon: 'coupling',
    pn: '600-DS',
    sizes: cuKeys(NB.CU_COUPLING),
    build: (p) => {
      const A = NB.CU_COUPLING[p.size]![0]
      const f = sp(p.size).socket + 0.04
      return coaxial([hub([0, 0, -A / 2], NZ, p.size, 'p', { face: f }), hub([0, 0, A / 2], Z, p.size, 'p', { face: f })], [])
    }
  },
  cuReducer: {
    ru: 'Муфта переходная',
    en: 'Reducing Coupling C x C',
    group: CU,
    cat: 'Муфты и адаптеры',
    icon: 'reducer',
    pn: '600',
    sizes: CU_SIZES.filter((s) => cuRedPartners(s).length),
    size2: { label: 'Второй размер', reversible: true, options: (s) => cuRedPartners(s) },
    build: (p) => {
      const a = p.size
      const b = p.size2 ?? cuRedPartners(a)[0]
      const [big, small] = sizeIndex(a) > sizeIndex(b) ? [a, b] : [b, a]
      const A = NB.CU_REDUCER.get(`${big}|${small}`)?.[0] ?? 0.4
      const zA = -A / 2
      const zB = A / 2
      return coaxial(
        [hub([0, 0, zA], NZ, a, 'p'), hub([0, 0, zB], Z, b, 'p')],
        [lathe(O, Z, [[sp(a).od / 2 - sp(a).wall, zA], [hubR(a, 'p'), zA - 0.02], [hubR(b, 'p'), zB + 0.02], [sp(b).od / 2 - sp(b).wall, zB]])]
      )
    },
    bom: (p) => {
      const b = p.size2 ?? p.size
      const [big, small] = sizeIndex(p.size) > sizeIndex(b) ? [p.size, b] : [b, p.size]
      return [{ name: `${sizeLabel(big)} x ${sizeLabel(small)} Wrot Copper Reducing Coupling C x C`, pn: '600' }]
    }
  },
  cuUnion: {
    ru: 'Разъёмная муфта (union)',
    en: 'Union C x C',
    group: CU,
    cat: 'Муфты и адаптеры',
    icon: 'union',
    pn: '633-W',
    sizes: cuKeys(NB.CU_UNION),
    build: (p) => {
      const s = p.size
      const A = NB.CU_UNION[s]![0]
      const R = hubR(s, 'p')
      const f = sp(s).socket + 0.06
      return coaxial(
        [hub([0, 0, -A / 2], NZ, s, 'p', { face: f }), hub([0, 0, A / 2], Z, s, 'p', { face: f })],
        [
          { t: 'prism', at: [0, 0, -A / 2 - f * 0.45], dir: Z, sides: 6, r: R * 1.55, h: A + f * 0.9, color: BRASS },
          lathe([0, 0, A / 2 + f * 0.45], Z, [[R * 1.05, 0], [R * 1.3, 0], [R * 1.3, f * 0.4], [R * 1.05, f * 0.4]], { color: BRASS, metal: true })
        ]
      )
    }
  },
  cuFa: {
    ru: 'Адаптер FPT (female)',
    en: 'Adapter C x F',
    group: CU,
    cat: 'Муфты и адаптеры',
    icon: 'fa',
    pn: '603',
    sizes: cuKeys(NB.CU_FA),
    build: (p) => {
      const s = p.size
      const th = threadSize(s)
      const A = NB.CU_FA[s]![0]
      const T = Math.min(NPT[th] ?? 0.55, A - 0.1)
      const Rh = sp(th).od / 2 + 0.06 + sp(th).od * 0.04
      return finalize({
        ports: [hub(O, NZ, s, 'p'), fpt([0, 0, A - T], Z, th, 'p', T, { face: T, R: Rh, bare: true })],
        shapes: [
          lathe(O, Z, [[sp(s).od / 2, 0], [hubR(s, 'p'), 0], [Rh * 0.98, A - T - 0.05], [sp(th).od / 2 - 0.02, A - T - 0.05]]),
          { t: 'prism', at: [0, 0, A - T - 0.05], dir: Z, sides: 6, r: Rh * 1.12, h: T + 0.05 },
          lathe([0, 0, A - T], Z, [[sp(th).od / 2 - 0.6 * pitchOf(th) - 0.02, -0.02], ...sawtooth(sp(th).od / 2, sp(th).od / 2 - 0.6 * pitchOf(th), 0, T, pitchOf(th)), [sp(th).od / 2 + 0.02, T + 0.002]])
        ]
      })
    },
    bom: (p) => [{ name: `${sizeLabel(p.size)} Wrot Copper Adapter C x F (FPT)`, pn: '603' }]
  },
  cuMa: {
    ru: 'Адаптер MPT (male)',
    en: 'Adapter C x M',
    group: CU,
    cat: 'Муфты и адаптеры',
    icon: 'ma',
    pn: '604',
    sizes: cuKeys(NB.CU_MA),
    build: (p) => {
      const s = p.size
      const th = threadSize(s)
      const B = NB.CU_MA[s]![0]
      const T = Math.min(NPT[th] ?? 0.55, B - 0.08)
      return finalize({
        ports: [hub(O, NZ, s, 'p'), mpt([0, 0, B], Z, th, 'p', T)],
        shapes: [lathe(O, Z, [[sp(s).od / 2, 0], [hubR(s, 'p'), 0], [hubR(s, 'p'), B - T], [sp(th).od / 2 - 0.05, B - T]])]
      })
    },
    bom: (p) => [{ name: `${sizeLabel(p.size)} Wrot Copper Adapter C x M (MPT)`, pn: '604' }]
  },
  cuCap: {
    ru: 'Заглушка',
    en: 'Tube Cap C',
    group: CU,
    cat: 'Заглушки и арматура',
    icon: 'cap',
    pn: '617',
    sizes: cuKeys(NB.CU_CAP),
    build: (p) => {
      const N = NB.CU_CAP[p.size]![0]
      const S = sp(p.size).socket
      return capBuilt(p.size, 'p', S + N + 0.06, S, false)
    }
  },
  cuValve: {
    ru: 'Шаровый кран (пайка)',
    en: 'Ball Valve Sweat x Sweat (Lead-Free Brass)',
    group: CU,
    cat: 'Заглушки и арматура',
    icon: 'valve',
    sizes: CU_SIZES.slice(0, 6),
    build: (p) => {
      const s = p.size
      const od = sp(s).od
      const g = od * 0.95 + 0.35
      const R = hubR(s, 'p')
      return finalize({
        ports: [hub([0, 0, -g], NZ, s, 'p', { face: sp(s).socket + 0.12 }), hub([0, 0, g], Z, s, 'p', { face: sp(s).socket + 0.12 })],
        shapes: [
          { t: 'prism', at: [0, 0, -g + 0.05], dir: Z, sides: 8, r: R * 1.75, h: g * 2 - 0.1, color: BRASS },
          lathe(O, Y, [[R * 0.35, 0], [R * 0.35, R * 2.3], [0.001, R * 2.3]], { color: BRASS, metal: true }),
          { t: 'box', at: [R * 1.8, R * 2.45, 0], dir: Y, size: [R * 5, R * 0.35, R * 0.9], color: '#c8352e' }
        ]
      })
    },
    bom: (p) => [{ name: `${sizeLabel(p.size)} Lead-Free Brass Ball Valve Sweat x Sweat` }]
  },


  // ----------------------------- НАПОРНЫЕ Sch 40 -----------------------------
  elbow90: {
    ru: 'Отвод 90°',
    en: '90° Elbow S x S',
    group: P,
    cat: 'Отводы',
    icon: 'ell90',
    key: 'E',
    pn: '2300',
    sizes: keysOf(PR.ELL90),
    build: (p) => {
      const r = PR.ELL90[p.size]!
      return pressureBend(p.size, Math.PI / 2, r.G, r.H)
    }
  },
  p90fpt: {
    ru: 'Отвод 90° раструб × FPT',
    en: '90° Elbow S x FPT',
    group: P,
    cat: 'Отводы',
    icon: 'ell90',
    pn: '2301',
    sizes: keysOf(PR.ELL90_FPT),
    build: (p) => {
      const r = PR.ELL90_FPT[p.size]!
      const s = p.size
      return finalize({
        ports: [hub(mul(NZ, r.G), NZ, s, 'p', { face: r.H - r.G }), fpt(mul(X, r.G1), X, s, 'p', r.H1 - r.G1 - 0.05, { face: r.H1 - r.G1, R: hubR(s, 'p') + 0.05 })],
        shapes: [tube(bodyR(s, 'p'), ...bendPath(Math.PI / 2, r.G, r.G1, 0.9))]
      })
    }
  },
  p90st: {
    ru: 'Отвод 90° street',
    en: '90° Street Elbow SPG x S',
    group: P,
    cat: 'Отводы',
    icon: 'st90',
    pn: '2304',
    sizes: keysOf(PR.ELL90_ST),
    build: (p) => {
      const r = PR.ELL90_ST[p.size]!
      const s = p.size
      return finalize({
        ports: [spig(mul(NZ, r.H), NZ, s, 'p', r.H - r.G), hub(mul(X, r.G1), X, s, 'p', { face: r.H1 - r.G1 })],
        shapes: [tube(bodyR(s, 'p'), ...bendPath(Math.PI / 2, r.G, r.G1, 0.9))]
      })
    }
  },
  p90mpt: {
    ru: 'Отвод 90° MPT × раструб',
    en: '90° Street Elbow MPT x S',
    group: P,
    cat: 'Отводы',
    icon: 'st90',
    pn: '2306',
    sizes: keysOf(PR.ELL90_MPT),
    build: (p) => {
      const r = PR.ELL90_MPT[p.size]!
      const s = p.size
      return finalize({
        ports: [mpt(mul(NZ, r.H), NZ, s, 'p', r.H - r.G), hub(mul(X, r.G1), X, s, 'p', { face: r.H1 - r.G1 })],
        shapes: [tube(bodyR(s, 'p'), ...bendPath(Math.PI / 2, r.G, r.G1, 0.9))]
      })
    }
  },
  elbow45: {
    ru: 'Отвод 45°',
    en: '45° Elbow S x S',
    group: P,
    cat: 'Отводы',
    icon: 'ell45',
    key: 'F',
    pn: '2309',
    sizes: keysOf(PR.ELL45),
    build: (p) => {
      const r = PR.ELL45[p.size]!
      return pressureBend(p.size, Math.PI / 4, r.J, r.H, 0.95)
    }
  },
  tee: {
    ru: 'Тройник',
    en: 'Tee S x S x S',
    group: P,
    cat: 'Тройники',
    icon: 'tee',
    key: 'T',
    pn: '2400',
    sizes: keysOf(PR.TEE),
    size2: { label: 'Размер отвода', optional: true, options: (s) => [s, ...pairOpts(PR.TEE_RED, s)] },
    build: (p) => {
      const s = p.size
      const red = p.size2 && p.size2 !== s ? PR.TEE_RED.get(PR.pairKey(s, p.size2)) : undefined
      const r = PR.TEE[s]!
      const G = red ? red.G : r.G
      const H = red ? red.H : r.H
      const b = p.size2 ?? s
      return teeLike(s, 'p', G, G, [{ dir: X, G: red ? red.G1 : r.G, size: b, face: red ? red.H1 - red.G1 : r.H - r.G }], undefined, [H - G, H - G])
    },
    bom: (p) => {
      const red = p.size2 && p.size2 !== p.size ? PR.TEE_RED.get(PR.pairKey(p.size, p.size2)) : undefined
      return [{ name: red ? `${sizeLabel(p.size)} x ${sizeLabel(p.size)} x ${sizeLabel(p.size2!)} PVC Sch 40 Reducing Tee` : `${sizeLabel(p.size)} PVC Sch 40 Tee`, pn: red?.pn ?? PR.TEE[p.size]?.pn }]
    }
  },
  pteefpt: {
    ru: 'Тройник с FPT отводом',
    en: 'Tee S x S x FPT',
    group: P,
    cat: 'Тройники',
    icon: 'tee',
    pn: '2401',
    sizes: keysOf(PR.TEE_FPT),
    build: (p) => {
      const r = PR.TEE_FPT[p.size]!
      return teeLike(p.size, 'p', r.G, r.G, [{ dir: X, G: r.G1, size: p.size, kind: 'fpt', face: r.H1 - r.G1 }], undefined, [r.H - r.G, r.H - r.G])
    }
  },
  cross: {
    ru: 'Крестовина',
    en: 'Cross',
    group: P,
    cat: 'Тройники',
    icon: 'cross',
    key: 'X',
    pn: '2410',
    sizes: keysOf(PR.CROSS),
    build: (p) => {
      const r = PR.CROSS[p.size]!
      const f = r.H - r.G
      return teeLike(p.size, 'p', r.G, r.G, [{ dir: X, G: r.G, size: p.size, face: f }, { dir: NX, G: r.G, size: p.size, face: f }], undefined, [f, f])
    }
  },
  coupling: {
    ru: 'Муфта',
    en: 'Coupling S x S',
    group: P,
    cat: 'Муфты и адаптеры',
    icon: 'coupling',
    key: 'C',
    pn: '2100',
    sizes: keysOf(PR.COUPLING),
    build: (p) => {
      const r = PR.COUPLING[p.size]!
      const f = (r.L - r.N) / 2
      return coaxial([hub([0, 0, -r.N / 2], NZ, p.size, 'p', { face: f }), hub([0, 0, r.N / 2], Z, p.size, 'p', { face: f })], [])
    }
  },
  reducer: {
    ru: 'Муфта переходная',
    en: 'Reducing Coupling S x S',
    group: P,
    cat: 'Муфты и адаптеры',
    icon: 'reducer',
    key: 'D',
    pn: '2100',
    sizes: PRESSURE_SIZES.slice(1),
    size2: { label: 'Второй размер', reversible: true, options: (s) => smaller(s, PRESSURE_SIZES) },
    build: (p) => {
      const a = p.size
      const b = p.size2 ?? PRESSURE_SIZES[Math.max(0, sizeIndex(a) - 1)]
      const big = sizeIndex(a) >= sizeIndex(b) ? a : b
      const small = big === a ? b : a
      const r = PR.COUPLING_RED.get(PR.pairKey(big, small))
      const N = r?.N ?? 0.125
      const sb = sp(big).socket
      const ss = sp(small).socket
      const L = r?.L ?? sb + ss + N + (sp(big).od - sp(small).od) * 0.6 + 0.2
      const taper = Math.max(0.05, L - sb - ss - N - 0.08)
      // порт 0 — размер a (снизу), порт 1 — размер b (сверху)
      const zA = -N / 2
      const zB = N / 2 + taper
      const portA = hub([0, 0, zA], NZ, a, 'p')
      const portB = hub([0, 0, zB], Z, b, 'p')
      const Ra = hubR(a, 'p')
      const Rb = hubR(b, 'p')
      return coaxial([portA, portB], [lathe(O, Z, [[sp(a).od / 2 - sp(a).wall, zA], [Ra, zA - 0.01], [Rb, zB + 0.01], [sp(b).od / 2 - sp(b).wall, zB]])])
    },
    bom: (p) => {
      const a = p.size
      const b = p.size2 ?? a
      const [big, small] = sizeIndex(a) >= sizeIndex(b) ? [a, b] : [b, a]
      return [{ name: `${sizeLabel(big)} x ${sizeLabel(small)} PVC Sch 40 Reducing Coupling`, pn: PR.COUPLING_RED.get(PR.pairKey(big, small))?.pn }]
    }
  },
  punion: {
    ru: 'Разъёмная муфта (union)',
    en: 'Union S x S, EPDM O-ring',
    group: P,
    cat: 'Муфты и адаптеры',
    icon: 'union',
    pn: '2710',
    sizes: keysOf(PR.UNION),
    build: (p) => {
      const r = PR.UNION[p.size]!
      const s = p.size
      const half = r.L / 2
      const f = half - r.N / 2
      const R = hubR(s, 'p')
      return coaxial(
        [hub([0, 0, -r.N / 2], NZ, s, 'p', { face: f, depth: Math.min(r.S, f) }), hub([0, 0, r.N / 2], Z, s, 'p', { face: f, depth: Math.min(r.S, f) })],
        [
          { t: 'knurl', at: [0, 0, -half * 0.15], dir: Z, r: R * 1.32, h: r.L * 0.42, ribs: 18 },
          lathe([0, 0, -r.N / 2 - 0.02], Z, [[R * 1.02, 0], [R * 1.1, 0], [R * 1.1, 0.06], [R * 1.02, 0.06]], { color: '#222' }),
          lathe(O, Z, [[R * 1.05, -half * 0.15 - 0.02], [R * 1.12, -half * 0.15 - 0.02], [R * 1.12, half * 0.55], [R * 1.05, half * 0.55]])
        ]
      )
    }
  },
  pfa: {
    ru: 'Адаптер FPT (female)',
    en: 'Female Adapter S x FPT',
    group: P,
    cat: 'Муфты и адаптеры',
    icon: 'fa',
    pn: '2101',
    sizes: keysOf(PR.FEMALE_ADAPTER),
    build: (p) => {
      const r = PR.FEMALE_ADAPTER[p.size]!
      const s = p.size
      const S = sp(s).socket
      const T = Math.max(0.4, r.L - r.N - S)
      return coaxial([hub([0, 0, -r.N / 2], NZ, s, 'p', { face: S + 0.02 }), fpt([0, 0, r.N / 2], Z, s, 'p', T - 0.05, { face: T, R: hubR(s, 'p') + 0.06 + sp(s).od * 0.03 })], [])
    }
  },
  pma: {
    ru: 'Адаптер MPT (male)',
    en: 'Male Adapter MPT x S',
    group: P,
    cat: 'Муфты и адаптеры',
    icon: 'ma',
    pn: '2109',
    sizes: keysOf(PR.MALE_ADAPTER),
    build: (p) => {
      const r = PR.MALE_ADAPTER[p.size]!
      const s = p.size
      const S = Math.max(sp(s).socket, r.L - r.N - r.T)
      const R = hubR(s, 'p')
      return coaxial(
        [hub([0, 0, -r.N / 2], NZ, s, 'p', { face: S }), mpt([0, 0, r.N / 2 + r.T], Z, s, 'p', r.T)],
        [{ t: 'prism', at: [0, 0, -r.N / 2 - 0.01], dir: Z, sides: 8, r: R * 1.12, h: r.N + 0.02 }]
      )
    }
  },
  pbush: {
    ru: 'Втулка переходная SPG × S',
    en: 'Reducer Bushing, Flush Style SPG x S',
    group: P,
    cat: 'Муфты и адаптеры',
    icon: 'bushing',
    pn: '2107',
    sizes: [...new Set([...PR.BUSHING.keys()].map((k) => k.split('|')[0] as SizeId))],
    size2: { label: 'Внутренний размер', options: (s) => pairOpts(PR.BUSHING, s) },
    build: (p) => {
      const big = p.size
      const small = p.size2 ?? pairOpts(PR.BUSHING, big)[0]
      const r = PR.BUSHING.get(PR.pairKey(big, small))!
      const ob = sp(big).od / 2
      const os = sp(small).od / 2
      const ri = os - sp(small).wall
      // гладкий конец вниз (торец на z=0), раструб малого размера вверх, дно на z=N
      return finalize({
        ports: [spig(O, NZ, big, 'p', 0, { bare: true }), hub([0, 0, r.N], Z, small, 'p', { bare: true, depth: Math.min(sp(small).socket, r.L - r.N) })],
        shapes: [
          lathe(O, Z, [[ri, 0], [ob - 0.03, 0], [ob, 0.03], [ob, r.SPG], [ob + 0.04, r.SPG + 0.02], [ob + 0.04, r.L - 0.02], [ob, r.L], [os + 0.03, r.L], [os, r.L - 0.03], [os, r.N], [ri, r.N], [ri, 0]])
        ]
      })
    },
    bom: (p) => [{ name: `${sizeLabel(p.size)} x ${sizeLabel(p.size2 ?? p.size)} PVC Sch 40 Reducer Bushing SPG x S`, pn: PR.BUSHING.get(PR.pairKey(p.size, p.size2 ?? p.size))?.pn }]
  },
  pbushT: {
    ru: 'Втулка переходная MPT × FPT',
    en: 'Reducer Bushing MPT x FPT',
    group: P,
    cat: 'Муфты и адаптеры',
    icon: 'bushing',
    pn: '2112',
    sizes: [...new Set([...PR.BUSHING_THD.keys()].map((k) => k.split('|')[0] as SizeId))],
    size2: { label: 'Внутренний размер', options: (s) => pairOpts(PR.BUSHING_THD, s) },
    build: (p) => {
      const big = p.size
      const small = p.size2 ?? pairOpts(PR.BUSHING_THD, big)[0]
      const r = PR.BUSHING_THD.get(PR.pairKey(big, small))!
      const ob = sp(big).od / 2
      const os = sp(small).od / 2
      const depth = Math.min(NPT[small], r.L - 0.12)
      const zb = r.L - depth
      const h = 0.6 * pitchOf(small)
      return finalize({
        ports: [mpt(O, NZ, big, 'p', r.T, { bare: true }), fpt([0, 0, zb], Z, small, 'p', depth, { bare: true })],
        shapes: [
          lathe(O, Z, [[os - h - sp(small).wall, 0], [ob - 0.6 * pitchOf(big) - 0.02, 0], ...sawtooth(ob - 0.6 * pitchOf(big), ob, 0.02, r.T, pitchOf(big)), [ob, r.T + 0.01], [os - h - sp(small).wall, r.T + 0.01]]),
          { t: 'prism', at: [0, 0, r.T], dir: Z, sides: 6, r: ob * 1.18, h: r.L - r.T },
          lathe([0, 0, zb], Z, [[os - h - sp(small).wall, -0.02], ...sawtooth(os - h, os, 0, depth, pitchOf(small)), [os + 0.02, depth + 0.002]])
        ]
      })
    },
    bom: (p) => [{ name: `${sizeLabel(p.size)} x ${sizeLabel(p.size2 ?? p.size)} PVC Sch 40 Reducer Bushing MPT x FPT`, pn: PR.BUSHING_THD.get(PR.pairKey(p.size, p.size2 ?? p.size))?.pn }]
  },
  cap: {
    ru: 'Заглушка',
    en: 'Cap S',
    group: P,
    cat: 'Заглушки',
    icon: 'cap',
    key: 'K',
    pn: '2116',
    sizes: keysOf(PR.CAP),
    build: (p) => {
      const r = PR.CAP[p.size]!
      return capBuilt(p.size, 'p', r.L, r.S, false)
    }
  },
  pcapfpt: {
    ru: 'Заглушка FPT',
    en: 'Cap FPT',
    group: P,
    cat: 'Заглушки',
    icon: 'cap',
    pn: '2117',
    sizes: keysOf(PR.CAP_FPT),
    build: (p) => {
      const r = PR.CAP_FPT[p.size]!
      return capBuilt(p.size, 'p', r.L, r.T, true)
    }
  },
  pplug: {
    ru: 'Пробка SPG',
    en: 'Plug SPG',
    group: P,
    cat: 'Заглушки',
    icon: 'plug',
    pn: '2118',
    sizes: keysOf(PR.PLUG_SPG),
    build: (p) => {
      const r = PR.PLUG_SPG[p.size]!
      const s = sp(p.size)
      const o = s.od / 2
      const R = hubR(p.size, 'p') + 0.03
      return {
        ports: [spig(O, NZ, p.size, 'p', 0, { bare: true })],
        shapes: [lathe(O, Z, [[o - s.wall * 1.5, 0.15], [o - s.wall * 1.5, 0], [o - 0.03, 0], [o, 0.03], [o, r.SPG], [R, r.SPG], [R, r.L - 0.04], [R - 0.04, r.L], [0.001, r.L]])]
      }
    }
  },
  pplugmpt: {
    ru: 'Пробка MPT',
    en: 'Plug MPT',
    group: P,
    cat: 'Заглушки',
    icon: 'plug',
    pn: '2113',
    sizes: keysOf(PR.PLUG_MPT),
    build: (p) => {
      const r = PR.PLUG_MPT[p.size]!
      const s = sp(p.size)
      const o = s.od / 2
      const h = 0.6 * pitchOf(p.size)
      return {
        ports: [mpt(O, NZ, p.size, 'p', r.T, { bare: true })],
        shapes: [
          lathe(O, Z, [[0.001, 0], [o - h - 0.02, 0], ...sawtooth(o - h, o, 0.02, r.T, pitchOf(p.size)), [o, r.T + 0.01], [0.001, r.T + 0.01]]),
          { t: 'prism', at: [0, 0, r.T], dir: Z, sides: 4, r: o * 1.15, h: r.L - r.T }
        ]
      }
    }
  },
  valve: {
    ru: 'Шаровый кран',
    en: 'Ball Valve S x S',
    group: P,
    cat: 'Арматура',
    icon: 'valve',
    key: 'V',
    sizes: PRESSURE_SIZES.slice(0, 8),
    build: (p) => {
      const s = p.size
      const od = sp(s).od
      const g = od * 0.9 + 0.4
      const R = hubR(s, 'p')
      return finalize({
        ports: [hub([0, 0, -g], NZ, s, 'p', { face: sp(s).socket + 0.15 }), hub([0, 0, g], Z, s, 'p', { face: sp(s).socket + 0.15 })],
        shapes: [
          lathe(O, Z, [[R * 0.9, -g], [R * 1.05, -g * 0.75], [R * 1.42, -g * 0.35], [R * 1.48, 0], [R * 1.42, g * 0.35], [R * 1.05, g * 0.75], [R * 0.9, g]]),
          lathe(O, Y, [[R * 0.32, 0], [R * 0.32, R * 1.9], [0.001, R * 1.9]]),
          { t: 'box', at: [R * 1.1, R * 2.05, 0], dir: Y, size: [R * 3.4, R * 0.36, R * 0.75], color: '#c8352e' }
        ]
      })
    },
    bom: (p) => [{ name: `${sizeLabel(p.size)} PVC Ball Valve (Slip x Slip)` }]
  },

  // ----------------------------- DWV -----------------------------
  dwv90: {
    ru: 'Колено 90° (1/4 Bend)',
    en: '1/4 Bend',
    group: D,
    cat: 'Колена',
    icon: 'bend90',
    pn: '300',
    sizes: keysOf(DW.D_BEND90),
    build: (p) => dwvBend(p.size, 90, DW.D_BEND90[p.size]![0], 0.75)
  },
  st90: {
    ru: 'Колено 90° street',
    en: '1/4 Bend, Street (Spigot x Hub)',
    group: D,
    cat: 'Колена',
    icon: 'st90',
    pn: '302',
    sizes: keysOf(DW.D_BEND90_ST),
    build: (p) => {
      const [A, B] = DW.D_BEND90_ST[p.size]!
      return dwvBend(p.size, 90, A, 0.75, B)
    }
  },
  dwvLong90: {
    ru: 'Колено 90° длинное',
    en: 'Long Sweep 1/4 Bend',
    group: D,
    cat: 'Колена',
    icon: 'long90',
    pn: '304',
    sizes: keysOf(DW.D_LONG90),
    build: (p) => dwvBend(p.size, 90, DW.D_LONG90[p.size]![0], 0.93)
  },
  dlongst: {
    ru: 'Колено 90° длинное street',
    en: 'Long Sweep 1/4 Bend, Street (Hub x Spigot)',
    group: D,
    cat: 'Колена',
    icon: 'long90',
    pn: '309',
    sizes: keysOf(DW.D_LONG90_ST),
    build: (p) => {
      const [A, B] = DW.D_LONG90_ST[p.size]!
      return dwvBend(p.size, 90, A, 0.93, B)
    }
  },
  dvent90: {
    ru: 'Вентиляционное колено 90°',
    en: 'Vent Ell (90° Short Turn)',
    group: D,
    cat: 'Колена',
    icon: 'ell90',
    pn: '331',
    sizes: keysOf(DW.D_VENT90),
    build: (p) => dwvBend(p.size, 90, DW.D_VENT90[p.size]![0], 0.55)
  },
  dvent90st: {
    ru: 'Вент. колено 90° street',
    en: 'Vent Ell, Street (Hub x Spigot)',
    group: D,
    cat: 'Колена',
    icon: 'st90',
    pn: '333',
    sizes: keysOf(DW.D_VENT90_ST),
    build: (p) => {
      const [A, B] = DW.D_VENT90_ST[p.size]!
      return dwvBend(p.size, 90, A, 0.55, B)
    }
  },
  d60: {
    ru: 'Колено 60° (1/6 Bend)',
    en: '1/6 Bend',
    group: D,
    cat: 'Колена',
    icon: 'bend45',
    pn: '319',
    sizes: keysOf(DW.D_BEND60),
    build: (p) => dwvBend(p.size, 60, DW.D_BEND60[p.size]![0], 0.65)
  },
  d60st: {
    ru: 'Колено 60° street',
    en: '1/6 Bend, Street (Hub x Spigot)',
    group: D,
    cat: 'Колена',
    icon: 'st45',
    pn: '320',
    sizes: keysOf(DW.D_BEND60_ST),
    build: (p) => {
      const [A, B] = DW.D_BEND60_ST[p.size]!
      return dwvBend(p.size, 60, A, 0.65, B)
    }
  },
  dwv45: {
    ru: 'Колено 45° (1/8 Bend)',
    en: '1/8 Bend',
    group: D,
    cat: 'Колена',
    icon: 'bend45',
    pn: '321',
    sizes: keysOf(DW.D_BEND45),
    build: (p) => dwvBend(p.size, 45, DW.D_BEND45[p.size]![0], 0.6)
  },
  st45: {
    ru: 'Колено 45° street',
    en: '1/8 Bend, Street (Spigot x Hub)',
    group: D,
    cat: 'Колена',
    icon: 'st45',
    pn: '323',
    sizes: keysOf(DW.D_BEND45_ST),
    build: (p) => {
      const [A, B] = DW.D_BEND45_ST[p.size]!
      return dwvBend(p.size, 45, A, 0.6, B)
    }
  },
  dwv22: {
    ru: 'Колено 22.5° (1/16 Bend)',
    en: '1/16 Bend',
    group: D,
    cat: 'Колена',
    icon: 'bend22',
    pn: '324',
    sizes: keysOf(DW.D_BEND22),
    build: (p) => dwvBend(p.size, 22.5, DW.D_BEND22[p.size]![0], 0.5)
  },
  d22st: {
    ru: 'Колено 22.5° street',
    en: '1/16 Bend, Street (Spigot x Hub)',
    group: D,
    cat: 'Колена',
    icon: 'bend22',
    pn: '326',
    sizes: keysOf(DW.D_BEND22_ST),
    build: (p) => {
      const [A, B] = DW.D_BEND22_ST[p.size]!
      return dwvBend(p.size, 22.5, A, 0.5, B)
    }
  },
  d90dbl: {
    ru: 'Двойное колено 90°',
    en: 'Double 1/4 Bend',
    group: D,
    cat: 'Колена',
    icon: 'dbl90',
    pn: '327',
    sizes: keysOf(DW.D_DBL90),
    build: (p) => {
      const [A, B] = DW.D_DBL90[p.size]!
      const s = p.size
      const br = bodyR(s, 'd')
      const rs = Math.min(B, A) * 0.85
      const arm = (side: V3): PathSeg[] => [line(mul(side, B), mul(side, rs)), { t: 'arc', a: mul(side, rs), t0: mul(side, -1), n: NZ, r: rs, ang: Math.PI / 2 }, line([0, 0, -rs], [0, 0, -A])]
      return finalize({ ports: [hub([0, 0, -A], NZ, s, 'd'), hub(mul(X, B), X, s, 'd'), hub(mul(NX, B), NX, s, 'd')], shapes: [tube(br, ...arm(X)), tube(br, ...arm(NX))] })
    }
  },
  closetBend: {
    ru: 'Колено для унитаза 4×3',
    en: 'Closet Bend, Reducing',
    group: D,
    cat: 'Колена',
    icon: 'bend90',
    pn: '329',
    sizes: ['4'],
    size2: { label: 'Выход', options: () => ['3'] },
    build: (p) => {
      const [A, B] = DW.D_CLOSET_BEND['4']!
      const small = p.size2 ?? '3'
      // порт 0 — выход 3" (по -Z), порт 1 — 4" вверх (под унитазный фланец)
      return finalize({
        ports: [hub(mul(NZ, B), NZ, small, 'd'), hub(mul(X, A), X, '4', 'd')],
        shapes: [tube(bodyR(small, 'd'), ...bendPath(Math.PI / 2, B, A, 0.85)), lathe(mul(X, A * 0.35), X, [[bodyR(small, 'd'), 0], [bodyR('4', 'd'), A * 0.5]])]
      })
    },
    bom: () => [{ name: '4" x 3" PVC DWV Closet Bend', pn: '329' }]
  },

  sanTee: {
    ru: 'Санитарный тройник',
    en: 'Sanitary Tee',
    group: D,
    cat: 'Тройники',
    icon: 'santee',
    pn: '400',
    sizes: keysOf(DW.D_SAN),
    size2: { label: 'Размер отвода', optional: true, options: (s) => [s, ...pairOpts(DW.D_SAN_RED, s)] },
    build: (p) => {
      const s = p.size
      const b = p.size2 ?? s
      const red = b !== s ? DW.D_SAN_RED.get(`${s}|${b}`) : undefined
      if (red) {
        const [A, B, Cc] = red
        return teeLike(s, 'd', Cc, B - Cc, [{ dir: X, G: A, size: b, sweep: true }])
      }
      const [A, B] = DW.D_SAN[s]!
      return teeLike(s, 'd', A, B - A, [{ dir: X, G: A, size: b, sweep: true }])
    }
  },
  dsanst: {
    ru: 'Санитарный тройник street',
    en: 'Sanitary Tee, Street (Spigot x Hub x Hub)',
    group: D,
    cat: 'Тройники',
    icon: 'santee',
    pn: '403',
    sizes: keysOf(DW.D_SAN_ST),
    build: (p) => {
      const [A, B, Cc] = DW.D_SAN_ST[p.size]!
      return teeLike(p.size, 'd', Cc, B - Cc, [{ dir: X, G: A, size: p.size, sweep: true }], Cc)
    }
  },
  dblSanTee: {
    ru: 'Двойной санитарный тройник',
    en: 'Double Sanitary Tee (Sanitary Cross)',
    group: D,
    cat: 'Тройники',
    icon: 'dblsan',
    pn: '428',
    sizes: keysOf(DW.D_DBL_SAN),
    build: (p) => {
      const [A, B] = DW.D_DBL_SAN[p.size]!
      return teeLike(p.size, 'd', A, B - A, [{ dir: X, G: A, size: p.size, sweep: true }, { dir: NX, G: A, size: p.size, sweep: true }])
    }
  },
  dventtee: {
    ru: 'Вентиляционный тройник',
    en: 'Vent Tee',
    group: D,
    cat: 'Тройники',
    icon: 'tee',
    pn: '441',
    sizes: keysOf(DW.D_VENT_TEE),
    build: (p) => {
      const [A, B] = DW.D_VENT_TEE[p.size]!
      return teeLike(p.size, 'd', A, B - A, [{ dir: X, G: A, size: p.size }])
    }
  },
  dcotee: {
    ru: 'Тройник-ревизия с пробкой',
    en: 'Cleanout Tee with Cleanout Plug',
    group: D,
    cat: 'Ревизии и заглушки',
    icon: 'cotee',
    pn: '444X',
    sizes: keysOf(DW.D_CO_TEE),
    build: (p) => {
      const [A, B, Cc] = DW.D_CO_TEE[p.size]!
      const s = p.size
      const o = sp(s).od / 2
      const R = hubR(s, 'd') + 0.08
      const plugH = Math.max(0.35, o * 0.35)
      const built = teeLike(s, 'd', Cc, B - Cc, [])
      built.shapes.push(
        tube(bodyR(s, 'd'), line(O, [A - 0.4, 0, 0])),
        lathe([A - 0.4, 0, 0], X, [[bodyR(s, 'd'), 0], [R, 0.15], [R, 0.4], [o * 0.95, 0.4]]),
        lathe([A, 0, 0], X, [[0.001, 0], [o * 0.95, 0], [o * 0.95, 0.06], [0.001, 0.06]]),
        { t: 'prism', at: [A + 0.05, 0, 0], dir: X, sides: 4, r: o * 0.42, h: plugH }
      )
      return built
    },
    bom: (p) => [{ name: `${sizeLabel(p.size)} PVC DWV Cleanout Tee with Cleanout Plug`, pn: '444X' }]
  },
  wye: {
    ru: 'Косой тройник (Wye)',
    en: 'Wye (45°)',
    group: D,
    cat: 'Тройники',
    icon: 'wye',
    pn: '600',
    sizes: keysOf(DW.D_WYE),
    size2: { label: 'Размер отвода', optional: true, options: (s) => [s, ...pairOpts(DW.D_WYE_RED, s)] },
    build: (p) => {
      const s = p.size
      const b = p.size2 ?? s
      const [A, B, Cc] = (b !== s ? DW.D_WYE_RED.get(`${s}|${b}`) : undefined) ?? DW.D_WYE[s]!
      return teeLike(s, 'd', B, A - B, [{ dir: [C, 0, C], G: Cc, size: b }])
    }
  },
  dwyest: {
    ru: 'Wye street',
    en: 'Wye, Street (Spigot x Hub x Hub)',
    group: D,
    cat: 'Тройники',
    icon: 'wye',
    pn: '602',
    sizes: keysOf(DW.D_WYE_ST),
    build: (p) => {
      const [A, B, Cc] = DW.D_WYE_ST[p.size]!
      return teeLike(p.size, 'd', B, A - B, [{ dir: [C, 0, C], G: Cc, size: p.size }], B)
    }
  },
  ddblwye: {
    ru: 'Двойной Wye',
    en: 'Double Wye',
    group: D,
    cat: 'Тройники',
    icon: 'dblwye',
    pn: '611',
    sizes: keysOf(DW.D_DBL_WYE),
    build: (p) => {
      const [A, B, Cc] = DW.D_DBL_WYE[p.size]!
      return teeLike(p.size, 'd', B, A - B, [{ dir: [C, 0, C], G: Cc, size: p.size }, { dir: [-C, 0, C], G: Cc, size: p.size }])
    }
  },
  combo: {
    ru: 'Комбо (Wye + 1/8 Bend)',
    en: 'Combination Wye & 1/8 Bend',
    group: D,
    cat: 'Тройники',
    icon: 'combo',
    pn: '501',
    sizes: keysOf(DW.D_COMBO),
    size2: { label: 'Размер отвода', optional: true, options: (s) => [s, ...pairOpts(DW.D_COMBO_RED, s)] },
    build: (p) => {
      const s = p.size
      const b = p.size2 ?? s
      const [A, B, Cc] = (b !== s ? DW.D_COMBO_RED.get(`${s}|${b}`) : undefined) ?? DW.D_COMBO[s]!
      return teeLike(s, 'd', Cc, B - Cc, [{ dir: X, G: A, size: b, segs: comboBranch(A, Cc, 1).segs }])
    }
  },
  ddblcombo: {
    ru: 'Двойное комбо',
    en: 'Double Combination Wye & 1/8 Bend',
    group: D,
    cat: 'Тройники',
    icon: 'dblcombo',
    pn: '507',
    sizes: keysOf(DW.D_DBL_COMBO),
    build: (p) => {
      const [A, B, Cc] = DW.D_DBL_COMBO[p.size]!
      return teeLike(p.size, 'd', Cc, B - Cc, [
        { dir: X, G: A, size: p.size, segs: comboBranch(A, Cc, 1).segs },
        { dir: NX, G: A, size: p.size, segs: comboBranch(A, Cc, -1).segs }
      ])
    }
  },

  dcoup: {
    ru: 'Муфта DWV',
    en: 'Coupling (Hub x Hub)',
    group: D,
    cat: 'Муфты и переходы',
    icon: 'coupling',
    pn: '100',
    sizes: keysOf(DW.D_COUPLING),
    build: (p) => {
      const [A, B] = DW.D_COUPLING[p.size]!
      const f = (B - A) / 2
      return coaxial([hub([0, 0, -A / 2], NZ, p.size, 'd', { face: f }), hub([0, 0, A / 2], Z, p.size, 'd', { face: f })], [])
    }
  },
  dincr: {
    ru: 'Переход (increaser-reducer)',
    en: 'Pipe Increaser-Reducer (Hub x Hub)',
    group: D,
    cat: 'Муфты и переходы',
    icon: 'reducer',
    pn: '102',
    sizes: ALL_SIZES.filter((s) => incrPartners(s).length),
    size2: { label: 'Второй размер', reversible: true, options: (s) => incrPartners(s) },
    build: (p) => {
      // порт 0 — размер size (снизу), порт 1 — size2 (сверху); работает в обе стороны
      const a = p.size
      const b = p.size2 ?? incrPartners(a)[0]
      const [small, big] = sizeIndex(a) < sizeIndex(b) ? [a, b] : [b, a]
      const [Lall, N] = DW.D_INCREASER.get(`${small}|${big}`)!
      const da = sp(a).dwv
      const db = sp(b).dwv
      const extra = Math.max(0, (Lall - N - da - db) / 2)
      const z0 = -N / 2
      const z1 = N / 2
      return coaxial(
        [hub([0, 0, z0], NZ, a, 'd', { face: da + extra }), hub([0, 0, z1], Z, b, 'd', { face: db + extra })],
        [lathe(O, Z, [[sp(a).od / 2 - sp(a).wall, z0], [bodyR(a, 'd'), z0 - 0.05], [bodyR(b, 'd'), z1 + 0.05], [sp(b).od / 2 - sp(b).wall, z1]])]
      )
    },
    bom: (p) => {
      const b = p.size2 ?? p.size
      const [small, big] = sizeIndex(p.size) < sizeIndex(b) ? [p.size, b] : [b, p.size]
      return [{ name: `${sizeLabel(small)} x ${sizeLabel(big)} PVC DWV Pipe Increaser-Reducer`, pn: '102' }]
    }
  },
  dbush: {
    ru: 'Втулка DWV (flush bushing)',
    en: 'Flush Bushing (Spigot x Hub)',
    group: D,
    cat: 'Муфты и переходы',
    icon: 'bushing',
    pn: '107',
    sizes: [...new Set([...DW.D_BUSHING.keys()].map((k) => k.split('|')[0] as SizeId))],
    size2: { label: 'Внутренний размер', options: (s) => pairOpts(DW.D_BUSHING, s) },
    build: (p) => {
      const big = p.size
      const small = p.size2 ?? pairOpts(DW.D_BUSHING, big)[0]
      const [Cc] = DW.D_BUSHING.get(`${big}|${small}`)!
      const ob = sp(big).od / 2
      const os = sp(small).od / 2
      const ri = os - sp(small).wall
      const L = sp(big).dwv + 0.06
      const depth = Math.min(sp(small).dwv, L - 0.1)
      const top = L
      return {
        ports: [spig(O, NZ, big, 'd', 0, { bare: true }), hub([0, 0, top - depth - Math.min(Cc, 0.3)], Z, small, 'd', { bare: true, depth })],
        shapes: [lathe(O, Z, [[ri, 0], [ob - 0.03, 0], [ob, 0.03], [ob, top], [os, top], [os, top - depth - Math.min(Cc, 0.3)], [ri, top - depth - Math.min(Cc, 0.3)], [ri, 0]])]
      }
    },
    bom: (p) => [{ name: `${sizeLabel(p.size)} x ${sizeLabel(p.size2 ?? p.size)} PVC DWV Flush Bushing`, pn: '107' }]
  },
  dfa: {
    ru: 'Адаптер FPT × раструб',
    en: 'Female Adapter (FPT x Hub)',
    group: D,
    cat: 'Муфты и переходы',
    icon: 'fa',
    pn: '101',
    sizes: keysOf(DW.D_FEMALE_ADAPTER),
    build: (p) => {
      const [A] = DW.D_FEMALE_ADAPTER[p.size]!
      const s = p.size
      return coaxial([hub([0, 0, -A / 2], NZ, s, 'd'), fpt([0, 0, A / 2], Z, s, 'd', NPT[s], { face: NPT[s] + 0.08, R: hubR(s, 'd') + 0.08 + sp(s).od * 0.02 })], [])
    }
  },
  dma: {
    ru: 'Адаптер MPT × раструб',
    en: 'Male Adapter (MPT x Hub)',
    group: D,
    cat: 'Муфты и переходы',
    icon: 'ma',
    pn: '109',
    sizes: keysOf(DW.D_MALE_ADAPTER),
    build: (p) => {
      const [A] = DW.D_MALE_ADAPTER[p.size]!
      const s = p.size
      return coaxial([hub([0, 0, -A / 2], NZ, s, 'd'), mpt([0, 0, A / 2 + NPT[s]], Z, s, 'd', NPT[s])], [lathe([0, 0, -A / 2], Z, [[hubR(s, 'd') + 0.04, 0], [hubR(s, 'd') + 0.04, A], [sp(s).od / 2, A]])])
    }
  },
  dtrapad: {
    ru: 'Адаптер сифона (trap adapter)',
    en: 'Trap Adapter, Hub x Tubular Slip w/ Nut',
    group: D,
    cat: 'Муфты и переходы',
    icon: 'trapad',
    pn: '104W',
    sizes: keysOf(DW.D_TRAP_ADAPTER),
    build: (p) => {
      const s = p.size
      const [A] = DW.D_TRAP_ADAPTER[s]!
      const R = hubR(s, 'd')
      const nutH = 0.55 + sp(s).od * 0.12
      return finalize({
        ports: [hub([0, 0, -A / 2], NZ, s, 'd'), { pos: [0, 0, A / 2 + nutH], dir: Z, size: s, kind: 'slip', depth: 0, fam: 'd' }],
        shapes: [
          lathe([0, 0, -A / 2], Z, [[R, 0], [R, A + 0.2], [sp(s).od / 2 - 0.1, A + 0.2]]),
          { t: 'knurl', at: [0, 0, A / 2 + 0.05], dir: Z, r: R * 1.18, h: nutH, ribs: 20 },
          lathe([0, 0, A / 2 + nutH], Z, [[R * 1.18, 0], [sp(s).od / 2 * 0.72, 0.04]])
        ]
      })
    }
  },

  cleanout: {
    ru: 'Ревизия: адаптер + пробка',
    en: 'Female Adapter (FPT x Hub) + Cleanout Plug',
    group: D,
    cat: 'Ревизии и заглушки',
    icon: 'cleanout',
    pn: '101+106',
    sizes: keysOf(DW.D_FEMALE_ADAPTER).filter((s) => s in DW.D_CO_PLUG),
    build: (p) => {
      const s = p.size
      const [A] = DW.D_FEMALE_ADAPTER[s]!
      const [PA, PB] = DW.D_CO_PLUG[s]!
      const o = sp(s).od / 2
      const R = hubR(s, 'd') + 0.08 + sp(s).od * 0.02
      const f = NPT[s] + 0.08
      const top = A / 2 + f
      const built = finalize({
        ports: [hub([0, 0, -A / 2], NZ, s, 'd'), fpt([0, 0, A / 2], Z, s, 'd', NPT[s], { face: f, R })],
        shapes: []
      })
      built.ports = built.ports.slice(0, 1) // FPT закрыт пробкой
      built.shapes.push(lathe([0, 0, top - PB], Z, [[0.001, 0], [o * 0.98, 0], [o * 0.98, PB + 0.05], [0.001, PB + 0.05]]), { t: 'prism', at: [0, 0, top + 0.05], dir: Z, sides: 4, r: o * 0.42, h: Math.max(0.3, PA - PB - 0.05) })
      return built
    },
    bom: (p) => [
      { name: `${sizeLabel(p.size)} PVC DWV Female Adapter (FPT x Hub)`, pn: '101' },
      { name: `${sizeLabel(p.size)} PVC DWV Cleanout Plug`, pn: '106' }
    ]
  },
  dfco: {
    ru: 'Ревизия в раструб (spigot) + пробка',
    en: 'Fitting Cleanout Adapter with Cleanout Plug (Spigot x FPT)',
    group: D,
    cat: 'Ревизии и заглушки',
    icon: 'cleanout',
    pn: '105X',
    sizes: keysOf(DW.D_FITTING_CO).filter((s) => s in DW.D_CO_PLUG),
    build: (p) => {
      const s = p.size
      const [A, B] = DW.D_FITTING_CO[s]!
      const [PA, PB] = DW.D_CO_PLUG[s]!
      const o = sp(s).od / 2
      const d = sp(s).dwv
      const R = hubR(s, 'd') + 0.04
      return {
        ports: [spig(O, NZ, s, 'd', d + 0.02)],
        shapes: [
          lathe(O, Z, [[o - sp(s).wall, 0], [o - 0.03, 0], [o, 0.03], [o, d + 0.02], [R, d + 0.04], [R, d + A + B], [o * 0.98, d + A + B]]),
          lathe([0, 0, d + A + B - PB], Z, [[0.001, 0], [o * 0.97, 0], [o * 0.97, PB + 0.04], [0.001, PB + 0.04]]),
          { t: 'prism', at: [0, 0, d + A + B + 0.04], dir: Z, sides: 4, r: o * 0.42, h: Math.max(0.3, PA - PB - 0.05) }
        ]
      }
    },
    bom: (p) => [
      { name: `${sizeLabel(p.size)} PVC DWV Fitting Cleanout Adapter (Spigot x FPT)`, pn: '105' },
      { name: `${sizeLabel(p.size)} PVC DWV Cleanout Plug`, pn: '106' }
    ]
  },
  dplug: {
    ru: 'Пробка ревизии MPT',
    en: 'Cleanout Plug (MPT)',
    group: D,
    cat: 'Ревизии и заглушки',
    icon: 'plug',
    pn: '106',
    sizes: keysOf(DW.D_CO_PLUG),
    build: (p) => {
      const s = p.size
      const [PA, PB] = DW.D_CO_PLUG[s]!
      const o = sp(s).od / 2
      const h = 0.6 * pitchOf(s)
      return {
        ports: [mpt(O, NZ, s, 'd', PB, { bare: true })],
        shapes: [
          lathe(O, Z, [[0.001, 0], [o - h - 0.02, 0], ...sawtooth(o - h, o, 0.02, PB, pitchOf(s)), [o + 0.08, PB], [o + 0.08, PB + 0.1], [0.001, PB + 0.1]]),
          { t: 'prism', at: [0, 0, PB + 0.1], dir: Z, sides: 4, r: o * 0.42, h: Math.max(0.3, PA - PB - 0.1) }
        ]
      }
    }
  },
  dcap: {
    ru: 'Заглушка DWV',
    en: 'Cap (Socket)',
    group: D,
    cat: 'Ревизии и заглушки',
    icon: 'cap',
    pn: '116',
    sizes: keysOf(DW.D_CAP),
    build: (p) => {
      const [A, Cc] = DW.D_CAP[p.size]!
      return capBuilt(p.size, 'd', A, Cc, false)
    }
  },

  ptrap: {
    ru: 'Сифон P-trap',
    en: 'P-Trap with Solvent Weld Joint',
    group: D,
    cat: 'Сифоны и фланцы',
    icon: 'ptrap',
    pn: '706X',
    sizes: keysOf(DW.D_PTRAP),
    build: (p) => {
      const [A, B, Cc] = DW.D_PTRAP[p.size]!
      const s = p.size
      return finalize({ ports: [hub([A, B, 0], X, s, 'd'), hub([0, Cc, 0], Y, s, 'd')], shapes: [tube(bodyR(s, 'd'), ...trapPath(A, B, Cc))] })
    }
  },
  dptrapu: {
    ru: 'Сифон P-trap с гайкой (union)',
    en: 'P-Trap with Union & Plastic Nut',
    group: D,
    cat: 'Сифоны и фланцы',
    icon: 'ptrap',
    pn: '708P',
    sizes: keysOf(DW.D_PTRAP_UNION),
    build: (p) => {
      const [A, B, Cc] = DW.D_PTRAP_UNION[p.size]!
      const s = p.size
      const R = Math.min(0.9 * Cc, 0.27 * A)
      const nutR = hubR(s, 'd') * 1.32
      const nutH = 0.45 + sp(s).od * 0.18
      return finalize({
        ports: [hub([A, B, 0], X, s, 'd'), hub([0, Cc, 0], Y, s, 'd')],
        shapes: [tube(bodyR(s, 'd'), ...trapPath(A, B, Cc)), { t: 'knurl', at: [2 * R, R + (B - R) * 0.32, 0], dir: Y, r: nutR, h: nutH, ribs: 22 }]
      })
    }
  },
  dreturn: {
    ru: 'U-колено (return bend)',
    en: 'Return Bend (Hub x Hub)',
    group: D,
    cat: 'Сифоны и фланцы',
    icon: 'return',
    pn: '700',
    sizes: keysOf(DW.D_RETURN),
    build: (p) => {
      const [A, B, Cc] = DW.D_RETURN[p.size]!
      const s = p.size
      const R = A / 2
      return finalize({
        ports: [hub([A, B, 0], Y, s, 'd'), hub([0, Cc, 0], Y, s, 'd')],
        shapes: [tube(bodyR(s, 'd'), line([A, B, 0], [A, R, 0]), { t: 'arc', a: [A, R, 0], t0: [0, -1, 0], n: NX, r: R, ang: Math.PI }, line([0, R, 0], [0, Cc, 0]))]
      })
    }
  },
  closet: {
    ru: 'Фланец унитаза',
    en: 'Closet Flange (Hub End)',
    group: D,
    cat: 'Сифоны и фланцы',
    icon: 'closet',
    pn: '800',
    sizes: keysOf(DW.D_CLOSET),
    build: (p) => closetFlange(p.size, DW.D_CLOSET[p.size]!, false),
    place: { rot: [-90, 0, 0], flushTop: (p) => DW.D_CLOSET[p.size]![1] },
    bom: (p) => [{ name: `4" x ${sizeLabel(p.size)} PVC DWV Closet Flange`, pn: '800' }]
  },
  closetAdj: {
    ru: 'Фланец унитаза с металл. кольцом',
    en: 'Closet Flange, Adjustable with Metal Ring',
    group: D,
    cat: 'Сифоны и фланцы',
    icon: 'closet',
    pn: '811',
    sizes: keysOf(DW.D_CLOSET_ADJ),
    build: (p) => closetFlange(p.size, DW.D_CLOSET_ADJ[p.size]!, true),
    place: { rot: [-90, 0, 0], flushTop: (p) => DW.D_CLOSET_ADJ[p.size]![1] },
    bom: (p) => [{ name: `4" x ${sizeLabel(p.size)} PVC DWV Closet Flange, Adjustable w/ Metal Ring`, pn: '811' }]
  }
}

function closetFlange(size: SizeId, [A, B, Cc]: number[], metal: boolean): Built {
  const s = sp(size)
  const o = s.od / 2
  const R = hubR(size, 'd')
  const d = s.dwv
  const top = B
  const throat = Math.min(sp('4').od / 2 - 0.1, R + 0.45)
  const inner = Math.min(o - s.wall + 0.15, throat - 0.25)
  const shapes: Shape[] = [
    // раструб снизу (дно на z=0, торец на z=-d) и раструб-горловина вверх до фланца
    lathe(O, Z, [[o, -d], [R, -d], [R, 0.1], [throat, top - Cc], [A / 2 - 0.15, top - Cc], [A / 2, top - Cc + 0.08], [A / 2, top], [inner + 0.06, top], [inner, top - 0.06], [inner, top - Cc - 0.25], [o - s.wall, 0.1], [o - s.wall, 0], [o, 0], [o, -d]])
  ]
  if (metal) shapes.push(lathe([0, 0, top - Cc - 0.12], Z, [[throat + 0.3, 0], [A / 2 + 0.05, 0], [A / 2 + 0.05, 0.12], [throat + 0.3, 0.12]], { color: '#a7adb3', metal: true }))
  // прорези под болты
  for (const ang of [0, Math.PI]) {
    const rr = A / 2 - 0.55
    shapes.push({ t: 'box', at: [Math.cos(ang) * rr, Math.sin(ang) * rr, top + 0.001], dir: Z, size: [0.9, 0.012, 0.32], color: '#2a2e33' })
  }
  return { ports: [hub(O, NZ, size, 'd', { bare: true })], shapes }
}

// ---------- доступ ----------
export const fittingDef = (kind: string): FittingDef => FITTINGS[kind] ?? FITTINGS.pipe
export const FITTING_ORDER = Object.keys(FITTINGS)
export const isDwvKind = (kind: string): boolean => fittingDef(kind).group === 'dwv'

const buildCache = new WeakMap<Part, Built>()
export function buildPart(p: Part): Built {
  let b = buildCache.get(p)
  if (!b) {
    b = fittingDef(p.kind).build(p)
    buildCache.set(p, b)
  }
  return b
}
export const portsOf = (p: Part): PortDef[] => buildPart(p).ports

export function bomLines(p: Part): { name: string; pn?: string }[] {
  const def = fittingDef(p.kind)
  if (def.bom) return def.bom(p)
  const fam = def.group === 'dwv' ? 'PVC DWV' : def.group === 'copper' ? 'Wrot Copper' : 'PVC Sch 40'
  const pn = def.group === 'pressure' ? (pressurePn(p.kind, p.size) ?? def.pn) : def.pn
  return [{ name: `${sizeLabel(p.size)} ${fam} ${def.en}`, pn }]
}

const PN_TABLES: Record<string, Partial<Record<SizeId, { pn?: string }>>> = {
  elbow90: PR.ELL90,
  p90fpt: PR.ELL90_FPT,
  p90st: PR.ELL90_ST,
  p90mpt: PR.ELL90_MPT,
  elbow45: PR.ELL45,
  pteefpt: PR.TEE_FPT,
  cross: PR.CROSS,
  coupling: PR.COUPLING,
  punion: PR.UNION,
  pfa: PR.FEMALE_ADAPTER,
  pma: PR.MALE_ADAPTER,
  cap: PR.CAP,
  pcapfpt: PR.CAP_FPT,
  pplug: PR.PLUG_SPG,
  pplugmpt: PR.PLUG_MPT
}
const pressurePn = (kind: string, size: SizeId): string | undefined => PN_TABLES[kind]?.[size]?.pn

export { DWV_SIZES, n }

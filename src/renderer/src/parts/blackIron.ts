// Чёрная сталь под газ: фитинги из ковкого чугуна Class 150 (ASME B16.3), резьба NPT. Размеры 1/2"–1-1/2".
// Порты: внутренняя резьба FPT (дно гнезда — pos, устье — pos + dir·глубина), наружная MPT (торец — pos).
// Вид по фото каталогов: толстые плечи почти в диаметр бурта, узкий выступающий бурт у каждого отверстия,
// скруглённое «колено» в центре, графитово-серый литой чугун.
import { SizeId, sizeLabel } from '../data/sizes'
import * as K from './kit'
import type { Built, FittingDef, PortDef, Shape, V3 } from './kit'
const { O, X, Y, Z, NZ, NX, NPT, sp, fpt, mpt, lathe, rounded, finalize, outDir } = K

export const BI_SIZES: SizeId[] = ['bi1/2', 'bi3/4', 'bi1', 'bi1-1/4', 'bi1-1/2']
const IRON = '#4b4f54'
const BRASS = '#c9a64a'
const GAS_YELLOW = '#f2c21b'

// A — центр-торец отвода 90° и тройника, C — отвода 45°, W — длина муфты, H — диаметр бурта,
// U — длина американки, Kc — высота заглушки, Bs — центр-торец наружной резьбы street-отвода, V — длина газового крана
const MI: Record<string, { A: number; C: number; W: number; H: number; U: number; Kc: number; Bs: number; V: number }> = {
  'bi1/2': { A: 1.12, C: 0.88, W: 1.34, H: 1.2, U: 1.81, Kc: 0.85, Bs: 1.62, V: 2.3 },
  'bi3/4': { A: 1.31, C: 0.98, W: 1.52, H: 1.46, U: 2.06, Kc: 0.95, Bs: 1.88, V: 2.6 },
  'bi1': { A: 1.5, C: 1.12, W: 1.67, H: 1.77, U: 2.25, Kc: 1.12, Bs: 2.18, V: 3.1 },
  'bi1-1/4': { A: 1.75, C: 1.29, W: 1.93, H: 2.15, U: 2.5, Kc: 1.25, Bs: 2.5, V: 3.6 },
  'bi1-1/2': { A: 1.94, C: 1.43, W: 2.15, H: 2.43, U: 2.69, Kc: 1.32, Bs: 2.74, V: 4.0 }
}
const mi = (s: SizeId) => MI[s]
const E = (s: SizeId): number => NPT[s] // глубина резьбы
const beadR = (s: SizeId): number => mi(s).H / 2 // бурт
const bodyR = (s: SizeId): number => mi(s).H / 2 * 0.9 // плечо корпуса — чуть тоньше бурта
const beadW = (s: SizeId): number => 0.12 + sp(s).od * 0.1 // ширина бурта
const mul = (d: V3, k: number): V3 => [d[0] * k, d[1] * k, d[2] * k]

// Полый шести-/восьмигранник (r — до грани), отверстие под трубу открыто
const hexRing = (at: V3, dir: V3, sides: number, r: number, h: number, inner: number, color: string, metal = false): Shape =>
  lathe(at, dir, [[inner, 0], [r / Math.cos(Math.PI / sides), 0], [r / Math.cos(Math.PI / sides), h], [inner, h], [inner, 0]], { color, metal, seg: sides, phi: [180 / sides, 360], flat: true })
// Гнёзда, нарисованные общим кодом, — в цвет детали
const paint = (b: Built, color: string, metal = false): Built => ({ ...b, shapes: b.shapes.map((x) => (x.t === 'lathe' && !x.color ? { ...x, color, metal } : x)) })

// Шар в центре — скруглённое «колено» отвода и узел тройника
function ball(r: number, color = IRON): Shape {
  const prof: [number, number][] = []
  for (let i = 0; i <= 24; i++) {
    const a = -Math.PI / 2 + (Math.PI * i) / 24
    prof.push([Math.max(0.001, Math.cos(a) * r), Math.sin(a) * r])
  }
  return lathe(O, Y, prof, { color, seg: 64 })
}
// Плечо от центра до гнезда (сплошной цилиндр)
const arm = (dir: V3, len: number, r: number): Shape => lathe(O, dir, [[0.001, 0], [r, 0], [r, len], [0.001, len]], { color: IRON, seg: 64 })
// Выступающий бурт у отверстия: кольцо с фасками, внутри — открыто (видна резьба)
function bead(dir: V3, end: number, s: SizeId): Shape {
  const w = beadW(s)
  const R = beadR(s)
  const ri = sp(s).od / 2 + 0.01
  return lathe(mul(dir, end - w), dir, rounded([[ri, 0], [R, 0], [R, w], [ri, w]], Math.min(0.06, w * 0.3)), { color: IRON, seg: 64 })
}
// Гнездо FPT: устье на расстоянии `end` от центра по направлению dir; снаружи — плечо, у устья — бурт
const socket = (dir: V3, end: number, s: SizeId, o: Partial<PortDef> = {}): PortDef => fpt(mul(dir, end - E(s)), dir, s, 'p', E(s), { face: E(s), R: bodyR(s), ...o })

// Отвод на угол ang (90° или 45°), центр-торец a
function ell(s: SizeId, ang: number, a: number): Built {
  const out = outDir(ang)
  const r = bodyR(s)
  const shapes: Shape[] = [arm(NZ, a - E(s), r), arm(out, a - E(s), r), ball(r), bead(NZ, a, s), bead(out, a, s)]
  return paint(finalize({ ports: [socket(NZ, a, s), socket(out, a, s)], shapes }), IRON)
}

// Тройник / крестовина: проход по Z, отвод(ы) по ±X
function teeLike(s: SizeId, cross: boolean): Built {
  const a = mi(s).A
  const r = bodyR(s)
  const dirs: V3[] = cross ? [NZ, Z, X, NX] : [NZ, Z, X]
  const shapes: Shape[] = [ball(r * 1.04), ...dirs.flatMap((d) => [arm(d, a - E(s), r), bead(d, a, s)])]
  return paint(finalize({ ports: dirs.map((d) => socket(d, a, s)), shapes }), IRON)
}

// Муфта (и переходная — второй конец меньше)
function coupling(s: SizeId, s2: SizeId = s): Built {
  const h = mi(s).W / 2
  const r1 = bodyR(s)
  const r2 = bodyR(s2)
  const shapes: Shape[] = [
    lathe([0, 0, -h + E(s) - 0.02], Z, [[sp(s).od / 2 - 0.05, 0], [r1, 0], [r1, h - E(s) + 0.02], [r2, h * 2 - E(s) - E(s2) + 0.04], [sp(s2).od / 2 - 0.05, h * 2 - E(s) - E(s2) + 0.04]], { color: IRON, seg: 64 }),
    bead(NZ, h, s),
    bead(Z, h, s2)
  ]
  return paint(finalize({ ports: [socket(NZ, h, s), socket(Z, h, s2)], shapes }), IRON)
}

// Американка (union) FPT × FPT: шестигранный конец, восьмигранная гайка, второй конец с буртом
function union(s: SizeId): Built {
  const { U, H } = mi(s)
  const h = U / 2
  const hexR = H / 2 * 1.02
  const ri = sp(s).od / 2 + 0.01
  const shapes: Shape[] = [
    hexRing([0, 0, -h], Z, 6, hexR, E(s) + 0.14, ri, IRON),
    lathe([0, 0, -h + E(s) + 0.14], Z, [[ri, 0], [hexR * 0.88, 0], [hexR * 0.88, U * 0.12], [ri, U * 0.12]], { color: IRON, seg: 64 }),
    hexRing([0, 0, -U * 0.16], Z, 8, hexR * 1.24, U * 0.38, ri, IRON),
    lathe([0, 0, U * 0.22], Z, [[ri, 0], [hexR * 0.95, 0], [hexR * 0.95, h - U * 0.22], [ri, h - U * 0.22]], { color: IRON, seg: 64 }),
    bead(Z, h, s)
  ]
  return paint(finalize({ ports: [socket(NZ, h, s, { R: hexR * 0.97 }), socket(Z, h, s, { R: hexR * 0.9 })], shapes }), IRON)
}

// Колпак (cap) FPT: устье вниз (−Z), купол сверху, бурт у устья
function cap(s: SizeId): Built {
  const r = bodyR(s)
  const top = mi(s).Kc - E(s)
  const shapes: Shape[] = [lathe(O, Z, rounded([[0.001, 0], [r, 0], [r, top * 0.45], [r * 0.78, top], [0.001, top]], r * 0.32), { color: IRON, seg: 64 }), bead(NZ, E(s), s)]
  return paint(finalize({ ports: [fpt(O, NZ, s, 'p', E(s), { face: E(s), R: r })], shapes }), IRON)
}

// Пробка (beaded plug) MPT: буртик и квадратная головка
function plug(s: SizeId): Built {
  const od = sp(s).od
  const hh = 0.28 + od * 0.25
  const collar = 0.1 + od * 0.06
  const shapes: Shape[] = [
    lathe(O, Z, rounded([[0.001, 0], [od / 2 + 0.08, 0], [od / 2 + 0.08, collar], [0.001, collar]], 0.03), { color: IRON, seg: 48 }),
    { t: 'rbox', at: [0, 0, collar + hh / 2], dir: Z, size: [od * 0.62, hh, od * 0.62], r: 0.05, color: IRON }
  ]
  return paint(finalize({ ports: [mpt(O, NZ, s, 'p', E(s))], shapes }), IRON)
}

// Футорка (hex bushing): наружная резьба s, внутренняя s2 (меньше)
function bushing(s: SizeId, s2: SizeId): Built {
  const hh = E(s2) + 0.16
  const hexR = sp(s).od / 2 * 1.08
  const shapes: Shape[] = [hexRing(O, Z, 6, hexR, hh, sp(s2).od / 2 + 0.01, IRON)]
  return paint(finalize({ ports: [mpt(O, NZ, s, 'p', E(s)), fpt([0, 0, hh - E(s2)], Z, s2, 'p', E(s2), { face: E(s2), R: hexR * 0.9 })], shapes }), IRON)
}

// Street-отвод 90°: внутренняя резьба по −Z (с буртом), наружная по +X (видна резьба)
function street90(s: SizeId): Built {
  const { A, Bs } = mi(s)
  const r = bodyR(s)
  const neck = Bs - E(s)
  const shapes: Shape[] = [
    arm(NZ, A - E(s), r),
    ball(r),
    lathe(O, X, [[0.001, 0], [r, 0], [r, r * 0.9], [sp(s).od / 2 + 0.02, neck - 0.08], [sp(s).od / 2, neck], [0.001, neck]], { color: IRON, seg: 64 }),
    bead(NZ, A, s)
  ]
  return paint(finalize({ ports: [socket(NZ, A, s), mpt([Bs, 0, 0], X, s, 'p', E(s))], shapes }), IRON)
}

// Газовый шаровой кран FPT × FPT: латунь, восьмигранные концы; ручка — жёлтая «бабочка» до 3/4", рычаг от 1"
function gasValve(s: SizeId): Built {
  const { V, H } = mi(s)
  const h = V / 2
  const od = sp(s).od
  const ri = od / 2 + 0.01
  const flat = H / 2 * 1.06
  const endL = E(s) + 0.16
  const bodyL = V - 2 * endL
  const top = flat * 0.98
  const boss = 0.26 + od * 0.08
  const stemTop = top + 0.38
  const shapes: Shape[] = [
    hexRing([0, 0, -h], Z, 8, flat, endL, ri, BRASS, true),
    hexRing([0, 0, h - endL], Z, 8, flat, endL, ri, BRASS, true),
    // корпус между концами: цилиндр с поясками
    lathe([0, 0, -h + endL], Z, rounded([[ri, 0], [flat * 0.96, 0], [flat * 0.96, bodyL], [ri, bodyL]], 0.05), { color: BRASS, metal: true, seg: 64 }),
    lathe([0, 0, -bodyL * 0.18], Z, [[flat * 0.95, 0], [flat * 1.0, 0], [flat * 1.0, 0.06], [flat * 0.95, 0.06]], { color: BRASS, metal: true, seg: 64 }),
    lathe([0, 0, bodyL * 0.18 - 0.06], Z, [[flat * 0.95, 0], [flat * 1.0, 0], [flat * 1.0, 0.06], [flat * 0.95, 0.06]], { color: BRASS, metal: true, seg: 64 }),
    // бобышка штока и гайка
    lathe([0, top * 0.6, 0], Y, rounded([[0.001, 0], [boss, 0], [boss, stemTop - top * 0.6 - 0.12], [0.001, stemTop - top * 0.6 - 0.12]], 0.04), { color: BRASS, metal: true, seg: 48 }),
    { t: 'nut', at: [0, stemTop - 0.12, 0], dir: Y, sides: 6, r: boss * 0.8, h: 0.14, ch: 0.03, color: '#c3c8cd', metal: true }
  ]
  const hy = stemTop + 0.02
  if (od < 1.2) {
    // Т-ручка «бабочка»: открыт — крылья вдоль трубы
    const span = od * 1.25 + 0.9
    shapes.push(
      { t: 'rbox', at: [0, hy + 0.2, 0], dir: Y, size: [0.42, 0.42, 0.5], r: 0.08, color: GAS_YELLOW },
      { t: 'rbox', at: [0, hy + 0.24, 0], dir: Y, size: [0.17, 0.48, span], r: 0.07, color: GAS_YELLOW }
    )
  } else {
    // рычаг вдоль трубы (открыт)
    const lever = 2.6 + od * 1.5
    shapes.push(
      { t: 'rbox', at: [0, hy + 0.1, 0.1], dir: Y, size: [0.55, 0.2, 0.75], r: 0.06, color: GAS_YELLOW },
      { t: 'rbox', at: [0, hy + 0.1, lever / 2], dir: Y, size: [0.44, 0.16, lever], r: 0.07, color: GAS_YELLOW }
    )
  }
  return paint(finalize({ ports: [socket(NZ, h, s, { R: flat * 0.97 }), socket(Z, h, s, { R: flat * 0.97 })], shapes }), BRASS, true)
}

const smaller = (s: SizeId): SizeId[] => BI_SIZES.slice(0, BI_SIZES.indexOf(s))
const MAL = (what: string) => (s: SizeId, s2?: SizeId): string => `${sizeLabel(s)}${s2 && s2 !== s ? ' x ' + sizeLabel(s2) : ''} Black Malleable Iron ${what}, Class 150`

export function registerBlackIron(F: Record<string, FittingDef>): void {
  const G = 'gas' as const
  const def = (k: string, d: Omit<FittingDef, 'group' | 'sizes'> & { sizes?: SizeId[] }): void => {
    F[k] = { group: G, sizes: BI_SIZES, ...d } as FittingDef
  }
  def('bi90', { ru: '90° Elbow', en: '90° Elbow, Black Malleable (FPT x FPT)', cat: 'Elbows', icon: 'ell90', build: (p) => ell(p.size, Math.PI / 2, mi(p.size).A), bom: (p) => [{ name: MAL('90° Elbow')(p.size) }] })
  def('bi45', { ru: '45° Elbow', en: '45° Elbow, Black Malleable (FPT x FPT)', cat: 'Elbows', icon: 'ell45', build: (p) => ell(p.size, Math.PI / 4, mi(p.size).C), bom: (p) => [{ name: MAL('45° Elbow')(p.size) }] })
  def('biStreet90', { ru: '90° Street Elbow (MPT x FPT)', en: '90° Street Elbow, Black Malleable', cat: 'Elbows', icon: 'st90', build: (p) => street90(p.size), bom: (p) => [{ name: MAL('90° Street Elbow')(p.size) }] })
  def('biTee', { ru: 'Tee', en: 'Tee, Black Malleable (FPT)', cat: 'Tees & Crosses', icon: 'tee', build: (p) => teeLike(p.size, false), bom: (p) => [{ name: MAL('Tee')(p.size) }] })
  def('biCross', { ru: 'Cross', en: 'Cross, Black Malleable (FPT)', cat: 'Tees & Crosses', icon: 'cross', build: (p) => teeLike(p.size, true), bom: (p) => [{ name: MAL('Cross')(p.size) }] })
  def('biCoupling', { ru: 'Coupling', en: 'Coupling, Black Malleable (FPT x FPT)', cat: 'Couplings & Unions', icon: 'coupling', build: (p) => coupling(p.size), bom: (p) => [{ name: MAL('Coupling')(p.size) }] })
  def('biReducer', {
    ru: 'Reducing Coupling',
    en: 'Reducing Coupling, Black Malleable (FPT x FPT)',
    cat: 'Couplings & Unions',
    icon: 'reducer',
    sizes: BI_SIZES.slice(1),
    size2: { label: 'Small end', options: smaller },
    build: (p) => coupling(p.size, p.size2 ?? smaller(p.size)[0]),
    bom: (p) => [{ name: MAL('Reducing Coupling')(p.size, p.size2) }]
  })
  def('biUnion', { ru: 'Union', en: 'Union, Black Malleable, Ground Joint (FPT x FPT)', cat: 'Couplings & Unions', icon: 'union', build: (p) => union(p.size), bom: (p) => [{ name: MAL('Union, Ground Joint')(p.size) }] })
  def('biBushing', {
    ru: 'Hex Bushing (MPT x FPT)',
    en: 'Hex Bushing, Black Malleable',
    cat: 'Couplings & Unions',
    icon: 'bushing',
    sizes: BI_SIZES.slice(1),
    size2: { label: 'Inside (FPT)', options: smaller },
    build: (p) => bushing(p.size, p.size2 ?? smaller(p.size)[0]),
    bom: (p) => [{ name: MAL('Hex Bushing')(p.size, p.size2) }]
  })
  def('biCap', { ru: 'Cap', en: 'Cap, Black Malleable (FPT)', cat: 'Caps & Plugs', icon: 'cap', build: (p) => cap(p.size), bom: (p) => [{ name: MAL('Cap')(p.size) }] })
  def('biPlug', { ru: 'Plug, Square Head (MPT)', en: 'Square Head Plug, Black', cat: 'Caps & Plugs', icon: 'cap', build: (p) => plug(p.size), bom: (p) => [{ name: MAL('Square Head Plug')(p.size) }] })
  def('biGasValve', {
    ru: 'Gas Ball Valve (FPT x FPT)',
    en: 'Gas Ball Valve, Brass, FPT x FPT (UL/CSA)',
    cat: 'Valves',
    icon: 'valve',
    build: (p) => gasValve(p.size),
    bom: (p) => [{ name: `${sizeLabel(p.size)} Brass Gas Ball Valve, FPT x FPT, UL Listed / CSA Approved` }]
  })
}


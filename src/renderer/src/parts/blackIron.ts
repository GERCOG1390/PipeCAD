// Чёрная сталь под газ: фитинги из ковкого чугуна Class 150 (ASME B16.3), резьба NPT. Размеры 1/2"–1-1/2".
// Порты: внутренняя резьба FPT (дно гнезда — pos, устье — pos + dir·глубина), наружная MPT (торец — pos).
import { SizeId, sizeLabel } from '../data/sizes'
import * as K from './kit'
import type { Built, FittingDef, PortDef, Shape, V3 } from './kit'
const { O, X, Y, Z, NZ, NX, NPT, sp, fpt, mpt, lathe, rounded, finalize, tube, bendPath, outDir, line, sawtooth, pitchOf } = K

export const BI_SIZES: SizeId[] = ['bi1/2', 'bi3/4', 'bi1', 'bi1-1/4', 'bi1-1/2']
const IRON = '#2e3135'
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
// Полый шестигранник/восьмигранник: кольцо с гранями (r — до грани), отверстие под трубу открыто
const hexRing = (at: V3, dir: V3, sides: number, r: number, h: number, inner: number, color: string, metal = false): Shape =>
  lathe(at, dir, [[inner, 0], [r / Math.cos(Math.PI / sides), 0], [r / Math.cos(Math.PI / sides), h], [inner, h], [inner, 0]], { color, metal, seg: sides, phi: [180 / sides, 360], flat: true })
// Гнёзда, нарисованные общим кодом, — в цвет детали
const paint = (b: Built, color: string, metal = false): Built => ({ ...b, shapes: b.shapes.map((x) => (x.t === 'lathe' && !x.color ? { ...x, color, metal } : x)) })
const ironTube = (r: number, ...segs: Parameters<typeof tube>[1][]): Shape => ({ ...(tube(r, ...segs) as Extract<Shape, { t: 'tube' }>), color: IRON })
const E = (s: SizeId): number => NPT[s] // глубина резьбы (затяжка от руки + ключом)
const bandR = (s: SizeId): number => mi(s).H / 2
const bodyR = (s: SizeId): number => mi(s).H / 2 * 0.84

// Гнездо FPT с буртом: устье на расстоянии `end` от центра по направлению dir
const socket = (dir: V3, end: number, s: SizeId, o: Partial<PortDef> = {}): PortDef =>
  fpt([dir[0] * (end - E(s)), dir[1] * (end - E(s)), dir[2] * (end - E(s))], dir, s, 'p', E(s), { face: E(s), R: bandR(s), ...o })

// Отвод на угол ang (90° или 45°), центр-торец a
function ell(s: SizeId, ang: number, a: number): Built {
  const out = outDir(ang)
  const shapes: Shape[] = [ironTube(bodyR(s), ...bendPath(ang, a - E(s) * 0.6, a - E(s) * 0.6, 0.55))]
  return paint(finalize({ ports: [socket(NZ, a, s), socket(out, a, s)], shapes }), IRON)
}

// Тройник / крестовина: проход по Z, отвод(ы) по ±X
function teeLike(s: SizeId, cross: boolean): Built {
  const a = mi(s).A
  const r = bodyR(s)
  const e = a - E(s) * 0.6
  const shapes: Shape[] = [
    ironTube(r, line([0, 0, -e], [0, 0, e])),
    ironTube(r, line(O, [e, 0, 0])),
    lathe(O, Y, rounded([[0.001, -r * 1.05], [r * 1.05, -r * 1.05], [r * 1.05, r * 1.05], [0.001, r * 1.05]], r * 0.5), { color: IRON, seg: 48 })
  ]
  const ports = [socket(NZ, a, s), socket(Z, a, s), socket(X, a, s)]
  if (cross) {
    shapes.push(ironTube(r, line(O, [-e, 0, 0])))
    ports.push(socket(NX, a, s))
  }
  return paint(finalize({ ports, shapes }), IRON)
}

// Муфта (и переходная — второй конец меньше)
function coupling(s: SizeId, s2: SizeId = s): Built {
  const w = mi(s).W
  const h = w / 2
  const r1 = bandR(s)
  const r2 = bandR(s2)
  const shapes: Shape[] = [
    lathe([0, 0, -h + E(s) - 0.02], Z, rounded([[sp(s).od / 2 - 0.05, 0], [r1 * 0.97, 0], [r1 * 0.97, h - E(s) + 0.02], [r2 * 0.97, w - E(s) - E(s2) + 0.04], [sp(s2).od / 2 - 0.05, w - E(s) - E(s2) + 0.04]], 0.03), { color: IRON, seg: 64 })
  ]
  return paint(finalize({ ports: [socket(NZ, h, s), socket(Z, h, s2)], shapes }), IRON)
}

// Американка (union) FPT × FPT: два шестигранных конца и гайка
function union(s: SizeId): Built {
  const { U, H } = mi(s)
  const h = U / 2
  const hexR = H / 2 * 1.02
  const shapes: Shape[] = [
    hexRing([0, 0, -h], Z, 6, hexR, E(s) + 0.12, sp(s).od / 2 + 0.01, IRON),
    hexRing([0, 0, h - E(s) - 0.12], Z, 6, hexR, E(s) + 0.12, sp(s).od / 2 + 0.01, IRON),
    hexRing([0, 0, -U * 0.18], Z, 8, hexR * 1.22, U * 0.36, sp(s).od / 2 + 0.01, IRON),
    lathe([0, 0, -h + E(s) + 0.1], Z, [[sp(s).od / 2 - 0.05, 0], [hexR * 0.92, 0], [hexR * 0.92, U - 2 * E(s) - 0.2], [sp(s).od / 2 - 0.05, U - 2 * E(s) - 0.2]], { color: IRON, seg: 48 })
  ]
  return paint(finalize({ ports: [socket(NZ, h, s, { R: hexR * 0.97 }), socket(Z, h, s, { R: hexR * 0.97 })], shapes }), IRON)
}

// Заглушка-колпак (cap) FPT: устье вниз (−Z)
function cap(s: SizeId): Built {
  const R = bandR(s)
  const top = mi(s).Kc - E(s)
  const shapes: Shape[] = [lathe(O, Z, rounded([[0.001, 0], [R, 0], [R, top * 0.55], [R * 0.82, top], [0.001, top]], R * 0.18), { color: IRON, seg: 64 })]
  return paint(finalize({ ports: [fpt(O, NZ, s, 'p', E(s), { face: E(s), R })], shapes }), IRON)
}

// Пробка (plug) MPT с квадратной головкой
function plug(s: SizeId): Built {
  const od = sp(s).od
  const hh = 0.28 + od * 0.25
  const shapes: Shape[] = [
    { t: 'rbox', at: [0, 0, hh / 2], dir: Z, size: [od * 0.62, hh, od * 0.62], r: 0.04, color: IRON },
    lathe(O, Z, [[0.001, -0.02], [od / 2 * 0.98, -0.02], [od / 2 * 0.98, 0.06], [0.001, 0.06]], { color: IRON, seg: 48 })
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

// Street-отвод 90°: внутренняя резьба по −Z, наружная по +X
function street90(s: SizeId): Built {
  const { A, Bs } = mi(s)
  const shapes: Shape[] = [
    ironTube(bodyR(s), ...bendPath(Math.PI / 2, A - E(s) * 0.6, Bs - E(s), 0.55)),
    ironTube(sp(s).od / 2, line([Bs - E(s) - 0.05, 0, 0], [Bs - E(s), 0, 0]))
  ]
  return paint(finalize({ ports: [socket(NZ, A, s), mpt([Bs, 0, 0], X, s, 'p', E(s))], shapes }), IRON)
}

// Газовый шаровой кран FPT × FPT: латунь, жёлтая ручка
function gasValve(s: SizeId): Built {
  const { V, H } = mi(s)
  const h = V / 2
  const hexR = H / 2 * 1.04
  const ballR = hexR * 1.18
  const stemH = ballR + 0.45
  const lever = 2.2 + sp(s).od * 1.4
  const shapes: Shape[] = [
    hexRing([0, 0, -h], Z, 6, hexR, E(s) + 0.14, sp(s).od / 2 + 0.01, BRASS, true),
    hexRing([0, 0, h - E(s) - 0.14], Z, 6, hexR, E(s) + 0.14, sp(s).od / 2 + 0.01, BRASS, true),
    lathe([0, 0, -h + E(s) + 0.1], Z, rounded([[sp(s).od / 2 - 0.05, 0], [hexR * 0.9, 0], [ballR, V * 0.18], [ballR, V - 2 * E(s) - 0.2 - V * 0.18], [hexR * 0.9, V - 2 * E(s) - 0.2], [sp(s).od / 2 - 0.05, V - 2 * E(s) - 0.2]], 0.12), { color: BRASS, metal: true, seg: 64 }),
    // шток, гайка штока, ручка
    lathe([0, ballR * 0.7, 0], Y, [[0.001, 0], [0.16, 0], [0.16, stemH - ballR * 0.7], [0.001, stemH - ballR * 0.7]], { color: '#c3c8cd', metal: true, seg: 24 }),
    { t: 'nut', at: [0, stemH - 0.05, 0], dir: Y, sides: 6, r: 0.24, h: 0.16, color: '#c3c8cd', metal: true },
    { t: 'rbox', at: [0, stemH + 0.12, 0], dir: Y, size: [0.75, 0.16, 0.6], r: 0.05, color: GAS_YELLOW },
    { t: 'rbox', at: [lever / 2, stemH + 0.12, 0], dir: Y, size: [lever, 0.14, 0.42], r: 0.06, color: GAS_YELLOW }
  ]
  return paint(finalize({ ports: [socket(NZ, h, s, { R: hexR * 0.97 }), socket(Z, h, s, { R: hexR * 0.97 })], shapes }), BRASS, true)
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

void sawtooth
void pitchOf

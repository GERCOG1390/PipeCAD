// Оборудование: водонагреватели, баки, тэнклесы, насосы, приямки, обратные клапаны.
import * as WH from '../data/waterHeaters'
import { ALL_SIZES, SizeId, sizeLabel } from '../data/sizes'
import * as K from './kit'
import type { Built, FittingDef, PortDef, PathSeg, Shape, V3 } from './kit'
const { O, X, Y, Z, NZ, NX, BRASS, RUBBER, STEEL, NPT, sp, hub, fpt, mpt, hubR, lathe, rounded, finalize, sawtooth, pitchOf } = K
// ---------- Газовый бойлер Bradford White ----------
// Начало координат — центр дна на полу, +Y вверх, +Z — перед (газовый блок), горячая вода слева (−X), холодная справа (+X).
// Углы phi на кожухе: 0° — перед, +90° — справа (+X).
export const WH_JACKET = '#e9e7e1'
export const WH_BLACK = '#1d1f23'
export const WH_DARK = '#2c2f34'
export const WH_GALV = '#aab0b5'
export const WH_ALU = '#c3c8cc'
export const WH_BLUE = '#1f4f9c'
export const WH_YELLOW = '#f2c230'
export const WH_GRAY = '#6d737a'
export function waterHeater(h: WH.HeaterSpec): Built {
  const R = h.B / 2
  const top = h.F
  const seg = 160
  const shapes: Shape[] = []
  const P = (deg: number, r: number, y: number): V3 => [Math.sin((deg * Math.PI) / 180) * r, y, Math.cos((deg * Math.PI) / 180) * r]
  const D = (deg: number): V3 => [Math.sin((deg * Math.PI) / 180), 0, Math.cos((deg * Math.PI) / 180)]
  // накладка на кожух: часть цилиндра от y0 до y1, по углу phi0..phi0+dphi
  const skin = (phi0: number, dphi: number, y0: number, y1: number, color: string, t = 0.025, metal = false): Shape =>
    lathe(O, Y, [[R + 0.02, y0], [R + 0.02 + t, y0], [R + 0.02 + t, y1], [R + 0.02, y1]], { color, metal, seg: 96, phi: [phi0, dphi] })

  // ---- кожух ----
  shapes.push(
    lathe(O, Y, rounded([[0.001, 1.6], [R, 1.6], [R, top - 0.5], [R - 0.2, top - 0.05], [R * 0.6, top + 0.1], [0.001, top + 0.18]], 0.55), { color: WH_JACKET, seg }),
    // верхняя крышка с отбортовкой
    lathe(O, Y, rounded([[R - 0.55, top - 0.02], [R - 0.15, top - 0.02], [R - 0.15, top + 0.12], [R - 0.55, top + 0.16]], 0.05), { color: '#dedcd5', seg }),
    // цоколь: опорное кольцо с ножками
    lathe(O, Y, rounded([[0.001, 0.0], [R - 0.35, 0], [R - 0.05, 0.35], [R - 0.05, 1.7], [0.001, 1.7]], 0.12), { color: WH_BLACK, seg })
  )
  // вертикальный шов кожуха сзади
  shapes.push(skin(178, 4, 1.7, top - 0.6, '#d3d1ca', 0.03))
  // фирменная этикетка: белое поле, синяя шапка, чёрная полоса; жёлтая EnergyGuide справа
  const ly0 = top * 0.4
  const ly1 = top * 0.78
  shapes.push(
    skin(-62, 54, ly0, ly1, '#f6f6f2', 0.04),
    skin(-62, 54, ly1 - (ly1 - ly0) * 0.22, ly1, WH_BLUE, 0.1),
    skin(-62, 54, ly0 + (ly1 - ly0) * 0.1, ly0 + (ly1 - ly0) * 0.16, WH_BLACK, 0.1),
    skin(-58, 22, ly0 + (ly1 - ly0) * 0.3, ly0 + (ly1 - ly0) * 0.6, '#c7ccd4', 0.1),
    skin(18, 26, top * 0.52, top * 0.72, WH_YELLOW, 0.04),
    skin(20, 22, top * 0.66, top * 0.7, WH_BLACK, 0.09),
    // табличка с данными (rating plate) над газовым блоком
    skin(-14, 20, h.E + 6.5, h.E + 10.5, '#b9bec3', 0.06, true)
  )
  // забор воздуха (FVIR): жалюзи по кругу у основания
  shapes.push(skin(0, 360, 1.85, 4.05, '#4a4e55', 0.03))
  for (let a = -175; a < 180; a += 7.5) shapes.push(skin(a, 3.2, 2.15, 3.75, '#0c0d0f', 0.07))
  // дверца камеры сгорания со смотровым окном
  shapes.push(
    skin(-17, 34, 4.2, Math.min(h.E - 2.4, 9.5), WH_ALU, 0.04, true),
    skin(-4, 8, 6.2, 7.6, '#0e1012', 0.09),
    skin(-1.5, 3, 6.5, 7.3, '#ff7a1a', 0.12)
  )

  // ---- газовый блок (ICON) спереди ----
  const front = h.H - R
  const cz = front - 1.45
  const cy = h.E + 1.2
  shapes.push(
    { t: 'rbox', at: [0, cy, cz], dir: Y, size: [4.4, 5.6, 2.9], r: 0.45, color: WH_DARK },
    { t: 'rbox', at: [0, cy + 0.15, cz + 1.25], dir: Y, size: [3.7, 4.6, 0.5], r: 0.3, color: '#3a3e44' },
    // поворотная ручка температуры с рифлением и указателем
    { t: 'knurl', at: [0, cy + 0.6, cz + 1.45], dir: Z, r: 1.05, h: 0.75, ribs: 18, color: '#8a9097' },
    lathe([0, cy + 0.6, cz + 2.2], Z, rounded([[0.001, 0], [1.0, 0], [0.9, 0.12], [0.001, 0.16]], 0.05), { color: '#9aa0a6', seg: 64 }),
    { t: 'box', at: [0, cy + 1.2, cz + 2.33], dir: Y, size: [0.16, 0.7, 0.06], color: '#c8352e' },
    // индикатор состояния и шкала
    lathe([1.35, cy - 1.55, cz + 1.5], Z, rounded([[0.001, 0], [0.2, 0], [0.2, 0.1], [0.001, 0.14]], 0.04), { color: '#29d16b', seg: 24 }),
    { t: 'box', at: [-0.9, cy - 1.55, cz + 1.52], dir: Y, size: [1.4, 0.35, 0.04], color: '#e6e6e0' },
    // ввод термодатчика в бак
    lathe([0, cy, cz - 1.45], Z, [[0.001, -0.4], [0.75, -0.4], [0.75, 0.2], [0.001, 0.2]], { color: WH_GALV, metal: true, seg: 48 }),
    { t: 'nut', at: [0, cy, front - 2.9 - 0.2], dir: Z, sides: 6, r: 0.8, h: 0.35, color: WH_GALV, metal: true }
  )
  // трубки к горелке: подача газа, пилот, термопара — уходят вниз в камеру сгорания
  const tubeDown = (x: number, r: number, color: string): Shape => ({
    t: 'tube',
    r,
    color,
    metal: true,
    segs: [
      { t: 'line', a: [x, cy - 2.8, cz + 0.2], b: [x, 5.6, cz + 0.2] },
      { t: 'arc', a: [x, 5.6, cz + 0.2], t0: [0, -1, 0], n: [0, 0, -1], r: 0.6, ang: Math.PI / 2 },
      { t: 'line', a: [x, 5.0, cz - 0.4], b: [x, 5.0, cz - 1.8] }
    ]
  })
  shapes.push(tubeDown(0.9, 0.22, WH_ALU), tubeDown(-0.4, 0.09, '#c27a52'), tubeDown(-0.9, 0.07, '#c27a52'))
  // газовый вход 1/2" FPT слева на блоке: прилив и шестигранник
  const gasPos: V3 = [-2.65, h.E, cz]
  shapes.push(
    { t: 'nut', at: [-2.2, h.E, cz], dir: NX, sides: 6, r: 0.62, h: 0.45, color: '#7d838a', metal: true },
    lathe([-2.2, h.E, cz], X, [[0.5, 0], [0.62, 0], [0.62, 0.15], [0.5, 0.15]], { color: '#7d838a', metal: true, seg: 48 })
  )
  const ports: PortDef[] = [fpt(gasPos, NX, '1/2', 'p', NPT['1/2'], { face: 0.5, R: 0.58 })]

  // ---- водяные патрубки: диэлектрические ниппели с термоловушками ----
  const stub = Math.max(0.6, h.G - top)
  const wsize = h.M as SizeId
  const wo = sp(wsize).od / 2
  for (const [x, color] of [[-h.J / 2, '#c8352e'], [h.J / 2, '#2563eb']] as [number, string][]) {
    ports.push(mpt([x, h.G, 0], Y, wsize, 'p', stub, { preferCu: true }))
    shapes.push(
      // приварная муфта бака, шестигранник ниппеля, цветная пластиковая втулка-маркер
      lathe([x, top - 0.1, 0], Y, rounded([[0.001, 0], [wo + 0.5, 0], [wo + 0.5, 0.18], [0.001, 0.22]], 0.06), { color: '#cfcdc6', seg: 48 }),
      { t: 'nut', at: [x, top + 0.12, 0], dir: Y, sides: 6, r: wo + 0.22, h: 0.42, color: WH_GALV, metal: true },
      lathe([x, top + 0.56, 0], Y, rounded([[wo + 0.005, 0], [wo + 0.09, 0], [wo + 0.09, 0.22], [wo + 0.005, 0.22]], 0.03), { color, seg: 48 })
    )
  }
  // анодный стержень (шестигранная головка) и маркировка HOT/COLD рисками
  shapes.push(
    { t: 'nut', at: [0, top + 0.12, -R * 0.55], dir: Y, sides: 6, r: 0.6, h: 0.4, color: WH_GALV, metal: true },
    lathe([0, top + 0.52, -R * 0.55], Y, [[0.001, 0], [0.22, 0], [0.22, 0.12], [0.001, 0.12]], { color: WH_GALV, metal: true, seg: 24 })
  )

  // ---- T&P клапан (справа-спереди), выход вниз 3/4" FPT ----
  const tA = 55
  const td = D(tA)
  const base = P(tA, R - 0.15, h.D)
  const c = P(tA, R + 2.2, h.D)
  shapes.push(
    lathe(base, td, rounded([[0.001, 0], [0.5, 0], [0.5, 0.9]], 0.05), { color: BRASS, metal: true, seg: 48 }),
    { t: 'nut', at: P(tA, R + 0.6, h.D), dir: td, sides: 6, r: 0.6, h: 0.5, color: BRASS, metal: true },
    // корпус клапана: бочка с приливом
    lathe(P(tA, R + 1.05, h.D), td, rounded([[0.001, 0], [0.55, 0], [0.82, 0.45], [0.82, 1.7], [0.6, 2.0], [0.001, 2.05]], 0.12), { color: BRASS, metal: true, seg: 64 }),
    // колпак пружины сверху и тестовый рычаг
    lathe([c[0], h.D + 0.6, c[2]], Y, rounded([[0.001, 0], [0.62, 0], [0.62, 1.0], [0.45, 1.25], [0.001, 1.3]], 0.12), { color: BRASS, metal: true, seg: 48 }),
    {
      t: 'sweep',
      path: [
        [c[0], h.D + 1.95, c[2]],
        [c[0] + td[0] * 0.6, h.D + 2.05, c[2] + td[2] * 0.6],
        [c[0] + td[0] * 2.2, h.D + 1.6, c[2] + td[2] * 2.2]
      ],
      w: 0.32,
      th: 0.09,
      side: [-td[2], 0, td[0]],
      color: '#c9cdd1',
      metal: true
    },
    lathe([c[0], h.D + 1.85, c[2]], Y, [[0.001, 0], [0.18, 0], [0.18, 0.25], [0.001, 0.25]], { color: '#c9cdd1', metal: true, seg: 24 }),
    // прилив выхода вниз
    lathe([c[0], h.D - 0.3, c[2]], [0, -1, 0], rounded([[0.001, -0.3], [0.62, -0.3], [0.62, 0.55], [0.68, 0.6], [0.68, 0.95], [0.6, 1.0], [0.001, 1.0]], 0.05), { color: BRASS, metal: true, seg: 48 }),
    { t: 'nut', at: [c[0], h.D - 1.3, c[2]], dir: Y, sides: 6, r: 0.66, h: 0.42, color: BRASS, metal: true }
  )
  // вход резьбы FPT — ровно на торце прилива (y = D − 1.3)
  ports.push(fpt([c[0], h.D - 1.3 + NPT['3/4'], c[2]], [0, -1, 0], '3/4', 'p', NPT['3/4'], { face: NPT['3/4'], R: 0.66, bare: true, preferCu: true }))

  // ---- сливной кран у дна (слева-спереди): корпус, маховичок, штуцер под шланг ----
  const dA = -38
  const dd = D(dA)
  const dc = P(dA, R + 1.4, 7.5)
  shapes.push(
    lathe(P(dA, R - 0.1, 7.5), dd, rounded([[0.001, 0], [0.42, 0], [0.42, 0.7], [0.62, 0.8], [0.62, 1.9], [0.001, 2.0]], 0.08), { color: BRASS, metal: true, seg: 48 }),
    { t: 'nut', at: P(dA, R + 0.35, 7.5), dir: dd, sides: 6, r: 0.55, h: 0.4, color: BRASS, metal: true },
    lathe([dc[0], 7.5 + 0.55, dc[2]], Y, [[0.001, 0], [0.22, 0], [0.22, 0.6], [0.001, 0.6]], { color: BRASS, metal: true, seg: 24 }),
    { t: 'knurl', at: [dc[0], 7.5 + 1.1, dc[2]], dir: Y, r: 0.75, h: 0.22, ribs: 10, color: '#c8352e' },
    lathe(P(dA, R + 1.4, 7.5), [0, -1, 0], [[0.001, 0.3], [0.38, 0.3], ...sawtooth(0.36, 0.42, 0.5, 1.4, 1 / 11.5), [0.001, 1.4]], { color: BRASS, metal: true, seg: 32 })
  )

  // ---- патрубки отопления (H-модели) — заглушены пробками ----
  if (h.K && h.L) {
    for (const y of [h.K, h.L]) {
      const sd = D(-90)
      shapes.push(
        lathe(P(-90, R - 0.1, y), sd, rounded([[0.001, 0], [0.65, 0], [0.65, 0.7], [0.001, 0.7]], 0.06), { color: WH_GALV, metal: true, seg: 48 }),
        { t: 'nut', at: P(-90, R + 0.6, y), dir: sd, sides: 6, r: 0.55, h: 0.3, color: WH_GALV, metal: true },
        { t: 'nut', at: P(-90, R + 0.9, y), dir: sd, sides: 4, r: 0.3, h: 0.3, color: WH_GALV, metal: true }
      )
    }
  }

  if (h.vent === 'atm') {
    // ---- колпак тяги (draft diverter) ----
    const cR = h.C / 2
    // юбка колпака не должна доходить до водяных патрубков
    const sk = Math.min(2.6, h.J / 2 - sp(wsize).od / 2 - 0.55 - cR)
    const legH = 1.1
    for (const a of [30, 150, 270]) {
      const p0 = P(a, cR + sk - 0.4, top + 0.1)
      const p1 = P(a, cR + sk - 0.6, top + legH)
      const p2 = P(a, cR + 1.6, top + legH + 0.25)
      shapes.push({ t: 'sweep', path: [p0, p1, p2], w: 0.6, th: 0.07, side: [Math.cos((a * Math.PI) / 180), 0, -Math.sin((a * Math.PI) / 180)], color: WH_GALV, metal: true })
    }
    const skirtTop = top + legH + 1.6
    shapes.push(
      // юбка колпака с завальцованной кромкой
      lathe([0, top + legH, 0], Y, rounded([[cR + sk - 0.1, 0.05], [cR + sk, 0], [cR + sk, 0.35], [cR + 0.2, skirtTop - top - legH], [cR + 0.1, skirtTop - top - legH + 0.1]], 0.08), { color: WH_GALV, metal: true, seg }),
      lathe([0, top + legH, 0], Y, [[cR + sk - 0.1, 0.1], [cR + sk - 0.05, 0.1], [cR + 0.15, skirtTop - top - legH], [cR + 0.1, skirtTop - top - legH]], { color: '#8f959a', metal: true, seg }),
      // патрубок с гофрой (crimp) под B-vent
      lathe([0, skirtTop, 0], Y, [[cR - 0.04, 0], [cR + 0.05, 0], ...sawtooth(cR + 0.02, cR + 0.07, 0.15, Math.min(1.2, h.A - skirtTop - 0.2), 0.18), [cR + 0.05, h.A - skirtTop], [cR - 0.04, h.A - skirtTop]], { color: WH_GALV, metal: true, seg })
    )
    // защита фланца дымохода (flue baffle) — виден в центре крышки
    shapes.push(lathe([0, top + 0.1, 0], Y, [[0.001, 0], [cR + 0.35, 0], [cR + 0.35, 0.12], [0.001, 0.12]], { color: '#5d6369', metal: true, seg: 64 }))
  } else {
    // ---- power vent: плита, корпус вентилятора, мотор с рёбрами, электрика, адаптер дымохода ----
    const by = top + 0.15
    const housH = h.A - top - 3.4
    // блок вентилятора сзади: водяные патрубки (z = 0) остаются свободными
    const dz = R * 0.6
    const bz = -1.4 - dz / 2
    const hx = 0.4
    const hw = R * 0.95
    shapes.push(
      { t: 'rbox', at: [hx, by + 0.15, bz], dir: Y, size: [hw + 1.2, 0.3, dz + 0.8], r: 0.12, color: WH_DARK, metal: true },
      { t: 'rbox', at: [hx, by + 0.3 + housH / 2, bz], dir: Y, size: [hw, housH, dz], r: 1.0, color: WH_BLACK },
      // мотор вентилятора: корпус с рёбрами охлаждения и крышкой
      { t: 'knurl', at: [R * 0.18, by + 0.3 + housH, bz + 0.3], dir: Y, r: 2.3, h: 1.6, ribs: 24, color: '#3b3f45' },
      lathe([R * 0.18, by + 0.3 + housH + 1.6, bz + 0.3], Y, rounded([[0.001, 0], [2.3, 0], [2.1, 0.35], [0.001, 0.45]], 0.15), { color: '#2a2d31', seg: 64 }),
      // клеммная коробка и шнур питания вниз по кожуху
      { t: 'rbox', at: [hx + hw / 2 + 0.6, by + 1.6, bz], dir: Y, size: [1.2, 2.4, 2.6], r: 0.2, color: '#4a4e55' },
      {
        t: 'tube',
        r: 0.17,
        color: '#15171a',
        segs: [
          { t: 'line', a: [hx + hw / 2 + 1.25, by + 1.2, bz], b: [R * 0.75, by + 0.6, bz - 1] },
          { t: 'line', a: [R * 0.75, by + 0.6, bz - 1], b: [R * 0.72, by + 0.2, -R * 0.72] },
          { t: 'line', a: [R * 0.72, by + 0.2, -R * 0.72], b: [R * 0.72, top - 10, -R * 0.72] }
        ]
      },
      // реле давления с силиконовой трубкой
      { t: 'rbox', at: [hx - hw / 2 - 0.45, by + housH * 0.55, bz], dir: Y, size: [0.9, 1.6, 1.6], r: 0.15, color: '#3a3e44' },
      { t: 'tube', r: 0.12, color: '#c8352e', segs: [{ t: 'line', a: [hx - hw / 2 - 0.45, by + housH * 0.55 + 0.8, bz], b: [-R * 0.3 + 0.4, h.A - 3.0, bz - 0.4] }] }
    )
    // выход дымохода: адаптер, резиновая муфта с двумя хомутами, раструб под PVC C"
    const vSize = String(h.C) as SizeId
    const vx = -R * 0.3
    const vz = bz - 0.6
    const vo = sp(vSize).od / 2
    const rubTop = h.A
    shapes.push(
      lathe([vx, by + housH * 0.6, vz], Y, rounded([[0.001, 0], [vo + 0.35, 0], [vo + 0.35, rubTop - by - housH * 0.6 - 2.6], [0.001, rubTop - by - housH * 0.6 - 2.6]], 0.2), { color: WH_BLACK, seg: 64 }),
      lathe([vx, rubTop - 2.7, vz], Y, rounded([[vo + 0.2, 0], [vo + 0.42, 0], [vo + 0.42, 2.7], [vo + 0.2, 2.7]], 0.1), { color: '#141517', seg: 64 })
    )
    for (const yy of [rubTop - 2.3, rubTop - 0.8]) {
      shapes.push(
        lathe([vx, yy, vz], Y, [[vo + 0.42, 0], [vo + 0.46, 0], [vo + 0.46, 0.5], [vo + 0.42, 0.5]], { color: WH_ALU, metal: true, seg: 64 }),
        { t: 'rbox', at: [vx + vo + 0.62, yy + 0.25, vz], dir: Y, size: [0.42, 0.5, 0.55], r: 0.06, color: WH_ALU, metal: true }
      )
    }
    const vp = hub([vx, rubTop - sp(vSize).socket, vz], Y, vSize, 'p', { bare: true, R: vo + 0.22 })
    ports.push(vp)
  }

  const built = finalize({ ports, shapes })
  // резьбовые концы ниппелей — оцинковка
  built.shapes = built.shapes.map((s) => (s.t === 'lathe' && !s.color ? { ...s, color: WH_GALV, metal: true } : s))
  void WH_GRAY
  return built
}

// ---------- Расширительный бак Watts PLT ----------
// Начало — низ бака (клапан ниппеля воздуха), +Y — к подключению. D — диаметр, L — длина вместе с патрубком.
export const XT_ALMOND = '#ece3c6'
export const XT: { model: string; gal: number; D: number; L: number; conn: 'mpt' | 'fpt'; size: SizeId; floor?: boolean }[] = [
  { model: 'PLT-5', gal: 2.1, D: 8, L: 11, conn: 'mpt', size: '3/4' },
  { model: 'PLT-12', gal: 4.5, D: 10.5, L: 13.5, conn: 'mpt', size: '3/4' },
  { model: 'PLT-20', gal: 8.5, D: 12.5, L: 19.2, conn: 'mpt', size: '3/4' },
  { model: 'PLT-35', gal: 14, D: 16, L: 21.7, conn: 'fpt', size: '1', floor: true }
]
export function expansionTank(t: (typeof XT)[number]): Built {
  const R = t.D / 2
  const seg = 128
  const stub = 0.75
  const neckR = 0.95
  const base = t.floor ? 3.2 : 0.7 // высота низа корпуса (у напольного — стойка)
  const top = t.L - (t.conn === 'mpt' ? stub + 0.55 : 0.6)
  const hd = R * 0.42 // высота днищ
  const prof: [number, number][] = [[0.001, base]]
  for (let i = 1; i <= 14; i++) {
    const a = (i / 14) * (Math.PI / 2)
    prof.push([Math.sin(a) * R, base + hd * (1 - Math.cos(a))])
  }
  prof.push([R, top - hd])
  for (let i = 1; i <= 14; i++) {
    const a = (i / 14) * (Math.PI / 2)
    prof.push([Math.max(neckR, Math.cos(a) * R), top - hd + hd * Math.sin(a)])
  }
  prof.push([neckR, top], [0.001, top + 0.05])
  const mid = (base + top) / 2
  const shapes: Shape[] = [
    lathe(O, Y, prof, { color: XT_ALMOND, seg }),
    // шов сварки половин корпуса
    lathe(O, Y, rounded([[R - 0.01, mid - 0.18], [R + 0.08, mid - 0.1], [R + 0.08, mid + 0.1], [R - 0.01, mid + 0.18]], 0.05), { color: '#ddd3b4', seg }),
    // этикетка Watts: белое поле с синей полосой
    lathe(O, Y, [[R + 0.02, mid + 0.6], [R + 0.05, mid + 0.6], [R + 0.05, mid + R * 0.55], [R + 0.02, mid + R * 0.55]], { color: '#f4f4f0', seg: 64, phi: [-35, 70] }),
    lathe(O, Y, [[R + 0.03, mid + R * 0.3], [R + 0.08, mid + R * 0.3], [R + 0.08, mid + R * 0.45], [R + 0.03, mid + R * 0.45]], { color: '#1f5fae', seg: 64, phi: [-35, 70] }),
    // горловина из нержавейки
    lathe([0, top - 0.1, 0], Y, rounded([[0.001, 0], [neckR + 0.1, 0], [neckR + 0.1, 0.25], [0.62, 0.45], [0.62, t.L - top - (t.conn === 'mpt' ? stub : 0.6) + 0.1], [0.001, t.L - top - (t.conn === 'mpt' ? stub : 0.6) + 0.1]], 0.06), { color: '#c9ced3', metal: true, seg: 64 }),
    // ниппель воздуха (Schrader) с колпачком внизу
    lathe([0, base - 0.05, 0], [0, -1, 0], [[0.001, 0], [0.18, 0], [0.18, 0.45], [0.001, 0.45]], { color: BRASS, metal: true, seg: 24 }),
    lathe([0, base - 0.5, 0], [0, -1, 0], rounded([[0.001, 0], [0.24, 0], [0.24, 0.42], [0.001, 0.48]], 0.06), { color: '#15171a', seg: 24 })
  ]
  if (t.floor) {
    // напольная стойка-юбка с вырезом
    shapes.push(lathe(O, Y, rounded([[R * 0.78, 0], [R * 0.86, 0], [R * 0.8, base + hd * 0.3], [R * 0.72, base + hd * 0.3]], 0.08), { color: XT_ALMOND, seg }))
    shapes.push(lathe(O, Y, [[R * 0.86, 0.6], [R * 0.9, 0.6], [R * 0.9, 1.8], [R * 0.86, 1.8]], { color: '#1a1b1e', seg: 48, phi: [-20, 40] }))
  }
  const port =
    t.conn === 'mpt'
      ? mpt([0, t.L, 0], Y, t.size, 'p', stub, { preferCu: true })
      : fpt([0, t.L - NPT[t.size], 0], Y, t.size, 'p', NPT[t.size], { face: NPT[t.size], R: 0.95, preferCu: true })
  const built = finalize({ ports: [port], shapes })
  built.shapes = built.shapes.map((s) => (s.t === 'lathe' && !s.color ? { ...s, color: '#c9ced3', metal: true } : s))
  return built
}

// ---------- Проточные (tankless) конденсационные котлы ----------
// Начало — центр дна корпуса, +Y вверх, +Z — перед, задняя стенка (к стене) на z = −D/2.
// Подключения снизу: x — от левого края (вид спереди), z — от задней стенки.
export interface TanklessSpec {
  model: string
  brand: 'Navien' | 'Rinnai'
  btu: number
  W: number
  H: number
  D: number
  conns: { name: string; x: number; z: number; kind: 'mpt'; size: SizeId; water?: boolean }[]
  vents: { x: number; z: number; size: SizeId; name: string }[]
}
// Navien NPE Series Spec Sheet (Rev. 12/15): 17.3 x 27.4 x 13.2; hot 2.3" от левого края, recirc +3.0", cold +8.3"; 2.4" от задней стенки;
// вентиляция сверху: intake 4.5" от левого края, exhaust +6.7"; 3.0"/2.6" от задней стенки.
export const NAVIEN_CONNS: TanklessSpec['conns'] = [
  { name: 'Hot Out', x: 2.3, z: 2.4, kind: 'mpt', size: '3/4', water: true },
  { name: 'Recirc In', x: 5.3, z: 2.4, kind: 'mpt', size: '3/4', water: true },
  { name: 'Cold In', x: 13.6, z: 2.4, kind: 'mpt', size: '3/4', water: true },
  { name: 'Gas', x: 1.8, z: 6.2, kind: 'mpt', size: '3/4' },
  { name: 'Condensate', x: 10.8, z: 2.4, kind: 'mpt', size: '1/2' }
]
export const NAVIEN_VENTS: TanklessSpec['vents'] = [
  { x: 4.5, z: 3.0, size: '2', name: 'Intake' },
  { x: 11.2, z: 2.6, size: '2', name: 'Exhaust' }
]
// Rinnai Sensei Spec Sheet (RUi-SP-1): 18.5 x 26.4 x 11.45; размеры снизу от правого края (E, F, H) и от передней кромки (B, C, D);
// вентиляция: 5.90" от левого края.
export const rinnaiConn = (fromRight: number, fromFront: number): { x: number; z: number } => ({ x: 18.5 - fromRight, z: 11.45 - fromFront })
export const RINNAI_CONNS: TanklessSpec['conns'] = [
  { name: 'Hot Out', ...rinnaiConn(14.27, 6.16), kind: 'mpt', size: '3/4', water: true },
  { name: 'Cold In', ...rinnaiConn(9.54, 3.56), kind: 'mpt', size: '3/4', water: true },
  { name: 'Gas', ...rinnaiConn(3.57, 2.78), kind: 'mpt', size: '3/4' },
  { name: 'Condensate', x: 2.6, z: 3.0, kind: 'mpt', size: '1/2' }
]
export const RINNAI_VENTS: TanklessSpec['vents'] = [{ x: 5.9, z: 11.45 - 6.08, size: '2', name: 'Exhaust' }]
export const TANKLESS: TanklessSpec[] = [
  { model: 'NPE-240A2', brand: 'Navien', btu: 199900, W: 17.3, H: 27.4, D: 13.2, conns: NAVIEN_CONNS, vents: NAVIEN_VENTS },
  { model: 'NPE-210A2', brand: 'Navien', btu: 180000, W: 17.3, H: 27.4, D: 13.2, conns: NAVIEN_CONNS, vents: NAVIEN_VENTS },
  { model: 'NPE-180A2', brand: 'Navien', btu: 150000, W: 17.3, H: 27.4, D: 13.2, conns: NAVIEN_CONNS, vents: NAVIEN_VENTS },
  { model: 'RU199iN', brand: 'Rinnai', btu: 199000, W: 18.5, H: 26.4, D: 11.45, conns: RINNAI_CONNS, vents: RINNAI_VENTS },
  { model: 'RU180iN', brand: 'Rinnai', btu: 180000, W: 18.5, H: 26.4, D: 11.45, conns: RINNAI_CONNS, vents: RINNAI_VENTS },
  { model: 'RU160iN', brand: 'Rinnai', btu: 160000, W: 18.5, H: 26.4, D: 11.45, conns: RINNAI_CONNS, vents: RINNAI_VENTS }
]

export function tankless(t: TanklessSpec): Built {
  const { W, H, D } = t
  const back = -D / 2
  const nav = t.brand === 'Navien'
  const body = nav ? '#e9eaec' : '#eef0f2'
  const frame = nav ? '#8f959b' : '#aeb3b8'
  const DARK = '#1c1e21'
  const STEEL = '#c3c8cd'
  const shapes: Shape[] = []
  const coverD = D * 0.78
  const coverZ = back + D - coverD / 2 // центр крышки
  const fz = back + D // передняя плоскость
  // ---- корпус: стальная рама, крышка, рамка-окантовка ----
  shapes.push(
    { t: 'rbox', at: [0, H / 2, back + D * 0.4], dir: Y, size: [W, H, D * 0.8], r: 0.5, color: frame, metal: true },
    { t: 'rbox', at: [0, H / 2, coverZ], dir: Y, size: [W - 0.25, H - 0.35, coverD], r: 1.6, color: body },
    // окантовка (стык крышки и рамы)
    { t: 'rbox', at: [0, H / 2, back + D - coverD + 0.06], dir: Y, size: [W + 0.05, H - 0.2, 0.12], r: 0.3, color: '#5c6167', metal: true },
    // настенные кронштейны сверху и снизу
    { t: 'rbox', at: [0, H - 1.6, back + 0.12], dir: Y, size: [W * 0.62, 1.8, 0.25], r: 0.08, color: '#6e747a', metal: true },
    { t: 'rbox', at: [0, 2.2, back + 0.12], dir: Y, size: [W * 0.4, 1.2, 0.25], r: 0.08, color: '#6e747a', metal: true }
  )
  // винты крышки по углам (снизу)
  for (const sx of [-1, 1]) shapes.push(lathe([sx * (W / 2 - 1.4), 0.02, fz - 1.0], [0, -1, 0], rounded([[0.001, 0], [0.22, 0], [0.22, 0.08], [0.001, 0.12]], 0.03), { color: STEEL, metal: true, seg: 24 }))
  // боковые жалюзи (воздух для электроники) на раме
  for (const sx of [-1, 1]) {
    for (let i = 0; i < 9; i++) {
      shapes.push({ t: 'rbox', at: [sx * (W / 2 + 0.02), H * 0.62 + i * 0.55, back + D * 0.36], dir: Y, size: [0.06, 0.18, D * 0.42], r: 0.03, color: '#3d4247' })
    }
  }
  if (nav) {
    // «волны» крышки Navien — выпуклые рёбра
    for (const s of [-1, 1]) {
      shapes.push({
        t: 'sweep',
        path: [
          [s * W * 0.23, H - 1.0, fz + 0.01],
          [s * W * 0.18, H * 0.72, fz + 0.06],
          [s * W * 0.13, H * 0.42, fz + 0.07],
          [s * W * 0.11, H * 0.15, fz + 0.03],
          [s * W * 0.105, 1.0, fz - 0.05]
        ],
        w: 0.3,
        th: 0.14,
        rad: 0.07,
        side: X,
        color: '#d4d7da'
      })
    }
    // центральная панель с дисплеем и кнопками
    shapes.push(
      { t: 'rbox', at: [0, H * 0.2, fz - 0.02], dir: Y, size: [W * 0.21, H * 0.32, 0.3], r: 0.35, color: '#d9dcdf' },
      { t: 'rbox', at: [0, H * 0.17, fz + 0.12], dir: Y, size: [2.9, 3.4, 0.14], r: 0.3, color: DARK },
      { t: 'rbox', at: [0, H * 0.17 + 0.5, fz + 0.2], dir: Y, size: [2.1, 1.3, 0.04], r: 0.08, color: '#0d2b3c' },
      { t: 'box', at: [0, H * 0.17 + 0.55, fz + 0.23], dir: Y, size: [1.6, 0.6, 0.02], color: '#5ad0ff' }
    )
    for (const [bx, by] of [[-0.75, -0.8], [0, -0.8], [0.75, -0.8], [0, -1.35]] as [number, number][]) {
      shapes.push(lathe([bx, H * 0.17 + by, fz + 0.2], Z, rounded([[0.001, 0], [0.22, 0], [0.22, 0.06], [0.001, 0.09]], 0.03), { color: '#8a9096', seg: 32 }))
    }
    // логотип и табличка
    shapes.push(
      { t: 'rbox', at: [0, H * 0.83, fz + 0.04], dir: Y, size: [3.8, 0.55, 0.06], r: 0.05, color: '#1c3f8e' },
      { t: 'box', at: [-1.3, H * 0.83, fz + 0.08], dir: Y, size: [0.5, 0.35, 0.02], color: '#e8742a' }
    )
    // сифон конденсата снизу (белый цилиндр) и ввод кабеля
    const cx = -W / 2 + 10.8
    shapes.push(
      lathe([cx + 1.4, -0.05, back + 4.2], [0, -1, 0], rounded([[0.001, 0], [0.75, 0], [0.75, 3.2], [0.4, 3.5], [0.001, 3.5]], 0.15), { color: '#f2f2ee', seg: 64 }),
      { t: 'tube', r: 0.18, color: '#f2f2ee', segs: [{ t: 'line', a: [cx + 1.4, -3.2, back + 4.2], b: [cx + 0.4, -3.2, back + 2.4] }] }
    )
  } else {
    // Rinnai: тёмная нижняя полоса, панель управления справа, решётка
    shapes.push(
      { t: 'rbox', at: [0, 2.7, fz - 0.08], dir: Y, size: [W - 2.4, 1.5, 0.24], r: 0.25, color: '#3a3e43' },
      { t: 'rbox', at: [W * 0.22, H * 0.16 + 2.4, fz + 0.04], dir: Y, size: [3.4, 4.4, 0.18], r: 0.35, color: DARK },
      { t: 'rbox', at: [W * 0.22, H * 0.16 + 2.4 + 0.8, fz + 0.14], dir: Y, size: [2.4, 1.3, 0.04], r: 0.08, color: '#0f2a1a' },
      { t: 'box', at: [W * 0.22, H * 0.16 + 2.4 + 0.85, fz + 0.17], dir: Y, size: [1.9, 0.7, 0.02], color: '#7fe0a0' },
      { t: 'rbox', at: [W * 0.22, H * 0.16 + 2.4 - 1.6, fz + 0.13], dir: Y, size: [2.6, 0.45, 0.04], r: 0.1, color: '#c22a2a' },
      { t: 'rbox', at: [-W * 0.22, H * 0.9, fz + 0.03], dir: Y, size: [3.2, 0.6, 0.05], r: 0.08, color: '#c62828' }
    )
    for (const [bx, by] of [[-0.8, -0.5], [0, -0.5], [0.8, -0.5]] as [number, number][]) {
      shapes.push(lathe([W * 0.22 + bx, H * 0.16 + 2.4 + by, fz + 0.14], Z, rounded([[0.001, 0], [0.26, 0], [0.26, 0.06], [0.001, 0.09]], 0.03), { color: '#9aa0a6', seg: 32 }))
    }
    for (let i = 0; i < 14; i++) shapes.push({ t: 'rbox', at: [-W / 2 + 2.3 + i * 1.02, 2.7, fz + 0.05], dir: Y, size: [0.6, 1.0, 0.06], r: 0.05, color: '#16181b' })
    // PRV (предохранительный клапан) на выходе горячей воды — входит в комплект Rinnai
    const prv = rinnaiConn(10.39, 7.6)
    const px = -W / 2 + prv.x
    const pz = back + prv.z
    shapes.push(
      lathe([px, -0.05, pz], [0, -1, 0], rounded([[0.001, 0], [0.55, 0], [0.55, 1.6], [0.001, 1.6]], 0.08), { color: BRASS, metal: true, seg: 48 }),
      { t: 'nut', at: [px, -0.1, pz], dir: [0, -1, 0], sides: 6, r: 0.6, h: 0.4, color: BRASS, metal: true },
      { t: 'sweep', path: [[px, -1.0, pz], [px + 0.5, -1.2, pz], [px + 1.6, -1.15, pz]], w: 0.28, th: 0.08, side: [0, 0, 1], color: STEEL, metal: true }
    )
  }
  // ---- нижняя плита: проходы, кабельный ввод, шнур ----
  shapes.push(
    { t: 'rbox', at: [0, 0.25, back + D * 0.42], dir: Y, size: [W - 0.6, 0.5, D * 0.82], r: 0.15, color: '#55595e', metal: true },
    lathe([W / 2 - 1.4, -0.05, back + 1.6], [0, -1, 0], rounded([[0.001, 0], [0.35, 0], [0.35, 0.5], [0.2, 0.6], [0.001, 0.6]], 0.08), { color: '#202226', seg: 32 }),
    { t: 'tube', r: 0.14, color: '#202226', segs: [{ t: 'line', a: [W / 2 - 1.4, -0.6, back + 1.6], b: [W / 2 - 1.2, -6, back + 0.6] }] }
  )
  // ---- подключения снизу: шестигранник, ниппель, цветное кольцо ----
  const ports: PortDef[] = []
  for (const c of t.conns) {
    const x = -W / 2 + c.x
    const z = back + c.z
    const o = sp(c.size).od / 2
    const color = c.water ? (c.name.startsWith('Hot') ? '#c8352e' : c.name.startsWith('Cold') ? '#2563eb' : '#e0a21c') : c.name === 'Gas' ? '#e8c51a' : '#9aa0a6'
    shapes.push(
      lathe([x, 0, z], [0, -1, 0], rounded([[o + 0.05, 0], [o + 0.55, 0], [o + 0.55, 0.12], [o + 0.05, 0.12]], 0.03), { color: '#303438', seg: 48 }),
      { t: 'nut', at: [x, -0.12, z], dir: [0, -1, 0], sides: 6, r: o + 0.24, h: 0.42, ch: 0.06, color: BRASS, metal: true },
      lathe([x, -0.55, z], [0, -1, 0], rounded([[o - 0.04, 0], [o + 0.11, 0], [o + 0.11, 0.22], [o - 0.04, 0.22]], 0.03), { color, seg: 48 })
    )
    ports.push(mpt([x, -1.6, z], [0, -1, 0], c.size, 'p', 0.8, c.water ? { preferCu: true } : {}))
  }
  // ---- вентиляция: фланец с прокладкой, стопорное кольцо, патрубок PVC ----
  for (const v of t.vents) {
    const x = -W / 2 + v.x
    const z = back + v.z
    const vo = sp(v.size).od / 2
    shapes.push(
      lathe([x, H - 0.1, z], Y, rounded([[vo + 0.3, 0], [vo + 1.45, 0], [vo + 1.45, 0.22], [vo + 0.3, 0.3]], 0.08), { color: '#33373c', seg: 96 }),
      lathe([x, H + 0.12, z], Y, [[vo + 0.3, 0], [vo + 0.4, 0], [vo + 0.4, 0.1], [vo + 0.3, 0.1]], { color: '#111214', seg: 96 }),
      lathe([x, H + 0.2, z], Y, rounded([[vo + 0.03, 0], [vo + 0.36, 0], [vo + 0.36, 1.1], [vo + 0.45, 1.2], [vo + 0.45, 1.55], [vo + 0.03, 1.55]], 0.05), { color: '#ecece6', seg: 96 }),
      { t: 'knurl', at: [x, H + 0.25, z], dir: Y, r: vo + 0.62, h: 0.45, ribs: 16, color: '#3b3f44' }
    )
    for (const a of [45, 135, 225, 315]) {
      const r = (a * Math.PI) / 180
      shapes.push({ t: 'nut', at: [x + Math.cos(r) * (vo + 1.08), H + 0.2, z + Math.sin(r) * (vo + 1.08)], dir: Y, sides: 6, r: 0.14, h: 0.12, color: STEEL, metal: true })
    }
    ports.push(hub([x, H + 1.75 - sp(v.size).socket, z], Y, v.size, 'p', { bare: true, R: vo + 0.36 }))
  }
  const built = finalize({ ports, shapes })
  built.shapes = built.shapes.map((s) => (s.t === 'lathe' && !s.color ? { ...s, color: BRASS, metal: true } : s))
  return built
}

// ---------- Насосы Zoeller и приямки (sump / sewage ejector basin) ----------
// Начало — центр дна, +Y вверх. У приямка на дне «посадочное место» (порт seat), у насоса — такой же порт снизу:
// насос, выбранный при активном seat, встаёт в приямок.
export const SEAT = (y: number, dir: V3): PortDef => ({ pos: [0, y, 0], dir, size: '4', kind: 'seat', depth: 0, fam: 'd', bare: true })
export const ZOE_PLASTIC = '#18191b'

export interface PumpSpec {
  model: string
  name: string
  hp: string
  H: number // высота до верха корпуса выключателя (без ручки)
  baseR: number // радиус улитки
  baseTop: number // верх улитки
  motorR0: number // радиус корпуса двигателя внизу
  motorR1: number // ... и вверху
  caseH: number // высота корпуса выключателя
  dx: number // ось напорного патрубка по X (патрубок у основания, смотрит вверх)
  outTop: number // верх напорного патрубка
  out: SizeId
  floatX: number
  floatR: number
  floatH: number
}
// Zoeller FM2958 (M53): 10-1/16" высота, 1-1/2" FNPT вертикально у основания, поплавок вкл/выкл 7-1/4"/3".
// Zoeller M267 Waste-Mate: 14-5/8" × 13-1/16" × 11-1/4", 2" FNPT вертикально у основания.
export const PUMPS: PumpSpec[] = [
  { model: 'M53', name: 'Mighty-Mate Sump Pump, 3/10 HP, 1-1/2" FNPT', hp: '3/10 HP', H: 10.06, baseR: 3.7, baseTop: 2.7, motorR0: 3.0, motorR1: 2.55, caseH: 2.5, dx: 4.55, outTop: 3.6, out: '1-1/2', floatX: -4.4, floatR: 1.15, floatH: 4.2 },
  { model: 'M267', name: 'Waste-Mate Sewage Ejector Pump, 1/2 HP, 2" FNPT', hp: '1/2 HP', H: 14.625, baseR: 4.6, baseTop: 3.9, motorR0: 3.55, motorR1: 2.95, caseH: 2.9, dx: 5.35, outTop: 4.9, out: '2', floatX: -5.3, floatR: 1.3, floatH: 4.8 }
]
export const ZOE_GREEN = '#1d5a3d'
export const SS = '#c9ced3'

export const poly = (pts: V3[]): PathSeg[] => pts.slice(1).map((b, i) => ({ t: 'line' as const, a: pts[i], b }))

export function zoellerPump(p: PumpSpec): Built {
  const { H, baseR, baseTop, motorR0, motorR1, caseH, dx } = p
  const seg = 128
  const legH = 0.75
  const motorBot = baseTop + 0.4
  const motorTop = H - caseH
  const bossR = sp(p.out).od / 2 + 0.45
  const T = NPT[p.out]
  const G = { color: ZOE_GREEN }
  const shapes: Shape[] = []
  // ножки и рёбра основания
  const nLeg = p.model === 'M267' ? 3 : 4
  for (let i = 0; i < nLeg; i++) {
    const a = (i / nLeg) * Math.PI * 2 + Math.PI / nLeg + Math.PI / 2
    const yaw = (-a * 180) / Math.PI
    shapes.push({ t: 'rbox', at: [Math.cos(a) * baseR * 0.72, 0, Math.sin(a) * baseR * 0.72].map((v, k) => (k === 1 ? (legH + 0.3) / 2 : v)) as V3, dir: Y, size: [p.model === 'M267' ? 2.6 : 1.4, legH + 0.3, 0.7], r: 0.18, yaw, ...G })
  }
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2
    shapes.push({ t: 'rbox', at: [Math.cos(a) * (baseR - 0.15), (legH + baseTop) / 2, Math.sin(a) * (baseR - 0.15)], dir: Y, size: [0.35, baseTop - legH - 0.2, 0.35], r: 0.1, ...G })
  }
  // всасывающая решётка снизу
  shapes.push(lathe([0, legH - 0.05, 0], Y, [[0.001, 0], [baseR * 0.62, 0], [baseR * 0.62, 0.08], [0.001, 0.08]], { color: '#0c120e', seg: 64 }))
  // улитка с фланцем
  shapes.push(
    lathe([0, legH, 0], Y, rounded([[0.001, 0], [baseR * 0.7, 0], [baseR, 0.5], [baseR, baseTop - legH - 0.35], [baseR + 0.25, baseTop - legH - 0.3], [baseR + 0.25, baseTop - legH], [0.001, baseTop - legH]], 0.15), { ...G, seg }),
    // переходная шейка к двигателю
    lathe([0, baseTop - 0.05, 0], Y, rounded([[0.001, 0], [motorR0 + 0.45, 0], [motorR0 + 0.45, 0.45], [0.001, 0.45]], 0.1), { ...G, seg })
  )
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.5
    shapes.push({ t: 'nut', at: [Math.cos(a) * (baseR - 0.1), baseTop, Math.sin(a) * (baseR - 0.1)], dir: Y, sides: 6, r: 0.2, h: 0.2, color: '#a9aeb3', metal: true })
  }
  // напорный патрубок у основания + перемычка к улитке
  shapes.push(
    lathe([dx, legH, 0], Y, rounded([[0.001, 0], [bossR * 0.85, 0], [bossR, 0.6], [bossR, p.outTop - T - legH + 0.02], [0.001, p.outTop - T - legH + 0.02]], 0.12), { ...G, seg: 64 }),
    { t: 'rbox', at: [(dx + baseR * 0.55) / 2, legH + (p.outTop - legH - 1.0) / 2, 0], dir: Y, size: [dx - baseR * 0.55, p.outTop - legH - 1.0, bossR * 1.5], r: 0.35, ...G }
  )
  // корпус двигателя — усечённый конус с литыми рёбрами
  shapes.push(lathe([0, motorBot, 0], Y, rounded([[0.001, 0], [motorR0, 0], [motorR1, motorTop - motorBot - 0.3], [motorR1 - 0.25, motorTop - motorBot + 0.05], [0.001, motorTop - motorBot + 0.05]], 0.25), { ...G, seg }))
  for (const a of [Math.PI / 4, (3 * Math.PI) / 4, (5 * Math.PI) / 4, (7 * Math.PI) / 4]) {
    const rr = (motorR0 + motorR1) / 2
    shapes.push({ t: 'rbox', at: [Math.cos(a) * rr, motorBot + 0.2, Math.sin(a) * rr], dir: Y, size: [0.45, motorTop - motorBot - 0.6, 0.45], r: 0.15, yaw: (-a * 180) / Math.PI, ...G })
  }
  // корпус выключателя сверху: литая коробка с крышкой и болтом
  const cw = motorR1 * 1.45
  const cd = motorR1 * 1.3
  const cx = -motorR1 * 0.12
  shapes.push(
    { t: 'rbox', at: [cx, motorTop + caseH * 0.38, 0], dir: Y, size: [cw, caseH * 0.82, cd], r: 0.3, ...G },
    { t: 'rbox', at: [cx, motorTop + caseH * 0.88, 0], dir: Y, size: [cw + 0.25, caseH * 0.24, cd + 0.25], r: 0.12, ...G },
    { t: 'nut', at: [cx, motorTop + caseH * 0.5, cd / 2], dir: Z, sides: 6, r: 0.3, h: 0.2, color: '#b5bac0', metal: true },
    { t: 'nut', at: [cx + cw * 0.3, H - 0.02, cd * 0.25], dir: Y, sides: 6, r: 0.22, h: 0.15, color: '#b5bac0', metal: true },
    { t: 'nut', at: [cx - cw * 0.3, H - 0.02, -cd * 0.25], dir: Y, sides: 6, r: 0.22, h: 0.15, color: '#b5bac0', metal: true }
  )
  // ручка из нержавейки
  const hw = cw * 0.38
  const hh = p.model === 'M267' ? 3.0 : 2.4
  shapes.push({ t: 'tube', r: 0.13, color: SS, metal: true, segs: poly([[cx - hw, H - 0.1, -0.5], [cx - hw, H + hh - 0.3, -0.5], [cx - hw + 0.3, H + hh, -0.5], [cx + hw - 0.3, H + hh, -0.5], [cx + hw, H + hh - 0.3, -0.5], [cx + hw, H - 0.1, -0.5]]) })
  // кабельный ввод сбоку и шнур
  const cgx = cx + cw / 2
  shapes.push(
    lathe([cgx, motorTop + caseH * 0.35, -0.4], X, rounded([[0.001, 0], [0.42, 0], [0.42, 0.55], [0.28, 0.75], [0.001, 0.75]], 0.08), { color: '#121314', seg: 32 }),
    { t: 'tube', r: 0.17, color: '#111214', segs: poly([[cgx + 0.7, motorTop + caseH * 0.35, -0.4], [cgx + 1.3, motorTop + caseH * 0.1, -0.6], [cgx + 1.5, motorTop - 1.5, -1.0], [cgx + 1.4, baseTop + 0.6, -1.6], [cgx + 2.4, legH, -3.5]]) }
  )
  // поплавковый выключатель: рычаг, штанга, поплавок и защитная проволока
  const fx = p.floatX
  const yLev = motorTop + caseH * 0.45
  const fBot = legH + 1.3
  shapes.push(
    { t: 'tube', r: 0.1, color: SS, metal: true, segs: poly([[cx - cw / 2, yLev, 0.4], [fx + 0.6, yLev + 0.15, 0.4], [fx, yLev - 0.35, 0.4], [fx, fBot + p.floatH + 0.2, 0.4]]) },
    lathe([fx, fBot, 0.4], Y, rounded([[0.001, 0], [p.floatR * 0.55, 0], [p.floatR, p.floatR * 0.6], [p.floatR, p.floatH - p.floatR * 0.8], [p.floatR * 0.35, p.floatH], [0.001, p.floatH]], 0.3), { color: '#f2f2ee', seg: 64 }),
    // защита поплавка (проволочная петля)
    { t: 'tube', r: 0.1, color: SS, metal: true, segs: poly([[cx - cw / 2, motorTop + caseH * 0.15, -0.9], [fx - p.floatR - 0.35, motorTop + caseH * 0.15, -0.9], [fx - p.floatR - 0.35, motorTop + caseH * 0.15, 1.6], [cx - cw / 2, motorTop + caseH * 0.15, 1.6]]) },
    { t: 'tube', r: 0.1, color: SS, metal: true, segs: poly([[cx - cw / 2, motorTop + caseH * 0.15 + 0.3, -0.9], [cx - cw / 2 - 0.5, motorTop + caseH * 0.15 + 1.6, -0.9]]) },
    // табличка
    { t: 'rbox', at: [0, motorBot + (motorTop - motorBot) * 0.62, (motorR0 + motorR1) / 2 - 0.02], dir: Y, size: [motorR1 * 0.8, 0.6, 0.06], r: 0.05, color: '#d7dadc' }
  )
  const ports: PortDef[] = [SEAT(0, [0, -1, 0]), fpt([dx, p.outTop - T, 0], Y, p.out, 'p', T, { face: T, R: bossR })]
  const built = finalize({ ports, shapes })
  built.shapes = built.shapes.map((s) => (s.t === 'lathe' && !s.color ? { ...s, color: ZOE_GREEN } : s))
  return built
}

export interface BasinSpec {
  key: string
  name: string
  D: number // диаметр по верху
  Db: number // диаметр дна
  H: number
  sealed: boolean
  pn: string
}
export const BASINS: BasinSpec[] = [
  { key: 'sump1822', name: 'Sump Basin 18" × 22" w/ Lid', D: 18, Db: 15, H: 22, sealed: false, pn: '18x22' },
  { key: 'sump1824', name: 'Sump Basin 18" × 24" w/ Lid', D: 18, Db: 15, H: 24, sealed: false, pn: '18x24' },
  { key: 'ej1830', name: 'Sewage Ejector Basin 18" × 30", Sealed Cover', D: 18, Db: 15, H: 30, sealed: true, pn: '18x30' },
  { key: 'ej2430', name: 'Sewage Ejector Basin 24" × 30", Sealed Cover', D: 24, Db: 20, H: 30, sealed: true, pn: '24x30' }
]

export function basin(b: BasinSpec): Built {
  const { H } = b
  const r0 = b.Db / 2
  const r1 = b.D / 2
  const wall = 0.22
  const floor = 0.45
  const rAt = (y: number): number => r0 + ((r1 - r0) * y) / H
  const seg = 128
  // профиль: дно с кольцом против всплытия, гофрированная стенка, фланец сверху, внутренняя гладкая стенка
  const prof: [number, number][] = [[0.001, 0], [r0 + 1.6, 0], [r0 + 1.6, 0.6], [r0 + 0.2, 0.7]]
  for (let y = 2.5; y < H - 3; y += 3.2) {
    prof.push([rAt(y), y], [rAt(y + 0.5) + 0.3, y + 0.6], [rAt(y + 1.4) + 0.3, y + 1.4], [rAt(y + 2), y + 2])
  }
  prof.push([rAt(H - 1.2), H - 1.2], [r1 + 1.8, H - 0.6], [r1 + 1.8, H], [r1 - wall, H], [r0 - wall, floor], [0.001, floor])
  const shapes: Shape[] = [lathe(O, Y, prof, { color: ZOE_PLASTIC, seg })]
  const ports: PortDef[] = [SEAT(floor, Y)]
  // посадочное место крышки на фланце
  ports.push({ pos: [0, H, 0], dir: Y, size: b.D > 20 ? '6' : '4', kind: 'lid', depth: 0, fam: 'd', bare: true })
  if (b.sealed) {
    // 4" входной раструб сбоку, 2" вентиляция на крышке
    const yIn = H - 8
    const rIn = rAt(yIn)
    const inR = hubR('4', 'd')
    shapes.push(lathe([-rIn + 0.6, yIn, 0], [-1, 0, 0], rounded([[0.001, 0], [inR + 0.5, 0], [inR + 0.5, 0.8], [0.001, 0.8]], 0.2), { color: ZOE_PLASTIC, seg: 64 }))
    ports.push(hub([-rIn - 0.2, yIn, 0], [-1, 0, 0], '4', 'd', { R: inR }))
  } else {
    // ввод дренажа (drain tile) 4"
    const yIn = H - 6
    const rIn = rAt(yIn)
    const inR = hubR('4', 'd')
    ports.push(hub([-rIn - 0.2, yIn, 0], [-1, 0, 0], '4', 'd', { R: inR }))
  }
  const built = finalize({ ports, shapes })
  built.shapes = built.shapes.map((s) => (s.t === 'lathe' && !s.color ? { ...s, color: ZOE_PLASTIC } : s))
  return built
}

// Крышка приямка: начало — на фланце приямка, +Y вверх. Снимается (Delete) и ставится обратно на фланец.
export const basinPump = (b: BasinSpec): PumpSpec => PUMPS.find((p) => p.model === (b.sealed ? 'M267' : 'M53'))!
export function basinLid(b: BasinSpec): Built {
  const r1 = b.D / 2
  const seg = 128
  const lidC = b.sealed ? '#26292d' : '#1d4f2e'
  const shapes: Shape[] = [lathe(O, Y, rounded([[0.001, 0], [r1 + 1.6, 0], [r1 + 1.6, 0.35], [r1 + 1.2, 0.5], [0.001, 0.5]], 0.12), { color: lidC, seg })]
  // кольцевое рифление
  for (const rr of [r1 * 0.45, r1 * 0.75]) shapes.push(lathe([0, 0.48, 0], Y, [[rr, 0], [rr + 0.25, 0], [rr + 0.25, 0.08], [rr, 0.08]], { color: lidC, seg }))
  const nb = b.sealed ? 8 : 6
  for (let i = 0; i < nb; i++) {
    const a = (i / nb) * Math.PI * 2 + Math.PI / nb
    shapes.push({ t: 'nut', at: [Math.cos(a) * (r1 + 0.9), 0.45, Math.sin(a) * (r1 + 0.9)], dir: Y, sides: 6, r: 0.22, h: 0.2, color: '#b9bec3', metal: true })
  }
  // уплотнители: напорная труба (над патрубком насоса) и кабели
  const grom = (x: number, z: number, r: number): void => {
    shapes.push(lathe([x, 0.45, z], Y, rounded([[r, 0], [r + 0.45, 0], [r + 0.45, 0.25], [r, 0.25]], 0.08), { color: '#0b0b0c', seg: 48 }))
  }
  const pump = basinPump(b)
  grom(pump.dx, 0, sp(pump.out).od / 2 + 0.05)
  grom(-0.9, 0, 0.3)
  grom(-0.9, -2.2, 0.3)
  const ports: PortDef[] = [{ pos: O, dir: [0, -1, 0], size: b.D > 20 ? '6' : '4', kind: 'lid', depth: 0, fam: 'd', bare: true }]
  if (b.sealed) {
    // 2" вентиляция
    const vR = hubR('2', 'd')
    shapes.push(lathe([-3.5, 0.45, 4], Y, rounded([[0.001, 0], [vR + 0.4, 0], [vR + 0.4, 0.3], [0.001, 0.3]], 0.1), { color: '#0b0b0c', seg: 48 }))
    ports.push(hub([-3.5, 0.7, 4], Y, '2', 'd', { R: vR }))
  }
  const built = finalize({ ports, shapes })
  built.shapes = built.shapes.map((s) => (s.t === 'lathe' && !s.color ? { ...s, color: ZOE_PLASTIC } : s))
  return built
}

// ---------- Обратные клапаны для насосов ----------
// Ось Z — поток: вход по −Z (порт 0), выход по +Z (порт 1). Стрелка на корпусе показывает направление.
export const flowArrow = (x: number, y: number, z0: number, z1: number, color: string, side = false): Shape[] => [
  { t: 'rbox', at: [x, y, (z0 + z1) / 2 - 0.2], dir: Y, size: side ? [0.06, 0.16, z1 - z0 - 0.4] : [0.16, 0.06, z1 - z0 - 0.4], r: 0.025, color },
  lathe([x, y, z1 - 0.45], Z, [[0.001, 0], [0.26, 0], [0.001, 0.45]], { color, seg: 24 })
]

// Самп: подпружиненный клапан в линии, концы — резиновые муфты с двумя хомутами (садятся прямо на трубу)
export function sumpCheck(size: SizeId): Built {
  const o = sp(size).od / 2
  const seg = 128
  const B = 4.2 // корпус
  const CL = 3.0 // длина муфты
  const ins = 1.5 // на сколько труба заходит в муфту
  const bodyR = o + 0.55
  const shapes: Shape[] = [
    // корпус: две половины с фланцем по центру
    lathe(O, Z, rounded([[o - 0.12, -B / 2], [o, -B / 2], [o, -B / 2 + 0.2], [bodyR - 0.15, -B / 2 + 0.8], [bodyR, -0.55], [bodyR + 0.3, -0.45], [bodyR + 0.3, 0.45], [bodyR, 0.55], [bodyR - 0.15, B / 2 - 0.8], [o, B / 2 - 0.2], [o, B / 2], [o - 0.12, B / 2]], 0.1), { color: '#e6e8ea', seg })
  ]
  // винты фланца
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + Math.PI / 6
    shapes.push({ t: 'nut', at: [Math.cos(a) * (bodyR + 0.12), Math.sin(a) * (bodyR + 0.12), -0.47], dir: NZ, sides: 6, r: 0.12, h: 0.1, color: STEEL, metal: true })
  }
  shapes.push(...flowArrow(0, bodyR - 0.02, -B / 2 + 0.9, B / 2 - 0.9, '#2a6fd1'))
  // шейки корпуса (входят в муфты) и муфты с хомутами
  for (const s of [-1, 1]) {
    const z0 = s * (B / 2)
    const neckEnd = s * (B / 2 + CL - ins)
    shapes.push(lathe([0, 0, z0], [0, 0, s], [[o - 0.12, 0], [o, 0], [o, Math.abs(neckEnd - z0)], [o - 0.12, Math.abs(neckEnd - z0)]], { color: '#e6e8ea', seg: 64 }))
    const Rc = o + 0.22
    shapes.push(lathe([0, 0, z0 - s * 0.1], [0, 0, s], rounded([[o, 0], [Rc - 0.04, 0], [Rc, 0.06], [Rc, CL + 0.1], [o, CL + 0.1]], 0.05), { color: RUBBER, seg }))
    for (const k of [0.75, CL - 0.6]) {
      const z = z0 + s * k
      const Rb = Rc + 0.03
      shapes.push(
        lathe([0, 0, z - 0.25], Z, rounded([[Rc, 0], [Rb, 0], [Rb, 0.5], [Rc, 0.5]], 0.012), { color: STEEL, metal: true, seg }),
        { t: 'box', at: [0, Rb + 0.11, z], dir: Y, size: [0.62, 0.22, 0.47], color: STEEL, metal: true },
        { t: 'nut', at: [-0.5, Rb + 0.13, z], dir: X, sides: 6, r: 0.156, h: 0.17, color: STEEL, metal: true }
      )
    }
  }
  const pz = B / 2 + CL - ins
  return {
    ports: [
      hub([0, 0, -pz], NZ, size, 'p', { bare: true, depth: ins, face: ins + 0.1, R: o + 0.25, mech: true }),
      hub([0, 0, pz], Z, size, 'p', { bare: true, depth: ins, face: ins + 0.1, R: o + 0.25, mech: true })
    ],
    shapes
  }
}

// Эжектор: PVC клапан обратного хода (swing) с крышкой сверху и накидными гайками; концы — раструбы под клей
export function ejectorCheck(size: SizeId): Built {
  const o = sp(size).od / 2
  const seg = 128
  const GRAY = '#8e959b'
  const R = o + 0.7
  const shapes: Shape[] = [
    // корпус
    lathe(O, Z, rounded([[0.001, -2.0], [o + 0.35, -2.0], [R, -1.2], [R, 1.2], [o + 0.35, 2.0], [0.001, 2.0]], 0.35), { color: GRAY, seg }),
    // горловина и крышка (доступ к заслонке)
    lathe([0, 0, 0.15], Y, rounded([[0.001, 0], [R * 0.75, 0], [R * 0.75, R + 0.55], [0.001, R + 0.55]], 0.15), { color: GRAY, seg: 96 }),
    { t: 'knurl', at: [0, R + 0.1, 0.15], dir: Y, r: R * 0.85, h: 0.7, ribs: 24, color: GRAY },
    lathe([0, R + 0.8, 0.15], Y, rounded([[0.001, 0], [R * 0.85, 0], [R * 0.85, 0.15], [0.001, 0.25]], 0.06), { color: GRAY, seg: 96 }),
    { t: 'nut', at: [0, R + 0.95, 0.15], dir: Y, sides: 6, r: 0.45, h: 0.3, ch: 0.05, color: GRAY }
  ]
  shapes.push(...flowArrow(R, 0, -1.0, 1.2, '#1c1e21', true))
  // накидные гайки и концевые муфты
  for (const s of [-1, 1]) {
    shapes.push(
      lathe([0, 0, s * 1.8], [0, 0, s], rounded([[o + 0.2, 0], [o + 0.6, 0], [o + 0.6, 0.6], [o + 0.2, 0.6]], 0.05), { color: GRAY, seg }),
      { t: 'knurl', at: [0, 0, s * 2.0], dir: [0, 0, s], r: R + 0.15, h: 1.0, ribs: 20, color: GRAY },
      lathe([0, 0, s * 2.0], [0, 0, s], rounded([[o + 0.2, 0], [R + 0.1, 0], [R + 0.1, 1.0], [o + 0.4, 1.15], [o + 0.2, 1.15]], 0.08), { color: GRAY, seg })
    )
  }
  const pz = 3.1
  const built = finalize({
    ports: [hub([0, 0, -pz], NZ, size, 'p', { R: o + 0.35 }), hub([0, 0, pz], Z, size, 'p', { R: o + 0.35 })],
    shapes
  })
  built.shapes = built.shapes.map((s) => (s.t === 'lathe' && !s.color ? { ...s, color: GRAY } : s))
  return built
}


// Габариты приямка для выреза в плите/грунте
export const basinDims = (kind: string): { r: number; H: number } | undefined => {
  const b = BASINS.find((x) => 'pit_' + x.key === kind)
  return b ? { r: b.D / 2, H: b.H } : undefined
}
export const basinRadius = (kind: string): number | undefined => {
  const b = BASINS.find((x) => 'pit_' + x.key === kind)
  return b ? b.D / 2 : undefined
}

// Регистрация оборудования в реестре деталей
export function registerEquipment(F: Record<string, FittingDef>): void {
  // Газовые бойлеры: по позиции на модель
  for (const h of WH.HEATERS) {
    F['wh_' + h.model] = {
      ru: `${h.gal} Gal ${h.vent === 'pv' ? 'Power Vent' : 'Atmospheric'}${h.note ? ' · ' + h.note : ''}`,
      en: `Bradford White ${h.model}`,
      group: 'heater',
      cat: h.vent === 'pv' ? 'Gas — Power Vent' : 'Gas — Atmospheric Vent',
      icon: 'heater',
      pn: h.model,
      sizes: ALL_SIZES,
      place: { rot: [0, 0, 0], height: 0, always: true },
      build: () => waterHeater(h),
      bom: () => [{ name: `Bradford White ${h.model} ${h.gal} Gal Natural Gas Water Heater, ${h.vent === 'pv' ? 'Power Vent' : 'Atmospheric Vent'}${h.btu ? ', ' + h.btu.toLocaleString('en-US') + ' BTU' : ''}`, pn: h.model }]
    }
  }

  // Расширительные баки
  for (const t of XT) {
    F['xt_' + t.model] = {
      ru: 'Expansion Tank ' + t.gal + ' Gal' + (t.floor ? ' · Floor' : ''),
      en: 'Watts ' + t.model + ' Potable Water Thermal Expansion Tank',
      group: 'heater',
      cat: 'Thermal Expansion Tanks',
      icon: 'xtank',
      pn: t.model,
      sizes: ALL_SIZES,
      place: { rot: [0, 0, 0], height: 0 },
      build: () => expansionTank(t),
      bom: () => [{ name: 'Watts ' + t.model + ' Thermal Expansion Tank, ' + t.gal + ' Gal, ' + sizeLabel(t.size) + (t.conn === 'mpt' ? ' MNPT' : ' FNPT'), pn: t.model }]
    }
  }

  // Проточные котлы (tankless)
  for (const t of TANKLESS) {
    F['tl_' + t.model] = {
      ru: t.brand + ' ' + t.model + ' · ' + Math.round(t.btu / 1000) + 'k BTU',
      en: t.brand + ' ' + t.model + ' Condensing Tankless Water Heater',
      group: 'heater',
      cat: 'Gas — Tankless (Condensing)',
      icon: 'tankless',
      pn: t.model,
      sizes: ALL_SIZES,
      // висит на стене: низ корпуса на высоте 48" от пола
      place: { rot: [0, 0, 0], height: 48, always: true },
      build: () => tankless(t),
      bom: () => [{ name: t.brand + ' ' + t.model + ' Indoor Condensing Tankless Water Heater, Natural Gas, ' + t.btu.toLocaleString('en-US') + ' BTU', pn: t.model }]
    }
  }

  for (const p of PUMPS) {
    F['pump_' + p.model] = {
      ru: 'Zoeller ' + p.model + ' · ' + p.hp + ' · ' + sizeLabel(p.out) + ' out',
      en: 'Zoeller ' + p.model + ' ' + p.name,
      group: 'pump',
      cat: 'Pumps — Zoeller',
      icon: 'pump',
      pn: p.model,
      sizes: ALL_SIZES,
      // ставится на пол или (если выбрано посадочное место) на дно приямка
      place: { rot: [0, 0, 0], height: 0, always: true },
      build: () => zoellerPump(p),
      bom: () => [{ name: 'Zoeller ' + p.model + ' ' + p.name + ', 115V', pn: p.model }]
    }
  }
  for (const b of BASINS) {
    F['pit_' + b.key] = {
      ru: b.name,
      en: b.name + ' (polyethylene)',
      group: 'pump',
      cat: b.sealed ? 'Basins — Sewage Ejector' : 'Basins — Sump',
      icon: 'basin',
      pn: b.pn,
      sizes: ALL_SIZES,
      // утоплен в пол: крышка на уровне пола
      place: { rot: [0, 0, 0], height: -b.H, always: true },
      build: () => basin(b),
      bom: () => [{ name: b.name + ', polyethylene' + (b.sealed ? ', 4" inlet hub, 2" vent' : ', 4" inlet'), pn: b.pn }]
    }
    F['lid_' + b.key] = {
      ru: (b.sealed ? 'Sealed cover' : 'Lid') + ' for ' + b.pn + ' basin',
      en: (b.sealed ? 'Sealed bolt-down cover' : 'Snap-on lid') + ' for ' + b.D + '" basin',
      group: 'pump',
      cat: 'Basin Covers',
      icon: 'basin',
      pn: b.pn,
      sizes: ALL_SIZES,
      // ставится только на фланец приямка (выбрать кольцо на верхнем фланце)
      place: { rot: [0, 0, 0], height: 0, always: true },
      build: () => basinLid(b),
      // крышка входит в комплект приямка
      bom: () => []
    }
  }
  for (const s of ['1-1/4', '1-1/2'] as SizeId[]) {
    F['cv_sump_' + s] = {
      ru: sizeLabel(s) + ' Sump Check Valve · rubber couplings',
      en: sizeLabel(s) + ' In-Line Sump Pump Check Valve with Rubber Couplings & SS Clamps',
      group: 'pump',
      cat: 'Check Valves',
      icon: 'check',
      sizes: [s],
      build: () => sumpCheck(s),
      bom: () => [{ name: sizeLabel(s) + ' Sump Pump Check Valve, In-Line Spring, Rubber Couplings w/ SS Clamps' }]
    }
  }
  F['cv_ej_2'] = {
    ru: '2" Ejector Check Valve · PVC swing, union',
    en: '2" PVC Swing Check Valve, Union x Solvent Socket (Sewage Ejector)',
    group: 'pump',
    cat: 'Check Valves',
    icon: 'check',
    sizes: ['2'],
    build: () => ejectorCheck('2'),
    bom: () => [{ name: '2" PVC Swing Check Valve, True Union, Socket Ends (Sewage)' }]
  }
}

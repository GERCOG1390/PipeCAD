// Реестр фитингов: для каждого вида — порты (куда и чем подключается) и 3D-формы.
// Размеры берутся из каталогов Charlotte Pipe (data/charlotte*.ts).
import * as DW from './data/charlotteDwv'
import * as PR from './data/charlottePressure'
import * as NB from './data/nibcoCopper'
import * as MV from './data/muellerValves'
import * as NHD from './data/noHub'
import { ALL_SIZES, CU_SIZES, DWV_SIZES, SIZES, SizeId, n, pressureHubWall, sizeIndex, sizeLabel, sizeMatLabel, sizeSpec, threadSize } from './data/sizes'
import * as K from './parts/kit'
import { registerEquipment } from './parts/equipment'
export type { Built, FittingDef, Group, Part, PathSeg, PortDef, PortKind, Shape, V3 } from './parts/kit'
export { arcEnd, bodyR, hubR, hubWall, mates } from './parts/kit'
export { basinDims, basinRadius } from './parts/equipment'
import type { Built, Fam, FittingDef, Part, PathSeg, PortDef, Shape, V3 } from './parts/kit'
const { add, mul, C, Z, NZ, X, NX, Y, O, sp, cuWall, hubWall, hubR, bodyR, sockDepth, NPT, hub, fpt, spig, mpt, mates, pitchOf, sawtooth, hubProfile, stubProfile, finalize, line, bendPath, outDir, sweepIn, comboBranch, trapPath, tube, lathe, rounded, domeProfile, keysOf, pairOpts, incrPartners, smaller, bullBranches, bullRuns, cuKeys, cuRedPartners, BRASS, RUBBER, STEEL } = K

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

// Смеситель душа (rough-in valve) по чертежу Moen 2520/2510 Posi-Temp.
// Локальные оси: +Z — в комнату (ось картриджа), +Y — вверх. Порты: 0 горячая (−X), 1 холодная (+X), 2 душ (вверх), 3 излив ванны (вниз).
// Торцы входов — 2-3/4" между собой (±1-3/8"), выходы — 1-3/8" от центра.
const SHOWER_END = 1.375
function showerValve(kind: 'cc' | 'ips'): Built {
  const dirs: V3[] = [NX, X, Y, [0, -1, 0]]
  const ports: PortDef[] = dirs.map((d) => {
    if (kind === 'cc') {
      const sz: SizeId = 'cu1/2'
      const depth = sp(sz).socket
      return hub(mul(d, SHOWER_END - depth), d, sz, 'p', { face: depth, R: sp(sz).od / 2 + 0.09 })
    }
    const T = NPT['1/2']
    return fpt(mul(d, SHOWER_END - T), d, '1/2', 'p', T, { face: T, R: 0.6 })
  })
  const armR = 0.42
  const shapes: Shape[] = [
    // корпус и выходы к портам
    ...dirs.map((d, i) => tube(armR, line(O, mul(d, SHOWER_END - ports[i].depth)))),
    lathe([0, 0, -0.85], Z, [[0.001, 0], [0.9, 0], [1.0, 0.15], [1.0, 1.35], [0.62, 1.5], [0.62, 2.15], [0.5, 2.15], [0.5, 2.55], [0.001, 2.6]]),
    // защитная пластиковая рамка под штукатурку (plaster ground) 4-1/2"
    { t: 'box', at: [0, 0, 1.5], dir: Y, size: [4.5, 4.5, 0.08], color: '#e6e6e0' },
    // заглушка-тест (test plug) спереди
    lathe([0, 0, 1.5], Z, [[0.001, 0.05], [0.66, 0.05], [0.66, 0.45], [0.001, 0.5]], { color: '#2b2f34' })
  ]
  const built = finalize({ ports, shapes })
  // латунь: всё, что без своего цвета
  built.shapes = built.shapes.map((s) => (s.t !== 'pipe' && !('color' in s && s.color) ? { ...s, color: BRASS, ...(s.t === 'lathe' ? { metal: true } : {}) } as Shape : s))
  return built
}

// Шаровый кран под пайку по чертежу Mueller Streamline 7700S. Ось трубы — Z, шток — вверх (+Y),
// рычаг в положении «открыто» — вдоль трубы (+Z). Двухсоставный корпус: основной корпус + ввёрнутая торцевая часть (слева).
const LEVER = '#b9bdc3'
const GRIP = '#f1f1ec'
function muellerBallValve(size: SizeId): Built {
  const d = MV.MUELLER_7700S[size]!
  const o = sp(size).od / 2
  const cw = Math.max(0.05, sp(size).od * 0.065) // стенка раструба
  const cupR = o + cw
  const bodyR = Math.max(cupR * 1.55, o + 0.32)
  const half = d.C * 0.25
  const B = d.B
  const bore = d.A / 2
  const seg = 128
  const S = 0.03 + sp(size).od * 0.02 // скругления
  // основной корпус: правый раструб + шаровая камера (наружный контур, дальше — внутренний канал)
  const body = rounded(
    [
      [bore, -half * 0.55],
      [bodyR * 0.82, -half * 0.55],
      [bodyR * 0.82, -half * 0.62],
      [bodyR, -half * 0.62],
      [bodyR, half * 0.7],
      [bodyR * 0.9, half],
      [cupR + cw * 0.6, half + 0.14],
      [cupR, half + 0.2],
      [cupR, B - 0.06],
      [cupR + cw * 0.35, B - 0.02],
      [cupR + cw * 0.1, B],
      [o + 0.015, B],
      [o, B - 0.03],
      [o, B - d.F],
      [bore, B - d.F - 0.02],
      [bore, -half * 0.55]
    ],
    S
  )
  // торцевая часть (end piece): левый раструб + резьбовая шейка в корпус
  const end = rounded(
    [
      [bore, -half * 0.5],
      [bodyR * 0.8, -half * 0.5],
      [bodyR * 0.8, -half * 0.62],
      [cupR + cw * 0.5, -half - 0.12],
      [cupR, -half - 0.22],
      [cupR, -B + 0.06],
      [cupR + cw * 0.35, -B + 0.02],
      [cupR + cw * 0.1, -B],
      [o + 0.015, -B],
      [o, -B + 0.03],
      [o, -B + d.F],
      [bore, -B + d.F + 0.02],
      [bore, -half * 0.5]
    ],
    S * 0.8
  )
  // горловина штока: плавно вырастает из корпуса
  const neckR = bodyR * 0.46
  const neckTop = bodyR + d.D * 0.17
  const neck = rounded(
    [
      [0.001, bodyR * 0.5],
      [neckR * 1.55, bodyR * 0.5],
      [neckR * 1.25, bodyR * 0.9],
      [neckR, bodyR * 1.0],
      [neckR, neckTop],
      [neckR * 0.85, neckTop + 0.02],
      [0.001, neckTop + 0.02]
    ],
    S
  )
  const packH = d.D * 0.14
  const packTop = neckTop + packH
  const stemR = Math.max(0.09, bodyR * 0.15)
  const leverTh = Math.max(0.06, d.E * 0.017)
  const leverW = Math.max(0.3, d.E * 0.1)
  const leverY = d.D - leverTh * 0.5 // верх рычага у ручки — на высоте D
  const y0 = packTop + 0.03 + leverTh * 0.5 // у штока рычаг лежит сразу на сальниковой гайке
  const nutY = y0 + leverTh * 0.5
  const shapes: Shape[] = [
    lathe(O, Z, body, { color: BRASS, metal: true, seg }),
    lathe(O, Z, end, { color: BRASS, metal: true, seg }),
    // восьмигранник торцевой части — под ключ при сборке корпуса
    { t: 'nut', at: [0, 0, -half * 0.62 - 0.02 - Math.max(0.12, half * 0.36)], dir: Z, sides: 8, r: bodyR * 0.98, h: Math.max(0.12, half * 0.36), color: BRASS, metal: true },
    lathe(O, Y, neck, { color: BRASS, metal: true, seg }),
    // сальниковая гайка
    { t: 'nut', at: [0, neckTop, 0], dir: Y, sides: 6, r: neckR * 0.92, h: packH, color: BRASS, metal: true },
    // шток
    lathe([0, packTop, 0], Y, [[0.001, 0], [stemR, 0], [stemR, nutY - packTop + 0.12], [stemR * 0.7, nutY - packTop + 0.16], [0.001, nutY - packTop + 0.16]], { color: LEVER, metal: true, seg: 48 }),
    // рычаг: от гайки полоса поднимается и уходит вдоль трубы; сзади — загиб-упор
    {
      t: 'sweep',
      path: [
        [0, y0 - 0.3, -0.3],
        [0, y0 - 0.02, -0.24],
        [0, y0, -0.05],
        [0, y0, d.E * 0.12],
        [0, leverY, d.E * 0.4],
        [0, leverY, d.E]
      ],
      w: leverW,
      th: leverTh,
      rad: leverTh * 0.45,
      side: X,
      color: LEVER,
      metal: true
    },
    // виниловая ручка на конце рычага
    {
      t: 'sweep',
      path: [
        [0, leverY, d.E * 0.5],
        [0, leverY, d.E * 0.75],
        [0, leverY, d.E + 0.06]
      ],
      w: leverW * 1.3,
      th: leverTh * 3,
      rad: leverTh * 1.3,
      side: X,
      color: GRIP
    },
    // шайба и гайка рычага
    lathe([0, nutY, 0], Y, [[stemR, 0], [stemR * 2.2, 0], [stemR * 2.2, 0.03], [stemR, 0.03]], { color: LEVER, metal: true, seg: 48 }),
    { t: 'nut', at: [0, nutY + 0.03, 0], dir: Y, sides: 6, r: stemR * 1.7, h: Math.max(0.1, stemR * 1.2), color: LEVER, metal: true }
  ]
  return {
    ports: [hub([0, 0, -(B - d.F)], NZ, size, 'p', { bare: true, depth: d.F }), hub([0, 0, B - d.F], Z, size, 'p', { bare: true, depth: d.F })],
    shapes
  }
}

// PVC шаровый кран (компактный, под клей): белый корпус, красная рукоятка-флажок
function pvcBallValve(size: SizeId): Built {
  const s = sp(size)
  const o = s.od / 2
  const R = hubR(size, 'p')
  const g = s.od * 0.9 + 0.4
  const bodyR = R * 1.42
  const seg = 128
  const face = s.socket + 0.15
  const body = rounded(
    [
      [o - s.wall, -g],
      [R * 1.02, -g],
      [R * 1.02, -g * 0.62],
      [bodyR, -g * 0.3],
      [bodyR, g * 0.3],
      [R * 1.02, g * 0.62],
      [R * 1.02, g],
      [o - s.wall, g]
    ],
    0.04 + s.od * 0.03
  )
  const neckR = bodyR * 0.42
  const neckTop = bodyR + s.od * 0.25
  const hy = neckTop + 0.08
  const hw = Math.max(0.45, R * 1.2)
  const hl = R * 3.6
  const shapes: Shape[] = [
    lathe(O, Z, body, { seg }),
    lathe(O, Y, rounded([[0.001, bodyR * 0.6], [neckR * 1.5, bodyR * 0.6], [neckR, bodyR * 0.98], [neckR, neckTop], [0.001, neckTop]], 0.04), { seg }),
    // рукоятка-флажок: от штока вдоль трубы, конец шире
    { t: 'sweep', path: [[0, hy, -neckR * 0.9], [0, hy, hl * 0.4], [0, hy + 0.02, hl]], w: hw, th: Math.max(0.1, R * 0.28), rad: Math.max(0.04, R * 0.12), side: X, color: '#c8352e' },
    lathe([0, hy, 0], Y, [[0.001, 0], [neckR * 1.15, 0], [neckR * 1.15, Math.max(0.12, R * 0.35)], [0.001, Math.max(0.12, R * 0.35)]], { color: '#c8352e', seg: 64 })
  ]
  return finalize({ ports: [hub([0, 0, -g], NZ, size, 'p', { face }), hub([0, 0, g], Z, size, 'p', { face })], shapes })
}

// ---------- No-hub муфта: неопреновая манжета + гофрированный кожух из нержавейки + хомуты ----------
// Ось — Z. Трубы упираются в центральный выступ манжеты с двух сторон.
const nhKey = (a: SizeId, b: SizeId): string => (sizeIndex(a) >= sizeIndex(b) || sp(a).od >= sp(b).od ? `${a}|${b}` : `${b}|${a}`)
function noHubCoupling(a: SizeId, b: SizeId, W: number, clamps: number): Built {
  const oa = sp(a).od / 2
  const ob = sp(b).od / 2
  const big = Math.max(oa, ob)
  const gT = 0.16 + big * 0.02 // толщина манжеты над большей трубой
  const Rg = big + gT
  const Rs = Rg + 0.012 // кожух
  const lug = 0.1 // центральный выступ
  const lip = 0.07
  const seg = 128
  // манжета: внутренняя поверхность ступенчатая (разные диаметры сторон), снаружи — общий цилиндр
  const gasket = rounded(
    [
      [oa, -W / 2 - lip],
      [Rg - 0.03, -W / 2 - lip],
      [Rg, -W / 2 - lip + 0.03],
      [Rg, W / 2 + lip - 0.03],
      [Rg - 0.03, W / 2 + lip],
      [ob, W / 2 + lip],
      [ob, lug / 2],
      [Math.min(oa, ob) - 0.12, lug / 2],
      [Math.min(oa, ob) - 0.12, -lug / 2],
      [oa, -lug / 2],
      [oa, -W / 2 - lip]
    ],
    0.02
  )
  // гофрированный кожух
  const shield: [number, number][] = []
  const N = Math.max(40, Math.round(W / 0.04))
  for (let i = 0; i <= N; i++) {
    const z = -W / 2 + (W * i) / N
    shield.push([Rs + 0.014 * (1 + Math.sin((z / 0.11) * Math.PI * 2)) * 0.5, z])
  }
  const prof: [number, number][] = [[Rg, -W / 2], ...shield, [Rg, W / 2]]
  const shapes: Shape[] = [lathe(O, Z, gasket, { color: RUBBER, seg }), lathe(O, Z, prof, { color: STEEL, metal: true, seg })]
  // хомуты: лента 1/2", корпус червячного механизма сверху, винт с шестигранной головкой
  const bandW = 0.5
  const span = W - bandW - 0.08
  for (let i = 0; i < clamps; i++) {
    const z = clamps === 1 ? 0 : -span / 2 + (span * i) / (clamps - 1)
    const Rb = Rs + 0.03
    shapes.push(
      lathe([0, 0, z - bandW / 2], Z, rounded([[Rs + 0.005, 0], [Rb, 0], [Rb, bandW], [Rs + 0.005, bandW]], 0.012), { color: STEEL, metal: true, seg }),
      // корпус замка
      { t: 'box', at: [0, Rb + 0.11, z], dir: Y, size: [0.62, 0.22, bandW * 0.95], color: STEEL, metal: true },
      // винт: стержень по касательной (вдоль X) и шестигранная головка 5/16"
      lathe([-0.33, Rb + 0.13, z], X, [[0.001, 0], [0.07, 0], [0.07, 0.62], [0.001, 0.62]], { color: STEEL, metal: true, seg: 24 }),
      { t: 'nut', at: [-0.5, Rb + 0.13, z], dir: X, sides: 6, r: 0.156, h: 0.17, color: STEEL, metal: true }
    )
  }
  const depth = W / 2 - lug / 2
  return {
    ports: [
      hub([0, 0, -lug / 2], NZ, a, 'p', { bare: true, depth, face: W / 2 + lip - lug / 2, R: Rs, mech: true }),
      hub([0, 0, lug / 2], Z, b, 'p', { bare: true, depth, face: W / 2 + lip - lug / 2, R: Rs, mech: true })
    ],
    shapes
  }
}
const nhOptions = (m: Map<string, unknown>, s: SizeId): SizeId[] => {
  const out = new Set<SizeId>()
  for (const k of m.keys()) {
    const [x, y] = k.split('|') as [SizeId, SizeId]
    if (x === s) out.add(y)
    if (y === s) out.add(x)
  }
  return [...out].sort((p, q) => sizeIndex(p) - sizeIndex(q))
}
const nhSizes = (m: Map<string, unknown>): SizeId[] => ALL_SIZES.filter((s) => nhOptions(m, s).length)
const NH_EN: Record<string, string> = { pvc: 'PVC', cu: 'Copper', ci: 'Cast Iron', gs: 'Galv. Steel' }
const nhLabel = (s: SizeId): string => `${sizeLabel(s)} ${NH_EN[sp(s).mat]}`
void sizeMatLabel

const PIPE_NAME: Record<string, (sz: string) => string> = {
  pvc: (sz) => `${sz} PVC Sch 40 Pipe`,
  cu: (sz) => `${sz} Type L Copper Tube (ASTM B88)`,
  ci: (sz) => `${sz} Cast Iron No-Hub Soil Pipe (CISPI 301 / ASTM A888)`,
  gs: (sz) => `${sz} Galvanized Steel Pipe Sch 40 (ASTM A53)`
}

// Адаптер сифона (trap adapter) по чертежу Charlotte 104 W: DWV-раструб (клей) → уступ → корпус с наружной
// резьбой под накидную гайку → гайка с рёбрами и шайба под трубку сифона (tubular). Ось — Z, раструб вниз (−Z).
const SLIP_TUBE: Record<string, number> = { '1-1/4': 1.25, '1-1/2': 1.5, '2': 1.5 } // наружный диаметр трубки сифона
function trapAdapter(size: SizeId): Built {
  const s = sp(size)
  const o = s.od / 2
  const [A] = DW.D_TRAP_ADAPTER[size]!
  const R = hubR(size, 'd') + 0.02
  const depth = s.dwv
  const face = depth + 0.06
  const tube = (SLIP_TUBE[size] ?? 1.5) / 2
  const thMaj = o + 0.04 // резьба под накидную гайку
  const pitch = 1 / 11.5
  const thMin = thMaj - 0.6 * pitch
  const bore = tube + 0.03
  const z0 = A // начало резьбы (A — от уступа раструба)
  const T = 0.62 + s.od * 0.06 // длина резьбы
  const z1 = z0 + T
  const seg = 128
  // корпус: раструб, уступ, гладкая шейка, резьба; внутри — канал под трубку сифона
  const body: [number, number][] = [
    [o, -face],
    [R - 0.03, -face],
    [R, -face + 0.03],
    [R, 0],
    ...rounded([[R, 0], [R, 0.06], [thMaj + 0.02, z0 - 0.04], [thMin, z0]], 0.03).slice(1),
    ...sawtooth(thMin, thMaj, z0, z1 - 0.04, pitch),
    [thMaj - 0.03, z1],
    [bore + 0.04, z1],
    [bore, z1 - 0.06],
    [bore, 0.08],
    [o - s.wall, 0],
    [o, 0],
    [o, -face]
  ]
  // накидная гайка: стоит на резьбе, перекрывает её почти полностью
  const nutR = thMaj + 0.16 + s.od * 0.05
  const nutStart = z0 + 0.12
  const nutH = T + 0.1
  const nutTop = nutStart + nutH
  const lipT = 0.1
  const nutFace = rounded(
    [
      [nutR * 0.97, nutTop - lipT - 0.05],
      [nutR * 0.97, nutTop - 0.04],
      [nutR * 0.9, nutTop],
      [tube + 0.06, nutTop],
      [tube + 0.04, nutTop - lipT],
      [thMaj, nutTop - lipT]
    ],
    0.03
  )
  // коническая шайба: видна в отверстии гайки
  const washer: [number, number][] = [
    [tube + 0.005, nutTop - lipT - 0.02],
    [thMaj - 0.04, nutTop - lipT - 0.02],
    [tube + 0.04, nutTop - lipT - 0.32],
    [tube + 0.005, nutTop - lipT - 0.32]
  ]
  const NUT = '#ecece6'
  return {
    ports: [hub(O, NZ, size, 'd', { bare: true, depth }), { pos: [0, 0, nutTop], dir: Z, size, kind: 'slip', depth: 0, fam: 'd' }],
    shapes: [
      lathe(O, Z, body, { seg }),
      // рёбра для захвата рукой
      { t: 'knurl', at: [0, 0, nutStart], dir: Z, r: nutR, h: nutH - lipT - 0.04, ribs: 14, color: NUT },
      // внутренняя юбка гайки (закрывает резьбу изнутри)
      lathe([0, 0, nutStart], Z, rounded([[thMaj + 0.005, 0.03], [thMaj + 0.005, 0], [nutR * 0.93, 0], [nutR * 0.93, 0.03]], 0.01), { color: NUT, seg }),
      lathe(O, Z, nutFace, { color: NUT, seg }),
      lathe(O, Z, washer, { color: '#3a3d42', seg: 64 })
    ]
  }
}

// ---------- Диэлектрический юнион Watts LF3001A (FIP × пайка) ----------
// ES-LF3001A: A — гайка под ключ, B — общая длина (мм → дюймы). Ось Z: снизу (−Z) стальной адаптер FIP,
// шестигранная стальная гайка, чёрный изолятор, сверху латунный хвостовик под пайку меди.
const DIEL: Partial<Record<SizeId, { A: number; B: number }>> = {
  'cu1/2': { A: 32 / 25.4, B: 48 / 25.4 },
  'cu3/4': { A: 41 / 25.4, B: 54 / 25.4 },
  cu1: { A: 48 / 25.4, B: 64 / 25.4 }
}
const ZINC = '#bfc4c9'
function dielectricUnion(size: SizeId): Built {
  const d = DIEL[size]!
  const th = threadSize(size)
  const to = sp(th).od / 2 // резьба FIP (труба/ниппель того же номинала)
  const T = Math.min(NPT[th], d.B * 0.38)
  const pitch = pitchOf(th)
  const ra = (d.A / 2) * 0.93 // стальной адаптер
  const zA = d.B * 0.42
  const zH = d.B * 0.78 // верх гайки
  const co = sp(size).od / 2
  const cupR = co + Math.max(0.05, sp(size).od * 0.07)
  const S = sp(size).socket
  const seg = 96
  const shapes: Shape[] = [
    // стальной адаптер с внутренней резьбой FIP
    lathe(O, Z, [[to - 0.6 * pitch, 0.02], ...sawtooth(to - 0.6 * pitch, to, 0.02, T, pitch), [to * 0.82, T + 0.03], [to * 0.82, zA], [ra * 0.9, zA], ...rounded([[ra * 0.9, zA], [ra, zA - 0.06], [ra, 0.04], [ra - 0.04, 0]], 0.03).slice(1), [to + 0.03, 0], [to, 0.02]], { color: ZINC, metal: true, seg }),
    // рифление под ключ/руку на адаптере
    { t: 'knurl', at: [0, 0, 0.06], dir: Z, r: ra + 0.012, h: zA * 0.55, ribs: 28, color: ZINC },
    // шестигранная гайка
    { t: 'nut', at: [0, 0, zA - 0.08], dir: Z, sides: 6, r: d.A / 2, h: zH - zA + 0.08, ch: 0.06, color: ZINC, metal: true },
    // изолятор (полисульфон) между гайкой и хвостовиком
    lathe([0, 0, zH], Z, [[cupR * 0.98, 0], [cupR + 0.12, 0], [cupR + 0.12, 0.07], [cupR * 0.98, 0.07]], { color: '#121315', seg: 64 }),
    // латунный хвостовик под пайку
    lathe([0, 0, 0], Z, rounded([[co * 0.8, zH - 0.1], [cupR + 0.06, zH - 0.1], [cupR + 0.06, zH + 0.12], [cupR, zH + 0.2], [cupR, d.B - 0.04], [cupR - 0.015, d.B], [co + 0.015, d.B], [co, d.B - 0.03], [co, d.B - S], [co * 0.8, d.B - S - 0.02], [co * 0.8, zH - 0.1]], 0.02), { color: BRASS, metal: true, seg })
  ]
  return {
    ports: [fpt([0, 0, T], NZ, th, 'p', T, { bare: true }), hub([0, 0, d.B - S], Z, size, 'p', { bare: true, depth: S })],
    shapes
  }
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
const NH = 'nohub'

export const FITTINGS: Record<string, FittingDef> = {
  pipe: {
    ru: 'Pipe',
    en: 'Pipe',
    group: 'common',
    cat: 'Pipe',
    icon: 'pipe',
    key: 'P',
    sizes: [...PRESSURE_SIZES, ...CU_SIZES, ...SIZES.filter((s) => s.mat === 'ci' || s.mat === 'gs').map((s) => s.id)],
    build: (p) => ({
      ports: [spig(O, NZ, p.size, 'p', 0, { bare: true }), spig([0, 0, p.length ?? DEFAULT_PIPE], Z, p.size, 'p', 0, { bare: true })],
      shapes: [{ t: 'pipe', size: p.size, len: p.length ?? DEFAULT_PIPE }]
    }),
    bom: (p) => [{ name: PIPE_NAME[sp(p.size).mat](sizeLabel(p.size)) }]
  },
  // ----------------------------- МЕДЬ (NIBCO Wrot, пайка) -----------------------------
  cu90: {
    ru: '90° Elbow',
    en: '90° Elbow C x C',
    group: CU,
    cat: 'Bends',
    icon: 'ell90',
    pn: '607',
    sizes: cuKeys(NB.CU_90),
    build: (p) => cuBend(p.size, 90, NB.CU_90[p.size]![0], 0.85)
  },
  cu90lr: {
    ru: 'Long Sweep 1/4 Bend',
    en: '90° Elbow Long Radius C x C',
    group: CU,
    cat: 'Bends',
    icon: 'long90',
    pn: '607-LT',
    sizes: cuKeys(NB.CU_90_LR),
    build: (p) => cuBend(p.size, 90, NB.CU_90_LR[p.size]![0], 0.95)
  },
  cu90st: {
    ru: '90° Street Elbow (Ftg x C)',
    en: '90° Fitting Elbow Ftg x C',
    group: CU,
    cat: 'Bends',
    icon: 'st90',
    pn: '607-2',
    sizes: cuKeys(NB.CU_90_ST),
    build: (p) => {
      const [B, Cc] = NB.CU_90_ST[p.size]!
      return cuBend(p.size, 90, Cc, 0.85, B)
    }
  },
  cu45: {
    ru: '45° Elbow',
    en: '45° Elbow C x C',
    group: CU,
    cat: 'Bends',
    icon: 'ell45',
    pn: '606',
    sizes: cuKeys(NB.CU_45),
    build: (p) => cuBend(p.size, 45, NB.CU_45[p.size]![0], 0.8)
  },
  cu45st: {
    ru: '45° Street Elbow (Ftg x C)',
    en: '45° Fitting Elbow Ftg x C',
    group: CU,
    cat: 'Bends',
    icon: 'st45',
    pn: '606-2',
    sizes: cuKeys(NB.CU_45_ST),
    build: (p) => {
      const [B, Cc] = NB.CU_45_ST[p.size]!
      return cuBend(p.size, 45, Cc, 0.8, B)
    }
  },
  cuTee: {
    ru: 'Tee',
    en: 'Tee C x C x C',
    group: CU,
    cat: 'Tees',
    icon: 'tee',
    pn: '611',
    sizes: cuKeys(NB.CU_TEE),
    size2: { label: 'Branch size', optional: true, options: (s) => [s, ...pairOpts(NB.CU_TEE_RED, s)] },
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
cuBull: {
    ru: 'Bullhead Tee',
    en: 'Bullhead Tee C x C x C',
    group: CU,
    cat: 'Tees',
    icon: 'bullhead',
    pn: '611',
    sizes: bullBranches(NB.CU_TEE_BULL),
    size2: { label: 'Run size (sides)', options: (s) => bullRuns(NB.CU_TEE_BULL, s) },
    build: (p) => {
      const branch = p.size
      const run = p.size2 ?? bullRuns(NB.CU_TEE_BULL, branch)[0]
      const [Cc, G] = NB.CU_TEE_BULL.get(`${run}|${branch}`)!
      return teeLike(run, 'p', Cc, Cc, [{ dir: X, G, size: branch }])
    },
    bom: (p) => {
      const run = p.size2 ?? p.size
      return [{ name: `${sizeLabel(run)} x ${sizeLabel(run)} x ${sizeLabel(p.size)} Wrot Copper Tee C x C x C (Bullhead)`, pn: '611' }]
    }
  },
showerCC: {
    ru: 'Shower Rough-In Valve (CC, sweat)',
    en: 'Posi-Temp Pressure-Balancing Rough-In Valve 1/2" CC',
    group: CU,
    cat: 'Shower Valves',
    icon: 'shower',
    pn: '2520',
    sizes: ['cu1/2'],
    place: { rot: [0, 0, 0], height: 48 },
    build: () => showerValve('cc'),
    bom: () => [{ name: 'Moen 2520 Posi-Temp Pressure-Balancing Rough-In Valve 1/2" CC', pn: '2520' }]
  },
  showerIPS: {
    ru: 'Shower Rough-In Valve (IPS, threaded)',
    en: 'Posi-Temp Pressure-Balancing Rough-In Valve 1/2" IPS',
    group: P,
    cat: 'Shower Valves',
    icon: 'shower',
    pn: '2510',
    sizes: ['1/2'],
    place: { rot: [0, 0, 0], height: 48 },
    build: () => showerValve('ips'),
    bom: () => [{ name: 'Moen 2510 Posi-Temp Pressure-Balancing Rough-In Valve 1/2" IPS', pn: '2510' }]
  },

  cuCross: {
    ru: 'Cross (cast)',
    en: 'Cross C x C x C x C - Cast',
    group: CU,
    cat: 'Tees',
    icon: 'cross',
    pn: '735',
    sizes: cuKeys(NB.CU_CROSS),
    build: (p) => {
      const A = NB.CU_CROSS[p.size]![0]
      return teeLike(p.size, 'p', A, A, [{ dir: X, G: A, size: p.size }, { dir: NX, G: A, size: p.size }])
    }
  },
  cuCoupling: {
    ru: 'Coupling (with stop)',
    en: 'Coupling with Dimpled Tube Stop C x C',
    group: CU,
    cat: 'Couplings & Adapters',
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
    ru: 'Reducing Coupling',
    en: 'Reducing Coupling C x C',
    group: CU,
    cat: 'Couplings & Adapters',
    icon: 'reducer',
    pn: '600',
    sizes: CU_SIZES.filter((s) => cuRedPartners(s).length),
    size2: { label: 'Second size', reversible: true, options: (s) => cuRedPartners(s) },
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
  cuDiel: {
    ru: 'Dielectric Union (FIP x Sweat)',
    en: 'Dielectric Union, FIP x Solder',
    group: CU,
    cat: 'Couplings & Adapters',
    icon: 'union',
    pn: 'LF3001A',
    sizes: ['cu1/2', 'cu3/4', 'cu1'],
    build: (p) => dielectricUnion(p.size),
    bom: (p) => [{ name: sizeLabel(p.size) + ' Watts LF3001A Dielectric Union, FIP x Solder (Lead Free)', pn: 'LF3001A' }]
  },
  cuUnion: {
    ru: 'Union',
    en: 'Union C x C',
    group: CU,
    cat: 'Couplings & Adapters',
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
    ru: 'Female Adapter (FPT)',
    en: 'Adapter C x F',
    group: CU,
    cat: 'Couplings & Adapters',
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
    ru: 'Male Adapter (MPT)',
    en: 'Adapter C x M',
    group: CU,
    cat: 'Couplings & Adapters',
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
    ru: 'Cap',
    en: 'Tube Cap C',
    group: CU,
    cat: 'Caps & Plugs',
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
    ru: 'Ball Valve, Full Port (sweat)',
    en: 'Lead Free Brass Ball Valve, Solder, Full Port',
    group: CU,
    cat: 'Valves',
    icon: 'valve',
    pn: '7700S',
    sizes: CU_SIZES.filter((s) => s in MV.MUELLER_7700S),
    build: (p) => muellerBallValve(p.size),
    bom: (p) => [{ name: `${sizeLabel(p.size)} Mueller Streamline 7700S Lead Free Brass Ball Valve, Solder x Solder, Full Port`, pn: MV.MUELLER_7700S[p.size]?.pn }]
  },


// ----------------------------- NO-HUB МУФТЫ -----------------------------
  nhStd: {
    ru: 'No-Hub Coupling, Standard (CI)',
    en: 'No-Hub Standard Coupling (CISPI 310)',
    group: NH,
    cat: 'Cast Iron ↔ Cast Iron',
    icon: 'nohub',
    pn: 'NH 1',
    sizes: nhSizes(NHD.NH_STD),
    size2: { label: 'Other side', reversible: true, options: (s) => nhOptions(NHD.NH_STD, s) },
    build: (p) => {
      const b = p.size2 ?? p.size
      const spec = NHD.NH_STD.get(nhKey(p.size, b))!
      return noHubCoupling(p.size, b, spec.W, spec.clamps)
    },
    bom: (p) => {
      const b = p.size2 ?? p.size
      const nm = b === p.size ? sizeLabel(p.size) : `${sizeLabel(p.size)} x ${sizeLabel(b)}`
      return [{ name: `${nm} Charlotte No-Hub Coupling, Standard (CISPI 310)`, pn: 'NH 1' }]
    }
  },
  nhHD: {
    ru: 'No-Hub Coupling, Heavy Duty (CI)',
    en: 'No-Hub Heavy Duty Coupling (ASTM C1540)',
    group: NH,
    cat: 'Cast Iron ↔ Cast Iron',
    icon: 'nohub',
    pn: 'SDC 4',
    sizes: nhSizes(NHD.NH_HD),
    build: (p) => {
      const spec = NHD.NH_HD.get(`${p.size}|${p.size}`)!
      return noHubCoupling(p.size, p.size, spec.W, spec.clamps)
    },
    bom: (p) => [{ name: `${sizeLabel(p.size)} Charlotte Heavy Duty No-Hub Coupling (ASTM C1540)`, pn: 'SDC 4' }]
  },
  nhTrans: {
    ru: 'Transition Coupling (Fernco ProFlex)',
    en: 'Shielded Transition Coupling',
    group: NH,
    cat: 'PVC / Galvanized / Cast Iron Transitions',
    icon: 'nohub',
    pn: 'ProFlex',
    sizes: nhSizes(NHD.PROFLEX),
    size2: { label: 'Other side', reversible: true, options: (s) => nhOptions(NHD.PROFLEX, s) },
    build: (p) => {
      const b = p.size2 ?? nhOptions(NHD.PROFLEX, p.size)[0]
      return noHubCoupling(p.size, b, NHD.PROFLEX_W, 2)
    },
    bom: (p) => {
      const b = p.size2 ?? p.size
      const pn = NHD.PROFLEX.get(`${p.size}|${b}`)
      return [{ name: `Fernco ProFlex ${pn ?? ''} Shielded Transition Coupling ${nhLabel(p.size)} x ${nhLabel(b)}`, pn }]
    }
  },

  // ----------------------------- НАПОРНЫЕ Sch 40 -----------------------------
  elbow90: {
    ru: '90° Elbow',
    en: '90° Elbow S x S',
    group: P,
    cat: 'Elbows',
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
    ru: '90° Elbow (S x FPT)',
    en: '90° Elbow S x FPT',
    group: P,
    cat: 'Elbows',
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
    ru: '90° Street Elbow',
    en: '90° Street Elbow SPG x S',
    group: P,
    cat: 'Elbows',
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
    ru: '90° Street Elbow (MPT x S)',
    en: '90° Street Elbow MPT x S',
    group: P,
    cat: 'Elbows',
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
    ru: '45° Elbow',
    en: '45° Elbow S x S',
    group: P,
    cat: 'Elbows',
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
    ru: 'Tee',
    en: 'Tee S x S x S',
    group: P,
    cat: 'Tees',
    icon: 'tee',
    key: 'T',
    pn: '2400',
    sizes: keysOf(PR.TEE),
    size2: { label: 'Branch size', optional: true, options: (s) => [s, ...pairOpts(PR.TEE_RED, s)] },
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
pbull: {
    ru: 'Bullhead Tee',
    en: 'Bullhead Tee S x S x S',
    group: P,
    cat: 'Tees',
    icon: 'bullhead',
    pn: '2400',
    // size — отвод (центр), size2 — проход (бока)
    sizes: bullBranches(PR.TEE_BULL),
    size2: { label: 'Run size (sides)', options: (s) => bullRuns(PR.TEE_BULL, s) },
    build: (p) => {
      const branch = p.size
      const run = p.size2 ?? bullRuns(PR.TEE_BULL, branch)[0]
      const r = PR.TEE_BULL.get(PR.pairKey(run, branch))!
      return teeLike(run, 'p', r.G, r.G, [{ dir: X, G: r.G1, size: branch, face: r.H1 - r.G1 }], undefined, [r.H - r.G, r.H - r.G])
    },
    bom: (p) => {
      const run = p.size2 ?? p.size
      return [{ name: `${sizeLabel(run)} x ${sizeLabel(run)} x ${sizeLabel(p.size)} PVC Sch 40 Bullhead Tee`, pn: PR.TEE_BULL.get(PR.pairKey(run, p.size))?.pn }]
    }
  },
  pteefpt: {
    ru: 'Tee (S x S x FPT)',
    en: 'Tee S x S x FPT',
    group: P,
    cat: 'Tees',
    icon: 'tee',
    pn: '2401',
    sizes: keysOf(PR.TEE_FPT),
    build: (p) => {
      const r = PR.TEE_FPT[p.size]!
      return teeLike(p.size, 'p', r.G, r.G, [{ dir: X, G: r.G1, size: p.size, kind: 'fpt', face: r.H1 - r.G1 }], undefined, [r.H - r.G, r.H - r.G])
    }
  },
  cross: {
    ru: 'Cross',
    en: 'Cross',
    group: P,
    cat: 'Tees',
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
    ru: 'Coupling',
    en: 'Coupling S x S',
    group: P,
    cat: 'Couplings & Adapters',
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
    ru: 'Reducing Coupling',
    en: 'Reducing Coupling S x S',
    group: P,
    cat: 'Couplings & Adapters',
    icon: 'reducer',
    key: 'D',
    pn: '2100',
    sizes: PRESSURE_SIZES.slice(1),
    size2: { label: 'Second size', reversible: true, options: (s) => smaller(s, PRESSURE_SIZES) },
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
    ru: 'Union',
    en: 'Union S x S, EPDM O-ring',
    group: P,
    cat: 'Couplings & Adapters',
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
    ru: 'Female Adapter (FPT)',
    en: 'Female Adapter S x FPT',
    group: P,
    cat: 'Couplings & Adapters',
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
    ru: 'Male Adapter (MPT)',
    en: 'Male Adapter MPT x S',
    group: P,
    cat: 'Couplings & Adapters',
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
    ru: 'Reducer Bushing (SPG x S)',
    en: 'Reducer Bushing, Flush Style SPG x S',
    group: P,
    cat: 'Couplings & Adapters',
    icon: 'bushing',
    pn: '2107',
    sizes: [...new Set([...PR.BUSHING.keys()].map((k) => k.split('|')[0] as SizeId))],
    size2: { label: 'Inside size', options: (s) => pairOpts(PR.BUSHING, s) },
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
    ru: 'Reducer Bushing (MPT x FPT)',
    en: 'Reducer Bushing MPT x FPT',
    group: P,
    cat: 'Couplings & Adapters',
    icon: 'bushing',
    pn: '2112',
    sizes: [...new Set([...PR.BUSHING_THD.keys()].map((k) => k.split('|')[0] as SizeId))],
    size2: { label: 'Inside size', options: (s) => pairOpts(PR.BUSHING_THD, s) },
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
    ru: 'Cap',
    en: 'Cap S',
    group: P,
    cat: 'Caps & Plugs',
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
    ru: 'Cap (FPT)',
    en: 'Cap FPT',
    group: P,
    cat: 'Caps & Plugs',
    icon: 'cap',
    pn: '2117',
    sizes: keysOf(PR.CAP_FPT),
    build: (p) => {
      const r = PR.CAP_FPT[p.size]!
      return capBuilt(p.size, 'p', r.L, r.T, true)
    }
  },
  pplug: {
    ru: 'Plug (SPG)',
    en: 'Plug SPG',
    group: P,
    cat: 'Caps & Plugs',
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
    ru: 'Plug (MPT)',
    en: 'Plug MPT',
    group: P,
    cat: 'Caps & Plugs',
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
    ru: 'Ball Valve',
    en: 'Ball Valve S x S',
    group: P,
    cat: 'Valves',
    icon: 'valve',
    key: 'V',
    sizes: PRESSURE_SIZES.slice(0, 8),
    build: (p) => pvcBallValve(p.size),
    bom: (p) => [{ name: `${sizeLabel(p.size)} PVC Ball Valve (Slip x Slip)` }]
  },

  // ----------------------------- DWV -----------------------------
  dwv90: {
    ru: '1/4 Bend (90°)',
    en: '1/4 Bend',
    group: D,
    cat: 'Bends',
    icon: 'bend90',
    pn: '300',
    sizes: keysOf(DW.D_BEND90),
    build: (p) => dwvBend(p.size, 90, DW.D_BEND90[p.size]![0], 0.75)
  },
  st90: {
    ru: '1/4 Bend, Street',
    en: '1/4 Bend, Street (Spigot x Hub)',
    group: D,
    cat: 'Bends',
    icon: 'st90',
    pn: '302',
    sizes: keysOf(DW.D_BEND90_ST),
    build: (p) => {
      const [A, B] = DW.D_BEND90_ST[p.size]!
      return dwvBend(p.size, 90, A, 0.75, B)
    }
  },
  dwvLong90: {
    ru: 'Long Sweep 1/4 Bend',
    en: 'Long Sweep 1/4 Bend',
    group: D,
    cat: 'Bends',
    icon: 'long90',
    pn: '304',
    sizes: keysOf(DW.D_LONG90),
    build: (p) => dwvBend(p.size, 90, DW.D_LONG90[p.size]![0], 0.93)
  },
  dlongst: {
    ru: 'Long Sweep 1/4 Bend, Street',
    en: 'Long Sweep 1/4 Bend, Street (Hub x Spigot)',
    group: D,
    cat: 'Bends',
    icon: 'long90',
    pn: '309',
    sizes: keysOf(DW.D_LONG90_ST),
    build: (p) => {
      const [A, B] = DW.D_LONG90_ST[p.size]!
      return dwvBend(p.size, 90, A, 0.93, B)
    }
  },
  dvent90: {
    ru: 'Vent Ell 90°',
    en: 'Vent Ell (90° Short Turn)',
    group: D,
    cat: 'Bends',
    icon: 'ell90',
    pn: '331',
    sizes: keysOf(DW.D_VENT90),
    build: (p) => dwvBend(p.size, 90, DW.D_VENT90[p.size]![0], 0.55)
  },
  dvent90st: {
    ru: 'Vent Street Ell 90°',
    en: 'Vent Ell, Street (Hub x Spigot)',
    group: D,
    cat: 'Bends',
    icon: 'st90',
    pn: '333',
    sizes: keysOf(DW.D_VENT90_ST),
    build: (p) => {
      const [A, B] = DW.D_VENT90_ST[p.size]!
      return dwvBend(p.size, 90, A, 0.55, B)
    }
  },
  d60: {
    ru: '1/6 Bend (60°)',
    en: '1/6 Bend',
    group: D,
    cat: 'Bends',
    icon: 'bend45',
    pn: '319',
    sizes: keysOf(DW.D_BEND60),
    build: (p) => dwvBend(p.size, 60, DW.D_BEND60[p.size]![0], 0.65)
  },
  d60st: {
    ru: '1/6 Bend, Street',
    en: '1/6 Bend, Street (Hub x Spigot)',
    group: D,
    cat: 'Bends',
    icon: 'st45',
    pn: '320',
    sizes: keysOf(DW.D_BEND60_ST),
    build: (p) => {
      const [A, B] = DW.D_BEND60_ST[p.size]!
      return dwvBend(p.size, 60, A, 0.65, B)
    }
  },
  dwv45: {
    ru: '1/8 Bend (45°)',
    en: '1/8 Bend',
    group: D,
    cat: 'Bends',
    icon: 'bend45',
    pn: '321',
    sizes: keysOf(DW.D_BEND45),
    build: (p) => dwvBend(p.size, 45, DW.D_BEND45[p.size]![0], 0.6)
  },
  st45: {
    ru: '1/8 Bend, Street',
    en: '1/8 Bend, Street (Spigot x Hub)',
    group: D,
    cat: 'Bends',
    icon: 'st45',
    pn: '323',
    sizes: keysOf(DW.D_BEND45_ST),
    build: (p) => {
      const [A, B] = DW.D_BEND45_ST[p.size]!
      return dwvBend(p.size, 45, A, 0.6, B)
    }
  },
  dwv22: {
    ru: '1/16 Bend (22.5°)',
    en: '1/16 Bend',
    group: D,
    cat: 'Bends',
    icon: 'bend22',
    pn: '324',
    sizes: keysOf(DW.D_BEND22),
    build: (p) => dwvBend(p.size, 22.5, DW.D_BEND22[p.size]![0], 0.5)
  },
  d22st: {
    ru: '1/16 Bend, Street',
    en: '1/16 Bend, Street (Spigot x Hub)',
    group: D,
    cat: 'Bends',
    icon: 'bend22',
    pn: '326',
    sizes: keysOf(DW.D_BEND22_ST),
    build: (p) => {
      const [A, B] = DW.D_BEND22_ST[p.size]!
      return dwvBend(p.size, 22.5, A, 0.5, B)
    }
  },
  d90dbl: {
    ru: 'Double 1/4 Bend',
    en: 'Double 1/4 Bend',
    group: D,
    cat: 'Bends',
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
    ru: 'Closet Bend 4×3',
    en: 'Closet Bend, Reducing',
    group: D,
    cat: 'Bends',
    icon: 'bend90',
    pn: '329',
    sizes: ['4'],
    size2: { label: 'Outlet', options: () => ['3'] },
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
    ru: 'Sanitary Tee',
    en: 'Sanitary Tee',
    group: D,
    cat: 'Tees',
    icon: 'santee',
    pn: '400',
    sizes: keysOf(DW.D_SAN),
    size2: { label: 'Branch size', optional: true, options: (s) => [s, ...pairOpts(DW.D_SAN_RED, s)] },
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
    ru: 'Sanitary Tee, Street',
    en: 'Sanitary Tee, Street (Spigot x Hub x Hub)',
    group: D,
    cat: 'Tees',
    icon: 'santee',
    pn: '403',
    sizes: keysOf(DW.D_SAN_ST),
    build: (p) => {
      const [A, B, Cc] = DW.D_SAN_ST[p.size]!
      return teeLike(p.size, 'd', Cc, B - Cc, [{ dir: X, G: A, size: p.size, sweep: true }], Cc)
    }
  },
  dblSanTee: {
    ru: 'Double Sanitary Tee',
    en: 'Double Sanitary Tee (Sanitary Cross)',
    group: D,
    cat: 'Tees',
    icon: 'dblsan',
    pn: '428',
    sizes: keysOf(DW.D_DBL_SAN),
    build: (p) => {
      const [A, B] = DW.D_DBL_SAN[p.size]!
      return teeLike(p.size, 'd', A, B - A, [{ dir: X, G: A, size: p.size, sweep: true }, { dir: NX, G: A, size: p.size, sweep: true }])
    }
  },
  dventtee: {
    ru: 'Vent Tee',
    en: 'Vent Tee',
    group: D,
    cat: 'Tees',
    icon: 'tee',
    pn: '441',
    sizes: keysOf(DW.D_VENT_TEE),
    build: (p) => {
      const [A, B] = DW.D_VENT_TEE[p.size]!
      return teeLike(p.size, 'd', A, B - A, [{ dir: X, G: A, size: p.size }])
    }
  },
  dcotee: {
    ru: 'Cleanout Tee with Plug',
    en: 'Cleanout Tee with Cleanout Plug',
    group: D,
    cat: 'Cleanouts & Caps',
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
    ru: 'Wye',
    en: 'Wye (45°)',
    group: D,
    cat: 'Tees',
    icon: 'wye',
    pn: '600',
    sizes: keysOf(DW.D_WYE),
    size2: { label: 'Branch size', optional: true, options: (s) => [s, ...pairOpts(DW.D_WYE_RED, s)] },
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
    cat: 'Tees',
    icon: 'wye',
    pn: '602',
    sizes: keysOf(DW.D_WYE_ST),
    build: (p) => {
      const [A, B, Cc] = DW.D_WYE_ST[p.size]!
      return teeLike(p.size, 'd', B, A - B, [{ dir: [C, 0, C], G: Cc, size: p.size }], B)
    }
  },
  ddblwye: {
    ru: 'Double Wye',
    en: 'Double Wye',
    group: D,
    cat: 'Tees',
    icon: 'dblwye',
    pn: '611',
    sizes: keysOf(DW.D_DBL_WYE),
    build: (p) => {
      const [A, B, Cc] = DW.D_DBL_WYE[p.size]!
      return teeLike(p.size, 'd', B, A - B, [{ dir: [C, 0, C], G: Cc, size: p.size }, { dir: [-C, 0, C], G: Cc, size: p.size }])
    }
  },
  combo: {
    ru: 'Combo Wye & 1/8 Bend',
    en: 'Combination Wye & 1/8 Bend',
    group: D,
    cat: 'Tees',
    icon: 'combo',
    pn: '501',
    sizes: keysOf(DW.D_COMBO),
    size2: { label: 'Branch size', optional: true, options: (s) => [s, ...pairOpts(DW.D_COMBO_RED, s)] },
    build: (p) => {
      const s = p.size
      const b = p.size2 ?? s
      const [A, B, Cc] = (b !== s ? DW.D_COMBO_RED.get(`${s}|${b}`) : undefined) ?? DW.D_COMBO[s]!
      return teeLike(s, 'd', Cc, B - Cc, [{ dir: X, G: A, size: b, segs: comboBranch(A, Cc, 1).segs }])
    }
  },
  ddblcombo: {
    ru: 'Double Combo Wye & 1/8 Bend',
    en: 'Double Combination Wye & 1/8 Bend',
    group: D,
    cat: 'Tees',
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
    ru: 'DWV Coupling',
    en: 'Coupling (Hub x Hub)',
    group: D,
    cat: 'Couplings & Reducers',
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
    ru: 'Increaser-Reducer',
    en: 'Pipe Increaser-Reducer (Hub x Hub)',
    group: D,
    cat: 'Couplings & Reducers',
    icon: 'reducer',
    pn: '102',
    sizes: ALL_SIZES.filter((s) => incrPartners(s).length),
    size2: { label: 'Second size', reversible: true, options: (s) => incrPartners(s) },
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
    ru: 'Flush Bushing (DWV)',
    en: 'Flush Bushing (Spigot x Hub)',
    group: D,
    cat: 'Couplings & Reducers',
    icon: 'bushing',
    pn: '107',
    sizes: [...new Set([...DW.D_BUSHING.keys()].map((k) => k.split('|')[0] as SizeId))],
    size2: { label: 'Inside size', options: (s) => pairOpts(DW.D_BUSHING, s) },
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
    ru: 'Female Adapter (FPT x Hub)',
    en: 'Female Adapter (FPT x Hub)',
    group: D,
    cat: 'Couplings & Reducers',
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
    ru: 'Male Adapter (MPT x Hub)',
    en: 'Male Adapter (MPT x Hub)',
    group: D,
    cat: 'Couplings & Reducers',
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
    ru: 'Trap Adapter',
    en: 'Trap Adapter, Hub x Tubular Slip w/ Nut',
    group: D,
    cat: 'Couplings & Reducers',
    icon: 'trapad',
    pn: '104W',
    sizes: keysOf(DW.D_TRAP_ADAPTER),
    build: (p) => trapAdapter(p.size)
  },

  cleanout: {
    ru: 'Cleanout: Adapter + Plug',
    en: 'Female Adapter (FPT x Hub) + Cleanout Plug',
    group: D,
    cat: 'Cleanouts & Caps',
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
    ru: 'Fitting Cleanout Adapter + Plug',
    en: 'Fitting Cleanout Adapter with Cleanout Plug (Spigot x FPT)',
    group: D,
    cat: 'Cleanouts & Caps',
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
    ru: 'Cleanout Plug (MPT)',
    en: 'Cleanout Plug (MPT)',
    group: D,
    cat: 'Cleanouts & Caps',
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
    ru: 'DWV Cap',
    en: 'Cap (Socket)',
    group: D,
    cat: 'Cleanouts & Caps',
    icon: 'cap',
    pn: '116',
    sizes: keysOf(DW.D_CAP),
    build: (p) => {
      const [A, Cc] = DW.D_CAP[p.size]!
      return capBuilt(p.size, 'd', A, Cc, false)
    }
  },

  ptrap: {
    ru: 'P-Trap',
    en: 'P-Trap with Solvent Weld Joint',
    group: D,
    cat: 'Traps & Flanges',
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
    ru: 'P-Trap with Union Nut',
    en: 'P-Trap with Union & Plastic Nut',
    group: D,
    cat: 'Traps & Flanges',
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
    ru: 'Return Bend',
    en: 'Return Bend (Hub x Hub)',
    group: D,
    cat: 'Traps & Flanges',
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
    ru: 'Closet Flange',
    en: 'Closet Flange (Hub End)',
    group: D,
    cat: 'Traps & Flanges',
    icon: 'closet',
    pn: '800',
    sizes: keysOf(DW.D_CLOSET),
    build: (p) => closetFlange(p.size, DW.D_CLOSET[p.size]!, false),
    place: { rot: [-90, 0, 0], flushTop: (p) => DW.D_CLOSET[p.size]![1] },
    bom: (p) => [{ name: `4" x ${sizeLabel(p.size)} PVC DWV Closet Flange`, pn: '800' }]
  },
  closetAdj: {
    ru: 'Closet Flange, Metal Ring',
    en: 'Closet Flange, Adjustable with Metal Ring',
    group: D,
    cat: 'Traps & Flanges',
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
registerEquipment(FITTINGS)

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

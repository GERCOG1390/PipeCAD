// Окружение: бетон, каркас, пиломатериал, листы, грунт. Все размеры в дюймах.
// Объект задаётся углом pos (минимальный угол в своих осях) и поворотом rotY вокруг вертикали:
// локальная X — длина L, Y — высота H, Z — ширина/толщина W.
import { Euler, Matrix4, Quaternion, Vector3 } from 'three'
import type { V3 } from './catalog'

export type EnvType = 'concreteWall' | 'slab' | 'footing' | 'ground' | 'studWall' | 'joists' | 'lumber' | 'sheet' | 'person'
export type Mat = 'concrete' | 'wood' | 'plywood' | 'osb' | 'drywall' | 'dirt' | 'grass' | 'gravel' | 'sand'

export interface EnvItem {
  id: string
  type: EnvType
  pos: V3
  rotY: number
  L: number
  W: number
  H: number
  o: Record<string, string | number | boolean>
}

// Деталь объекта для отрисовки, расчёта материалов и поиска проходов труб
export interface Board {
  c: V3 // центр в локальных осях объекта
  s: V3 // размеры
  mat: Mat
  top?: Mat // другой материал верхней грани (трава/гравий на грунте)
  role: 'concrete' | 'stud' | 'plate' | 'joist' | 'rim' | 'board' | 'sheet' | 'ground'
  lumber?: string // '2x4' ...
  sheet?: string // 'plywood 3/4"' ...
}

// Реальные сечения пиломатериала: [толщина, ширина]
export const LUMBER: Record<string, [number, number]> = {
  '2x4': [1.5, 3.5],
  '2x6': [1.5, 5.5],
  '2x8': [1.5, 7.25],
  '2x10': [1.5, 9.25],
  '2x12': [1.5, 11.25],
  '4x4': [3.5, 3.5]
}
export const STOCK_LENGTHS = [96, 120, 144, 168, 192] // 8'–16'

export const SHEETS: Record<string, { mat: Mat; th: number; en: string; ru: string }> = {
  'ply-3/4': { mat: 'plywood', th: 0.75, en: '3/4" Plywood 4x8', ru: 'Плайвуд 3/4"' },
  'ply-1/2': { mat: 'plywood', th: 0.5, en: '1/2" Plywood 4x8', ru: 'Плайвуд 1/2"' },
  'osb-23/32': { mat: 'osb', th: 23 / 32, en: '23/32" OSB Subfloor 4x8', ru: 'OSB 23/32"' },
  'osb-7/16': { mat: 'osb', th: 7 / 16, en: '7/16" OSB 4x8', ru: 'OSB 7/16"' },
  'dw-1/2': { mat: 'drywall', th: 0.5, en: '1/2" Drywall 4x8', ru: 'Гипсокартон 1/2"' },
  'dw-5/8': { mat: 'drywall', th: 0.625, en: '5/8" Drywall 4x8', ru: 'Гипсокартон 5/8"' }
}

export const SURFACES: Record<string, string> = { grass: 'Трава', dirt: 'Земля', gravel: 'Гравий', sand: 'Песок' }

export interface EnvDef {
  ru: string
  cat: string
  // подписи полей размеров (только те, что редактируются)
  fields: Partial<Record<'L' | 'W' | 'H', string>>
}

export const ENV_DEFS: Record<EnvType, EnvDef> = {
  concreteWall: { ru: 'Бетонная стена', cat: 'Бетон', fields: { L: 'Длина', H: 'Высота', W: 'Толщина' } },
  slab: { ru: 'Бетонная плита (slab)', cat: 'Бетон', fields: { L: 'Длина', W: 'Ширина', H: 'Толщина' } },
  footing: { ru: 'Фундамент (footing)', cat: 'Бетон', fields: { L: 'Длина', W: 'Ширина', H: 'Высота' } },
  ground: { ru: 'Грунт', cat: 'Грунт', fields: { L: 'Длина', W: 'Ширина', H: 'Глубина' } },
  studWall: { ru: 'Каркасная стена', cat: 'Каркас', fields: { L: 'Длина', H: 'Высота' } },
  joists: { ru: 'Перекрытие (джойсты)', cat: 'Каркас', fields: { L: 'Пролёт', W: 'Ширина' } },
  lumber: { ru: 'Доска / брус', cat: 'Пиломатериал', fields: { L: 'Длина' } },
  sheet: { ru: 'Лист', cat: 'Листы', fields: { L: 'Длина', W: 'Ширина' } },
  person: { ru: 'Сантехник (в натуральную величину)', cat: 'Люди', fields: { H: 'Рост' } }
}

export interface Preset {
  label: string
  type: EnvType
  L: number
  W: number
  H: number
  o: Record<string, string | number | boolean>
}

export const PRESETS: { cat: string; items: Preset[] }[] = [
  {
    cat: 'Бетон',
    items: [
      { label: 'Стена бетонная 8"', type: 'concreteWall', L: 120, W: 8, H: 96, o: {} },
      { label: 'Плита пола 4"', type: 'slab', L: 144, W: 120, H: 4, o: {} },
      { label: 'Фундамент 20" × 10"', type: 'footing', L: 120, W: 20, H: 10, o: {} }
    ]
  },
  {
    cat: 'Каркас',
    items: [
      { label: 'Стена 2×4, шаг 16"', type: 'studWall', L: 96, W: 3.5, H: 96, o: { lumber: '2x4', oc: 16, drywall: 'none' } },
      { label: 'Стена 2×6, шаг 16"', type: 'studWall', L: 96, W: 5.5, H: 96, o: { lumber: '2x6', oc: 16, drywall: 'none' } },
      { label: 'Перекрытие 2×10, шаг 16"', type: 'joists', L: 144, W: 96, H: 9.25, o: { lumber: '2x10', oc: 16, rim: true, sub: 'osb-23/32' } },
      { label: 'Перекрытие 2×12, шаг 16"', type: 'joists', L: 168, W: 96, H: 11.25, o: { lumber: '2x12', oc: 16, rim: true, sub: 'osb-23/32' } }
    ]
  },
  {
    cat: 'Пиломатериал',
    items: ['2x4', '2x6', '2x8', '2x10', '2x12'].map((l) => ({ label: `Доска ${l.replace('x', '×')}`, type: 'lumber' as EnvType, L: 96, W: 0, H: 0, o: { lumber: l, orient: 'edge' } })).concat([
      { label: 'Стойка 4×4', type: 'lumber', L: 96, W: 0, H: 0, o: { lumber: '4x4', orient: 'post' } }
    ])
  },
  {
    cat: 'Листы',
    items: [
      { label: 'Плайвуд 3/4" 4×8', type: 'sheet', L: 96, W: 48, H: 0, o: { sheet: 'ply-3/4', orient: 'floor' } },
      { label: 'Плайвуд 1/2" 4×8', type: 'sheet', L: 96, W: 48, H: 0, o: { sheet: 'ply-1/2', orient: 'floor' } },
      { label: 'OSB 7/16" 4×8', type: 'sheet', L: 96, W: 48, H: 0, o: { sheet: 'osb-7/16', orient: 'wall' } },
      { label: 'Гипсокартон 1/2" 4×8', type: 'sheet', L: 96, W: 48, H: 0, o: { sheet: 'dw-1/2', orient: 'wall' } }
    ]
  },
  {
    cat: 'Грунт',
    items: [
      { label: 'Земля с травой', type: 'ground', L: 240, W: 240, H: 24, o: { surface: 'grass', trench: false } },
      { label: 'Траншея в грунте', type: 'ground', L: 240, W: 120, H: 36, o: { surface: 'grass', trench: true, tOff: 48, tW: 18, tD: 24 } },
      { label: 'Земля', type: 'ground', L: 240, W: 240, H: 24, o: { surface: 'dirt', trench: false } },
      { label: 'Гравий (подсыпка 4")', type: 'ground', L: 144, W: 120, H: 4, o: { surface: 'gravel', trench: false } },
      { label: 'Песок (подсыпка 4")', type: 'ground', L: 144, W: 120, H: 4, o: { surface: 'sand', trench: false } }
    ]
  },
  {
    cat: 'Люди',
    items: [{ label: `Сантехник (рост 5' 10")`, type: 'person', L: 0, W: 0, H: 70, o: { face: true } }]
  }
]

// Поверхность лежит на уровне 0 (грунт и плита — ниже, остальное — выше)
export const baseY = (p: Preset): number => (p.type === 'ground' || p.type === 'slab' ? -p.H : 0)

const str = (v: unknown, d: string): string => (typeof v === 'string' ? v : d)
const num = (v: unknown, d: number): number => (typeof v === 'number' && Number.isFinite(v) ? v : d)

// Размеры, которые определяются опциями (толщина каркаса, высота джойста и т.п.)
export function normalize(it: EnvItem): EnvItem {
  const lum = LUMBER[str(it.o.lumber, '2x4')] ?? LUMBER['2x4']
  switch (it.type) {
    case 'studWall':
      return { ...it, W: lum[1] }
    case 'joists':
      return { ...it, H: lum[1] }
    case 'lumber': {
      const orient = str(it.o.orient, 'edge')
      if (orient === 'post') return { ...it, W: lum[1], H: it.L }
      return { ...it, W: orient === 'edge' ? lum[0] : lum[1], H: orient === 'edge' ? lum[1] : lum[0] }
    }
    case 'sheet': {
      const sh = SHEETS[str(it.o.sheet, 'ply-3/4')] ?? SHEETS['ply-3/4']
      return { ...it, H: str(it.o.orient, 'floor') === 'floor' ? sh.th : it.W }
    }
    case 'person':
      // ширина фигуры по пропорциям фото
      return { ...it, L: Math.round(it.H * PERSON_ASPECT * 100) / 100, W: 1 }
    default:
      return it
  }
}

export const PERSON_ASPECT = 111 / 500

export function boardsOf(it: EnvItem): Board[] {
  const { L, W, H } = it
  const o = it.o
  switch (it.type) {
    case 'person':
      return []
    case 'concreteWall':
    case 'slab':
    case 'footing':
      return [{ c: [L / 2, H / 2, W / 2], s: [L, H, W], mat: 'concrete', role: 'concrete' }]
    case 'ground': {
      const top = str(o.surface, 'grass') as Mat
      const body: Mat = top === 'gravel' || top === 'sand' ? (top as Mat) : 'dirt'
      if (!o.trench) return [{ c: [L / 2, H / 2, W / 2], s: [L, H, W], mat: body, top, role: 'ground' }]
      const tW = Math.min(num(o.tW, 18), W - 2)
      const tOff = Math.max(0, Math.min(num(o.tOff, 48), W - tW))
      const tD = Math.min(num(o.tD, 24), H - 1)
      const out: Board[] = []
      if (tOff > 0.01) out.push({ c: [L / 2, H / 2, tOff / 2], s: [L, H, tOff], mat: body, top, role: 'ground' })
      const rest = W - tOff - tW
      if (rest > 0.01) out.push({ c: [L / 2, H / 2, W - rest / 2], s: [L, H, rest], mat: body, top, role: 'ground' })
      out.push({ c: [L / 2, (H - tD) / 2, tOff + tW / 2], s: [L, H - tD, tW], mat: body, top: 'dirt', role: 'ground' })
      return out
    }
    case 'studWall': {
      const lumber = str(o.lumber, '2x4')
      const [t, d] = LUMBER[lumber] ?? LUMBER['2x4']
      const oc = num(o.oc, 16)
      const out: Board[] = [
        { c: [L / 2, t / 2, d / 2], s: [L, t, d], mat: 'wood', role: 'plate', lumber },
        { c: [L / 2, H - t / 2, d / 2], s: [L, t, d], mat: 'wood', role: 'plate', lumber },
        { c: [L / 2, H - t * 1.5, d / 2], s: [L, t, d], mat: 'wood', role: 'plate', lumber }
      ]
      const studH = H - 3 * t
      const xs = [t / 2]
      for (let x = oc; x < L - t; x += oc) xs.push(x)
      xs.push(L - t / 2)
      for (const x of xs) out.push({ c: [x, t + studH / 2, d / 2], s: [t, studH, d], mat: 'wood', role: 'stud', lumber })
      const dw = str(o.drywall, 'none')
      const dth = 0.5
      if (dw === 'one' || dw === 'both') out.push({ c: [L / 2, H / 2, -dth / 2], s: [L, H, dth], mat: 'drywall', role: 'sheet', sheet: 'dw-1/2' })
      if (dw === 'both') out.push({ c: [L / 2, H / 2, d + dth / 2], s: [L, H, dth], mat: 'drywall', role: 'sheet', sheet: 'dw-1/2' })
      return out
    }
    case 'joists': {
      const lumber = str(o.lumber, '2x10')
      const [t, d] = LUMBER[lumber] ?? LUMBER['2x10']
      const oc = num(o.oc, 16)
      const rim = o.rim !== false
      const out: Board[] = []
      const x0 = rim ? t : 0
      const len = rim ? L - 2 * t : L
      const zs = [t / 2]
      for (let z = oc; z < W - t; z += oc) zs.push(z)
      zs.push(W - t / 2)
      for (const z of zs) out.push({ c: [x0 + len / 2, d / 2, z], s: [len, d, t], mat: 'wood', role: 'joist', lumber })
      if (rim) {
        out.push({ c: [t / 2, d / 2, W / 2], s: [t, d, W], mat: 'wood', role: 'rim', lumber })
        out.push({ c: [L - t / 2, d / 2, W / 2], s: [t, d, W], mat: 'wood', role: 'rim', lumber })
      }
      const sub = str(o.sub, 'none')
      if (SHEETS[sub]) {
        const sh = SHEETS[sub]
        out.push({ c: [L / 2, d + sh.th / 2, W / 2], s: [L, sh.th, W], mat: sh.mat, role: 'sheet', sheet: sub })
      }
      return out
    }
    case 'lumber': {
      const lumber = str(o.lumber, '2x4')
      const [t, d] = LUMBER[lumber] ?? LUMBER['2x4']
      const orient = str(o.orient, 'edge')
      const s3: V3 = orient === 'post' ? [t, L, d] : orient === 'edge' ? [L, d, t] : [L, t, d]
      return [{ c: [s3[0] / 2, s3[1] / 2, s3[2] / 2], s: s3, mat: 'wood', role: 'board', lumber }]
    }
    case 'sheet': {
      const key = str(o.sheet, 'ply-3/4')
      const sh = SHEETS[key] ?? SHEETS['ply-3/4']
      if (str(o.orient, 'floor') === 'floor') return [{ c: [L / 2, sh.th / 2, W / 2], s: [L, sh.th, W], mat: sh.mat, role: 'sheet', sheet: key }]
      return [{ c: [L / 2, W / 2, sh.th / 2], s: [L, W, sh.th], mat: sh.mat, role: 'sheet', sheet: key }]
    }
  }
}

export const itemMatrix = (it: EnvItem): Matrix4 =>
  new Matrix4().compose(new Vector3(...it.pos), new Quaternion().setFromEuler(new Euler(0, (it.rotY * Math.PI) / 180, 0)), new Vector3(1, 1, 1))

// ---------- материалы для спецификации ----------
export interface EnvBomLine {
  name: string
  ru: string
  qty: number
  unit: string
}

const stockFor = (len: number): { stock: number; n: number } => {
  const s = STOCK_LENGTHS.find((x) => x >= len - 0.01)
  if (s) return { stock: s, n: 1 }
  return { stock: 192, n: Math.ceil(len / 192) }
}

export function envBom(items: EnvItem[]): EnvBomLine[] {
  const lines = new Map<string, EnvBomLine>()
  const add = (key: string, name: string, ru: string, qty: number, unit: string): void => {
    const l = lines.get(key) ?? { name, ru, qty: 0, unit }
    l.qty += qty
    lines.set(key, l)
  }
  let concrete = 0
  for (const it of items) {
    const boards = boardsOf(it)
    for (const b of boards) {
      const vol = b.s[0] * b.s[1] * b.s[2]
      if (b.role === 'concrete') concrete += vol
      if (b.lumber) {
        const len = Math.max(...b.s)
        const { stock, n } = stockFor(len)
        const lab = b.lumber.replace('x', '×')
        add(`lum|${b.lumber}|${stock}`, `${b.lumber} x ${stock / 12}' SPF Lumber`, `Доска ${lab} × ${stock / 12}'`, n, 'шт.')
      }
    }
    if (it.type === 'ground') {
      const top = str(it.o.surface, 'grass')
      const area = (it.L * it.W) / 144
      if (top === 'grass') add('sod', 'Sod (grass)', 'Газон (дёрн)', area, 'кв. фут')
      if (top === 'gravel' || top === 'sand') add(`fill|${top}`, top === 'gravel' ? 'Gravel' : 'Sand', SURFACES[top], (it.L * it.W * it.H) / 46656, 'куб. ярд')
      if (it.o.trench) {
        const v = it.L * num(it.o.tW, 18) * num(it.o.tD, 24)
        add('trench', 'Trench excavation', 'Выемка грунта (траншея)', v / 46656, 'куб. ярд')
      }
    }
    // листы считаем по площади (лист 4'×8' = 4608 кв. дюймов)
    for (const b of boards.filter((x) => x.sheet)) {
      const sh = SHEETS[b.sheet!]
      const dims = [...b.s].sort((a, c) => c - a)
      add(`sheet|${b.sheet}`, sh.en, sh.ru, (dims[0] * dims[1]) / 4608, 'лист')
    }
  }
  if (concrete > 0) add('concrete', 'Concrete', 'Бетон', concrete / 46656, 'куб. ярд')
  return [...lines.values()].map((l) => ({
    ...l,
    qty: l.unit === 'лист' ? Math.ceil(l.qty - 0.001) : l.unit === 'куб. ярд' ? Math.ceil(l.qty * 4) / 4 : l.unit === 'кв. фут' ? Math.ceil(l.qty) : l.qty
  }))
}

// ---------- проходы труб сквозь окружение ----------
export interface Penetration {
  point: Vector3
  dir: Vector3
  radius: number // радиус трубы
  hole: number // диаметр отверстия
  where: string
  ok: boolean
  note: string
  envId: string
}

// Пересечение отрезка (в локальных осях коробки) с коробкой, расширенной на r: параметр входа или null
function segBox(a: Vector3, b: Vector3, half: Vector3, r: number): number | null {
  let t0 = 0
  let t1 = 1
  const d = b.clone().sub(a)
  for (const k of ['x', 'y', 'z'] as const) {
    const h = half[k] + r
    if (Math.abs(d[k]) < 1e-9) {
      if (Math.abs(a[k]) > h) return null
      continue
    }
    let ta = (-h - a[k]) / d[k]
    let tb = (h - a[k]) / d[k]
    if (ta > tb) [ta, tb] = [tb, ta]
    t0 = Math.max(t0, ta)
    t1 = Math.min(t1, tb)
    if (t0 > t1) return null
  }
  return (t0 + t1) / 2
}

export function findPenetrations(items: EnvItem[], pipes: { a: Vector3; b: Vector3; r: number }[]): Penetration[] {
  const out: Penetration[] = []
  for (const it of items) {
    const m = itemMatrix(it)
    const inv = m.clone().invert()
    for (const b of boardsOf(it)) {
      if (b.role === 'ground') continue
      const c = new Vector3(...b.c)
      const half = new Vector3(...b.s).multiplyScalar(0.5)
      for (const p of pipes) {
        const la = p.a.clone().applyMatrix4(inv).sub(c)
        const lb = p.b.clone().applyMatrix4(inv).sub(c)
        // труба должна проходить сквозь доску, а не лежать на ней: используем радиус 0 для оси
        const t = segBox(la, lb, half, 0)
        if (t === null) continue
        const local = la.clone().lerp(lb, t)
        const point = local.add(c).applyMatrix4(m)
        const dir = p.b.clone().sub(p.a).normalize()
        const hole = p.r * 2 + 0.25
        let ok = true
        let note = ''
        let where = ''
        if (b.role === 'joist' || b.role === 'rim') {
          const depth = b.s[1]
          ok = hole <= depth / 3 + 1e-6
          where = `джойст ${b.lumber?.replace('x', '×')}`
          note = ok ? `отверстие ${fmt(hole)}` : `отверстие ${fmt(hole)} > 1/3 высоты (${fmt(depth / 3)}) — IRC R502.8`
        } else if (b.role === 'stud' || b.role === 'plate') {
          const d = b.s[2] // ширина стойки/обвязки поперёк стены
          ok = hole <= d * 0.6 + 1e-6
          where = b.role === 'stud' ? `стойка ${b.lumber?.replace('x', '×')}` : `обвязка ${b.lumber?.replace('x', '×')}`
          note = ok ? `отверстие ${fmt(hole)}` : `отверстие ${fmt(hole)} > 60% ширины (${fmt(d * 0.6)}) — IRC R602.6`
        } else if (b.role === 'concrete') {
          where = 'бетон'
          note = `проход Ø${fmt(hole)} (гильза / алмазное сверление)`
        } else if (b.role === 'sheet') {
          where = b.sheet ? SHEETS[b.sheet].ru : 'лист'
          note = `отверстие ${fmt(hole)}`
        } else {
          where = `доска ${b.lumber?.replace('x', '×')}`
          note = `отверстие ${fmt(hole)}`
        }
        out.push({ point, dir, radius: p.r, hole, where, ok, note, envId: it.id })
      }
    }
  }
  return out
}

function fmt(inches: number): string {
  const n16 = Math.round(inches * 16)
  const whole = Math.floor(n16 / 16)
  const frac = n16 % 16
  if (!frac) return `${whole}"`
  let a = frac
  let b = 16
  while (a % 2 === 0) {
    a /= 2
    b /= 2
  }
  return `${whole ? whole + '-' : ''}${a}/${b}"`
}

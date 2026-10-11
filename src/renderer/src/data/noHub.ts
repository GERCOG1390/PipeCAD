// No-hub (hubless) муфты. Дюймы.
// Charlotte Pipe — Cast Iron No-Hub Submittal: NH 1 Standard Coupling (CISPI 310 / ASTM C1277),
// SDC 4 Heavy Duty Coupling (ASTM C1540) — ширина кожуха и число хомутов.
// Fernco ProFlex (sales sheet T2712): кожух 301 SS .012 x 2.125, хомуты 301 SS .025 x .500 — переходные муфты.
import type { SizeId } from './sizes'

export interface NoHubSpec {
  W: number // ширина кожуха (длина муфты)
  clamps: number
  pn: string
}

// Charlotte NH 1 — чугун ↔ чугун, ключ "a|b" (a ≥ b)
export const NH_STD = new Map<string, NoHubSpec>([
  ['ci1-1/2|ci1-1/2', { W: 2.13, clamps: 2, pn: 'NH 1' }],
  ['ci2|ci2', { W: 2.13, clamps: 2, pn: 'NH 1' }],
  ['ci2|ci1-1/2', { W: 2.13, clamps: 2, pn: 'NH 1' }],
  ['ci3|ci3', { W: 2.13, clamps: 2, pn: 'NH 1' }],
  ['ci3|ci2', { W: 2.13, clamps: 2, pn: 'NH 1' }],
  ['ci4|ci4', { W: 2.13, clamps: 2, pn: 'NH 1' }],
  ['ci4|ci3', { W: 2.13, clamps: 2, pn: 'NH 1' }],
  ['ci6|ci6', { W: 3.0, clamps: 2, pn: 'NH 1' }]
])

// Charlotte SDC 4 Heavy Duty — чугун ↔ чугун
export const NH_HD = new Map<string, NoHubSpec>([
  ['ci1-1/2|ci1-1/2', { W: 3.0, clamps: 4, pn: 'SDC 4' }],
  ['ci2|ci2', { W: 3.0, clamps: 4, pn: 'SDC 4' }],
  ['ci3|ci3', { W: 3.0, clamps: 4, pn: 'SDC 4' }],
  ['ci4|ci4', { W: 3.0, clamps: 4, pn: 'SDC 4' }],
  ['ci6|ci6', { W: 4.0, clamps: 6, pn: 'SDC 4' }]
])

// Fernco ProFlex: переходы чугун ↔ пластик/сталь и т.п. CI — чугун, PL — PVC, ST — сталь (оцинковка)
type M = 'ci' | 'pl' | 'st'
const ID: Record<M, (n: string) => SizeId | null> = {
  ci: (n) => (['1-1/2', '2', '3', '4', '6'].includes(n) ? (`ci${n}` as SizeId) : null),
  pl: (n) => (['1-1/2', '2', '3', '4', '6'].includes(n) ? (n as SizeId) : null),
  st: (n) => (['1-1/2', '2', '3', '4'].includes(n) ? (`gs${n}` as SizeId) : null)
}
const ALL: M[] = ['ci', 'pl', 'st']
const PLST: M[] = ['pl', 'st']
const ROWS: [string, string, M[], string, M[]][] = [
  // [part, размер A, материалы A, размер B, материалы B]
  ['3000-150', '1-1/2', ALL, '1-1/2', ALL],
  ['3000-215', '2', ALL, '1-1/2', ALL],
  ['3000-22', '2', ALL, '2', ALL],
  ['3000-33', '3', ['ci'], '3', PLST],
  ['3000-43', '4', ['ci'], '3', PLST],
  ['3000-44', '4', ['ci'], '4', PLST],
  ['3000-66', '6', ['ci'], '6', PLST],
  ['3004-320', '3', ['ci'], '2', ALL],
  ['3004-420', '4', ['ci'], '2', ALL],
  ['3004-430', '4', ['ci'], '3', ['ci']],
  ['3005-33', '3', PLST, '3', PLST],
  ['3005-43', '4', PLST, '3', PLST],
  ['3005-44', '4', PLST, '4', PLST],
  ['3005-66', '6', PLST, '6', PLST]
]

// Все конкретные пары (в обе стороны) → номер детали Fernco
export const PROFLEX = new Map<string, string>()
for (const [pn, a, ma, b, mb] of ROWS) {
  for (const x of ma) for (const y of mb) {
    const A = ID[x](a)
    const B = ID[y](b)
    if (!A || !B) continue
    if (!PROFLEX.has(`${A}|${B}`)) PROFLEX.set(`${A}|${B}`, pn)
    if (!PROFLEX.has(`${B}|${A}`)) PROFLEX.set(`${B}|${A}`, pn)
  }
}
export const PROFLEX_W = 2.125

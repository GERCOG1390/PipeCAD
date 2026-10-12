// Уклон горизонтальных труб канализации (DWV): минимум по IPC Table 704.1 — до 2-1/2" 1/4" на фут, 3"–6" 1/8" на фут.
// Местный кодекс (Illinois Plumbing Code) может требовать иное — это подсказка, а не проверка инспектора.
import { Vector3 } from 'three'
import { Part, SizeId, sizeSpec } from './catalog'
import { Model } from './geometry'
import { systemFam } from './store'

export const minSlope = (size: SizeId): number => (sizeSpec(size).od <= 2.876 ? 0.25 : 0.125)

export interface PipeSlope {
  id: string
  rise: number // дюймов на фут, по модулю
  min: number
  ok: boolean
}

// Горизонтальные (до ~11°) трубы систем DWV и их уклон
export function dwvSlopes(parts: Part[], model: Model): PipeSlope[] {
  const out: PipeSlope[] = []
  const z = new Vector3()
  for (const p of parts) {
    if (p.kind !== 'pipe' || sizeSpec(p.size).mat !== 'pvc' && sizeSpec(p.size).mat !== 'ci') continue
    const xf = model.xfs.get(p.id)
    if (!xf) continue
    z.set(0, 0, 1).applyQuaternion(xf.quat)
    if (Math.abs(z.y) > 0.2) continue
    if (systemFam(parts, p.id) !== 'd') continue
    const rise = (Math.abs(z.y) / Math.sqrt(1 - z.y * z.y)) * 12
    const min = minSlope(p.size)
    out.push({ id: p.id, rise, min, ok: rise >= min - 0.01 })
  }
  return out
}

// 0.25 → 1/4", 0.125 → 1/8"
export function slopeLabel(v: number): string {
  const n = Math.round(Math.abs(v) * 16)
  if (n === 0) return '0"'
  let a = n
  let b = 16
  while (a % 2 === 0 && b > 1) {
    a /= 2
    b /= 2
  }
  return b === 1 ? `${a}"` : `${a}/${b}"`
}

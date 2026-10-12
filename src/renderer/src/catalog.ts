// Точка входа справочника: размеры + реестр фитингов.
import { FITTINGS, Part, fittingDef } from './fittings'
import { SizeId, sizeIndex } from './data/sizes'

export * from './data/sizes'
export { DEFAULT_PIPE, FITTINGS, FITTING_ORDER, basinDims, basinRadius, bodyR, bomLines, buildPart, fittingDef, hubR, isDwvKind, mates, portsOf } from './fittings'
export type { Built, FittingDef, Group, Part, PathSeg, PortDef, PortKind, Shape, V3 } from './fittings'

export type PartKind = string

export const kindAvailable = (kind: string, size: SizeId): boolean => fittingDef(kind).sizes.includes(size)

// Варианты второго размера для детали (переходники, отводы тройников)
export function size2Options(kind: string, size: SizeId): SizeId[] {
  const s2 = fittingDef(kind).size2
  return s2 ? s2.options(size) : []
}

// Подходящий второй размер по умолчанию: желаемый, если допустим, иначе ближайший
export function defaultSize2(kind: string, size: SizeId, wanted?: SizeId): SizeId | undefined {
  const s2 = fittingDef(kind).size2
  if (!s2) return undefined
  const opts = s2.options(size)
  if (s2.optional) return wanted && opts.includes(wanted) && wanted !== size ? wanted : undefined
  if (wanted && opts.includes(wanted)) return wanted
  return [...opts].sort((a, b) => Math.abs(sizeIndex(a) - sizeIndex(size)) - Math.abs(sizeIndex(b) - sizeIndex(size)))[0]
}

export const partTitle = (p: Part): string => fittingDef(p.kind).ru

export const KIND_KEYS: { kind: string; key: string }[] = Object.entries(FITTINGS)
  .filter(([, d]) => d.key)
  .map(([kind, d]) => ({ kind, key: d.key! }))

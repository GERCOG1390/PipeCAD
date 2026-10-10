import { KINDS, Part, SIZES, SizeId, englishName } from './catalog'
import { Model } from './geometry'
import { formatLength } from './units'

const KERF = 0.125 // пропил

export interface PipeLine {
  size: SizeId
  name: string
  cuts: number[]
  total: number
  sticks: number
}

export interface FittingLine {
  key: string
  name: string
  ru: string
  qty: number
}

export interface Bom {
  pipes: PipeLine[]
  fittings: FittingLine[]
  joints: number
}

// Раскрой палок: First Fit Decreasing.
function sticksNeeded(cuts: number[], stick: number): number {
  const bins: number[] = []
  let extra = 0
  for (const c of [...cuts].sort((a, b) => b - a)) {
    if (c > stick) {
      extra += Math.floor(c / stick)
      const rest = c % stick
      if (rest > 0) place(rest)
      continue
    }
    place(c)
  }
  function place(c: number): void {
    const i = bins.findIndex((free) => free >= c)
    if (i >= 0) bins[i] -= c + KERF
    else bins.push(stick - c - KERF)
  }
  return bins.length + extra
}

export function computeBom(parts: Part[], model: Model, stick: number): Bom {
  const pipeMap = new Map<SizeId, number[]>()
  const fitMap = new Map<string, FittingLine>()
  for (const p of parts) {
    if (p.kind === 'pipe') {
      const arr = pipeMap.get(p.size) ?? []
      arr.push(p.length ?? 0)
      pipeMap.set(p.size, arr)
    } else {
      const key = `${p.kind}|${p.size}|${p.kind === 'reducer' ? p.size2 : ''}`
      const line = fitMap.get(key) ?? { key, name: englishName(p), ru: KINDS[p.kind].ru, qty: 0 }
      line.qty++
      fitMap.set(key, line)
    }
  }
  const order = (s: SizeId): number => SIZES.findIndex((x) => x.id === s)
  const pipes = [...pipeMap.entries()]
    .sort((a, b) => order(a[0]) - order(b[0]))
    .map(([size, cuts]) => ({
      size,
      name: englishName({ id: '', kind: 'pipe', size, attach: 0, roll: 0 }),
      cuts: [...cuts].sort((a, b) => b - a),
      total: cuts.reduce((a, b) => a + b, 0),
      sticks: sticksNeeded(cuts, stick)
    }))
  const fittings = [...fitMap.values()].sort((a, b) => a.name.localeCompare(b.name))
  return { pipes, fittings, joints: model.links.size / 2 }
}

export function bomCsv(bom: Bom, stick: number): string {
  const q = (s: string): string => `"${s.replace(/"/g, '""')}"`
  const rows: string[] = ['Item,Qty,Unit,Notes']
  for (const p of bom.pipes) {
    rows.push([q(`${p.name} (${stick / 12}' stick)`), p.sticks, 'stick', q(`total ${formatLength(p.total)}; cuts: ${p.cuts.map(formatLength).join(', ')}`)].join(','))
  }
  for (const f of bom.fittings) rows.push([q(f.name), f.qty, 'ea', ''].join(','))
  rows.push([q('Solvent welds (joints)'), bom.joints, 'ea', q('primer + cement')].join(','))
  return '﻿' + rows.join('\r\n')
}

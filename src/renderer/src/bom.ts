import { Part, SIZES, SizeId, bomLines, fittingDef } from './catalog'
import { EnvBomLine, Penetration } from './environment'
import { Model, portKey } from './geometry'
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
  pn?: string
  qty: number
}

export interface Bom {
  pipes: PipeLine[]
  fittings: FittingLine[]
  joints: number // склейки (раструб + гладкий конец)
  threads: number // резьбовые соединения
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
      for (const b of bomLines(p)) {
        const key = b.name
        const line = fitMap.get(key) ?? { key, name: b.name, ru: fittingDef(p.kind).ru, pn: b.pn, qty: 0 }
        line.qty++
        fitMap.set(key, line)
      }
    }
  }
  const order = (s: SizeId): number => SIZES.findIndex((x) => x.id === s)
  const pipes = [...pipeMap.entries()]
    .sort((a, b) => order(a[0]) - order(b[0]))
    .map(([size, cuts]) => ({
      size,
      name: bomLines({ id: '', kind: 'pipe', size, attach: 0, roll: 0 })[0].name,
      cuts: [...cuts].sort((a, b) => b - a),
      total: cuts.reduce((a, b) => a + b, 0),
      sticks: sticksNeeded(cuts, stick)
    }))
  const fittings = [...fitMap.values()].sort((a, b) => a.name.localeCompare(b.name))
  const byKey = new Map(model.ports.map((w) => [portKey(w.partId, w.index), w]))
  let joints = 0
  let threads = 0
  model.links.forEach((b, a) => {
    if (a > b) return
    const k = byKey.get(a)?.def.kind
    if (k === 'fpt' || k === 'mpt') threads++
    else joints++
  })
  return { pipes, fittings, joints, threads }
}

export function bomCsv(bom: Bom, stick: number, env: EnvBomLine[] = [], pens: Penetration[] = []): string {
  const q = (s: string): string => `"${s.replace(/"/g, '""')}"`
  const rows: string[] = ['Item,Charlotte Part,Qty,Unit,Notes']
  for (const p of bom.pipes) {
    rows.push([q(`${p.name} (${stick / 12}' stick)`), '', p.sticks, 'stick', q(`total ${formatLength(p.total)}; cuts: ${p.cuts.map(formatLength).join(', ')}`)].join(','))
  }
  for (const f of bom.fittings) rows.push([q(f.name), q(f.pn ?? ''), f.qty, 'ea', ''].join(','))
  rows.push([q('Solvent welds (joints)'), '', bom.joints, 'ea', q('primer + cement')].join(','))
  if (bom.threads) rows.push([q('Threaded joints'), '', bom.threads, 'ea', q('PTFE tape / thread sealant')].join(','))
  for (const e of env) rows.push([q(e.name), '', e.unit === 'куб. ярд' ? e.qty.toFixed(2) : e.qty, q(e.unit), q(e.ru)].join(','))
  for (const p of pens) rows.push([q('Penetration: ' + p.where), '', 1, 'ea', q(p.note)].join(','))
  return '﻿' + rows.join('\r\n')
}

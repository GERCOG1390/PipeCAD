// Лист для заказчика или инспекции: изометрия с длинами, материалы с ценами, раскрой и замечания (HTML → PDF)
import { Bom } from './bom'
import { EnvBomLine } from './environment'
import { money, pipeKey } from './prices'
import { Shot } from './Snapshot'
import { JobInfo } from './store'
import { formatLength } from './units'

export interface SheetData {
  title: string
  info: JobInfo
  shot: Shot | null
  bom: Bom
  stick: number
  env: EnvBomLine[]
  prices: Record<string, number>
  markup: number
  warnings: string[]
}

const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export interface PricedLine {
  key: string
  name: string
  sub: string
  qty: number
  unit: string
  price?: number
}

// Строки материалов в общем виде (для панели и для листа)
export function pricedLines(bom: Bom, stick: number, env: EnvBomLine[]): PricedLine[] {
  const out: PricedLine[] = []
  for (const p of bom.pipes) out.push({ key: pipeKey(p.size), name: p.name, sub: `${stick / 12}' sticks · total ${formatLength(p.total)} · ${p.cuts.length} cuts`, qty: p.sticks, unit: 'stick' })
  for (const f of [...bom.fittings].sort((a, b) => a.name.localeCompare(b.name, 'en', { numeric: true }))) out.push({ key: f.key, name: f.name, sub: f.pn ? `#${f.pn}` : '', qty: f.qty, unit: 'ea' })
  for (const e of env) out.push({ key: 'env|' + e.name, name: e.name, sub: 'Site / framing', qty: Math.round(e.qty * 100) / 100, unit: e.unit })
  return out
}

export function sheetTotals(lines: PricedLine[], prices: Record<string, number>, markup: number): { sub: number; priced: number; total: number } {
  let sub = 0
  let priced = 0
  for (const l of lines) {
    const p = prices[l.key]
    if (p === undefined) continue
    sub += p * l.qty
    priced++
  }
  return { sub, priced, total: sub * (1 + markup / 100) }
}

export function buildSheet(d: SheetData): string {
  const lines = pricedLines(d.bom, d.stick, d.env)
  const t = sheetTotals(lines, d.prices, d.markup)
  const anyPrice = t.priced > 0
  const date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
  const rows = lines
    .map((l) => {
      const p = d.prices[l.key]
      return `<tr><td>${esc(l.name)}${l.sub ? `<div class="sub">${esc(l.sub)}</div>` : ''}</td><td class="n">${l.qty} ${l.unit}</td>${anyPrice ? `<td class="n">${p !== undefined ? money(p) : '—'}</td><td class="n">${p !== undefined ? money(p * l.qty) : '—'}</td>` : ''}</tr>`
    })
    .join('')
  const cuts = d.bom.pipes
    .map((p) => `<tr><td>${esc(p.name)}</td><td>${p.cuts.map((c) => `<span class="cut">${esc(formatLength(c))}</span>`).join(' ')}</td></tr>`)
    .join('')
  const labels = (d.shot?.labels ?? []).map((l) => `<div class="lbl${l.warn ? ' warn' : ''}" style="left:${(l.x * 100).toFixed(2)}%;top:${(l.y * 100).toFixed(2)}%">${esc(l.text)}</div>`).join('')
  const joints = [
    d.bom.joints ? `${d.bom.joints} solvent welds (primer + cement)` : '',
    d.bom.solder ? `${d.bom.solder} solder joints` : '',
    d.bom.mech ? `${d.bom.mech} no-hub joints (60 in-lbs)` : '',
    d.bom.threads ? `${d.bom.threads} threaded (tape/dope)` : ''
  ].filter(Boolean)
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(d.title)}</title><style>
  * { box-sizing: border-box; }
  body { font: 11px/1.4 "Segoe UI", Arial, sans-serif; color: #111; margin: 0; }
  h1 { font-size: 20px; margin: 0; }
  .head { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #0f766e; padding-bottom: 6px; margin-bottom: 10px; }
  .brand { color: #0f766e; font-weight: 700; font-size: 12px; letter-spacing: .04em; }
  .meta { text-align: right; color: #444; }
  .info { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 16px; margin-bottom: 10px; }
  .info b { color: #555; font-weight: 600; display: inline-block; min-width: 64px; }
  .view { position: relative; border: 1px solid #ccc; border-radius: 6px; overflow: hidden; background: #fff; }
  .view img { width: 100%; display: block; }
  .lbl { position: absolute; transform: translate(-50%, -50%); background: rgba(255,255,255,.92); border: 1px solid #0f766e; color: #0b4f4a; border-radius: 4px; padding: 0 4px; font: 600 9px/1.5 Consolas, monospace; white-space: nowrap; }
  .lbl.warn { border-color: #d97706; color: #92400e; }
  h2 { font-size: 13px; margin: 14px 0 6px; color: #0f766e; text-transform: uppercase; letter-spacing: .05em; }
  table { width: 100%; border-collapse: collapse; }
  td, th { border-bottom: 1px solid #e3e3e3; padding: 4px 6px; vertical-align: top; text-align: left; }
  th { font-size: 10px; color: #555; text-transform: uppercase; }
  td.n, th.n { text-align: right; white-space: nowrap; }
  .sub { color: #777; font-size: 9.5px; }
  .tot td { border: none; font-weight: 700; }
  .cut { display: inline-block; border: 1px solid #ccc; border-radius: 3px; padding: 0 4px; margin: 1px; font-family: Consolas, monospace; font-size: 9.5px; }
  .warns li { color: #92400e; }
  .notes { white-space: pre-wrap; border: 1px solid #e3e3e3; border-radius: 6px; padding: 6px 8px; }
  .page { page-break-after: always; }
  .foot { margin-top: 12px; color: #888; font-size: 9px; }
  </style></head><body>
  <div class="page">
    <div class="head"><div><div class="brand">PIPECAD · PLUMBING LAYOUT</div><h1>${esc(d.title)}</h1></div><div class="meta">${esc(date)}</div></div>
    <div class="info">
      <div><b>Customer</b> ${esc(d.info.customer || '—')}</div>
      <div><b>Address</b> ${esc(d.info.address || '—')}</div>
    </div>
    ${d.shot ? `<div class="view"><img src="${d.shot.img}">${labels}</div>` : ''}
    ${d.info.notes ? `<h2>Notes</h2><div class="notes">${esc(d.info.notes)}</div>` : ''}
    ${d.warnings.length ? `<h2>Check before install</h2><ul class="warns">${d.warnings.map((w) => `<li>${esc(w)}</li>`).join('')}</ul>` : ''}
  </div>
  <div>
    <h2>Materials</h2>
    <table><thead><tr><th>Item</th><th class="n">Qty</th>${anyPrice ? '<th class="n">Unit</th><th class="n">Total</th>' : ''}</tr></thead><tbody>${rows}</tbody>
    ${anyPrice ? `<tbody class="tot"><tr><td></td><td class="n">Subtotal</td><td></td><td class="n">${money(t.sub)}</td></tr>${d.markup ? `<tr><td></td><td class="n">Markup ${d.markup}%</td><td></td><td class="n">${money(t.total - t.sub)}</td></tr>` : ''}<tr><td></td><td class="n">Materials total</td><td></td><td class="n">${money(t.total)}</td></tr></tbody>` : ''}
    </table>
    ${anyPrice && t.priced < lines.length ? `<div class="sub">${lines.length - t.priced} item(s) without a price are not in the total.</div>` : ''}
    ${joints.length ? `<div class="sub" style="margin-top:6px">Joints: ${joints.join(' · ')}</div>` : ''}
    ${cuts ? `<h2>Cut list</h2><table>${cuts}</table>` : ''}
    <div class="foot">Generated by PipeCAD. Drain slope minimums per IPC Table 704.1 — verify against the Illinois Plumbing Code and local amendments.</div>
  </div>
  </body></html>`
}

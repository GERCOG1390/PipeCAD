// Вкладка «Материалы»: спецификация с ценами, сведения о заказе, экспорт CSV и листа PDF
import { useMemo, useState } from 'react'
import { Bom, bomCsv } from './bom'
import { EnvBomSection } from './EnvPanel'
import { Penetration, envBom } from './environment'
import { Model } from './geometry'
import { money, usePrices } from './prices'
import { buildSheet, pricedLines, sheetTotals } from './report'
import { dwvSlopes } from './slope'
import { captureView } from './Snapshot'
import { useStore } from './store'
import { formatLength } from './units'

function PriceInput({ value, onCommit }: { value?: number; onCommit: (v: number | null) => void }) {
  const [text, setText] = useState<string | null>(null)
  const shown = text ?? (value !== undefined ? value.toFixed(2) : '')
  const commit = (): void => {
    if (text === null) return
    const t = text.replace(/[$,\s]/g, '')
    onCommit(t === '' ? null : Number(t))
    setText(null)
  }
  return (
    <input
      className="price"
      placeholder="$"
      value={shown}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
    />
  )
}

export function BomPanel({ bom, pens, model }: { bom: Bom; pens: Penetration[]; model: Model }) {
  const envItems = useStore((s) => s.env)
  const parts = useStore((s) => s.parts)
  const stick = useStore((s) => s.stick)
  const setStick = useStore((s) => s.setStick)
  const setMessage = useStore((s) => s.setMessage)
  const info = useStore((s) => s.info)
  const setInfo = useStore((s) => s.setInfo)
  const filePath = useStore((s) => s.filePath)
  const { prices, markup, setPrice, setMarkup } = usePrices()
  const [busy, setBusy] = useState(false)
  const envLines = useMemo(() => envBom(envItems), [envItems])
  const lines = useMemo(() => pricedLines(bom, stick, envLines), [bom, stick, envLines])
  const totals = sheetTotals(lines, prices, markup)
  const empty = !bom.pipes.length && !bom.fittings.length && !envItems.length
  const title = filePath ? filePath.split(/[\\/]/).pop()!.replace(/\.pipe$/i, '') : 'New project'

  const exportCsv = async (): Promise<void> => {
    const path = await window.api.exportFile({ defaultName: 'pvc-materials.csv', content: bomCsv(bom, stick, envLines, pens), ext: 'csv', label: 'CSV (Excel)' })
    if (path) setMessage(`List saved: ${path}`)
  }

  const exportPdf = async (out?: string): Promise<string | null> => {
    setBusy(true)
    try {
      const warnings: string[] = []
      if (model.open.length) warnings.push(`${model.open.length} open end(s) — cap, plug or connect before testing`)
      const flat = dwvSlopes(parts, model).filter((s) => !s.ok).length
      if (flat) warnings.push(`${flat} horizontal drain pipe(s) flatter than the minimum slope`)
      if (model.bad.length) warnings.push(`${model.bad.length} joint(s) don't line up`)
      const badPens = pens.filter((p) => !p.ok)
      for (const p of badPens.slice(0, 6)) warnings.push(`Framing: ${p.where} — ${p.note}`)
      const shot = await captureView(model)
      const html = buildSheet({ title, info, shot, bom, stick, env: envLines, prices, markup, warnings })
      const path = await window.api.exportPdf({ html, defaultName: `${title}.pdf`, out })
      if (path) setMessage(`PDF saved: ${path}`)
      return path
    } finally {
      setBusy(false)
    }
  }
  ;(window as unknown as { pipecadExportPdf: typeof exportPdf }).pipecadExportPdf = exportPdf // для автотестов

  return (
    <div className="bom">
      <details className="job" open={!!(info.customer || info.address)}>
        <summary>Job info (for the PDF sheet)</summary>
        <label>Customer</label>
        <input value={info.customer} onChange={(e) => setInfo({ customer: e.target.value })} placeholder="Name" />
        <label>Address</label>
        <input value={info.address} onChange={(e) => setInfo({ address: e.target.value })} placeholder="Job address" />
        <label>Notes</label>
        <textarea rows={3} value={info.notes} onChange={(e) => setInfo({ notes: e.target.value })} placeholder="Scope, permit #, inspection notes…" />
      </details>

      <div className="row between">
        <span className="muted">Pipe stick:</span>
        <div className="seg">
          {[120, 240].map((n) => (
            <button key={n} className={stick === n ? 'on' : ''} onClick={() => setStick(n)}>
              {n / 12}'
            </button>
          ))}
        </div>
      </div>
      {empty && <div className="empty">Empty — add some parts.</div>}

      {bom.pipes.map((p) => (
        <div key={p.size} className="bom-pipe">
          <div className="row between">
            <b>{p.name}</b>
            <span className="qty">{p.sticks} pcs</span>
          </div>
          <div className="muted small">
            Total {formatLength(p.total)} · cuts: {p.cuts.length}
          </div>
          <div className="cuts">
            {p.cuts.map((c, i) => (
              <span key={i}>{formatLength(c)}</span>
            ))}
          </div>
        </div>
      ))}

      {lines.length > 0 && (
        <table className="priced">
          <thead>
            <tr>
              <th>Item</th>
              <th className="n">Qty</th>
              <th className="n">Unit $</th>
              <th className="n">Total</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => {
              const pr = prices[l.key]
              return (
                <tr key={l.key}>
                  <td>
                    {l.name}
                    {l.sub && <div className="muted small">{l.sub}</div>}
                  </td>
                  <td className="qty n">
                    {l.qty}
                    <span className="muted small"> {l.unit}</span>
                  </td>
                  <td className="n">
                    <PriceInput value={pr} onCommit={(v) => setPrice(l.key, v)} />
                  </td>
                  <td className="n">{pr !== undefined ? money(pr * l.qty) : <span className="muted">—</span>}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}

      {!empty && (
        <>
          <div className="totals">
            <div className="row between">
              <span>Subtotal</span>
              <b>{money(totals.sub)}</b>
            </div>
            <div className="row between">
              <span>
                Markup{' '}
                <input className="price pct" value={String(markup)} onChange={(e) => setMarkup(Number(e.target.value) || 0)} /> %
              </span>
              <span>{money(totals.total - totals.sub)}</span>
            </div>
            <div className="row between grand">
              <span>Materials total</span>
              <b>{money(totals.total)}</b>
            </div>
            {totals.priced < lines.length && <div className="muted small">{lines.length - totals.priced} item(s) without a price. Prices are remembered for next jobs.</div>}
          </div>
          <div className="muted small">
            Solvent welds: {bom.joints} (primer + cement){bom.solder ? ` · solder joints: ${bom.solder}` : ''}
            {bom.mech ? ` · no-hub joints: ${bom.mech} (torque 60 in-lbs)` : ''}
            {bom.threads ? ` · threaded: ${bom.threads} (tape/dope)` : ''}
          </div>
          <EnvBomSection pens={pens} />
          <button className="wide primary" disabled={busy} onClick={() => void exportPdf()} title="Uses the current 3D view — set it up the way you want first">
            {busy ? 'Making PDF…' : '📄 Export PDF sheet'}
          </button>
          <button className="wide" onClick={exportCsv}>
            Export to Excel (CSV)
          </button>
        </>
      )}
    </div>
  )
}

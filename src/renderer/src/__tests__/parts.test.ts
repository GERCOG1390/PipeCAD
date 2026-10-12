// Проверки каталога: каждая деталь строится во всех размерах, порты корректны, к каждому концу можно что-то подключить.
import { describe, expect, it } from 'vitest'
import { FITTINGS, Part, SizeId, buildPart, defaultSize2, fittingDef, portsOf } from '../catalog'
import { buildModel } from '../geometry'
import { useStore } from '../store'
import { KITS } from '../kits'
import { dwvSlopes } from '../slope'

const finite = (v: number[]): boolean => v.every((x) => Number.isFinite(x))

// все сочетания размер/второй размер для вида детали
function variants(kind: string): Part[] {
  const def = fittingDef(kind)
  const out: Part[] = []
  for (const size of def.sizes) {
    const s2s: (SizeId | undefined)[] = def.size2 ? [...def.size2.options(size), ...(def.size2.optional ? [undefined] : [])] : [undefined]
    for (const size2 of s2s) out.push({ id: 'x', kind, size, size2, attach: 0, roll: 0, length: kind === 'pipe' ? 24 : undefined, pos: [0, 0, 0] })
  }
  return out
}

describe('catalog', () => {
  const kinds = Object.keys(FITTINGS)

  it('has parts', () => expect(kinds.length).toBeGreaterThan(100))

  it.each(kinds)('%s builds in every size with sane ports', (kind) => {
    for (const p of variants(kind)) {
      const b = buildPart(p)
      expect(b.shapes.length, `${kind} ${p.size}`).toBeGreaterThan(0)
      expect(b.ports.length, `${kind} ${p.size}`).toBeGreaterThan(0)
      for (const pt of b.ports) {
        expect(finite(pt.pos) && finite(pt.dir), `${kind} ${p.size} port`).toBe(true)
        expect(Math.hypot(...pt.dir), `${kind} ${p.size} dir length`).toBeCloseTo(1, 3)
        expect(pt.depth, `${kind} ${p.size} depth`).toBeGreaterThanOrEqual(0)
      }
      for (const s of b.shapes) {
        // NaN и Infinity в JSON превращаются в null
        expect(JSON.stringify(s).includes('null'), `${kind} ${p.size} shape ${s.t}`).toBe(false)
      }
    }
  })

  it('default size2 is valid for every kind', () => {
    for (const kind of kinds) {
      const def = fittingDef(kind)
      if (!def.size2) continue
      for (const size of def.sizes) {
        const s2 = defaultSize2(kind, size, size)
        if (s2) expect(def.size2.options(size)).toContain(s2)
      }
    }
  })
})

// К каждому обычному концу (раструб, гладкий, резьба) подключается труба — напрямую или через переходник
describe('connections', () => {
  const special = new Set(['slip', 'seat', 'lid'])
  const kinds = Object.keys(FITTINGS).filter((k) => k !== 'pipe')

  it.each(kinds)('%s: pipe attaches to every end', (kind) => {
    const p = variants(kind)[0]
    portsOf(p).forEach((pt, i) => {
      if (special.has(pt.kind)) return
      useStore.setState({ parts: [{ ...p }], env: [], activePort: { id: 'x', port: i }, selectedId: 'x', paletteSize: pt.size, placing: null, message: null })
      useStore.getState().addPart('pipe')
      const st = useStore.getState()
      expect(st.parts.length, `${kind} ${p.size} port ${i}: ${st.message}`).toBeGreaterThan(1)
      const model = buildModel(st.parts)
      expect(model.bad.length, `${kind} ${p.size} port ${i} bad joints`).toBe(0)
    })
  })
})

describe('pumps and basins', () => {
  it('pump drops onto the basin seat and lines up with the lid grommet', () => {
    const s = useStore.getState()
    useStore.setState({ parts: [], env: [], placing: null, paletteSize: '2' })
    s.startPlacing({ kind: 'pit_ej1830' })
    useStore.getState().placeAt([0, 0, 0])
    let parts = useStore.getState().parts
    expect(parts.map((p) => p.kind)).toEqual(['pit_ej1830', 'lid_ej1830'])
    const lid = parts[1]
    useStore.getState().deletePart(lid.id)
    useStore.getState().startPlacing({ kind: 'pump_M267' })
    useStore.getState().placeAt([1, 0, 1])
    parts = useStore.getState().parts
    const pump = parts.find((p) => p.kind === 'pump_M267')!
    expect(pump.parent?.id).toBe(parts[0].id)
  })
})

describe('assemblies', () => {
  it.each(KITS.map((k) => k.id))('%s kit builds cleanly and undoes in one step', (id) => {
    const kit = KITS.find((k) => k.id === id)!
    useStore.setState({ parts: [], env: [], past: [], future: [], placing: null, message: null })
    useStore.getState().startPlacing({ kind: kit.base, kit: kit.id })
    useStore.getState().placeAt([0, 0, 0])
    const st = useStore.getState()
    expect(st.message, st.message ?? '').toMatch(/added/)
    expect(st.parts.length).toBeGreaterThan(2)
    expect(buildModel(st.parts).bad.length).toBe(0)
    st.undo()
    expect(useStore.getState().parts.length).toBe(0)
  })
})

describe('drain slope', () => {
  it('flags a level DWV pipe and accepts 1/4" per foot', () => {
    // отвод 1/4 DWV стоит так, что выход горизонтальный
    const el: Part = { id: 'e', kind: 'dwv90', size: '2', attach: 0, roll: 0, pos: [0, 12, 0], rot: [0, 0, 0] }
    const open = buildModel([el]).open
    const horiz = open.find((w) => Math.abs(w.dir.y) < 0.1)!
    const pipe: Part = { id: 'p', kind: 'pipe', size: '2', attach: 0, roll: 0, length: 24, parent: { id: 'e', port: horiz.index } }
    let parts = [el, pipe]
    let s = dwvSlopes(parts, buildModel(parts))
    expect(s.length).toBe(1)
    expect(s[0].ok).toBe(false)
    parts = [el, { ...pipe, slope: -0.25 }]
    const m = buildModel(parts)
    s = dwvSlopes(parts, m)
    expect(s[0].ok).toBe(true)
    expect(s[0].rise).toBeCloseTo(0.25, 3)
    const ends = m.open.filter((w) => w.partId === 'p')
    expect(ends[0].pos.y).toBeCloseTo(horiz.pos.y - 0.5, 2)
  })
})

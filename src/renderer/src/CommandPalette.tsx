// Командная строка (⌘K / Ctrl+K): найти и поставить деталь, выполнить команду, открыть недавний проект
import { Box, Clock, Command, Package, Search } from 'lucide-react'
import { ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import { FITTINGS, SIZES, SizeId, sizeLabel, sizeMatLabel } from './catalog'
import { KITS } from './kits'
import { MOD, isMac } from './platform'
import { newProject, open, openPath, save } from './projectActions'
import { useRecentFiles } from './recentFiles'
import { toggleRecording } from './Replay'
import { useStore } from './store'
import { useThumb } from './thumbs'
import { useUi } from './ui'

interface Item {
  id: string
  label: string
  sub?: string
  keys?: string
  icon: ReactNode
  kind?: string // деталь — показываем картинку
  size?: SizeId
  words: string // по чему ищем
  run: () => void
}

function Thumb({ kind, size }: { kind: string; size: SizeId }) {
  const url = useThumb(kind, FITTINGS[kind].sizes.includes(size) ? size : FITTINGS[kind].sizes[0])
  return <span className="cp-thumb">{url ? <img src={url} alt="" /> : <Package size={18} />}</span>
}

// «3», «1-1/2», «3/4"», «cu 3/4» → размер
function sizeFrom(tokens: string[]): SizeId | undefined {
  const cu = tokens.some((t) => t === 'cu' || t === 'copper')
  for (const t of tokens) {
    const v = t.replace(/["”]/g, '').replace(/^(\d+)\s*1\/2$/, '$1-1/2')
    const hit = SIZES.find((s) => s.id === (cu ? 'cu' + v : v) || sizeLabel(s.id).replace(/["”]/g, '') === v)
    if (hit) return hit.id
  }
  return undefined
}

export function CommandPalette({ onSettings, onHelp }: { onSettings: () => void; onHelp: () => void }) {
  const show = useUi((s) => s.palette)
  const setShow = useUi((s) => s.setPalette)
  const [q, setQ] = useState('')
  const [i, setI] = useState(0)
  const input = useRef<HTMLInputElement>(null)
  const list = useRef<HTMLDivElement>(null)
  const files = useRecentFiles((s) => s.files)
  const paletteSize = useStore((s) => s.paletteSize)

  useEffect(() => {
    if (show) {
      setQ('')
      setI(0)
      setTimeout(() => input.current?.focus(), 0)
    }
  }, [show])

  const tokens = q.trim().toLowerCase().split(/\s+/).filter(Boolean)
  const size = sizeFrom(tokens) ?? paletteSize
  const items = useMemo<Item[]>(() => {
    const st = useStore.getState()
    const ui = useUi.getState()
    const cmd = (id: string, label: string, run: () => void, keys?: string, words = ''): Item => ({ id: 'c:' + id, label, run, keys, icon: <Command size={16} />, words: (label + ' ' + words).toLowerCase() })
    const cmds: Item[] = [
      cmd('save', 'Save project', () => void save(), `${MOD}S`),
      cmd('saveas', 'Save as…', () => void save(true), isMac ? '⌘⇧S' : 'Ctrl+Shift+S'),
      cmd('open', 'Open project…', () => void open(), `${MOD}O`),
      cmd('new', 'New project', newProject),
      cmd('fit', 'Fit everything in view', () => st.setView(null), 'Home', 'zoom extents'),
      cmd('top', 'View from top', () => st.setView([0, 1, 0]), undefined, 'plan'),
      cmd('front', 'View from front', () => st.setView([0, 0, 1]), undefined, 'elevation'),
      cmd('side', 'View from side', () => st.setView([1, 0, 0])),
      cmd('3d', '3D view', () => st.setView([1, 0.8, 1.2]), undefined, 'iso isometric'),
      cmd('dims', 'Show / hide pipe lengths', st.toggleDims, 'L', 'dimensions labels'),
      cmd('axes', 'Centerlines & intersections', st.toggleAxes, 'A', 'axes'),
      cmd('xray', 'Walls & floors: X-ray', () => st.setEnvMode('ghost'), undefined, 'transparent see through site'),
      cmd('solid', 'Walls & floors: solid', () => st.setEnvMode('solid'), undefined, 'site'),
      cmd('branch', 'Start a new branch', st.newBranch, undefined, 'separate place floor'),
      cmd('join', 'Join the selected end to another end', st.startJoin, 'J', 'connect'),
      cmd('replay', 'Replay the build', () => st.startReplay(), undefined, 'video animation'),
      cmd('rec', 'Record window video (MP4)', () => void toggleRecording(), undefined, 'record mp4'),
      cmd('bom', 'Materials, prices & PDF sheet', () => ui.setSideTab('bom'), undefined, 'bom list quote cut export pdf csv'),
      cmd('settings', 'View settings', onSettings, undefined, 'theme dark light size quality'),
      cmd('help', 'Keyboard & mouse shortcuts', onHelp, '?', 'help keys')
    ]
    const kits: Item[] = KITS.map((k) => ({
      id: 'k:' + k.id,
      label: k.title,
      sub: k.sub,
      icon: <Box size={16} />,
      kind: k.base,
      size: FITTINGS[k.base].sizes[0],
      words: (k.title + ' ' + k.sub + ' assembly kit').toLowerCase(),
      run: () => st.startPlacing({ kind: k.base, kit: k.id })
    }))
    const parts: Item[] = Object.keys(FITTINGS)
      .filter((k) => (k === 'pipe' || FITTINGS[k].group !== 'common') && !k.startsWith('lid_') && (FITTINGS[k].sizes.includes(size) || FITTINGS[k].group === 'heater' || FITTINGS[k].group === 'pump'))
      .map((k) => {
        const d = FITTINGS[k]
        const fixture = d.group === 'heater' || d.group === 'pump'
        return {
          id: 'p:' + k,
          label: fixture ? d.ru : `${d.ru} ${sizeLabel(size)}`,
          sub: [d.en !== d.ru ? d.en : '', d.pn ? '#' + d.pn : '', fixture ? '' : sizeMatLabel(size)].filter(Boolean).join(' · '),
          keys: d.key,
          icon: <Package size={16} />,
          kind: k,
          size,
          words: `${d.ru} ${d.en} ${d.pn ?? ''} ${d.cat} ${d.group}`.toLowerCase(),
          run: () => {
            if (!fixture && useStore.getState().paletteSize !== size) st.setPaletteSize(size)
            st.addPart(k)
          }
        }
      })
    const recents: Item[] = files.map((f) => ({ id: 'f:' + f.path, label: f.name, sub: f.path, icon: <Clock size={16} />, words: ('open recent ' + f.name).toLowerCase(), run: () => void openPath(f.path) }))
    return [...cmds, ...kits, ...parts, ...recents]
  }, [files, size, onSettings, onHelp])

  // слова-размеры («3», «cu») не мешают поиску по названию
  const words = tokens.filter((t) => !sizeFrom([t]) && t !== 'cu' && t !== 'copper')
  const shown = useMemo(() => {
    if (!tokens.length) return items.filter((x) => x.id.startsWith('c:') || x.id.startsWith('f:')).slice(0, 12)
    return items.filter((x) => words.every((w) => x.words.includes(w) || x.label.toLowerCase().includes(w))).slice(0, 40)
  }, [items, q])

  useEffect(() => setI(0), [q])
  useEffect(() => {
    list.current?.querySelector('.cp-item.on')?.scrollIntoView({ block: 'nearest' })
  }, [i])

  if (!show) return null
  const close = (): void => setShow(false)
  const run = (it?: Item): void => {
    if (!it) return
    close()
    it.run()
  }
  return (
    <div className="modal-back cp-back" onPointerDown={close}>
      <div className="cp" onPointerDown={(e) => e.stopPropagation()}>
        <div className="cp-input">
          <Search size={18} />
          <input
            ref={input}
            value={q}
            placeholder={`Find a part or command — e.g. "san tee 3", "cu 3/4 elbow", "save"`}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') return (e.preventDefault(), close())
              if (e.key === 'ArrowDown') return (e.preventDefault(), setI((x) => Math.min(shown.length - 1, x + 1)))
              if (e.key === 'ArrowUp') return (e.preventDefault(), setI((x) => Math.max(0, x - 1)))
              if (e.key === 'Enter') return (e.preventDefault(), run(shown[i]))
            }}
          />
          {sizeFrom(tokens) && <span className="tag">{sizeMatLabel(size)}</span>}
        </div>
        <div className="cp-list" ref={list}>
          {shown.map((it, n) => (
            <button key={it.id} className={'cp-item' + (n === i ? ' on' : '')} onMouseMove={() => setI(n)} onClick={() => run(it)}>
              {it.kind && it.size ? <Thumb kind={it.kind} size={it.size} /> : <span className="cp-icon">{it.icon}</span>}
              <span className="cp-text">
                <span>{it.label}</span>
                {it.sub && <small>{it.sub}</small>}
              </span>
              {it.keys && <kbd>{it.keys}</kbd>}
            </button>
          ))}
          {!shown.length && <div className="muted cp-empty">Nothing found. Try a part name, a Charlotte/NIBCO number or a size like 3 or 1-1/2.</div>}
        </div>
        <div className="cp-foot muted small">
          ↑↓ choose · Enter run · Esc close · sizes: type 3, 1-1/2, cu 3/4 · catalog now {sizeMatLabel(paletteSize)}
        </div>
      </div>
    </div>
  )
}

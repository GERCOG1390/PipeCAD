import { useEffect, useMemo, useState } from 'react'
import { KIND_KEYS } from './catalog'
import { computeBom } from './bom'
import { buildModel } from './geometry'
import { BomPanel, Inspector, Palette } from './Panels'
import { Scene } from './Scene'
import { EnvModeSwitch, EnvPalette } from './EnvPanel'
import { usePenetrations } from './EnvScene'
import { RecButton, ReplayBar } from './Replay'
import { QuickMenu } from './QuickMenu'
import { LengthEditor } from './LengthEditor'
import { ModeBanner } from './ModeBanner'
import { ProjectFile, serialize, useStore } from './store'

const DRAFT_KEY = 'pipecad.draft'

async function save(saveAs = false): Promise<void> {
  const { filePath, markSaved, setMessage } = useStore.getState()
  const path = await window.api.saveProject({ path: filePath, content: serialize(), saveAs })
  if (path) {
    markSaved(path)
    setMessage(`Saved: ${path}`)
  }
}

function confirmDiscard(): boolean {
  return !useStore.getState().dirty || confirm('You have unsaved changes. Continue without saving?')
}

async function open(): Promise<void> {
  if (!confirmDiscard()) return
  const r = await window.api.openProject()
  if (!r) return
  try {
    const f = JSON.parse(r.content) as ProjectFile
    if (f.app !== 'pipecad' || !Array.isArray(f.parts)) throw new Error()
    useStore.getState().loadProject(f, r.path)
  } catch {
    useStore.getState().setMessage('Couldn\'t read the project file')
  }
}

export function App() {
  const parts = useStore((s) => s.parts)
  const stick = useStore((s) => s.stick)
  const message = useStore((s) => s.message)
  const filePath = useStore((s) => s.filePath)
  const dirty = useStore((s) => s.dirty)
  const showDims = useStore((s) => s.showDims)
  const showPorts = useStore((s) => s.showPorts)
  const showAxes = useStore((s) => s.showAxes)
  const replaying = useStore((s) => !!s.replay)
  const canUndo = useStore((s) => s.past.length > 0)
  const canRedo = useStore((s) => s.future.length > 0)
  const st = useStore.getState()
  const [tab, setTab] = useState<'props' | 'bom'>('props')
  const [left, setLeft] = useState<'pipes' | 'env'>('pipes')
  const env = useStore((s) => s.env)
  const selectedEnv = useStore((s) => s.selectedEnv)

  const model = useMemo(() => buildModel(parts), [parts])
  const bom = useMemo(() => computeBom(parts, model, stick), [parts, model, stick])
  const openEnds = model.open.length
  ;(window as unknown as { pipecadModel: typeof model }).pipecadModel = model // для автотестов
  const pens = usePenetrations(model)
  const badPens = pens.filter((p) => !p.ok).length
  useEffect(() => {
    if (selectedEnv) setTab('props')
  }, [selectedEnv])

  // Черновик на случай закрытия без сохранения
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY)
      if (raw) {
        const d = JSON.parse(raw) as { file: ProjectFile; path: string | null }
        if (d.file?.parts?.length || d.file?.env?.length) {
          useStore.getState().loadProject(d.file, d.path)
          useStore.setState({ dirty: true })
        }
      }
    } catch {
      /* нет черновика */
    }
  }, [])
  useEffect(() => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ file: JSON.parse(serialize()), path: filePath }))
    } catch {
      /* ignore */
    }
  }, [parts, env, stick, filePath])

  useEffect(() => {
    const name = filePath ? filePath.split(/[\\/]/).pop() : 'New project'
    document.title = `${name}${dirty ? ' •' : ''} — PipeCAD`
  }, [filePath, dirty])

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const t = e.target as HTMLElement
      if (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA') return
      const s = useStore.getState()
      const k = e.key.toLowerCase()
      if (s.replay) {
        e.preventDefault()
        if (k === 'escape') s.stopReplay()
        else if (e.code === 'Space') s.setReplay({ playing: !s.replay.playing })
        else if (k === 'arrowright') s.setReplayIndex(s.replay.i + 1)
        else if (k === 'arrowleft') s.setReplayIndex(s.replay.i - 1)
        return
      }
      if (e.ctrlKey && (e.code === 'KeyZ') && !e.shiftKey) return (e.preventDefault(), s.undo())
      if (e.ctrlKey && (e.code === 'KeyY' || (e.code === 'KeyZ' && e.shiftKey))) return (e.preventDefault(), s.redo())
      if (e.ctrlKey && e.code === 'KeyS') return (e.preventDefault(), void save(e.shiftKey))
      if (e.ctrlKey && e.code === 'KeyO') return (e.preventDefault(), void open())
      if (e.ctrlKey) return
      if (s.joining && k === 'escape') return useStore.setState({ joining: false, message: null })
      if (e.code === 'KeyJ') return s.startJoin()
      if (e.code === 'KeyA') return s.toggleAxes()
      if (e.code === 'KeyL') return s.toggleDims()
      if (s.placing) {
        if (k === 'escape') return s.cancelPlacing()
        if (e.code === 'KeyR') return s.turnPlacing(e.shiftKey ? -90 : 90)
      }
      if ((k === 'delete' || k === 'backspace') && s.selectedEnv) return s.deleteEnv(s.selectedEnv)
      if ((k === 'delete' || k === 'backspace') && s.selectedId) return e.shiftKey ? s.deleteBranch(s.selectedId) : s.deletePart(s.selectedId)
      if (k === 'escape') return (s.select(null), s.selectEnv(null))
      if (e.code === 'KeyR' && s.selectedId) return s.rollPart(s.selectedId, e.shiftKey ? -90 : 90)
      if (k === 'home') return s.setView(null)
      // цифры при выбранной трубе — сразу ввод длины
      if (/^[0-9]$/.test(e.key) && s.selectedId && s.parts.find((p) => p.id === s.selectedId)?.kind === 'pipe') {
        e.preventDefault()
        return useStore.setState({ lengthEdit: { id: s.selectedId, text: e.key, n: Date.now() } })
      }
      const hit = KIND_KEYS.find((x) => e.code === `Key${x.key}`)
      // гасим символ клавиши, чтобы он не попал в поле длины, которое откроется после добавления трубы
      if (hit) return (e.preventDefault(), s.addPart(hit.kind))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (!message) return
    const t = setTimeout(() => useStore.getState().setMessage(null), 5000)
    return () => clearTimeout(t)
  }, [message])

  return (
    <div className="app">
      <header className="toolbar">
        <div className="brand">
          <span className="logo" />
          PipeCAD
        </div>
        <button onClick={() => confirmDiscard() && st.newProject()}>New</button>
        <button onClick={() => void open()}>Open</button>
        <button onClick={() => void save()}>Save</button>
        <button onClick={() => void save(true)} title="Save as… (Ctrl+Shift+S)">…</button>
        <span className="sep" />
        <button disabled={!canUndo} onClick={st.undo} title="Ctrl+Z">
          ↶
        </button>
        <button disabled={!canRedo} onClick={st.redo} title="Ctrl+Y">
          ↷
        </button>
        <span className="sep" />
        <button onClick={() => st.setView(null)} title="Fit all (Home)">Fit</button>
        <button onClick={() => st.setView([1, 0.8, 1.2])}>3D</button>
        <button onClick={() => st.setView([0, 1, 0])}>Top</button>
        <button onClick={() => st.setView([0, 0, 1])}>Front</button>
        <button onClick={() => st.setView([1, 0, 0])}>Side</button>
        <span className="sep" />
        <button className={showDims ? 'on' : 'off'} onClick={st.toggleDims} title={showDims ? 'Hide pipe lengths (L)' : 'Show pipe lengths (L)'}>
          📏 Lengths
        </button>
        <button className={showPorts ? 'on' : ''} onClick={st.togglePorts} title="Show open ends">
          Ends
        </button>
        <button className={showAxes ? 'on' : ''} onClick={st.toggleAxes} title="Open-end centerlines and intersections (A)">
          Axes
        </button>
        <span className="sep" />
        <button className={replaying ? 'on' : ''} onClick={() => (replaying ? st.stopReplay() : st.startReplay())} title="Replay: watch the build step by step">
          ▶ Replay
        </button>
        <RecButton />
        <span className="sep" />
        <span className="muted small">Site:</span>
        <EnvModeSwitch />
      </header>
      <div className={replaying ? "main replaying" : "main"}>
        <div className="left">
          <div className="tabs">
            <button className={left === 'pipes' ? 'on' : ''} onClick={() => setLeft('pipes')}>
              Pipe
            </button>
            <button className={left === 'env' ? 'on' : ''} onClick={() => setLeft('env')}>
              Site
            </button>
          </div>
          {left === 'pipes' ? <Palette model={model} /> : <EnvPalette />}
        </div>
        <div className="viewport">
          <Scene model={model} />
          <ReplayBar />
          <QuickMenu />
          <LengthEditor />
          <ModeBanner />
          {parts.length === 0 && env.length === 0 && (
            <div className="welcome">
              <h2>Start with the first part</h2>
              <p>Pick a pipe size on the left to open its fittings catalog. Start with "Pipe" (key P).</p>
            </div>
          )}
        </div>
        <aside className="side">
          <div className="tabs">
            <button className={tab === 'props' ? 'on' : ''} onClick={() => setTab('props')}>
              Properties
            </button>
            <button className={tab === 'bom' ? 'on' : ''} onClick={() => setTab('bom')}>
              Materials
            </button>
          </div>
          <div className="side-body">{tab === 'props' ? <Inspector model={model} /> : <BomPanel bom={bom} pens={pens} />}</div>
        </aside>
      </div>
      <footer className="status">
        <span>Parts: {parts.length}</span>
        <span className={openEnds ? 'warn' : ''}>Open ends: {openEnds}</span>
        <span>Solvent welds: {bom.joints}</span>
        {bom.solder > 0 && <span>Solder joints: {bom.solder}</span>}
        {bom.mech > 0 && <span>No-hub: {bom.mech}</span>}
        {pens.length > 0 && <span className={badPens ? 'err' : ''}>Penetrations: {pens.length}{badPens ? ` (too large: ${badPens})` : ''}</span>}
        {model.bad.length > 0 && <span className="err">Bad joints: {model.bad.length}</span>}
      </footer>
    </div>
  )
}

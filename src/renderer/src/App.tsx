import { useCallback, useEffect, useMemo, useState } from 'react'
import logo from './assets/logo.png'
import { KIND_KEYS } from './catalog'
import { computeBom } from './bom'
import { buildModel } from './geometry'
import { Inspector, Palette } from './Panels'
import { BomPanel } from './BomPanel'
import { Scene } from './Scene'
import { EnvPalette } from './EnvPanel'
import { usePenetrations } from './EnvScene'
import { RecButton, ReplayBar, toggleRecording } from './Replay'
import { QuickMenu } from './QuickMenu'
import { LengthEditor } from './LengthEditor'
import { PartToolbar } from './PartToolbar'
import { Welcome } from './Welcome'
import { CommandPalette } from './CommandPalette'
import { Coach } from './Coach'
import { ModeBanner } from './ModeBanner'
import { Shortcuts } from './Shortcuts'
import { ViewSettings } from './ViewSettings'
import { useViewPrefs } from './viewPrefs'
import { dwvSlopes } from './slope'
import { ProjectFile, serialize, useStore } from './store'
import { newProject, open, openPath, save } from './projectActions'
import { useRecentFiles } from './recentFiles'
import { Menu, MenuItem } from './Menu'
import { useUi } from './ui'
import { Box, Clapperboard, Eye, FileText, CircleHelp, Maximize, Redo2, Search, Settings, Undo2 } from 'lucide-react'
import { MOD, isMac } from './platform'

const DRAFT_KEY = 'pipecad.draft'

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
  const placing = useStore((s) => !!s.placing)
  const canUndo = useStore((s) => s.past.length > 0)
  const canRedo = useStore((s) => s.future.length > 0)
  const envMode = useStore((s) => s.envMode)
  const recording = useStore((s) => !!s.recording)
  const recentFiles = useRecentFiles((s) => s.files)
  const st = useStore.getState()
  const tab = useUi((s) => s.sideTab)
  const setTab = useUi((s) => s.setSideTab)
  const [left, setLeft] = useState<'pipes' | 'env'>('pipes')
  const [help, setHelp] = useState(false)
  const [settings, setSettings] = useState(false)
  const openSettings = useCallback(() => setSettings(true), [])
  const openHelp = useCallback(() => setHelp(true), [])
  const theme = useViewPrefs((s) => s.theme)
  const zoom = useViewPrefs((s) => s.zoom)
  const onsite = useViewPrefs((s) => s.onsite)
  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])
  useEffect(() => {
    document.documentElement.dataset.onsite = onsite ? '1' : '0'
  }, [onsite])
  useEffect(() => {
    window.api?.setZoom?.(zoom)
  }, [zoom])
  const env = useStore((s) => s.env)
  const selectedEnv = useStore((s) => s.selectedEnv)

  const model = useMemo(() => buildModel(parts), [parts])
  const bom = useMemo(() => computeBom(parts, model, stick), [parts, model, stick])
  const openEnds = model.open.length
  const flat = useMemo(() => dwvSlopes(parts, model).filter((s) => !s.ok).length, [parts, model])
  ;(window as unknown as { pipecadModel: typeof model }).pipecadModel = model // для автотестов
  const pens = usePenetrations(model)
  const badPens = pens.filter((p) => !p.ok).length
  // выделили деталь или объект — справа сразу её свойства
  const selectedId = useStore((s) => s.selectedId)
  useEffect(() => {
    if (selectedEnv || selectedId) setTab('props')
  }, [selectedEnv, selectedId])

  const fileItems: MenuItem[] = [
    { label: 'New project', onClick: newProject },
    { label: 'Open…', keys: `${MOD}O`, onClick: () => void open() },
    { label: 'Save', keys: `${MOD}S`, onClick: () => void save() },
    { label: 'Save as…', keys: isMac ? '⌘⇧S' : 'Ctrl+Shift+S', onClick: () => void save(true) },
    ...(recentFiles.length ? [{ sep: true as const, label: 'Recent' }, ...recentFiles.slice(0, 6).map((f) => ({ label: f.name, onClick: () => void openPath(f.path) }))] : []),
    { sep: true },
    { label: 'Materials, prices & PDF sheet', onClick: () => setTab('bom') }
  ]

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
      // ⌘K / Ctrl+K — откуда угодно, даже из поля ввода
      if ((e.ctrlKey || e.metaKey) && e.code === 'KeyK') return (e.preventDefault(), useUi.getState().setPalette(true))
      const t = e.target as HTMLElement
      if (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA') return
      const s = useStore.getState()
      const k = e.key.toLowerCase()
      // Ctrl на Windows, ⌘ на Mac
      const mod = e.ctrlKey || e.metaKey
      if (s.replay) {
        e.preventDefault()
        if (k === 'escape') s.stopReplay()
        else if (e.code === 'Space') s.setReplay({ playing: !s.replay.playing })
        else if (k === 'arrowright') s.setReplayIndex(s.replay.i + 1)
        else if (k === 'arrowleft') s.setReplayIndex(s.replay.i - 1)
        return
      }
      if (e.key === '?') return (e.preventDefault(), setHelp((h) => !h))
      if (k === 'escape') setHelp(false)
      if (mod && (e.code === 'Equal' || e.code === 'NumpadAdd')) return (e.preventDefault(), useViewPrefs.getState().stepZoom(1))
      if (mod && (e.code === 'Minus' || e.code === 'NumpadSubtract')) return (e.preventDefault(), useViewPrefs.getState().stepZoom(-1))
      if (mod && (e.code === 'Digit0' || e.code === 'Numpad0')) return (e.preventDefault(), useViewPrefs.getState().stepZoom(0))
      if (mod && (e.code === 'KeyZ') && !e.shiftKey) return (e.preventDefault(), s.undo())
      if (mod && (e.code === 'KeyY' || (e.code === 'KeyZ' && e.shiftKey))) return (e.preventDefault(), s.redo())
      if (mod && e.code === 'KeyS') return (e.preventDefault(), void save(e.shiftKey))
      if (mod && e.code === 'KeyO') return (e.preventDefault(), void open())
      if (mod) return
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
          <img className="logo-img" src={logo} alt="" />
          PipeCAD
        </div>
        <Menu label="File" icon={<FileText size={16} />} items={fileItems} />
        <span className="sep" />
        <button className="tb" disabled={!canUndo} onClick={st.undo} title={`Undo (${MOD}Z)`}>
          <Undo2 size={16} />
          <span>Undo</span>
        </button>
        <button className="tb" disabled={!canRedo} onClick={st.redo} title={`Redo (${isMac ? '⌘⇧Z' : 'Ctrl+Y'})`}>
          <Redo2 size={16} />
          <span>Redo</span>
        </button>
        <span className="sep" />
        <button className="tb" onClick={() => st.setView(null)} title="Fit everything in view (Home)">
          <Maximize size={16} />
          <span>Fit</span>
        </button>
        <Menu
          label="View"
          icon={<Box size={16} />}
          items={[
            { label: '3D view', onClick: () => st.setView([1, 0.8, 1.2]) },
            { label: 'Top', onClick: () => st.setView([0, 1, 0]) },
            { label: 'Front', onClick: () => st.setView([0, 0, 1]) },
            { label: 'Side', onClick: () => st.setView([1, 0, 0]) }
          ]}
        />
        <Menu
          label="Show"
          icon={<Eye size={16} />}
          items={[
            { label: 'Pipe lengths', keys: 'L', checked: showDims, onClick: st.toggleDims },
            { label: 'Open ends', checked: showPorts, onClick: st.togglePorts },
            { label: 'Centerlines & intersections', keys: 'A', checked: showAxes, onClick: st.toggleAxes },
            { sep: true, label: 'Walls, floors, ground' },
            { label: 'Solid', checked: envMode === 'solid', onClick: () => st.setEnvMode('solid') },
            { label: 'X-ray (see pipes inside)', checked: envMode === 'ghost', onClick: () => st.setEnvMode('ghost') },
            { label: 'Hidden', checked: envMode === 'hidden', onClick: () => st.setEnvMode('hidden') }
          ]}
        />
        <span className="sep" />
        <Menu
          label="Video"
          icon={<Clapperboard size={16} />}
          active={replaying}
          items={[
            { label: replaying ? 'Stop replay' : 'Replay the build step by step', onClick: () => (replaying ? st.stopReplay() : st.startReplay()) },
            { label: recording ? 'Stop recording and save' : 'Record window to MP4', onClick: () => void toggleRecording() }
          ]}
        />
        {recording && <RecButton />}
        <span className="grow" />
        <button className="tb find" onClick={() => useUi.getState().setPalette(true)} title="Find a part or command">
          <Search size={16} />
          <span>Find part or command</span>
          <kbd>{MOD}K</kbd>
        </button>
        <button className="tb icon-only" onClick={() => setSettings(true)} title="View settings: theme, size, quality">
          <Settings size={17} />
        </button>
        <button className="tb" onClick={() => setHelp(true)} title="Keyboard & mouse (?)">
          <CircleHelp size={16} />
          <span>Help</span>
        </button>
      </header>
      {help && <Shortcuts onClose={() => setHelp(false)} />}
      {settings && <ViewSettings onClose={() => setSettings(false)} />}
      <CommandPalette onSettings={openSettings} onHelp={openHelp} />
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
          <PartToolbar />
          <Coach />
          <ModeBanner />
          {parts.length === 0 && env.length === 0 && !placing && <Welcome />}
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
          <div className="side-body">{tab === 'props' ? <Inspector model={model} /> : <BomPanel bom={bom} pens={pens} model={model} />}</div>
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
        {flat > 0 && <span className="warn" title="Horizontal drain pipes flatter than the minimum slope (IPC 704.1)">Flat drains: {flat}</span>}
      </footer>
    </div>
  )
}

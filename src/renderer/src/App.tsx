import { useEffect, useMemo, useState } from 'react'
import { KIND_KEYS } from './catalog'
import { computeBom } from './bom'
import { buildModel } from './geometry'
import { BomPanel, Inspector, Palette } from './Panels'
import { Scene } from './Scene'
import { ProjectFile, serialize, useStore } from './store'

const DRAFT_KEY = 'pipecad.draft'

async function save(saveAs = false): Promise<void> {
  const { filePath, markSaved, setMessage } = useStore.getState()
  const path = await window.api.saveProject({ path: filePath, content: serialize(), saveAs })
  if (path) {
    markSaved(path)
    setMessage(`Сохранено: ${path}`)
  }
}

function confirmDiscard(): boolean {
  return !useStore.getState().dirty || confirm('Есть несохранённые изменения. Продолжить без сохранения?')
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
    useStore.getState().setMessage('Не удалось прочитать файл проекта')
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
  const canUndo = useStore((s) => s.past.length > 0)
  const canRedo = useStore((s) => s.future.length > 0)
  const st = useStore.getState()
  const [tab, setTab] = useState<'props' | 'bom'>('props')

  const model = useMemo(() => buildModel(parts), [parts])
  const bom = useMemo(() => computeBom(parts, model, stick), [parts, model, stick])
  const openEnds = model.open.length

  // Черновик на случай закрытия без сохранения
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY)
      if (raw) {
        const d = JSON.parse(raw) as { file: ProjectFile; path: string | null }
        if (d.file?.parts?.length) {
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
  }, [parts, stick, filePath])

  useEffect(() => {
    const name = filePath ? filePath.split(/[\\/]/).pop() : 'Новый проект'
    document.title = `${name}${dirty ? ' •' : ''} — PipeCAD`
  }, [filePath, dirty])

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const t = e.target as HTMLElement
      if (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA') return
      const s = useStore.getState()
      const k = e.key.toLowerCase()
      if (e.ctrlKey && (e.code === 'KeyZ') && !e.shiftKey) return (e.preventDefault(), s.undo())
      if (e.ctrlKey && (e.code === 'KeyY' || (e.code === 'KeyZ' && e.shiftKey))) return (e.preventDefault(), s.redo())
      if (e.ctrlKey && e.code === 'KeyS') return (e.preventDefault(), void save(e.shiftKey))
      if (e.ctrlKey && e.code === 'KeyO') return (e.preventDefault(), void open())
      if (e.ctrlKey) return
      if ((k === 'delete' || k === 'backspace') && s.selectedId) return s.deletePart(s.selectedId)
      if (k === 'escape') return s.select(null)
      if (e.code === 'KeyR' && s.selectedId) return s.rollPart(s.selectedId, e.shiftKey ? -90 : 90)
      if (k === 'home') return s.setView(null)
      const hit = KIND_KEYS.find((x) => e.code === `Key${x.key}`)
      if (hit) s.addPart(hit.kind)
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
        <button onClick={() => confirmDiscard() && st.newProject()}>Новый</button>
        <button onClick={() => void open()}>Открыть</button>
        <button onClick={() => void save()}>Сохранить</button>
        <button onClick={() => void save(true)}>Сохранить как…</button>
        <span className="sep" />
        <button disabled={!canUndo} onClick={st.undo} title="Ctrl+Z">
          ↶ Отменить
        </button>
        <button disabled={!canRedo} onClick={st.redo} title="Ctrl+Y">
          ↷ Вернуть
        </button>
        <span className="sep" />
        <button onClick={() => st.setView(null)} title="Home">Показать всё</button>
        <button onClick={() => st.setView([1, 0.8, 1.2])}>3D</button>
        <button onClick={() => st.setView([0, 1, 0])}>Сверху</button>
        <button onClick={() => st.setView([0, 0, 1])}>Спереди</button>
        <button onClick={() => st.setView([1, 0, 0])}>Сбоку</button>
        <span className="sep" />
        <button className={showDims ? 'on' : ''} onClick={st.toggleDims}>
          Размеры
        </button>
        <button className={showPorts ? 'on' : ''} onClick={st.togglePorts} title="Показывать свободные концы">
          Концы
        </button>
      </header>
      <div className="main">
        <Palette model={model} />
        <div className="viewport">
          <Scene model={model} />
          {parts.length === 0 && (
            <div className="welcome">
              <h2>Начни с первой детали</h2>
              <p>Слева выбери размер трубы — откроется каталог фитингов этого размера. Начни с «Трубы» (клавиша P).</p>
            </div>
          )}
        </div>
        <aside className="side">
          <div className="tabs">
            <button className={tab === 'props' ? 'on' : ''} onClick={() => setTab('props')}>
              Свойства
            </button>
            <button className={tab === 'bom' ? 'on' : ''} onClick={() => setTab('bom')}>
              Материалы
            </button>
          </div>
          <div className="side-body">{tab === 'props' ? <Inspector model={model} /> : <BomPanel bom={bom} />}</div>
        </aside>
      </div>
      <footer className="status">
        <span>Деталей: {parts.length}</span>
        <span className={openEnds ? 'warn' : ''}>Открытых концов: {openEnds}</span>
        <span>Склеек: {bom.joints}</span>
        {model.bad.length > 0 && <span className="err">Неправильных соединений: {model.bad.length}</span>}
        {message && <span className="msg">{message}</span>}
      </footer>
    </div>
  )
}

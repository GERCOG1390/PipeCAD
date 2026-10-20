// Действия с файлом проекта: новый, открыть, открыть недавний, сохранить. Общие для меню, стартового экрана и ⌘K.
import { useRecentFiles } from './recentFiles'
import { ProjectFile, serialize, useStore } from './store'

export async function save(saveAs = false): Promise<void> {
  const { filePath, markSaved, setMessage } = useStore.getState()
  const path = await window.api.saveProject({ path: filePath, content: serialize(), saveAs })
  if (path) {
    markSaved(path)
    useRecentFiles.getState().add(path)
    setMessage(`Saved: ${path}`)
  }
}

export function confirmDiscard(): boolean {
  return !useStore.getState().dirty || confirm('You have unsaved changes. Continue without saving?')
}

function load(r: { path: string; content: string }): boolean {
  try {
    const f = JSON.parse(r.content) as ProjectFile
    if (f.app !== 'pipecad' || !Array.isArray(f.parts)) throw new Error()
    useStore.getState().loadProject(f, r.path)
    useRecentFiles.getState().add(r.path)
    return true
  } catch {
    useStore.getState().setMessage("Couldn't read the project file")
    return false
  }
}

export async function open(): Promise<void> {
  if (!confirmDiscard()) return
  const r = await window.api.openProject()
  if (r) load(r)
}

export async function openPath(path: string): Promise<void> {
  if (!confirmDiscard()) return
  const r = await window.api.openProjectPath(path)
  if (r) load(r)
  else {
    useRecentFiles.getState().remove(path)
    useStore.getState().setMessage(`File not found — removed from recent: ${path}`)
  }
}

export function newProject(): void {
  if (confirmDiscard()) useStore.getState().newProject()
}

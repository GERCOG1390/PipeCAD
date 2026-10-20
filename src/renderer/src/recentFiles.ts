// Недавние проекты: пути к файлам .pipe, последние сверху (хранятся на этом компьютере)
import { create } from 'zustand'

export interface RecentFile {
  path: string
  name: string
  at: number
}

const KEY = 'pipecad.recentFiles'
const MAX = 8

const read = (): RecentFile[] => {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    return Array.isArray(v) ? v.filter((x) => typeof x?.path === 'string') : []
  } catch {
    return []
  }
}

export const nameOf = (path: string): string => (path.split(/[\\/]/).pop() ?? path).replace(/\.pipe$/i, '')

export const useRecentFiles = create<{ files: RecentFile[]; add: (path: string) => void; remove: (path: string) => void }>((set, get) => ({
  files: read(),
  add: (path) => {
    const files = [{ path, name: nameOf(path), at: Date.now() }, ...get().files.filter((f) => f.path !== path)].slice(0, MAX)
    set({ files })
    try {
      localStorage.setItem(KEY, JSON.stringify(files))
    } catch {
      /* ignore */
    }
  },
  remove: (path) => {
    const files = get().files.filter((f) => f.path !== path)
    set({ files })
    try {
      localStorage.setItem(KEY, JSON.stringify(files))
    } catch {
      /* ignore */
    }
  }
}))

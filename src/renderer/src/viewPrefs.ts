// Настройки вида программы: тема и размер интерфейса (запоминаются на этом компьютере)
import { create } from 'zustand'
import { isMac } from './platform'

export type Theme = 'dark' | 'light'
export type Quality = 'fast' | 'balanced' | 'high' | 'ultra'
export type Graphics = 'webgl' | 'webgpu'
export const ZOOMS = [0.9, 1, 1.15, 1.3, 1.5]

const read = (key: string): string | null => {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}
const write = (key: string, v: string): void => {
  try {
    localStorage.setItem(key, v)
  } catch {
    /* ignore */
  }
}

interface ViewPrefs {
  theme: Theme
  zoom: number
  quality: Quality
  setQuality: (q: Quality) => void
  graphics: Graphics
  setGraphics: (g: Graphics) => void
  setTheme: (t: Theme) => void
  setZoom: (z: number) => void
  stepZoom: (dir: 1 | -1 | 0) => void
}

export const useViewPrefs = create<ViewPrefs>((set, get) => ({
  theme: read('pipecad.theme') === 'light' ? 'light' : 'dark',
  zoom: Number(read('pipecad.zoom')) || 1,
  quality: (['fast', 'balanced', 'high', 'ultra'] as Quality[]).find((q) => q === read('pipecad.quality')) ?? 'high',
  // на Mac WebGPU идёт прямо в Metal и в замере в 3–5 раз быстрее WebGL (тот идёт через слой перевода ANGLE)
  graphics: ((g) => (g === 'webgpu' || g === 'webgl' ? g : isMac ? 'webgpu' : 'webgl'))(read('pipecad.graphics')),
  setGraphics: (graphics) => {
    set({ graphics })
    write('pipecad.graphics', graphics)
  },
  setQuality: (quality) => {
    set({ quality })
    write('pipecad.quality', quality)
  },
  setTheme: (theme) => {
    set({ theme })
    write('pipecad.theme', theme)
  },
  setZoom: (zoom) => {
    const z = Math.min(2, Math.max(0.75, zoom))
    set({ zoom: z })
    write('pipecad.zoom', String(z))
  },
  // Ctrl+= / Ctrl+- / Ctrl+0
  stepZoom: (dir) => {
    if (dir === 0) return get().setZoom(1)
    const z = get().zoom
    const next = dir > 0 ? ZOOMS.find((v) => v > z + 0.001) : [...ZOOMS].reverse().find((v) => v < z - 0.001)
    if (next) get().setZoom(next)
  }
}))

// Цвета 3D-сцены под тему
export const SCENE_COLORS: Record<Theme, { bg: string; cell: string; section: string }> = {
  dark: { bg: '#1a1e23', cell: '#2b3238', section: '#2f6f6c' },
  light: { bg: '#e9edf1', cell: '#c9d1d8', section: '#7bb8b4' }
}

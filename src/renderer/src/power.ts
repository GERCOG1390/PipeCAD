// Экономия батареи: от батареи или при перегреве рисуем без суперсэмплинга (в родном разрешении экрана).
// Состояние питания присылает главный процесс (powerMonitor); выключатель — в ⚙ View settings.
import { create } from 'zustand'

export type Thermal = 'unknown' | 'nominal' | 'fair' | 'serious' | 'critical'

interface Power {
  onBattery: boolean
  thermal: Thermal
  saver: boolean // экономия включена пользователем
  saving: boolean // экономия действует прямо сейчас
  setSaver: (on: boolean) => void
}

const KEY = 'pipecad.batterySaver'
const readSaver = (): boolean => {
  try {
    return localStorage.getItem(KEY) !== 'off'
  } catch {
    return true
  }
}

const hot = (t: Thermal): boolean => t === 'serious' || t === 'critical'

export const usePower = create<Power>((set, get) => ({
  onBattery: false,
  thermal: 'unknown',
  saver: readSaver(),
  saving: false,
  setSaver: (saver) => {
    try {
      localStorage.setItem(KEY, saver ? 'on' : 'off')
    } catch {
      /* ignore */
    }
    const { onBattery, thermal } = get()
    set({ saver, saving: saver && (onBattery || hot(thermal)) })
  }
}))

if (typeof window !== 'undefined' && window.api?.onPower)
  window.api.onPower((p) => {
    const saver = usePower.getState().saver
    usePower.setState({ onBattery: p.onBattery, thermal: p.thermal, saving: saver && (p.onBattery || hot(p.thermal)) })
  })

// Прайс: цена за единицу по ключу строки спецификации; хранится на этом компьютере и общий для всех проектов
import { create } from 'zustand'

const KEY = 'pipecad.prices'
const MARKUP_KEY = 'pipecad.markup'

function read<T>(key: string, def: T): T {
  try {
    const v = localStorage.getItem(key)
    return v === null ? def : (JSON.parse(v) as T)
  } catch {
    return def
  }
}
function write(key: string, v: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(v))
  } catch {
    /* ignore */
  }
}

interface PriceState {
  prices: Record<string, number>
  markup: number // наценка на материалы, %
  setPrice: (key: string, v: number | null) => void
  setMarkup: (v: number) => void
}

export const usePrices = create<PriceState>((set, get) => ({
  prices: read<Record<string, number>>(KEY, {}),
  markup: read<number>(MARKUP_KEY, 0),
  setPrice: (key, v) => {
    const prices = { ...get().prices }
    if (v === null || !Number.isFinite(v) || v < 0) delete prices[key]
    else prices[key] = Math.round(v * 100) / 100
    set({ prices })
    write(KEY, prices)
  },
  setMarkup: (markup) => {
    const v = Number.isFinite(markup) && markup >= 0 ? markup : 0
    set({ markup: v })
    write(MARKUP_KEY, v)
  }
}))

export const pipeKey = (size: string): string => 'pipe|' + size
export const money = (v: number): string => '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

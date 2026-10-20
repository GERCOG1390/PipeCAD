// Состояние интерфейса, которое нужно нескольким панелям: вкладка справа, окна, командная строка
import { create } from 'zustand'

export type SideTab = 'props' | 'bom'

interface Ui {
  sideTab: SideTab
  setSideTab: (t: SideTab) => void
  // попросить «Свойства» показать и раскрыть замену детали
  replaceTick: number
  askReplace: () => void
  palette: boolean // командная строка ⌘K
  setPalette: (v: boolean) => void
}

export const useUi = create<Ui>((set) => ({
  sideTab: 'props',
  setSideTab: (sideTab) => set({ sideTab }),
  replaceTick: 0,
  askReplace: () => set((s) => ({ sideTab: 'props', replaceTick: s.replaceTick + 1 })),
  palette: false,
  setPalette: (palette) => set({ palette })
}))

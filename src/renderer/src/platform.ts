// Платформа: на Mac горячие клавиши через ⌘ вместо Ctrl, а Delete — это клавиша ⌫
export const isMac = typeof navigator !== 'undefined' && /Mac/i.test(navigator.platform || navigator.userAgent)

/** Нажат ли модификатор команд (⌘ на Mac, Ctrl на Windows) */
export const modKey = (e: { ctrlKey: boolean; metaKey: boolean }): boolean => (isMac ? e.metaKey : e.ctrlKey)

/** Подпись модификатора для подсказок: «⌘» или «Ctrl+» */
export const MOD = isMac ? '⌘' : 'Ctrl+'
export const DEL = isMac ? '⌫' : 'Del'

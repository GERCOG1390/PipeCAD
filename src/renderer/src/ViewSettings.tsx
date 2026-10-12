// Окно настроек вида: тема и размер интерфейса
import { ZOOMS, useViewPrefs } from './viewPrefs'

export function ViewSettings({ onClose }: { onClose: () => void }) {
  const { theme, zoom, setTheme, setZoom } = useViewPrefs()
  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal settings" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <b>View settings</b>
          <button onClick={onClose}>Close</button>
        </div>
        <label>Theme</label>
        <div className="seg">
          <button className={theme === 'dark' ? 'on' : ''} onClick={() => setTheme('dark')}>
            ☾ Dark
          </button>
          <button className={theme === 'light' ? 'on' : ''} onClick={() => setTheme('light')}>
            ☀ Light
          </button>
        </div>
        <label>Interface size</label>
        <div className="seg">
          {ZOOMS.map((z) => (
            <button key={z} className={Math.abs(zoom - z) < 0.001 ? 'on' : ''} onClick={() => setZoom(z)}>
              {Math.round(z * 100)}%
            </button>
          ))}
        </div>
        <div className="muted small">Ctrl + / Ctrl − / Ctrl 0 also change the size. Light theme is easier to read in bright rooms and on a laptop on site.</div>
      </div>
    </div>
  )
}

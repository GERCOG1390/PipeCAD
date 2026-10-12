// Окно настроек вида: тема и размер интерфейса
import { QUALITY } from './Effects'
import { Quality, ZOOMS, useViewPrefs } from './viewPrefs'

export function ViewSettings({ onClose }: { onClose: () => void }) {
  const { theme, zoom, quality, setTheme, setZoom, setQuality } = useViewPrefs()
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
        <label>Render quality</label>
        <div className="seg">
          {(Object.keys(QUALITY) as Quality[]).map((q) => (
            <button key={q} className={quality === q ? 'on' : ''} onClick={() => setQuality(q)} title={QUALITY[q].hint}>
              {QUALITY[q].label}
            </button>
          ))}
        </div>
        <div className="muted small">{QUALITY[quality].hint}</div>
        <div className="muted small">Ctrl + / Ctrl − / Ctrl 0 also change the size. Light theme is easier to read in bright rooms and on a laptop on site.</div>
      </div>
    </div>
  )
}

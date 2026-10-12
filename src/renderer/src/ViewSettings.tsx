// Окно настроек вида: тема и размер интерфейса
import { QUALITY } from './Effects'
import { Quality, ZOOMS, useViewPrefs } from './viewPrefs'
import { useBackend } from './gpu'
import { MOD, isMac } from './platform'

export function ViewSettings({ onClose }: { onClose: () => void }) {
  const { theme, zoom, quality, graphics, setTheme, setZoom, setQuality, setGraphics } = useViewPrefs()
  const backend = useBackend((s) => s.label)
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
        <label>Graphics API (experimental)</label>
        <div className="seg">
          <button className={graphics === 'webgl' ? 'on' : ''} onClick={() => setGraphics('webgl')} title={isMac ? 'Proven: WebGL through ANGLE on Metal' : 'Proven: WebGL through ANGLE on DirectX 11'}>
            {isMac ? 'WebGL · Metal' : 'WebGL · DirectX 11'}
          </button>
          <button className={graphics === 'webgpu' ? 'on' : ''} onClick={() => setGraphics('webgpu')} title={isMac ? 'Experimental: WebGPU on Metal' : 'Experimental: WebGPU on DirectX 12'}>
            {isMac ? 'WebGPU · Metal' : 'WebGPU · DirectX 12'}
          </button>
        </div>
        <div className="muted small">Now running: {backend || '…'}. Switching restarts the 3D view; the project stays as is.</div>
        <div className="muted small">{MOD}+ / {MOD}− / {MOD}0 also change the size. Light theme is easier to read in bright rooms and on a laptop on site.</div>
      </div>
    </div>
  )
}

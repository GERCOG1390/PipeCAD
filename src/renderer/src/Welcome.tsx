// Стартовый экран пустого проекта: недавние проекты, готовые сборки, с чего начать
import { ArrowLeft, Clock, FolderOpen } from 'lucide-react'
import { FITTINGS, SizeId } from './catalog'
import { KITS } from './kits'
import { open, openPath } from './projectActions'
import { useRecentFiles } from './recentFiles'
import { useStore } from './store'
import { useThumb } from './thumbs'

function KitThumb({ kind }: { kind: string }) {
  const d = FITTINGS[kind]
  const url = useThumb(kind, d.sizes[0] as SizeId)
  return <span className="w-thumb">{url && <img src={url} alt="" draggable={false} />}</span>
}

const ago = (t: number): string => {
  const m = Math.round((Date.now() - t) / 60000)
  if (m < 60) return m <= 1 ? 'just now' : `${m} min ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h} h ago`
  const d = Math.round(h / 24)
  return d === 1 ? 'yesterday' : `${d} days ago`
}

export function Welcome() {
  const files = useRecentFiles((s) => s.files)
  const startPlacing = useStore((s) => s.startPlacing)
  return (
    <div className="welcome">
      <div className="welcome-card">
        <h2>Start a layout</h2>
        <p className="muted">
          <ArrowLeft size={15} className="inline" /> Pick a material and pipe size on the left, then add parts — each one snaps to the open end. Or start from a ready assembly:
        </p>
        <div className="w-kits">
          {KITS.map((k) => (
            <button key={k.id} className="w-kit" onClick={() => startPlacing({ kind: k.base, kit: k.id })} title="Then click the floor to place it">
              <KitThumb kind={k.base} />
              <span>
                <b>{k.title}</b>
                <small>{k.sub}</small>
              </span>
            </button>
          ))}
        </div>
        <div className="w-recent-head">
          <span>
            <Clock size={15} className="inline" /> Recent projects
          </span>
          <button className="link" onClick={() => void open()}>
            <FolderOpen size={15} className="inline" /> Open…
          </button>
        </div>
        {files.length ? (
          <div className="w-recent">
            {files.map((f) => (
              <button key={f.path} className="w-file" onClick={() => void openPath(f.path)} title={f.path}>
                <b>{f.name}</b>
                <small>{ago(f.at)}</small>
              </button>
            ))}
          </div>
        ) : (
          <div className="muted small">Projects you save or open will show up here.</div>
        )}
      </div>
    </div>
  )
}

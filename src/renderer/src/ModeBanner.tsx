// Плашка текущего режима вверху вьюпорта и всплывающие сообщения
import { fittingDef } from './catalog'
import { KITS } from './kits'
import { useStore } from './store'

export function ModeBanner() {
  const placing = useStore((s) => s.placing)
  const joining = useStore((s) => s.joining)
  const message = useStore((s) => s.message)
  const replay = useStore((s) => !!s.replay)
  if (replay) return null
  let mode: { title: string; hint: string; cancel: () => void } | null = null
  if (placing) {
    const kit = placing.kit ? KITS.find((k) => k.id === placing.kit) : undefined
    mode = {
      title: `Placing: ${kit ? kit.title : fittingDef(placing.kind).ru}`,
      hint: 'Click the floor or a surface · R — rotate 90° · Esc — cancel',
      cancel: () => useStore.getState().cancelPlacing()
    }
  } else if (joining) {
    mode = {
      title: 'Joining two ends',
      hint: 'Click the second open end — fittings turn to meet · Esc — cancel',
      cancel: () => useStore.setState({ joining: false, message: null })
    }
  }
  // подсказка режима важнее сообщения о нём же
  const showMsg = message && !(mode && /^(Click the floor|Click the second)/.test(message))
  return (
    <div className="banner-stack">
      {mode && (
        <div className="mode-banner">
          <span className="dot" />
          <div>
            <b>{mode.title}</b>
            <span>{mode.hint}</span>
          </div>
          <button onClick={mode.cancel}>Cancel</button>
        </div>
      )}
      {showMsg && (
        <div className="toast" onClick={() => useStore.getState().setMessage(null)}>
          {message}
        </div>
      )}
    </div>
  )
}

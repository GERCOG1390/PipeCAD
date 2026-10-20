// Подсказки при первом запуске: по одной, по ходу работы (не тур). Пролистать — Next, скрыть совсем — Skip tips.
import { Lightbulb, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { DEL, MOD } from './platform'
import { useStore } from './store'

const KEY = 'pipecad.coach'
const DONE = 99
const read = (): number => {
  try {
    return Number(localStorage.getItem(KEY) ?? 0) || 0
  } catch {
    return 0
  }
}
const write = (n: number): void => {
  try {
    localStorage.setItem(KEY, String(n))
  } catch {
    /* ignore */
  }
}

const TIPS: { title: string; text: string }[] = [
  {
    title: 'Green rings are open ends',
    text: 'Click a ring to select it (it turns orange), then pick the next part on the left — it snaps on. Right-click a ring for a quick menu of common parts.'
  },
  {
    title: 'Set a pipe length',
    text: "Select a pipe and just type the length: 3'6, 42 or 3-1/2, then Enter. Or drag the cyan arrows at its end."
  },
  {
    title: 'Everything for a part is right above it',
    text: `Click any part: the bar above it rotates, replaces or deletes it (${DEL}). ${MOD}Z undoes anything, ${MOD}K finds any part by name or number.`
  }
]

export function Coach() {
  const parts = useStore((s) => s.parts.length)
  const placing = useStore((s) => !!s.placing)
  const replaying = useStore((s) => !!s.replay)
  const [step, setStep] = useState(read)
  // первый совет само собой «выполнено», когда собрано несколько деталей
  useEffect(() => {
    if (step === 0 && parts >= 4) next()
  }, [parts])
  const next = (): void => {
    const n = step + 1 >= TIPS.length ? DONE : step + 1
    setStep(n)
    write(n)
  }
  const skip = (): void => {
    setStep(DONE)
    write(DONE)
  }
  if (step >= TIPS.length || parts === 0 || placing || replaying) return null
  const tip = TIPS[step]
  return (
    <div className="coach" role="status">
      <Lightbulb size={18} className="coach-ic" />
      <div className="coach-body">
        <b>{tip.title}</b>
        <span>{tip.text}</span>
        <div className="coach-foot">
          <span className="muted small">
            Tip {step + 1} of {TIPS.length}
          </span>
          <button className="link" onClick={skip}>
            Skip tips
          </button>
          <button className="primary" onClick={next}>
            {step + 1 < TIPS.length ? 'Next' : 'Got it'}
          </button>
        </div>
      </div>
      <button className="coach-x" onClick={skip} title="Don't show tips">
        <X size={15} />
      </button>
    </div>
  )
}

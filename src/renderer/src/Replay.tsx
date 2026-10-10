import { useEffect, useState } from 'react'
import { isRecording, startRecording, stopRecording } from './recorder'
import { useStore } from './store'

const STEP_MS = 700 // один шаг при скорости 1×

async function finishRecording(): Promise<void> {
  const s = useStore.getState()
  s.setRecording(0)
  try {
    const path = await stopRecording()
    useStore.getState().setMessage(path ? `Видео сохранено: ${path}` : 'Запись остановлена, файл не сохранён')
  } catch (e) {
    useStore.getState().setMessage(`Не удалось сохранить видео: ${(e as Error).message}`)
  }
}

export async function toggleRecording(): Promise<void> {
  if (isRecording()) return finishRecording()
  try {
    await startRecording()
    useStore.getState().setRecording(Date.now())
  } catch (e) {
    useStore.getState().setMessage(`Не удалось начать запись: ${(e as Error).message}`)
  }
}

export function RecButton() {
  const recording = useStore((s) => s.recording)
  const [, tick] = useState(0)
  useEffect(() => {
    if (!recording) return
    const t = setInterval(() => tick((x) => x + 1), 500)
    return () => clearInterval(t)
  }, [recording])
  const sec = recording ? Math.floor((Date.now() - recording) / 1000) : 0
  return (
    <button className={recording ? 'rec on' : 'rec'} onClick={() => void toggleRecording()} title="Записать видео окна (MP4)">
      {recording ? `⏹ ${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}` : '⏺ Запись'}
    </button>
  )
}

export function ReplayBar() {
  const replay = useStore((s) => s.replay)
  const setReplayIndex = useStore((s) => s.setReplayIndex)
  const setReplay = useStore((s) => s.setReplay)
  const stopReplay = useStore((s) => s.stopReplay)

  // проигрывание
  useEffect(() => {
    if (!replay || !replay.playing) return
    const t = setTimeout(() => {
      const r = useStore.getState().replay
      if (!r) return
      if (r.i < r.frames.length - 1) setReplayIndex(r.i + 1)
      else {
        setReplay({ playing: false })
        if (r.record) {
          useStore.setState({ replay: { ...r, playing: false, record: false } })
          // небольшая пауза на финальном кадре
          setTimeout(() => void finishRecording(), 1500)
        }
      }
    }, STEP_MS / replay.speed)
    return () => clearTimeout(t)
  }, [replay?.i, replay?.playing, replay?.speed])

  if (!replay) return null
  const n = replay.frames.length
  const recordFromStart = async (): Promise<void> => {
    if (!isRecording()) {
      try {
        await startRecording()
        useStore.getState().setRecording(Date.now())
      } catch (e) {
        useStore.getState().setMessage(`Не удалось начать запись: ${(e as Error).message}`)
        return
      }
    }
    // кадр по готовому проекту, затем с начала
    setReplay({ playing: false })
    setReplayIndex(n - 1)
    useStore.getState().setView(null)
    const r = useStore.getState().replay
    if (r) useStore.setState({ replay: { ...r, record: true } })
    setTimeout(() => setReplayIndex(0), 400)
    // дать записи начаться
    setTimeout(() => setReplay({ playing: true }), 1200)
  }

  return (
    <div className="replay-bar">
      <button onClick={() => setReplayIndex(0)} title="В начало">
        ⏮
      </button>
      <button className="play" onClick={() => (replay.i >= n - 1 && !replay.playing ? (setReplayIndex(0), setReplay({ playing: true })) : setReplay({ playing: !replay.playing }))} title="Пробел">
        {replay.playing ? '⏸' : '▶'}
      </button>
      <input type="range" min={0} max={n - 1} value={replay.i} onChange={(e) => (setReplay({ playing: false }), setReplayIndex(Number(e.target.value)))} />
      <span className="replay-count">
        Шаг {replay.i} / {n - 1}
      </span>
      <div className="seg">
        {[0.5, 1, 2, 4].map((v) => (
          <button key={v} className={replay.speed === v ? 'on' : ''} onClick={() => setReplay({ speed: v })}>
            {v}×
          </button>
        ))}
      </div>
      <label className="check">
        <input type="checkbox" checked={replay.auto} onChange={(e) => setReplay({ auto: e.target.checked })} /> Вращать камеру
      </label>
      <button className="rec" onClick={() => void recordFromStart()} disabled={replay.record} title="Начать повтор с начала и записать в видео">
        {replay.record ? '⏺ Пишу…' : '⏺ Записать повтор'}
      </button>
      <button onClick={stopReplay} title="Esc">
        ✕ Выйти
      </button>
    </div>
  )
}

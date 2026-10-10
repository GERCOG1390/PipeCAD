// Запись видео окна программы.
// На время записи окно ставится ровно 1280×720, захват идёт пиксель в пиксель с высоким битрейтом,
// а при сохранении встроенный ffmpeg перекодирует ролик в чёткий MP4 1280×720 (H.264).
let rec: MediaRecorder | null = null
let chunks: Blob[] = []
let source: MediaStream | null = null
let mime = ''

function pickMime(): string {
  const prefs = ['video/mp4;codecs=avc1.640028', 'video/mp4;codecs=avc1.4D401F', 'video/webm;codecs=vp9', 'video/mp4', 'video/webm']
  return prefs.find((m) => MediaRecorder.isTypeSupported(m)) ?? 'video/webm'
}

export const isRecording = (): boolean => !!rec && rec.state === 'recording'

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

export async function startRecording(): Promise<void> {
  if (isRecording()) return
  await window.api.recPrepare()
  await sleep(600) // окно успевает перестроиться под 1280×720
  try {
    source = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 30 }, audio: false })
  } catch (e) {
    await window.api.recRestore()
    throw e
  }
  const track = source.getVideoTracks()[0]
  track.contentHint = 'detail' // экранный контент: важнее чёткость текста и линий, чем плавность
  mime = pickMime()
  chunks = []
  rec = new MediaRecorder(source, { mimeType: mime, videoBitsPerSecond: 20_000_000 })
  rec.ondataavailable = (e) => {
    if (e.data.size) chunks.push(e.data)
  }
  rec.start(1000)
}

async function finish(): Promise<{ data: Uint8Array; ext: string } | null> {
  const r = rec
  if (!r) return null
  const done = new Promise<void>((res) => (r.onstop = () => res()))
  r.stop()
  await done
  source?.getTracks().forEach((t) => t.stop())
  source = null
  rec = null
  await window.api.recRestore()
  const blob = new Blob(chunks, { type: mime })
  chunks = []
  const ext = mime.startsWith('video/mp4') ? 'mp4' : 'webm'
  return { data: new Uint8Array(await blob.arrayBuffer()), ext }
}

// Останавливает запись и предлагает сохранить файл; возвращает путь или null
export async function stopRecording(): Promise<string | null> {
  const f = await finish()
  return f ? window.api.saveVideo(f) : null
}

// Для автотеста: записать N мс и перекодировать в указанный файл без диалога
export async function probeRecording(ms: number, out: string): Promise<{ mime: string; bytes: number; ok: boolean }> {
  await startRecording()
  await sleep(ms)
  const f = await finish()
  if (!f) return { mime, bytes: 0, ok: false }
  const ok = await window.api.transcodeTest({ ...f, out })
  return { mime, bytes: f.data.length, ok }
}
;(window as unknown as { pipecadProbeRecording: typeof probeRecording }).pipecadProbeRecording = probeRecording

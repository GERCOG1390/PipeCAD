// Запись видео окна программы (MediaRecorder). По возможности MP4 (H.264) — откроется на любом телефоне.
let rec: MediaRecorder | null = null
let chunks: Blob[] = []
let stream: MediaStream | null = null
let mime = ''

function pickMime(): string {
  const prefs = ['video/mp4;codecs=avc1.640028', 'video/mp4;codecs=avc1.42E01E', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm']
  return prefs.find((m) => MediaRecorder.isTypeSupported(m)) ?? 'video/webm'
}

export const isRecording = (): boolean => !!rec && rec.state === 'recording'

export async function startRecording(): Promise<void> {
  if (isRecording()) return
  stream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 30 }, audio: false })
  mime = pickMime()
  chunks = []
  rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 8_000_000 })
  rec.ondataavailable = (e) => {
    if (e.data.size) chunks.push(e.data)
  }
  rec.start(1000)
}

// Останавливает запись и предлагает сохранить файл; возвращает путь или null
export async function stopRecording(): Promise<string | null> {
  const r = rec
  if (!r) return null
  const done = new Promise<void>((res) => (r.onstop = () => res()))
  r.stop()
  await done
  stream?.getTracks().forEach((t) => t.stop())
  stream = null
  rec = null
  const blob = new Blob(chunks, { type: mime })
  chunks = []
  const ext = mime.startsWith('video/mp4') ? 'mp4' : 'webm'
  const data = new Uint8Array(await blob.arrayBuffer())
  return window.api.saveVideo({ data, ext })
}

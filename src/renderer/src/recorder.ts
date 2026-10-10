// Запись видео окна программы в 720p (1280×720). Окно вписывается в кадр целиком, по краям — фон интерфейса.
// По возможности MP4 (H.264) — откроется на любом телефоне.
const OUT_W = 1280
const OUT_H = 720
const FPS = 30
const BG = '#15181c'

let rec: MediaRecorder | null = null
let chunks: Blob[] = []
let source: MediaStream | null = null
let output: MediaStream | null = null
let video: HTMLVideoElement | null = null
let timer: number | null = null
let mime = ''

function pickMime(): string {
  const prefs = ['video/mp4;codecs=avc1.640028', 'video/mp4;codecs=avc1.4D401F', 'video/mp4;codecs=avc1.42E01F', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm']
  return prefs.find((m) => MediaRecorder.isTypeSupported(m)) ?? 'video/webm'
}

export const isRecording = (): boolean => !!rec && rec.state === 'recording'

export async function startRecording(): Promise<void> {
  if (isRecording()) return
  source = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: FPS }, audio: false })
  video = document.createElement('video')
  video.muted = true
  video.srcObject = source
  await video.play()

  // перерисовываем окно в холст 1280×720 («вписать», без искажений)
  const cv = document.createElement('canvas')
  cv.width = OUT_W
  cv.height = OUT_H
  const ctx = cv.getContext('2d')!
  ctx.imageSmoothingQuality = 'high'
  const draw = (): void => {
    if (!video) return
    const vw = video.videoWidth
    const vh = video.videoHeight
    ctx.fillStyle = BG
    ctx.fillRect(0, 0, OUT_W, OUT_H)
    if (vw && vh) {
      const k = Math.min(OUT_W / vw, OUT_H / vh)
      const w = vw * k
      const h = vh * k
      ctx.drawImage(video, (OUT_W - w) / 2, (OUT_H - h) / 2, w, h)
    }
  }
  draw()
  timer = window.setInterval(draw, 1000 / FPS)

  output = cv.captureStream(FPS)
  mime = pickMime()
  chunks = []
  rec = new MediaRecorder(output, { mimeType: mime, videoBitsPerSecond: 5_000_000 })
  rec.ondataavailable = (e) => {
    if (e.data.size) chunks.push(e.data)
  }
  rec.start(1000)
}

function cleanup(): void {
  if (timer !== null) clearInterval(timer)
  timer = null
  source?.getTracks().forEach((t) => t.stop())
  output?.getTracks().forEach((t) => t.stop())
  if (video) video.srcObject = null
  source = null
  output = null
  video = null
  rec = null
}

// Останавливает запись и предлагает сохранить файл; возвращает путь или null
export async function stopRecording(): Promise<string | null> {
  const r = rec
  if (!r) return null
  const done = new Promise<void>((res) => (r.onstop = () => res()))
  r.stop()
  await done
  cleanup()
  const blob = new Blob(chunks, { type: mime })
  chunks = []
  const ext = mime.startsWith('video/mp4') ? 'mp4' : 'webm'
  const data = new Uint8Array(await blob.arrayBuffer())
  return window.api.saveVideo({ data, ext })
}

// Для автотеста: записать N мс и вернуть параметры ролика без сохранения
export async function probeRecording(ms: number): Promise<{ mime: string; bytes: number; width: number; height: number; head: string }> {
  await startRecording()
  await new Promise((r) => setTimeout(r, ms))
  const r = rec!
  const done = new Promise<void>((res) => (r.onstop = () => res()))
  r.stop()
  await done
  const blob = new Blob(chunks, { type: mime })
  chunks = []
  cleanup()
  // размер кадра читаем из самого ролика
  const v = document.createElement('video')
  v.muted = true
  v.src = URL.createObjectURL(blob)
  await new Promise<void>((res) => {
    v.onloadedmetadata = () => res()
    v.onerror = () => res()
  })
  const headBytes = new Uint8Array(await blob.slice(0, 4096).arrayBuffer())
  const out = { mime, bytes: blob.size, width: v.videoWidth, height: v.videoHeight, head: btoa(String.fromCharCode(...headBytes)) }
  URL.revokeObjectURL(v.src)
  return out
}
;(window as unknown as { pipecadProbeRecording: typeof probeRecording }).pipecadProbeRecording = probeRecording

import { app, BrowserWindow, desktopCapturer, dialog, ipcMain, screen, session, shell } from 'electron'
import { spawn } from 'child_process'
import { readFile, unlink, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'

const PROJECT_FILTERS = [{ name: 'PipeCAD project', extensions: ['pipe'] }]

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1000,
    minHeight: 640,
    backgroundColor: '#15181c',
    autoHideMenuBar: true,
    title: 'PipeCAD',
    webPreferences: { preload: join(__dirname, '../preload/index.js'), sandbox: false }
  })
  if (process.env.ELECTRON_RENDERER_URL) win.loadURL(process.env.ELECTRON_RENDERER_URL)
  else win.loadFile(join(__dirname, '../renderer/index.html'))
}

ipcMain.handle('project:open', async () => {
  const r = await dialog.showOpenDialog({ filters: PROJECT_FILTERS, properties: ['openFile'] })
  if (r.canceled || !r.filePaths[0]) return null
  const path = r.filePaths[0]
  return { path, content: await readFile(path, 'utf8') }
})

ipcMain.handle('project:save', async (_e, args: { path: string | null; content: string; saveAs?: boolean }) => {
  let path = args.path
  if (!path || args.saveAs) {
    const r = await dialog.showSaveDialog({ filters: PROJECT_FILTERS, defaultPath: path ?? 'project.pipe' })
    if (r.canceled || !r.filePath) return null
    path = r.filePath
  }
  await writeFile(path, args.content, 'utf8')
  return path
})

// ---------- Видео ----------
// На время записи окно ставим ровно 1280×720 (содержимое), чтобы захват шёл пиксель в пиксель
const REC_W = 1280
const REC_H = 720
let recSaved: { bounds: Electron.Rectangle; max: boolean } | null = null

ipcMain.handle('rec:prepare', (e) => {
  const win = BrowserWindow.fromWebContents(e.sender)
  if (!win) return 1
  if (!recSaved) recSaved = { bounds: win.getBounds(), max: win.isMaximized() }
  if (win.isMaximized()) win.unmaximize()
  win.setMinimumSize(800, 500)
  win.setContentSize(REC_W, REC_H)
  return screen.getDisplayMatching(win.getBounds()).scaleFactor
})

ipcMain.handle('rec:restore', (e) => {
  const win = BrowserWindow.fromWebContents(e.sender)
  if (!win || !recSaved) return
  win.setMinimumSize(1000, 640)
  win.setBounds(recSaved.bounds)
  if (recSaved.max) win.maximize()
  recSaved = null
})

// Перекодируем запись встроенным ffmpeg: H.264 высокого качества, 1280×720, 30 к/с, обычный (не фрагментированный) MP4
function transcode(input: string, output: string): Promise<boolean> {
  let bin: string | null = null
  try {
    bin = (require('ffmpeg-static') as string).replace('app.asar', 'app.asar.unpacked')
  } catch {
    bin = null
  }
  if (!bin) return Promise.resolve(false)
  const vf = `scale=${REC_W}:${REC_H}:flags=lanczos:force_original_aspect_ratio=decrease,pad=${REC_W}:${REC_H}:(ow-iw)/2:(oh-ih)/2:color=0x15181c,format=yuv420p`
  const args = ['-y', '-i', input, '-vf', vf, '-r', '30', '-c:v', 'libx264', '-preset', 'slow', '-crf', '15', '-tune', 'animation', '-profile:v', 'high', '-movflags', '+faststart', '-an', output]
  return new Promise((res) => {
    const p = spawn(bin!, args, { windowsHide: true })
    p.on('error', () => res(false))
    p.on('close', (code) => res(code === 0))
  })
}

ipcMain.handle('video:save', async (_e, args: { data: Uint8Array; ext: string }) => {
  const d = new Date()
  const pad = (n: number): string => String(n).padStart(2, '0')
  const name = `PipeCAD ${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}-${pad(d.getMinutes())}.mp4`
  const r = await dialog.showSaveDialog({ defaultPath: join(app.getPath('videos'), name), filters: [{ name: 'MP4 Video', extensions: ['mp4'] }] })
  if (r.canceled || !r.filePath) return null
  const raw = join(tmpdir(), `pipecad-rec-${Date.now()}.${args.ext}`)
  await writeFile(raw, Buffer.from(args.data))
  const ok = await transcode(raw, r.filePath)
  if (!ok) await writeFile(r.filePath, Buffer.from(args.data)) // без ffmpeg — сохраняем как записали
  await unlink(raw).catch(() => undefined)
  return r.filePath
})

// Для автотеста: перекодировать без диалога
ipcMain.handle('video:transcodeTest', async (_e, args: { data: Uint8Array; ext: string; out: string }) => {
  const raw = join(tmpdir(), `pipecad-rec-test.${args.ext}`)
  await writeFile(raw, Buffer.from(args.data))
  await writeFile(args.out.replace(/\.mp4$/, `.raw.${args.ext}`), Buffer.from(args.data))
  return transcode(raw, args.out)
})

ipcMain.handle('file:export', async (_e, args: { defaultName: string; content: string; ext: string; label: string }) => {
  const r = await dialog.showSaveDialog({ defaultPath: args.defaultName, filters: [{ name: args.label, extensions: [args.ext] }] })
  if (r.canceled || !r.filePath) return null
  await writeFile(r.filePath, args.content, 'utf8')
  return r.filePath
})

// PDF-лист: HTML из окна программы печатается скрытым окном Chromium (Letter), затем открывается
ipcMain.handle('pdf:export', async (_e, args: { html: string; defaultName: string; out?: string }) => {
  let path = args.out ?? null
  if (!path) {
    const r = await dialog.showSaveDialog({ defaultPath: join(app.getPath('documents'), args.defaultName), filters: [{ name: 'PDF', extensions: ['pdf'] }] })
    if (r.canceled || !r.filePath) return null
    path = r.filePath
  }
  const tmp = join(tmpdir(), `pipecad-sheet-${Date.now()}.html`)
  await writeFile(tmp, args.html, 'utf8')
  const win = new BrowserWindow({ show: false, webPreferences: { sandbox: true, javascript: false } })
  try {
    await win.loadFile(tmp)
    const pdf = await win.webContents.printToPDF({ pageSize: 'Letter', printBackground: true, margins: { top: 0.4, bottom: 0.4, left: 0.4, right: 0.4 } })
    await writeFile(path, pdf)
  } finally {
    win.destroy()
    await unlink(tmp).catch(() => undefined)
  }
  if (!args.out) void shell.openPath(path)
  return path
})

app.whenReady().then(() => {
  // getDisplayMedia в окне программы записывает само это окно, без диалога выбора
  session.defaultSession.setDisplayMediaRequestHandler(async (_req, callback) => {
    const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
    const sources = await desktopCapturer.getSources({ types: ['window'], thumbnailSize: { width: 0, height: 0 } })
    const src = sources.find((s) => win && s.id === win.getMediaSourceId()) ?? sources.find((s) => s.name.includes('PipeCAD'))
    if (src) callback({ video: src })
    else callback({})
  })
  createWindow()
  app.on('activate', () => BrowserWindow.getAllWindows().length === 0 && createWindow())
})
app.on('window-all-closed', () => process.platform !== 'darwin' && app.quit())

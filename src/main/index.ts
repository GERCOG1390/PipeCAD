import { app, BrowserWindow, desktopCapturer, dialog, ipcMain, session } from 'electron'
import { readFile, writeFile } from 'fs/promises'
import { join } from 'path'

const PROJECT_FILTERS = [{ name: 'Проект PipeCAD', extensions: ['pipe'] }]

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

// Видео окна: сохраняем записанный ролик
ipcMain.handle('video:save', async (_e, args: { data: Uint8Array; ext: string }) => {
  const d = new Date()
  const pad = (n: number): string => String(n).padStart(2, '0')
  const name = `PipeCAD ${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}-${pad(d.getMinutes())}.${args.ext}`
  const r = await dialog.showSaveDialog({ defaultPath: join(app.getPath('videos'), name), filters: [{ name: 'Видео', extensions: [args.ext] }] })
  if (r.canceled || !r.filePath) return null
  await writeFile(r.filePath, Buffer.from(args.data))
  return r.filePath
})

ipcMain.handle('file:export', async (_e, args: { defaultName: string; content: string; ext: string; label: string }) => {
  const r = await dialog.showSaveDialog({ defaultPath: args.defaultName, filters: [{ name: args.label, extensions: [args.ext] }] })
  if (r.canceled || !r.filePath) return null
  await writeFile(r.filePath, args.content, 'utf8')
  return r.filePath
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

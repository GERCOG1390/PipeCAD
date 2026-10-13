import { contextBridge, ipcRenderer, webFrame } from 'electron'

contextBridge.exposeInMainWorld('api', {
  openProject: () => ipcRenderer.invoke('project:open'),
  saveProject: (args: { path: string | null; content: string; saveAs?: boolean }) => ipcRenderer.invoke('project:save', args),
  exportFile: (args: { defaultName: string; content: string; ext: string; label: string }) => ipcRenderer.invoke('file:export', args),
  saveVideo: (args: { data: Uint8Array; ext: string }) => ipcRenderer.invoke('video:save', args),
  recPrepare: () => ipcRenderer.invoke('rec:prepare'),
  recRestore: () => ipcRenderer.invoke('rec:restore'),
  setZoom: (f: number) => webFrame.setZoomFactor(f),
  exportPdf: (args: { html: string; defaultName: string; out?: string }) => ipcRenderer.invoke('pdf:export', args),
  onPower: (cb: (p: { onBattery: boolean; thermal: string }) => void) => {
    ipcRenderer.on('power', (_e, p) => cb(p))
    void ipcRenderer.invoke('power:get').then(cb)
  },
  transcodeTest: (args: { data: Uint8Array; ext: string; out: string }) => ipcRenderer.invoke('video:transcodeTest', args)
})

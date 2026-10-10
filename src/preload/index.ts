import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('api', {
  openProject: () => ipcRenderer.invoke('project:open'),
  saveProject: (args: { path: string | null; content: string; saveAs?: boolean }) => ipcRenderer.invoke('project:save', args),
  exportFile: (args: { defaultName: string; content: string; ext: string; label: string }) => ipcRenderer.invoke('file:export', args)
})

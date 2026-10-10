interface Window {
  api: {
    openProject: () => Promise<{ path: string; content: string } | null>
    saveProject: (args: { path: string | null; content: string; saveAs?: boolean }) => Promise<string | null>
    exportFile: (args: { defaultName: string; content: string; ext: string; label: string }) => Promise<string | null>
    saveVideo: (args: { data: Uint8Array; ext: string }) => Promise<string | null>
    recPrepare: () => Promise<number>
    recRestore: () => Promise<void>
    transcodeTest: (args: { data: Uint8Array; ext: string; out: string }) => Promise<boolean>
  }
}
declare module '*.css'

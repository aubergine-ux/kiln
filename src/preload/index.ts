import { contextBridge, ipcRenderer, webUtils } from 'electron'

/**
 * The bridge between the UI and the main process. The UI turns these into a typed
 * `api` object (see src/renderer/src/lib/api.ts).
 */
const bridge = {
  invoke: (channel: string, args: unknown[]) => ipcRenderer.invoke('kiln:invoke', channel, args),
  on: (event: string, cb: (payload: unknown) => void) => {
    const listener = (_e: unknown, payload: unknown) => cb(payload)
    ipcRenderer.on(`kiln:${event}`, listener)
    return () => ipcRenderer.removeListener(`kiln:${event}`, listener)
  },
  pathForFile: (file: File) => webUtils.getPathForFile(file),
  setTitleBar: (colors: { color: string; symbolColor: string }) => ipcRenderer.send('kiln:title-bar', colors),
  platform: process.platform
}

contextBridge.exposeInMainWorld('kiln', bridge)

export type Bridge = typeof bridge

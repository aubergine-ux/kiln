import path from 'node:path'
import { app, BrowserWindow, ipcMain, nativeTheme, shell } from 'electron'
import type { IpcResult } from '@shared/types'
import { api, startVersionWatcher } from './api'
import { handleFileProtocol, registerScheme } from './files'
import { getSettings } from './settings'
import { toErrorInfo } from './util/errors'

// Tests and portable setups can keep Kiln's settings somewhere else.
if (process.env.KILN_USER_DATA) app.setPath('userData', process.env.KILN_USER_DATA)

registerScheme()

/** Route "group.name" calls from the UI to the api object. */
function registerIpc(): void {
  ipcMain.handle('kiln:invoke', async (_event, channel: string, args: unknown[]): Promise<IpcResult<unknown>> => {
    const [group, name] = channel.split('.')
    const fn = (api as unknown as Record<string, Record<string, (...a: unknown[]) => unknown>>)[group]?.[name]
    if (typeof fn !== 'function') return { ok: false, error: { message: `Unknown action: ${channel}` } }
    try {
      return { ok: true, value: await fn(...args) }
    } catch (err) {
      return { ok: false, error: toErrorInfo(err) }
    }
  })
  ipcMain.on('kiln:title-bar', (event, colors: { color: string; symbolColor: string }) => {
    const w = BrowserWindow.fromWebContents(event.sender)
    if (w && process.platform !== 'darwin') w.setTitleBarOverlay?.({ ...colors, height: 44 })
  })
}

async function createWindow(): Promise<void> {
  const settings = await getSettings()
  const dark = settings.theme === 'dark' || (settings.theme === 'system' && nativeTheme.shouldUseDarkColors)
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 940,
    minHeight: 620,
    show: false,
    title: 'Kiln',
    backgroundColor: dark ? '#17130f' : '#faf7f2',
    icon: path.join(app.getAppPath(), 'resources/icon.png'),
    titleBarStyle: 'hidden',
    ...(process.platform === 'darwin'
      ? { trafficLightPosition: { x: 18, y: 15 } }
      : { titleBarOverlay: { color: '#00000000', symbolColor: dark ? '#e9e1d6' : '#3b2f25', height: 44 } }),
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true
    }
  })

  win.once('ready-to-show', () => win.show())
  // Links open in the browser, never inside Kiln.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) shell.openExternal(url)
    return { action: 'deny' }
  })
  win.webContents.on('will-navigate', (e) => e.preventDefault())

  if (process.env.ELECTRON_RENDERER_URL) await win.loadURL(process.env.ELECTRON_RENDERER_URL)
  else await win.loadFile(path.join(__dirname, '../renderer/index.html'))
}

app.whenReady().then(async () => {
  app.setAppUserModelId('io.github.aubergineux.kiln')
  handleFileProtocol()
  registerIpc()
  startVersionWatcher((await getSettings()).minecraftDir)
  await createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

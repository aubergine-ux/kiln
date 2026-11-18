import os from 'node:os'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { app, BrowserWindow, dialog, shell } from 'electron'
import type { ContentKind, ExportOptions, InstanceIcon, LauncherCandidate, LauncherStatus, NewInstance, Settings } from '@shared/types'
import { getSettings, updateSettings } from './settings'
import { layout } from './paths'
import { KilnError } from './util/errors'
import { exists, safeJoin } from './util/fs'
import { notify } from './progress'
import { detectSetup, isLauncherRunning, launcherExists } from './launcher/detect'
import { profileFiles } from './launcher/profiles'
import { listInstalledVersions, watchVersions } from './launcher/versions'
import * as store from './instances/store'
import * as content from './instances/content'
import * as worlds from './instances/worlds'
import * as media from './instances/media'
import { classifyPath } from './instances/metadata'
import { importModpack, inspectModpack } from './modpacks/modpack'
import { exportInstance } from './modpacks/export'
import { importExternal, scanExternal, scanFolder } from './importers/external'

/**
 * Everything the UI can ask the main process to do.
 * Each function is reachable from the UI as `api.<group>.<name>(...)`.
 */

const win = () => BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]

export function startVersionWatcher(minecraftDir: string): void {
  watchVersions(minecraftDir, () => notify('versions-changed'))
}

/** Let every window know the instance list changed, then pass the result through. */
async function changed<T>(work: Promise<T>): Promise<T> {
  const result = await work
  notify('instances-changed')
  return result
}

async function openDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true })
  const err = await shell.openPath(dir)
  if (err) throw new KilnError('The folder could not be opened.', err)
}

export const api = {
  app: {
    info: async () => ({ version: app.getVersion(), platform: process.platform, totalMemMb: Math.round(os.totalmem() / 1048576) })
  },

  settings: {
    get: getSettings,
    update: async (patch: Partial<Settings>) => {
      const before = await getSettings()
      const next = await updateSettings(patch)
      if (patch.minecraftDir && patch.minecraftDir !== before.minecraftDir) startVersionWatcher(next.minecraftDir)
      return next
    }
  },

  setup: {
    detect: detectSetup,
    /** Validate a launcher the user picked by hand. */
    customLauncher: async (file: string): Promise<LauncherCandidate> => {
      if (!(await exists(file))) throw new KilnError('That file does not exist.')
      return { kind: file.endsWith('.app') ? 'app' : 'exe', path: file, label: path.basename(file) }
    }
  },

  launcher: {
    status: async (): Promise<LauncherStatus> => {
      const s = await getSettings()
      const minecraftDirFound = await exists(s.minecraftDir)
      return {
        launcher: s.launcher,
        launcherFound: await launcherExists(s.launcher),
        minecraftDirFound,
        profilesFile: minecraftDirFound ? (await profileFiles(s.minecraftDir, s.launcher))[0] : null,
        running: await isLauncherRunning()
      }
    },
    openBackups: async () => openDir(layout.profileBackups((await getSettings()).dataDir))
  },

  versions: {
    list: async () => listInstalledVersions((await getSettings()).minecraftDir)
  },

  instances: {
    list: store.listInstances,
    get: store.getInstance,
    create: (input: NewInstance) => changed(store.createInstance(input)),
    update: (id: string, patch: store.InstancePatch) => changed(store.updateInstance(id, patch)),
    setIcon: (id: string, icon: InstanceIcon, png: string) => store.setIcon(id, icon, png),
    duplicate: (id: string) => changed(store.duplicateInstance(id)),
    remove: (id: string) => changed(store.deleteInstance(id)),
    play: (id: string) => store.playInstance(id),
    openFolder: async (id: string, sub = '') => openDir(sub ? safeJoin(store.gameDir(await getSettings(), id), sub) : store.gameDir(await getSettings(), id)),
    setGroups: (groups: string[]) => store.setGroups(groups),
    renameGroup: (from: string, to: string) => store.renameGroup(from, to)
  },

  content: {
    list: (id: string, kind: ContentKind, world?: string) => content.listContent(id, kind, world),
    install: (id: string, kind: ContentKind, files: string[], world?: string) => content.installContent(id, kind, files, world),
    setEnabled: (id: string, kind: ContentKind, file: string, enabled: boolean, world?: string) => content.setEnabled(id, kind, file, enabled, world),
    remove: (id: string, kind: ContentKind, files: string[], world?: string) => content.removeContent(id, kind, files, world),
    /** Work out what dropped files are, so drops can go to the right place. */
    classify: async (files: string[]) => Promise.all(files.map(async (f) => ({ path: f, kind: await classifyPath(f) })))
  },

  worlds: {
    list: (id: string) => worlds.listWorlds(id),
    backup: (id: string, folder: string) => worlds.backupWorld(id, folder),
    backups: (id: string) => worlds.listBackups(id),
    restore: (id: string, zip: string, mode: 'replace' | 'copy') => worlds.restoreWorld(id, zip, mode),
    deleteBackup: (id: string, file: string) => worlds.deleteBackup(id, file),
    copy: (fromId: string, folder: string, toId: string) => worlds.copyWorld(fromId, folder, toId),
    import: (id: string, source: string) => worlds.importWorld(id, source),
    remove: (id: string, folder: string) => worlds.deleteWorld(id, folder),
    openBackups: async (id: string) => openDir(layout.worldBackups((await getSettings()).dataDir, id))
  },

  screenshots: {
    list: (id: string) => media.listScreenshots(id),
    copy: (id: string, file: string) => media.copyScreenshot(id, file),
    remove: (id: string, files: string[]) => media.deleteScreenshots(id, files),
    open: async (id: string, file: string) => {
      const err = await shell.openPath(await media.screenshotPath(id, file))
      if (err) throw new KilnError('The screenshot could not be opened.', err)
    },
    reveal: async (id: string, file: string) => shell.showItemInFolder(await media.screenshotPath(id, file))
  },

  logs: {
    list: (id: string) => media.listLogs(id),
    read: (id: string, file: string) => media.readLog(id, file)
  },

  modpacks: {
    inspect: (file: string) => inspectModpack(file),
    import: async (file: string, name?: string) => {
      const result = await importModpack(file, name)
      notify('instances-changed')
      return result
    },
    export: async (id: string, options: ExportOptions) => {
      const config = await store.readConfig(id)
      const { canceled, filePath } = await dialog.showSaveDialog(win(), {
        title: 'Export instance',
        defaultPath: path.join(app.getPath('downloads'), `${config.name.replace(/[\\/:*?"<>|]/g, '')}.mrpack`),
        filters: [
          { name: 'Modpack', extensions: ['mrpack'] },
          { name: 'Zip archive', extensions: ['zip'] }
        ]
      })
      if (canceled || !filePath) return null
      await exportInstance(id, filePath, options)
      shell.showItemInFolder(filePath)
      return filePath
    }
  },

  importers: {
    scan: scanExternal,
    scanFolder: (dir: string) => scanFolder(dir),
    import: async (dir: string) => {
      const inst = await importExternal(dir)
      notify('instances-changed')
      return inst
    }
  },

  dialog: {
    pickFolder: async (title: string, defaultPath?: string) => {
      const r = await dialog.showOpenDialog(win(), { title, defaultPath, properties: ['openDirectory', 'createDirectory'] })
      return r.canceled ? null : r.filePaths[0]
    },
    pickFiles: async (title: string, filters: { name: string; extensions: string[] }[], multiple = true) => {
      const r = await dialog.showOpenDialog(win(), { title, filters, properties: multiple ? ['openFile', 'multiSelections'] : ['openFile'] })
      return r.canceled ? [] : r.filePaths
    },
    pickLauncher: async () => {
      const r = await dialog.showOpenDialog(win(), {
        title: 'Find the official launcher',
        properties: process.platform === 'darwin' ? ['openFile', 'treatPackageAsDirectory'] : ['openFile']
      })
      return r.canceled ? null : r.filePaths[0]
    }
  },

  shell: {
    openExternal: async (url: string) => {
      if (!/^https:\/\//.test(url)) throw new KilnError('Only web links can be opened.')
      await shell.openExternal(url)
    },
    openPath: async (p: string) => {
      const err = await shell.openPath(p)
      if (err) throw new KilnError('That could not be opened.', err)
    },
    showItem: async (p: string) => shell.showItemInFolder(p),
    openDataDir: async () => openDir((await getSettings()).dataDir),
    openMinecraftDir: async () => openDir((await getSettings()).minecraftDir)
  }
}

export type Api = typeof api

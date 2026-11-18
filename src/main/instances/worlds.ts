import { promises as fs } from 'node:fs'
import path from 'node:path'
import type { World, WorldBackup } from '@shared/types'
import { getSettings } from '../settings'
import { layout } from '../paths'
import { KilnError } from '../util/errors'
import { exists, listDir, safeJoin, statOrNull, uniquePath } from '../util/fs'
import { readNbt } from '../util/nbt'
import { createZip, extractZip, listZip } from '../util/zip'
import { fileUrl, trash } from '../files'
import { progressReporter } from '../progress'
import { gameDir } from './store'

const GAME_MODES = ['Survival', 'Creative', 'Adventure', 'Spectator']

async function savesDir(id: string): Promise<string> {
  return path.join(gameDir(await getSettings(), id), 'saves')
}

async function worldDir(id: string, folder: string): Promise<string> {
  const dir = safeJoin(await savesDir(id), folder)
  if (!(await exists(path.join(dir, 'level.dat')))) throw new KilnError(`The world "${folder}" could not be found.`)
  return dir
}

async function readWorld(dir: string, folder: string): Promise<World | null> {
  const levelDat = path.join(dir, 'level.dat')
  if (!(await exists(levelDat))) return null
  const world: World = { folder, name: folder }
  try {
    const nbt = readNbt(await fs.readFile(levelDat))
    const data = (nbt.Data ?? {}) as Record<string, unknown>
    world.name = (data.LevelName as string) || folder
    world.lastPlayed = (data.LastPlayed as number) || undefined
    world.gameMode = GAME_MODES[data.GameType as number]
    world.hardcore = data.hardcore === 1
    world.version = ((data.Version as Record<string, unknown>)?.Name as string) || undefined
  } catch {
    // A damaged level.dat still lists the world by its folder name.
  }
  if (!world.lastPlayed) world.lastPlayed = (await statOrNull(levelDat))?.mtimeMs
  const icon = await statOrNull(path.join(dir, 'icon.png'))
  if (icon) world.iconUrl = fileUrl(path.join(dir, 'icon.png'), icon.mtimeMs)
  return world
}

export async function listWorlds(id: string): Promise<World[]> {
  const saves = await savesDir(id)
  const worlds: World[] = []
  for (const folder of await listDir(saves)) {
    const w = await readWorld(path.join(saves, folder), folder)
    if (w) worlds.push(w)
  }
  return worlds.sort((a, b) => (b.lastPlayed ?? 0) - (a.lastPlayed ?? 0))
}

export async function backupWorld(id: string, folder: string): Promise<WorldBackup> {
  const s = await getSettings()
  const dir = await worldDir(id, folder)
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
  const dest = path.join(layout.worldBackups(s.dataDir, id), `${folder}__${stamp}.zip`)
  const files: string[] = []
  const progress = progressReporter(`backup:${id}:${folder}`, `Backing up ${folder}`)
  await createZip(dest, [{ from: dir, to: folder }], (f) => {
    files.push(f)
    progress.tick()
  })
  progress.finish()
  const stat = await fs.stat(dest)
  return { file: path.basename(dest), path: dest, world: folder, created: stat.mtimeMs, size: stat.size }
}

export async function listBackups(id: string): Promise<WorldBackup[]> {
  const s = await getSettings()
  const dir = layout.worldBackups(s.dataDir, id)
  const result: WorldBackup[] = []
  for (const file of await listDir(dir)) {
    if (!file.endsWith('.zip')) continue
    const stat = await statOrNull(path.join(dir, file))
    if (stat) result.push({ file, path: path.join(dir, file), world: file.split('__')[0], created: stat.mtimeMs, size: stat.size })
  }
  return result.sort((a, b) => b.created - a.created)
}

/** Find the folder inside a zip that holds level.dat ("" if it is at the root). */
async function worldRootInZip(zipFile: string): Promise<string> {
  const level = (await listZip(zipFile)).find((n) => /^([^/]+\/)?level\.dat$/.test(n))
  if (level === undefined) throw new KilnError('This zip does not contain a world.', 'A world zip needs a level.dat file at the top or inside one folder.')
  return level.slice(0, -'level.dat'.length)
}

/**
 * Restore a backup (or any world zip) into an instance.
 * mode "replace" moves the existing world to the trash first; "copy" keeps both.
 */
export async function restoreWorld(id: string, zipFile: string, mode: 'replace' | 'copy' = 'copy'): Promise<string> {
  const saves = await savesDir(id)
  await fs.mkdir(saves, { recursive: true })
  const prefix = await worldRootInZip(zipFile)
  const name = prefix.replace(/\/$/, '') || path.basename(zipFile, '.zip').split('__')[0]
  let target = path.join(saves, name)
  if (await exists(target)) {
    if (mode === 'replace') await trash(target)
    else target = await uniquePath(saves, `${name} (restored)`)
  }
  const progress = progressReporter(`restore:${id}`, `Restoring ${name}`)
  await extractZip(zipFile, target, prefix, () => progress.tick())
  progress.finish()
  return path.basename(target)
}

export async function deleteBackup(id: string, file: string): Promise<void> {
  const s = await getSettings()
  await trash(safeJoin(layout.worldBackups(s.dataDir, id), file))
}

/** Copy a world folder into another instance (or the same one). */
export async function copyWorld(fromId: string, folder: string, toId: string): Promise<string> {
  const src = await worldDir(fromId, folder)
  const saves = await savesDir(toId)
  await fs.mkdir(saves, { recursive: true })
  const target = await uniquePath(saves, folder)
  await fs.cp(src, target, { recursive: true, filter: (p) => path.basename(p) !== 'session.lock' })
  return path.basename(target)
}

/** Add a world from a dropped folder or zip. */
export async function importWorld(id: string, source: string): Promise<string> {
  const stat = await fs.stat(source)
  if (!stat.isDirectory()) return restoreWorld(id, source, 'copy')
  if (!(await exists(path.join(source, 'level.dat')))) throw new KilnError('That folder is not a world.', 'World folders contain a level.dat file.')
  const saves = await savesDir(id)
  await fs.mkdir(saves, { recursive: true })
  const target = await uniquePath(saves, path.basename(source))
  await fs.cp(source, target, { recursive: true, filter: (p) => path.basename(p) !== 'session.lock' })
  return path.basename(target)
}

export async function deleteWorld(id: string, folder: string): Promise<void> {
  await trash(await worldDir(id, folder))
}

import { promises as fs } from 'node:fs'
import path from 'node:path'
import type { LauncherCandidate } from '@shared/types'
import { KilnError } from '../util/errors'
import { exists, nowIso, writeFileAtomic } from '../util/fs'
import { withLock } from '../util/lock'
import { layout } from '../paths'

/**
 * Everything Kiln does to the official launcher goes through this file.
 * We only ever touch launcher_profiles.json (or the Microsoft Store variant),
 * and we always copy it to Kiln's backup folder before writing.
 */

export interface LauncherProfile {
  name: string
  type: string
  created?: string
  lastUsed?: string
  lastVersionId: string
  gameDir?: string
  icon?: string
  javaArgs?: string
  [key: string]: unknown
}

interface ProfilesFile {
  profiles: Record<string, LauncherProfile>
  settings?: Record<string, unknown>
  version?: number
  [key: string]: unknown
}

const MAIN_FILE = 'launcher_profiles.json'
const STORE_FILE = 'launcher_profiles_microsoft_store.json'
const MAX_BACKUPS = 40

/** The profile files to keep in sync. The Store launcher uses its own file name. */
export async function profileFiles(minecraftDir: string, launcher: LauncherCandidate | null): Promise<string[]> {
  const main = path.join(minecraftDir, MAIN_FILE)
  const store = path.join(minecraftDir, STORE_FILE)
  const present: string[] = []
  for (const f of [main, store]) if (await exists(f)) present.push(f)
  if (present.length) return present
  return [launcher?.kind === 'store' ? store : main]
}

async function readProfiles(file: string): Promise<ProfilesFile> {
  let raw: string
  try {
    raw = await fs.readFile(file, 'utf8')
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return { profiles: {}, settings: {}, version: 3 }
    throw e
  }
  try {
    const data = JSON.parse(raw) as ProfilesFile
    if (!data.profiles || typeof data.profiles !== 'object') data.profiles = {}
    return data
  } catch {
    throw new KilnError(
      `The launcher's profiles file could not be read (${path.basename(file)}).`,
      'It looks damaged. Open the official launcher once so it can repair it, or restore a copy from Kiln\'s backup folder (Settings → Open backups).'
    )
  }
}

async function backup(file: string, dataDir: string): Promise<void> {
  if (!(await exists(file))) return
  const dir = layout.profileBackups(dataDir)
  await fs.mkdir(dir, { recursive: true })
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const base = path.basename(file, '.json')
  await fs.copyFile(file, path.join(dir, `${base}-${stamp}.json`))

  // Keep the folder from growing forever.
  const all = (await fs.readdir(dir)).filter((f) => f.startsWith(base + '-')).sort()
  for (const old of all.slice(0, Math.max(0, all.length - MAX_BACKUPS))) await fs.rm(path.join(dir, old), { force: true })
}

/** Back up, apply `change` to every profiles file, and write them back. */
async function edit(
  minecraftDir: string,
  dataDir: string,
  launcher: LauncherCandidate | null,
  change: (data: ProfilesFile) => void
): Promise<void> {
  return withLock(`profiles:${minecraftDir}`, () => editNow(minecraftDir, dataDir, launcher, change))
}

async function editNow(
  minecraftDir: string,
  dataDir: string,
  launcher: LauncherCandidate | null,
  change: (data: ProfilesFile) => void
): Promise<void> {
  if (!(await exists(minecraftDir))) {
    throw new KilnError(
      'The game folder could not be found.',
      `Kiln is looking for it at ${minecraftDir}. Open the official launcher once so it creates the folder, or pick the right folder in Settings.`
    )
  }
  for (const file of await profileFiles(minecraftDir, launcher)) {
    const data = await readProfiles(file)
    await backup(file, dataDir)
    change(data)
    await writeFileAtomic(file, JSON.stringify(data, null, 2))
  }
}

export interface ProfileInput {
  id: string
  name: string
  versionId: string
  gameDir: string
  icon?: string
  javaArgs: string
}

export async function upsertProfile(minecraftDir: string, dataDir: string, launcher: LauncherCandidate | null, p: ProfileInput, select = false) {
  await edit(minecraftDir, dataDir, launcher, (data) => {
    const prev = data.profiles[p.id]
    data.profiles[p.id] = {
      ...prev,
      name: p.name,
      type: 'custom',
      created: prev?.created ?? nowIso(),
      lastUsed: select ? nowIso() : (prev?.lastUsed ?? new Date(0).toISOString()),
      lastVersionId: p.versionId,
      gameDir: p.gameDir,
      icon: p.icon ?? prev?.icon ?? 'Furnace',
      javaArgs: p.javaArgs
    }
  })
}

export async function removeProfile(minecraftDir: string, dataDir: string, launcher: LauncherCandidate | null, id: string) {
  const files = await profileFiles(minecraftDir, launcher)
  let present = false
  for (const f of files) if ((await readProfiles(f)).profiles[id]) present = true
  if (!present) return
  await edit(minecraftDir, dataDir, launcher, (data) => {
    delete data.profiles[id]
  })
}

/** Replace (or add) the -Xmx flag in a JVM argument string. */
export function buildJavaArgs(memoryMb: number, extra?: string): string {
  const base = '-XX:+UnlockExperimentalVMOptions -XX:+UseG1GC -XX:G1NewSizePercent=20 -XX:G1ReservePercent=20 -XX:MaxGCPauseMillis=50 -XX:G1HeapRegionSize=32M'
  const memory = memoryMb % 1024 === 0 ? `${memoryMb / 1024}G` : `${memoryMb}M`
  const cleanedExtra = (extra ?? '').replace(/-Xmx\S+/g, '').trim()
  return [`-Xmx${memory}`, base, cleanedExtra].filter(Boolean).join(' ')
}

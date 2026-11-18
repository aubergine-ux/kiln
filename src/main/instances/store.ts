import { promises as fs } from 'node:fs'
import path from 'node:path'
import { randomBytes } from 'node:crypto'
import type { Instance, InstanceConfig, InstanceIcon, NewInstance, Settings } from '@shared/types'
import { getSettings, updateSettings } from '../settings'
import { layout } from '../paths'
import { KilnError } from '../util/errors'
import { exists, listDir, nowIso, readJson, slugify, statOrNull, uniquePath, writeJson } from '../util/fs'
import { withLock } from '../util/lock'
import { fileUrl, trash } from '../files'
import { buildJavaArgs, removeProfile, upsertProfile } from '../launcher/profiles'
import { isVersionReady, listInstalledVersions } from '../launcher/versions'
import { isLauncherRunning, launcherExists, launcherHelp } from '../launcher/detect'
import { openLauncher } from '../launcher/launch'

/**
 * Instance layout on disk:
 *
 *   <data>/instances/<id>/
 *     instance.json      name, version, loader, icon, group, memory...
 *     icon.png           the icon (also sent to the launcher)
 *     minecraft/         the game directory: mods, saves, resourcepacks, ...
 */

const CONFIG = 'instance.json'
const ICON = 'icon.png'
export const GAME_FOLDERS = ['mods', 'resourcepacks', 'shaderpacks', 'saves', 'screenshots', 'config']

const GLYPHS = ['pickaxe', 'sword', 'tree', 'gem', 'flame', 'castle', 'mountain', 'compass']
const COLORS = ['ember', 'moss', 'sky', 'violet', 'rose', 'sand', 'slate', 'teal']

export function randomIcon(): InstanceIcon {
  const pick = <T>(a: T[]) => a[Math.floor(Math.random() * a.length)]
  return { kind: 'glyph', glyph: pick(GLYPHS), color: pick(COLORS) }
}

export const instanceDir = (s: Settings, id: string) => layout.instance(s.dataDir, id)
export const gameDir = (s: Settings, id: string) => layout.gameDir(s.dataDir, id)

export async function readConfig(id: string): Promise<InstanceConfig> {
  const s = await getSettings()
  const config = await readJson<InstanceConfig>(path.join(instanceDir(s, id), CONFIG))
  if (!config) throw new KilnError('This instance could not be found.', 'It may have been moved or deleted outside Kiln.')
  return config
}

async function writeConfig(id: string, config: InstanceConfig): Promise<void> {
  const s = await getSettings()
  await writeJson(path.join(instanceDir(s, id), CONFIG), config)
}

async function countJars(dir: string): Promise<number> {
  return (await listDir(dir)).filter((f) => f.endsWith('.jar')).length
}

async function hydrate(s: Settings, id: string, config: InstanceConfig, installed: Awaited<ReturnType<typeof listInstalledVersions>>): Promise<Instance> {
  const dir = instanceDir(s, id)
  const game = gameDir(s, id)
  const icon = await statOrNull(path.join(dir, ICON))
  const latestLog = await statOrNull(path.join(game, 'logs', 'latest.log'))
  const played = [config.lastPlayed, latestLog?.mtime.toISOString()].filter(Boolean).sort().pop()
  return {
    ...config,
    id,
    gameDir: game,
    iconUrl: icon ? fileUrl(path.join(dir, ICON), icon.mtimeMs) : undefined,
    modCount: await countJars(path.join(game, 'mods')),
    versionInstalled: isVersionReady(config.versionId, installed, config.loader),
    lastPlayed: played
  }
}

export async function listInstances(): Promise<Instance[]> {
  const s = await getSettings()
  const root = layout.instances(s.dataDir)
  const installed = await listInstalledVersions(s.minecraftDir)
  const result: Instance[] = []
  for (const id of await listDir(root)) {
    const config = await readJson<InstanceConfig>(path.join(root, id, CONFIG))
    if (config) result.push(await hydrate(s, id, config, installed))
  }
  return result
}

export async function getInstance(id: string): Promise<Instance> {
  const s = await getSettings()
  return hydrate(s, id, await readConfig(id), await listInstalledVersions(s.minecraftDir))
}

/** Write this instance's entry in the launcher's profiles file. */
export async function syncProfile(id: string, select = false): Promise<void> {
  const s = await getSettings()
  const config = await readConfig(id)
  const iconFile = path.join(instanceDir(s, id), ICON)
  const icon = (await exists(iconFile)) ? `data:image/png;base64,${(await fs.readFile(iconFile)).toString('base64')}` : undefined
  await upsertProfile(
    s.minecraftDir,
    s.dataDir,
    s.launcher,
    {
      id: config.profileId,
      name: config.name,
      versionId: config.versionId,
      gameDir: gameDir(s, id),
      icon,
      javaArgs: buildJavaArgs(config.memoryMb, config.extraJavaArgs)
    },
    select
  )
}

/** Turn a launcher version id into mc version + loader using what is installed. */
async function describeVersion(versionId: string): Promise<Pick<InstanceConfig, 'mcVersion' | 'loader' | 'loaderVersion'>> {
  const s = await getSettings()
  const found = (await listInstalledVersions(s.minecraftDir)).find((v) => v.id === versionId)
  if (found) return { mcVersion: found.mcVersion, loader: found.loader, loaderVersion: found.loaderVersion }
  if (versionId === 'latest-release') return { mcVersion: 'Latest release', loader: 'vanilla' }
  if (versionId === 'latest-snapshot') return { mcVersion: 'Latest snapshot', loader: 'vanilla' }
  return { mcVersion: versionId, loader: 'vanilla' }
}

function newProfileId(id: string): string {
  return `kiln-${id}-${randomBytes(3).toString('hex')}`
}

/** Create the folders and config for a new instance. Does not touch the launcher. */
export async function createInstanceFolder(input: NewInstance & { notes?: string; warning?: string }): Promise<string> {
  const s = await getSettings()
  const name = input.name.trim()
  if (!name) throw new KilnError('Give the instance a name first.')
  const root = layout.instances(s.dataDir)
  await fs.mkdir(root, { recursive: true })
  const dir = await uniquePath(root, slugify(name))
  const id = path.basename(dir)
  await fs.mkdir(dir, { recursive: true })
  for (const f of GAME_FOLDERS) await fs.mkdir(path.join(dir, 'minecraft', f), { recursive: true })

  const described = input.mcVersion ? { mcVersion: input.mcVersion, loader: input.loader ?? 'vanilla', loaderVersion: input.loaderVersion } : await describeVersion(input.versionId)
  const config: InstanceConfig = {
    name,
    icon: input.icon ?? randomIcon(),
    versionId: input.versionId,
    ...described,
    group: input.group || undefined,
    pinned: false,
    memoryMb: input.memoryMb ?? s.defaultMemoryMb,
    created: nowIso(),
    profileId: newProfileId(id),
    notes: input.notes,
    warning: input.warning
  }
  await writeConfig(id, config)
  return id
}

export async function createInstance(input: NewInstance): Promise<Instance> {
  const id = await createInstanceFolder(input)
  await syncProfile(id)
  return getInstance(id)
}

export type InstancePatch = Partial<
  Pick<InstanceConfig, 'name' | 'versionId' | 'mcVersion' | 'loader' | 'loaderVersion' | 'group' | 'pinned' | 'memoryMb' | 'extraJavaArgs' | 'notes'>
>

export function updateInstance(id: string, patch: InstancePatch): Promise<Instance> {
  return withLock(`instance:${id}`, () => updateNow(id, patch))
}

async function updateNow(id: string, patch: InstancePatch): Promise<Instance> {
  const config = await readConfig(id)
  const next: InstanceConfig = { ...config, ...patch }
  if (patch.name !== undefined) {
    next.name = patch.name.trim()
    if (!next.name) throw new KilnError('The name cannot be empty.')
  }
  // A version that is already installed tells us its loader; a planned loader install passes it explicitly.
  if (patch.versionId && patch.versionId !== config.versionId && !patch.loader) {
    Object.assign(next, { loaderVersion: undefined }, await describeVersion(patch.versionId))
  }
  if (patch.group === '') next.group = undefined
  await writeConfig(id, next)

  const touchesLauncher = ['name', 'versionId', 'memoryMb', 'extraJavaArgs'].some((k) => k in patch)
  if (touchesLauncher) await syncProfile(id)
  return getInstance(id)
}

/** Save an icon. `png` is a PNG rendered by the UI (data: URL), used for both Kiln and the launcher. */
export function setIcon(id: string, icon: InstanceIcon, png: string): Promise<Instance> {
  return withLock(`instance:${id}`, () => setIconNow(id, icon, png))
}

async function setIconNow(id: string, icon: InstanceIcon, png: string): Promise<Instance> {
  const s = await getSettings()
  const data = Buffer.from(png.replace(/^data:image\/png;base64,/, ''), 'base64')
  if (!data.length) throw new KilnError('That image could not be used as an icon.')
  await fs.writeFile(path.join(instanceDir(s, id), ICON), data)
  await writeConfig(id, { ...(await readConfig(id)), icon })
  await syncProfile(id)
  return getInstance(id)
}

export async function duplicateInstance(id: string): Promise<Instance> {
  const s = await getSettings()
  const config = await readConfig(id)
  const root = layout.instances(s.dataDir)
  const dir = await uniquePath(root, slugify(`${config.name} copy`))
  const newId = path.basename(dir)
  await fs.cp(instanceDir(s, id), dir, {
    recursive: true,
    filter: (src) => !/[\\/]minecraft[\\/](logs|crash-reports)([\\/]|$)/.test(path.relative(root, src))
  })
  await writeConfig(newId, {
    ...config,
    name: `${config.name} (copy)`,
    pinned: false,
    created: nowIso(),
    lastPlayed: undefined,
    profileId: newProfileId(newId)
  })
  await syncProfile(newId)
  return getInstance(newId)
}

export async function deleteInstance(id: string): Promise<void> {
  const s = await getSettings()
  const config = await readConfig(id)
  await removeProfile(s.minecraftDir, s.dataDir, s.launcher, config.profileId)
  await trash(instanceDir(s, id))
}

export interface PlayResult {
  launcherWasRunning: boolean
  versionMissing: boolean
}

/** Make the launcher's profile match the instance, select it, and open the launcher. */
export async function playInstance(id: string): Promise<PlayResult> {
  const s = await getSettings()
  if (!(await launcherExists(s.launcher))) {
    throw new KilnError('Official launcher not found.', launcherHelp())
  }
  const instance = await getInstance(id)
  const launcherWasRunning = await isLauncherRunning()
  await syncProfile(id, true)
  await withLock(`instance:${id}`, async () => writeConfig(id, { ...(await readConfig(id)), lastPlayed: nowIso() }))
  await openLauncher(s.launcher, s.minecraftDir)
  return { launcherWasRunning, versionMissing: !instance.versionInstalled }
}

/** Groups (folders) on the home screen. */
export async function setGroups(groups: string[]): Promise<Settings> {
  const unique = [...new Set(groups.map((g) => g.trim()).filter(Boolean))]
  const s = await updateSettings({ groups: unique })
  // Instances in a removed group fall back to "no group".
  for (const inst of await listInstances()) {
    if (inst.group && !unique.includes(inst.group)) await writeConfig(inst.id, { ...(await readConfig(inst.id)), group: undefined })
  }
  return s
}

export async function renameGroup(from: string, to: string): Promise<Settings> {
  const s = await getSettings()
  const name = to.trim()
  if (!name) throw new KilnError('Folder names cannot be empty.')
  if (s.groups.includes(name) && name !== from) throw new KilnError(`There is already a folder called "${name}".`)
  for (const inst of await listInstances()) {
    if (inst.group === from) await writeConfig(inst.id, { ...(await readConfig(inst.id)), group: name })
  }
  return updateSettings({ groups: s.groups.map((g) => (g === from ? name : g)) })
}

/** Remove a half-created instance (used when an import fails). */
export async function deleteInstanceFolder(id: string): Promise<void> {
  const s = await getSettings()
  await fs.rm(instanceDir(s, id), { recursive: true, force: true })
}

import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type { ExternalInstance, Instance, Loader } from '@shared/types'
import { getSettings } from '../settings'
import { KilnError } from '../util/errors'
import { exists, listDir, readJson } from '../util/fs'
import { fileUrl } from '../files'
import { progressReporter } from '../progress'
import { listInstalledVersions } from '../launcher/versions'
import { createInstanceFolder, deleteInstanceFolder, gameDir, getInstance, instanceDir, syncProfile } from '../instances/store'
import { loaderFromComponents, loaderFromCurseForge, resolveVersionId } from '../modpacks/resolve'

/** Import instances from Prism Launcher, MultiMC and the CurseForge app. Files are copied, never moved. */

const home = os.homedir()

function prismRoots(): string[] {
  switch (process.platform) {
    case 'win32': {
      const appData = process.env.APPDATA || path.join(home, 'AppData', 'Roaming')
      return [path.join(appData, 'PrismLauncher', 'instances')]
    }
    case 'darwin':
      return [path.join(home, 'Library', 'Application Support', 'PrismLauncher', 'instances')]
    default:
      return [
        path.join(process.env.XDG_DATA_HOME || path.join(home, '.local', 'share'), 'PrismLauncher', 'instances'),
        path.join(home, '.var', 'app', 'org.prismlauncher.PrismLauncher', 'data', 'PrismLauncher', 'instances'),
        path.join(home, '.local', 'share', 'multimc', 'instances')
      ]
  }
}

function curseForgeRoots(): string[] {
  const roots = [path.join(home, 'curseforge', 'minecraft', 'Instances'), path.join(home, 'Documents', 'curseforge', 'minecraft', 'Instances')]
  if (process.platform === 'win32' && process.env.USERPROFILE) roots.unshift(path.join(process.env.USERPROFILE, 'curseforge', 'minecraft', 'Instances'))
  return roots
}

function parseIni(text: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*([^=#;[]+?)\s*=\s*(.*)$/)
    if (m) out[m[1]] = m[2]
  }
  return out
}

interface Described extends ExternalInstance {
  /** Folder whose contents become the new game folder. */
  gameFolder: string
  iconFile?: string
  /** Files in gameFolder that belong to the other launcher and should not be copied. */
  skip: string[]
}

async function describePrism(dir: string, source: 'prism' | 'multimc'): Promise<Described | null> {
  const cfgText = await fs.readFile(path.join(dir, 'instance.cfg'), 'utf8').catch(() => null)
  if (cfgText === null) return null
  const cfg = parseIni(cfgText)
  const pack = await readJson<{ components?: { uid: string; version?: string }[] }>(path.join(dir, 'mmc-pack.json'))
  const { mc, loader, loaderVersion } = loaderFromComponents(pack?.components ?? [])
  let gameFolder = path.join(dir, '.minecraft')
  if (!(await exists(gameFolder))) gameFolder = path.join(dir, 'minecraft')

  // Icons are either inside the instance folder or in the launcher's shared icons folder.
  let iconFile: string | undefined
  const key = cfg.iconKey
  if (key && key !== 'default') {
    for (const candidate of [path.join(dir, `${key}.png`), path.join(path.dirname(path.dirname(dir)), 'icons', `${key}.png`)]) {
      if (await exists(candidate)) {
        iconFile = candidate
        break
      }
    }
  }
  return {
    source,
    path: dir,
    name: cfg.name || path.basename(dir),
    mcVersion: mc,
    loader,
    loaderVersion,
    iconUrl: iconFile ? fileUrl(iconFile) : undefined,
    gameFolder,
    iconFile,
    skip: []
  }
}

async function describeCurseForge(dir: string): Promise<Described | null> {
  const info = await readJson<{ name?: string; gameVersion?: string; baseModLoader?: { name?: string; minecraftVersion?: string } }>(
    path.join(dir, 'minecraftinstance.json')
  )
  if (!info) return null
  const { loader, loaderVersion } = loaderFromCurseForge(info.baseModLoader?.name)
  return {
    source: 'curseforge',
    path: dir,
    name: info.name || path.basename(dir),
    mcVersion: info.gameVersion || info.baseModLoader?.minecraftVersion || '',
    loader: (loader === 'other' ? 'vanilla' : loader) as Loader,
    loaderVersion,
    gameFolder: dir,
    skip: ['minecraftinstance.json', '.curseclient', 'profileImage']
  }
}

async function describe(dir: string): Promise<Described | null> {
  if (await exists(path.join(dir, 'instance.cfg'))) return describePrism(dir, /multimc/i.test(dir) ? 'multimc' : 'prism')
  if (await exists(path.join(dir, 'minecraftinstance.json'))) return describeCurseForge(dir)
  return null
}

const strip = ({ gameFolder: _g, iconFile: _i, skip: _s, ...rest }: Described): ExternalInstance => rest

/** Find instances from other launchers in their usual places. */
export async function scanExternal(): Promise<ExternalInstance[]> {
  const found: ExternalInstance[] = []
  for (const root of [...prismRoots(), ...curseForgeRoots()]) {
    for (const name of await listDir(root)) {
      const d = await describe(path.join(root, name)).catch(() => null)
      if (d) found.push(strip(d))
    }
  }
  return found
}

/** Look at a folder the user picked: either one instance, or a folder of instances. */
export async function scanFolder(dir: string): Promise<ExternalInstance[]> {
  const single = await describe(dir)
  if (single) return [strip(single)]
  const found: ExternalInstance[] = []
  const inner = (await exists(path.join(dir, 'instances'))) ? path.join(dir, 'instances') : dir
  for (const name of await listDir(inner)) {
    const d = await describe(path.join(inner, name)).catch(() => null)
    if (d) found.push(strip(d))
  }
  if (!found.length) throw new KilnError('No instances were found in that folder.', 'Pick a Prism Launcher, MultiMC or CurseForge instance folder, or the "instances" folder that contains them.')
  return found
}

async function countFiles(dir: string): Promise<number> {
  let n = 0
  for (const e of await fs.readdir(dir, { withFileTypes: true }).catch(() => [])) n += e.isDirectory() ? await countFiles(path.join(dir, e.name)) : 1
  return n
}

export async function importExternal(dir: string): Promise<Instance> {
  const d = await describe(dir)
  if (!d) throw new KilnError('That folder is not an instance Kiln can import.')
  const s = await getSettings()
  const installed = await listInstalledVersions(s.minecraftDir)
  const id = await createInstanceFolder({
    name: d.name,
    versionId: resolveVersionId(installed, d.loader, d.mcVersion, d.loaderVersion),
    mcVersion: d.mcVersion,
    loader: d.loader,
    loaderVersion: d.loaderVersion,
    notes: `Imported from ${{ prism: 'Prism Launcher', multimc: 'MultiMC', curseforge: 'the CurseForge app' }[d.source]}`
  })
  const game = gameDir(s, id)
  const progress = progressReporter(`import:${dir}`, `Copying ${d.name}`, await countFiles(d.gameFolder))
  try {
    if (await exists(d.gameFolder)) {
      await fs.cp(d.gameFolder, game, {
        recursive: true,
        force: true,
        filter: async (src) => {
          const rel = path.relative(d.gameFolder, src)
          if (d.skip.includes(rel.split(path.sep)[0])) return false
          if (!(await fs.stat(src)).isDirectory()) progress.tick()
          return true
        }
      })
    }
    if (d.iconFile) {
      await fs.copyFile(d.iconFile, path.join(instanceDir(s, id), 'icon.png'))
      const cfgPath = path.join(instanceDir(s, id), 'instance.json')
      const cfg = await readJson<Record<string, unknown>>(cfgPath)
      await fs.writeFile(cfgPath, JSON.stringify({ ...cfg, icon: { kind: 'image', file: 'icon.png' } }, null, 2) + '\n')
    }
    await syncProfile(id)
  } catch (e) {
    progress.finish()
    await deleteInstanceFolder(id)
    throw e
  }
  progress.finish()
  return getInstance(id)
}

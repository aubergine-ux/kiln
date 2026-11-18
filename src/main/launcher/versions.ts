import { promises as fs, watch, type FSWatcher } from 'node:fs'
import path from 'node:path'
import type { GameVersion, Loader } from '@shared/types'
import { listDir, readJson } from '../util/fs'

interface VersionJson {
  id: string
  inheritsFrom?: string
  jar?: string
  type?: string
  releaseTime?: string
  mainClass?: string
  libraries?: { name?: string }[]
  arguments?: { game?: unknown[] }
  minecraftArguments?: string
}

const MC_VERSION = /^(\d+\.\d+(?:\.\d+)?(?:-(?:pre|rc)\d+)?|\d{2}w\d{2}[a-z]|[ab]\d+\.\d+(?:\.\d+)?(?:_\d+)?)/

/** Work out the loader of a version json by looking at its libraries and arguments. */
export function classifyVersion(v: VersionJson): GameVersion {
  const libs = (v.libraries ?? []).map((l) => l.name ?? '')
  const lib = (prefix: string) => libs.find((n) => n.startsWith(prefix))?.split(':')[2]
  const args = [...(v.arguments?.game ?? []).filter((a): a is string => typeof a === 'string'), ...(v.minecraftArguments?.split(' ') ?? [])]
  const argValue = (flag: string) => {
    const i = args.indexOf(flag)
    return i >= 0 ? args[i + 1] : undefined
  }

  let loader: Loader = 'vanilla'
  let loaderVersion: string | undefined
  if (lib('net.fabricmc:fabric-loader:')) {
    loader = 'fabric'
    loaderVersion = lib('net.fabricmc:fabric-loader:')
  } else if (lib('org.quiltmc:quilt-loader:')) {
    loader = 'quilt'
    loaderVersion = lib('org.quiltmc:quilt-loader:')
  } else if (libs.some((n) => n.startsWith('net.neoforged')) || /neoforge/i.test(v.id)) {
    loader = 'neoforge'
    loaderVersion = argValue('--fml.neoForgeVersion') ?? lib('net.neoforged:neoforge:') ?? v.id.match(/neoforge-(.+)$/i)?.[1]
  } else if (libs.some((n) => n.startsWith('net.minecraftforge')) || /forge/i.test(v.id) || v.mainClass?.includes('cpw.mods')) {
    loader = 'forge'
    loaderVersion = argValue('--fml.forgeVersion') ?? lib('net.minecraftforge:forge:')?.split('-').slice(1).join('-') ?? v.id.match(/forge-?(.+)$/i)?.[1]
  } else if (/optifine/i.test(v.id)) {
    loader = 'optifine'
    loaderVersion = v.id.split(/optifine_?/i)[1]
  } else if (v.inheritsFrom) {
    loader = 'other'
  }

  const mcVersion = v.inheritsFrom ?? v.jar ?? v.id.match(MC_VERSION)?.[1] ?? v.id
  return { id: v.id, mcVersion, loader, loaderVersion, type: v.type, releaseTime: v.releaseTime }
}

/** Everything installed in .minecraft/versions, newest first. */
export async function listInstalledVersions(minecraftDir: string): Promise<GameVersion[]> {
  const dir = path.join(minecraftDir, 'versions')
  const result: GameVersion[] = []
  for (const id of await listDir(dir)) {
    const json = await readJson<VersionJson>(path.join(dir, id, `${id}.json`))
    if (!json?.id) continue
    const v = classifyVersion(json)
    // Inherit the release date from the parent so sorting works for loaders too.
    if (!v.releaseTime && json.inheritsFrom) {
      v.releaseTime = (await readJson<VersionJson>(path.join(dir, json.inheritsFrom, `${json.inheritsFrom}.json`)))?.releaseTime
    }
    if (!v.releaseTime) v.releaseTime = (await fs.stat(path.join(dir, id)).catch(() => null))?.mtime.toISOString()
    result.push(v)
  }
  return result.sort((a, b) => (b.releaseTime ?? '').localeCompare(a.releaseTime ?? ''))
}

/** Vanilla versions are downloaded by the launcher on demand, so only loaders must be installed. */
export function isVersionReady(versionId: string, installed: GameVersion[], loader: Loader = 'vanilla'): boolean {
  if (installed.some((v) => v.id === versionId)) return true
  if (loader !== 'vanilla') return false
  if (versionId === 'latest-release' || versionId === 'latest-snapshot') return true
  return MC_VERSION.test(versionId) && /^[\w.-]+$/.test(versionId) && !/fabric|forge|quilt|optifine/i.test(versionId)
}

let watcher: FSWatcher | null = null

/** Call `onChange` when something is added to or removed from the versions folder. */
export function watchVersions(minecraftDir: string, onChange: () => void): void {
  watcher?.close()
  watcher = null
  let timer: NodeJS.Timeout | undefined
  try {
    watcher = watch(path.join(minecraftDir, 'versions'), () => {
      clearTimeout(timer)
      timer = setTimeout(onChange, 800)
    })
    watcher.on('error', () => watcher?.close())
  } catch {
    // Folder does not exist yet; the UI also refreshes when the window gets focus.
  }
}

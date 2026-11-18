import { promises as fs } from 'node:fs'
import path from 'node:path'
import { parse as parseToml } from 'smol-toml'
import type { Loader } from '@shared/types'
import { readZipEntries, walkZip } from '../util/zip'

/**
 * Reads names, versions and icons out of mod jars and pack zips.
 * Nothing here touches Electron, so it is easy to test.
 */

export interface RawMeta {
  name?: string
  id?: string
  version?: string
  description?: string
  authors?: string[]
  icon?: Buffer
  loader?: Loader
}

/** JSON.parse that copes with the raw newlines and tabs some mods put inside strings. */
function lenientJson<T>(buf: Buffer): T | null {
  const text = buf.toString('utf8').replace(/^﻿/, '')
  try {
    return JSON.parse(text) as T
  } catch {
    try {
      return JSON.parse(text.replace(/[\u0000-\u001F]+/g, ' ')) as T
    } catch {
      return null
    }
  }
}

function names(list: unknown): string[] | undefined {
  if (typeof list === 'string') return list.split(',').map((s) => s.trim()).filter(Boolean)
  if (Array.isArray(list)) return list.map((a) => (typeof a === 'string' ? a : (a as { name?: string })?.name ?? '')).filter(Boolean)
  if (list && typeof list === 'object') return Object.keys(list)
  return undefined
}

/** Pick the largest icon from a fabric-style `{ "16": "a.png", "128": "b.png" }` map. */
function pickIcon(icon: unknown): string | undefined {
  if (typeof icon === 'string') return icon
  if (icon && typeof icon === 'object') {
    const sizes = Object.keys(icon).sort((a, b) => Number(b) - Number(a))
    return (icon as Record<string, string>)[sizes[0]]
  }
  return undefined
}

function manifestValue(buf: Buffer | undefined, key: string): string | undefined {
  return buf?.toString('utf8').match(new RegExp(`^${key}:\\s*(.+)$`, 'm'))?.[1].trim()
}

const MOD_META_FILES = new Set([
  'fabric.mod.json',
  'quilt.mod.json',
  'META-INF/mods.toml',
  'META-INF/neoforge.mods.toml',
  'mcmod.info',
  'META-INF/MANIFEST.MF'
])

export async function readModMeta(file: string): Promise<RawMeta> {
  const entries = await readZipEntries(file, (n) => MOD_META_FILES.has(n))
  const manifest = entries.get('META-INF/MANIFEST.MF')
  let meta: RawMeta = {}
  let iconPath: string | undefined

  const fabric = entries.get('fabric.mod.json')
  const quilt = entries.get('quilt.mod.json')
  const neoToml = entries.get('META-INF/neoforge.mods.toml')
  const forgeToml = entries.get('META-INF/mods.toml')
  const mcmod = entries.get('mcmod.info')

  if (quilt) {
    const q = lenientJson<{ quilt_loader?: { id?: string; version?: string; metadata?: Record<string, unknown> } }>(quilt)?.quilt_loader
    const m = q?.metadata ?? {}
    meta = { id: q?.id, version: q?.version, name: m.name as string, description: m.description as string, authors: names(m.contributors), loader: 'quilt' }
    iconPath = pickIcon(m.icon)
  } else if (fabric) {
    const f = lenientJson<Record<string, unknown>>(fabric) ?? {}
    meta = { id: f.id as string, version: f.version as string, name: f.name as string, description: f.description as string, authors: names(f.authors), loader: 'fabric' }
    iconPath = pickIcon(f.icon)
  } else if (neoToml || forgeToml) {
    try {
      const toml = parseToml((neoToml ?? forgeToml)!.toString('utf8')) as Record<string, unknown>
      const mod = ((toml.mods as Record<string, unknown>[]) ?? [])[0] ?? {}
      let version = mod.version as string | undefined
      if (!version || version.includes('${')) version = manifestValue(manifest, 'Implementation-Version') ?? version
      meta = {
        id: mod.modId as string,
        version,
        name: mod.displayName as string,
        description: typeof mod.description === 'string' ? mod.description.trim() : undefined,
        authors: names(mod.authors ?? toml.authors),
        loader: neoToml ? 'neoforge' : 'forge'
      }
      iconPath = (mod.logoFile ?? toml.logoFile) as string | undefined
    } catch {
      meta = { loader: neoToml ? 'neoforge' : 'forge' }
    }
  } else if (mcmod) {
    const data = lenientJson<unknown>(mcmod)
    const list = (Array.isArray(data) ? data : (data as { modList?: unknown[] })?.modList) ?? []
    const m = (list[0] ?? {}) as Record<string, unknown>
    meta = { id: m.modid as string, version: m.version as string, name: m.name as string, description: m.description as string, authors: names(m.authorList ?? m.authors), loader: 'forge' }
    iconPath = m.logoFile as string | undefined
  }

  if (meta.version?.includes('${')) meta.version = undefined
  if (iconPath) {
    const clean = iconPath.replace(/^\.?\//, '')
    meta.icon = (await readZipEntries(file, (n) => n === clean, 1)).get(clean)
  }
  return meta
}

/** Turn a pack.mcmeta description (string or text component) into a string with § colour codes. */
export function componentToString(c: unknown): string {
  if (c == null) return ''
  if (typeof c === 'string' || typeof c === 'number' || typeof c === 'boolean') return String(c)
  if (Array.isArray(c)) return c.map(componentToString).join('')
  const obj = c as Record<string, unknown>
  const colors: Record<string, string> = {
    black: '0', dark_blue: '1', dark_green: '2', dark_aqua: '3', dark_red: '4', dark_purple: '5', gold: '6', gray: '7',
    dark_gray: '8', blue: '9', green: 'a', aqua: 'b', red: 'c', light_purple: 'd', yellow: 'e', white: 'f'
  }
  let prefix = ''
  if (typeof obj.color === 'string' && colors[obj.color]) prefix += '§' + colors[obj.color]
  if (obj.bold) prefix += '§l'
  if (obj.italic) prefix += '§o'
  if (obj.underlined) prefix += '§n'
  if (obj.strikethrough) prefix += '§m'
  const text = componentToString(obj.text ?? obj.translate ?? '')
  const extra = Array.isArray(obj.extra) ? obj.extra.map(componentToString).join('') : ''
  return prefix + text + extra + (prefix ? '§r' : '')
}

/** Read pack.mcmeta and pack.png from a pack zip or folder. */
export async function readPackMeta(target: string): Promise<RawMeta> {
  let mcmeta: Buffer | undefined
  let icon: Buffer | undefined
  const stat = await fs.stat(target)
  if (stat.isDirectory()) {
    mcmeta = await fs.readFile(path.join(target, 'pack.mcmeta')).catch(() => undefined)
    icon = await fs.readFile(path.join(target, 'pack.png')).catch(() => undefined)
  } else {
    const entries = await readZipEntries(target, (n) => n === 'pack.mcmeta' || n === 'pack.png', 2).catch(() => new Map<string, Buffer>())
    mcmeta = entries.get('pack.mcmeta')
    icon = entries.get('pack.png')
  }
  const json = mcmeta ? lenientJson<{ pack?: { description?: unknown } }>(mcmeta) : null
  return { description: componentToString(json?.pack?.description).trim() || undefined, icon }
}

/** What kind of thing a dropped file or folder is. */
export type DropKind = 'mods' | 'resourcepacks' | 'shaderpacks' | 'datapacks' | 'modpack' | 'world' | 'unknown'

export async function classifyPath(target: string): Promise<DropKind> {
  const lower = target.toLowerCase()
  const stat = await fs.stat(target).catch(() => null)
  if (!stat) return 'unknown'
  if (stat.isDirectory()) {
    const has = async (p: string) => !!(await fs.stat(path.join(target, p)).catch(() => null))
    if (await has('level.dat')) return 'world'
    if (await has('shaders')) return 'shaderpacks'
    if (await has('pack.mcmeta')) return (await has('data')) && !(await has('assets')) ? 'datapacks' : 'resourcepacks'
    return 'unknown'
  }
  if (lower.endsWith('.jar') || lower.endsWith('.jar.disabled')) return 'mods'
  if (lower.endsWith('.mrpack')) return 'modpack'
  if (!lower.endsWith('.zip')) return 'unknown'

  const entries: string[] = []
  await walkZip(target, async (e) => {
    entries.push(e.fileName)
    return entries.length < 4000
  }).catch(() => {})
  const set = new Set(entries)
  if (set.has('modrinth.index.json') || set.has('manifest.json')) return 'modpack'
  if (entries.some((n) => /^([^/]+\/)?level\.dat$/.test(n))) return 'world'
  if (entries.some((n) => n.startsWith('shaders/'))) return 'shaderpacks'
  if (set.has('pack.mcmeta')) {
    const hasData = entries.some((n) => n.startsWith('data/'))
    const hasAssets = entries.some((n) => n.startsWith('assets/'))
    return hasData && !hasAssets ? 'datapacks' : 'resourcepacks'
  }
  return 'unknown'
}

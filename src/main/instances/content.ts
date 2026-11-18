import { promises as fs } from 'node:fs'
import path from 'node:path'
import type { ContentItem, ContentKind } from '@shared/types'
import { getSettings } from '../settings'
import { KilnError } from '../util/errors'
import { exists, listDir, safeJoin } from '../util/fs'
import { iconDataUrl, trash } from '../files'
import { gameDir } from './store'
import { readModMeta, readPackMeta, type RawMeta } from './metadata'

/**
 * Mods and packs live in the instance's game folder. Disabling a file renames it to
 * "<name>.disabled" so the game skips it. Folder packs are moved into a ".disabled"
 * subfolder instead, because the game would still load a renamed folder.
 */

const DISABLED = '.disabled'

async function contentDir(id: string, kind: ContentKind, world?: string): Promise<string> {
  const game = gameDir(await getSettings(), id)
  if (kind === 'datapacks') {
    if (!world) throw new KilnError('Pick a world first: data packs belong to a single world.')
    return path.join(safeJoin(path.join(game, 'saves'), world), 'datapacks')
  }
  return path.join(game, kind)
}

function accepts(kind: ContentKind, file: string, isFolder: boolean): boolean {
  const name = file.replace(/\.disabled$/, '').toLowerCase()
  if (kind === 'mods') return !isFolder && (name.endsWith('.jar') || name.endsWith('.litemod'))
  return isFolder || name.endsWith('.zip')
}

// Reading jars is slow-ish, so remember what we found per file + size + date.
const metaCache = new Map<string, RawMeta>()

async function metaFor(kind: ContentKind, full: string, size: number, mtime: number): Promise<RawMeta> {
  const key = `${full}|${size}|${mtime}`
  const cached = metaCache.get(key)
  if (cached) return cached
  let meta: RawMeta = {}
  try {
    if (kind === 'mods') meta = await readModMeta(full)
    else if (kind !== 'shaderpacks') meta = await readPackMeta(full)
  } catch {
    // Unreadable archives still show up, just without details.
  }
  metaCache.set(key, meta)
  return meta
}

function displayName(file: string): string {
  return file.replace(/\.disabled$/, '').replace(/\.(jar|zip|litemod)$/i, '')
}

async function itemFor(kind: ContentKind, dir: string, file: string, enabled: boolean): Promise<ContentItem | null> {
  const full = path.join(dir, file)
  const stat = await fs.stat(full).catch(() => null)
  if (!stat) return null
  const isFolder = stat.isDirectory()
  if (!accepts(kind, file, isFolder)) return null
  const meta = await metaFor(kind, full, stat.size, stat.mtimeMs)
  return {
    file: enabled ? file : file.endsWith(DISABLED) ? file : `${DISABLED}/${file}`,
    name: meta.name || displayName(file),
    id: meta.id,
    version: meta.version,
    description: meta.description,
    authors: meta.authors,
    iconUrl: iconDataUrl(meta.icon),
    enabled,
    isFolder,
    size: stat.size,
    modified: stat.mtimeMs,
    loader: meta.loader
  }
}

export async function listContent(id: string, kind: ContentKind, world?: string): Promise<ContentItem[]> {
  const dir = await contentDir(id, kind, world)
  const items: ContentItem[] = []
  for (const file of await listDir(dir)) {
    if (file === DISABLED || file.startsWith('.')) continue
    const item = await itemFor(kind, dir, file, !file.endsWith(DISABLED))
    if (item) items.push(item)
  }
  for (const file of await listDir(path.join(dir, DISABLED))) {
    const item = await itemFor(kind, path.join(dir, DISABLED), file, false)
    if (item) items.push(item)
  }
  return items.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
}

/** Where an item from listContent lives on disk. */
async function resolveItem(id: string, kind: ContentKind, file: string, world?: string): Promise<string> {
  return safeJoin(await contentDir(id, kind, world), file)
}

export async function setEnabled(id: string, kind: ContentKind, file: string, enabled: boolean, world?: string): Promise<void> {
  const dir = await contentDir(id, kind, world)
  const from = await resolveItem(id, kind, file, world)
  const isFolder = (await fs.stat(from)).isDirectory()
  let to: string
  if (file.startsWith(`${DISABLED}/`)) {
    if (!enabled) return
    to = path.join(dir, path.basename(file))
  } else if (isFolder) {
    if (enabled) return
    await fs.mkdir(path.join(dir, DISABLED), { recursive: true })
    to = path.join(dir, DISABLED, file)
  } else {
    const isDisabled = file.endsWith(DISABLED)
    if (isDisabled === !enabled) return
    to = path.join(dir, enabled ? file.slice(0, -DISABLED.length) : file + DISABLED)
  }
  if (await exists(to)) throw new KilnError(`"${path.basename(to)}" already exists in this folder.`, 'Remove one of the two copies first.')
  await fs.rename(from, to)
}

export async function removeContent(id: string, kind: ContentKind, files: string[], world?: string): Promise<void> {
  for (const file of files) await trash(await resolveItem(id, kind, file, world))
}

/**
 * Copy files into the right folder. For mods, an older file with the same mod id
 * is moved to the trash so dropping a new version works as an update.
 */
export async function installContent(id: string, kind: ContentKind, sources: string[], world?: string): Promise<string[]> {
  const dir = await contentDir(id, kind, world)
  await fs.mkdir(dir, { recursive: true })
  const installed: string[] = []
  const existing = kind === 'mods' ? await listContent(id, kind) : []

  for (const src of sources) {
    const stat = await fs.stat(src)
    const name = path.basename(src)
    if (!accepts(kind, name, stat.isDirectory())) {
      const expected = kind === 'mods' ? '.jar files' : '.zip files or pack folders'
      throw new KilnError(`"${name}" can't be added here.`, `This tab accepts ${expected}.`)
    }
    const target = path.join(dir, name.replace(/\.disabled$/, ''))
    if (path.resolve(src) === path.resolve(target)) continue

    if (kind === 'mods') {
      const meta = await readModMeta(src).catch(() => ({}) as RawMeta)
      for (const old of existing) {
        if (meta.id && old.id === meta.id && old.file !== path.basename(target)) await trash(path.join(dir, old.file))
      }
    }
    await fs.cp(src, target, { recursive: true, force: true })
    installed.push(path.basename(target))
  }
  return installed
}

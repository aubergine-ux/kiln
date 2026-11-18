import { promises as fs, type Stats } from 'node:fs'
import path from 'node:path'

export async function exists(p: string): Promise<boolean> {
  try {
    await fs.access(p)
    return true
  } catch {
    return false
  }
}

export async function statOrNull(p: string): Promise<Stats | null> {
  try {
    return await fs.stat(p)
  } catch {
    return null
  }
}

export async function readJson<T>(p: string): Promise<T | null> {
  try {
    return JSON.parse(await fs.readFile(p, 'utf8')) as T
  } catch {
    return null
  }
}

/** Write via a temp file and rename, so a crash never leaves a half-written file. */
export async function writeFileAtomic(p: string, data: string | Buffer): Promise<void> {
  await fs.mkdir(path.dirname(p), { recursive: true })
  const tmp = `${p}.${process.pid}.tmp`
  await fs.writeFile(tmp, data)
  await fs.rename(tmp, p)
}

export async function writeJson(p: string, value: unknown): Promise<void> {
  await writeFileAtomic(p, JSON.stringify(value, null, 2) + '\n')
}

export async function listDir(p: string): Promise<string[]> {
  try {
    return await fs.readdir(p)
  } catch {
    return []
  }
}

/** Turn a display name into a safe folder name. */
export function slugify(name: string): string {
  const slug = name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9 _.-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/^\.+/, '')
    .slice(0, 48)
  return slug || 'instance'
}

/** Return `dir/name`, or `dir/name-2`, `dir/name-3`... whichever does not exist yet. */
export async function uniquePath(dir: string, name: string): Promise<string> {
  const ext = path.extname(name)
  const base = name.slice(0, name.length - ext.length)
  let candidate = path.join(dir, name)
  for (let i = 2; await exists(candidate); i++) candidate = path.join(dir, `${base}-${i}${ext}`)
  return candidate
}

/** True if `child` is inside `parent` (or equal to it). */
export function isInside(parent: string, child: string): boolean {
  const rel = path.relative(path.resolve(parent), path.resolve(child))
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel))
}

/** Join a relative path from an archive or manifest, refusing anything that escapes `root`. */
export function safeJoin(root: string, relative: string): string {
  const cleaned = relative.replace(/\\/g, '/')
  if (cleaned.startsWith('/') || /^[a-zA-Z]:/.test(cleaned)) throw new Error(`Unsafe path: ${relative}`)
  const full = path.resolve(root, cleaned)
  if (!isInside(root, full) || full === path.resolve(root)) throw new Error(`Unsafe path: ${relative}`)
  return full
}

export async function dirSize(p: string): Promise<number> {
  let total = 0
  const entries = await fs.readdir(p, { withFileTypes: true }).catch(() => [])
  for (const e of entries) {
    const full = path.join(p, e.name)
    if (e.isDirectory()) total += await dirSize(full)
    else total += (await statOrNull(full))?.size ?? 0
  }
  return total
}

export function nowIso(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, '.000Z')
}

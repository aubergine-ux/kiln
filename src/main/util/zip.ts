import { createWriteStream, promises as fs } from 'node:fs'
import path from 'node:path'
import { pipeline } from 'node:stream/promises'
import yauzl from 'yauzl'
import yazl from 'yazl'
import { safeJoin } from './fs'

function open(file: string): Promise<yauzl.ZipFile> {
  return new Promise((resolve, reject) =>
    yauzl.open(file, { lazyEntries: true, autoClose: false }, (err, zip) => (err ? reject(err) : resolve(zip)))
  )
}

function readStream(zip: yauzl.ZipFile, entry: yauzl.Entry): Promise<NodeJS.ReadableStream> {
  return new Promise((resolve, reject) =>
    zip.openReadStream(entry, (err, stream) => (err ? reject(err) : resolve(stream)))
  )
}

async function toBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = []
  for await (const chunk of stream) chunks.push(chunk as Buffer)
  return Buffer.concat(chunks)
}

/** Walk every entry in a zip. Return false from the callback to stop early. */
export async function walkZip(
  file: string,
  onEntry: (entry: yauzl.Entry, read: () => Promise<Buffer>, stream: () => Promise<NodeJS.ReadableStream>) => Promise<boolean | void>
): Promise<void> {
  const zip = await open(file)
  try {
    await new Promise<void>((resolve, reject) => {
      zip.on('entry', async (entry: yauzl.Entry) => {
        try {
          const keepGoing = await onEntry(
            entry,
            async () => toBuffer(await readStream(zip, entry)),
            () => readStream(zip, entry)
          )
          if (keepGoing === false) resolve()
          else zip.readEntry()
        } catch (e) {
          reject(e)
        }
      })
      zip.on('end', () => resolve())
      zip.on('error', reject)
      zip.readEntry()
    })
  } finally {
    zip.close()
  }
}

/** Read a handful of entries by exact name (or by a predicate) into memory. */
export async function readZipEntries(file: string, wanted: (name: string) => boolean, limit = Infinity): Promise<Map<string, Buffer>> {
  const found = new Map<string, Buffer>()
  await walkZip(file, async (entry, read) => {
    if (!entry.fileName.endsWith('/') && wanted(entry.fileName)) {
      found.set(entry.fileName, await read())
      if (found.size >= limit) return false
    }
  })
  return found
}

export async function listZip(file: string): Promise<string[]> {
  const names: string[] = []
  await walkZip(file, async (entry) => {
    names.push(entry.fileName)
  })
  return names
}

/**
 * Extract entries whose names start with `prefix` into `dest`, dropping the prefix.
 * Paths that would land outside `dest` are rejected.
 */
export async function extractZip(file: string, dest: string, prefix = '', onFile?: (name: string) => void): Promise<number> {
  let count = 0
  await walkZip(file, async (entry, _read, stream) => {
    const name = entry.fileName.replace(/\\/g, '/')
    if (!name.startsWith(prefix)) return
    const rel = name.slice(prefix.length)
    if (!rel) return
    const target = safeJoin(dest, rel)
    if (name.endsWith('/')) {
      await fs.mkdir(target, { recursive: true })
      return
    }
    await fs.mkdir(path.dirname(target), { recursive: true })
    await pipeline(await stream(), createWriteStream(target))
    const mtime = entry.getLastModDate()
    await fs.utimes(target, mtime, mtime).catch(() => {})
    count++
    onFile?.(rel)
  })
  return count
}

/** A file or folder on disk, or an in-memory buffer, and its path inside the archive. */
export type ZipSource = { from: string; to: string } | { data: Buffer; to: string }

/** Create a zip from files and folders. Folders are added recursively. */
export async function createZip(dest: string, sources: ZipSource[], onFile?: (name: string) => void): Promise<void> {
  const zip = new yazl.ZipFile()
  const add = async (from: string, to: string): Promise<void> => {
    const stat = await fs.stat(from)
    if (stat.isDirectory()) {
      const children = await fs.readdir(from)
      if (children.length === 0) zip.addEmptyDirectory(to)
      for (const child of children) await add(path.join(from, child), `${to}/${child}`)
    } else {
      zip.addFile(from, to, { mtime: stat.mtime })
      onFile?.(to)
    }
  }
  for (const s of sources) {
    const to = s.to.replace(/\\/g, '/')
    if ('data' in s) zip.addBuffer(s.data, to)
    else await add(s.from, to)
  }
  await fs.mkdir(path.dirname(dest), { recursive: true })
  const tmp = `${dest}.part`
  const done = pipeline(zip.outputStream, createWriteStream(tmp))
  zip.end()
  await done
  await fs.rename(tmp, dest)
}

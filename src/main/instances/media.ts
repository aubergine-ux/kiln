import { promises as fs } from 'node:fs'
import path from 'node:path'
import { gunzipSync } from 'node:zlib'
import { clipboard, ClipboardItem, nativeImage } from 'electron'
import type { LogFile, Screenshot } from '@shared/types'
import { getSettings } from '../settings'
import { KilnError } from '../util/errors'
import { listDir, safeJoin, statOrNull } from '../util/fs'
import { fileUrl, trash } from '../files'
import { gameDir } from './store'

/** Screenshots and logs: read-only views over the game folder, plus copy and delete. */

async function screenshotsDir(id: string) {
  return path.join(gameDir(await getSettings(), id), 'screenshots')
}

export async function listScreenshots(id: string): Promise<Screenshot[]> {
  const dir = await screenshotsDir(id)
  const shots: Screenshot[] = []
  for (const file of await listDir(dir)) {
    if (!/\.(png|jpe?g)$/i.test(file)) continue
    const stat = await statOrNull(path.join(dir, file))
    if (stat) shots.push({ file, url: fileUrl(path.join(dir, file), stat.mtimeMs), created: stat.mtimeMs, size: stat.size })
  }
  return shots.sort((a, b) => b.created - a.created)
}

export async function screenshotPath(id: string, file: string): Promise<string> {
  return safeJoin(await screenshotsDir(id), file)
}

export async function copyScreenshot(id: string, file: string): Promise<void> {
  const image = nativeImage.createFromPath(await screenshotPath(id, file))
  if (image.isEmpty()) throw new KilnError('That screenshot could not be read.')
  const png = new Blob([new Uint8Array(image.toPNG())], { type: 'image/png' })
  await clipboard.write([new ClipboardItem({ 'image/png': png })])
}

export async function deleteScreenshots(id: string, files: string[]): Promise<void> {
  for (const f of files) await trash(await screenshotPath(id, f))
}

export async function listLogs(id: string): Promise<LogFile[]> {
  const game = gameDir(await getSettings(), id)
  const result: LogFile[] = []
  for (const [sub, kind] of [['logs', 'log'], ['crash-reports', 'crash']] as const) {
    for (const file of await listDir(path.join(game, sub))) {
      if (!/\.(log|txt|log\.gz)$/i.test(file)) continue
      const stat = await statOrNull(path.join(game, sub, file))
      if (stat?.isFile()) result.push({ file: `${sub}/${file}`, kind, modified: stat.mtimeMs, size: stat.size })
    }
  }
  return result.sort((a, b) => b.modified - a.modified)
}

const MAX_LOG = 8 * 1024 * 1024

export async function readLog(id: string, file: string): Promise<string> {
  if (!/^(logs|crash-reports)\//.test(file)) throw new KilnError('Only log files can be opened here.')
  const full = safeJoin(gameDir(await getSettings(), id), file)
  let data = await fs.readFile(full)
  if (file.endsWith('.gz')) data = gunzipSync(data)
  // Very large logs are trimmed to their last few megabytes, which is where problems usually are.
  if (data.length > MAX_LOG) return `[Kiln: showing the last 8 MB of ${Math.round(data.length / 1048576)} MB]\n` + data.subarray(data.length - MAX_LOG).toString('utf8')
  return data.toString('utf8')
}

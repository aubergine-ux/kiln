import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { nativeImage, net, protocol, shell } from 'electron'
import { promises as fs } from 'node:fs'

/**
 * The UI shows local images (world icons, screenshots, instance icons) through a
 * small "kiln://file/<path>" protocol. Only image files can be served this way.
 */
const SCHEME = 'kiln'
const IMAGE_EXT = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.bmp'])

export function registerScheme(): void {
  protocol.registerSchemesAsPrivileged([{ scheme: SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true } }])
}

export function handleFileProtocol(): void {
  protocol.handle(SCHEME, (request) => {
    const url = new URL(request.url)
    const file = decodeURIComponent(url.pathname.slice(1))
    if (url.host !== 'file' || !path.isAbsolute(file) || !IMAGE_EXT.has(path.extname(file).toLowerCase())) {
      return new Response('Not found', { status: 404 })
    }
    return net.fetch(pathToFileURL(file).toString())
  })
}

/** URL the UI can use in <img src>. `version` busts the cache after a change. */
export function fileUrl(file: string, version?: number): string {
  return `${SCHEME}://file/${encodeURIComponent(file)}${version ? `?v=${Math.round(version)}` : ''}`
}

/** Shrink an icon and turn it into a data: URL. Returns undefined for broken images. */
export function iconDataUrl(buf: Buffer | undefined, size = 64): string | undefined {
  if (!buf?.length) return undefined
  const img = nativeImage.createFromBuffer(buf)
  if (img.isEmpty()) return undefined
  const { width } = img.getSize()
  const resized = width > size ? img.resize({ width: size, height: size, quality: 'good' }) : img
  return resized.toDataURL()
}

/** Move to the system trash; fall back to deleting if the trash is unavailable. */
export async function trash(target: string): Promise<void> {
  // Automated tests delete for real instead of filling the system trash.
  if (process.env.KILN_NO_TRASH) return fs.rm(target, { recursive: true, force: true })
  try {
    await shell.trashItem(target)
  } catch {
    await fs.rm(target, { recursive: true, force: true })
  }
}

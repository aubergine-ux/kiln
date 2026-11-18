import * as lucide from './iconset'
import type { InstanceIcon } from '@shared/types'
import { glyphPixels } from './glyphs'

/** An icon as data: a list of SVG elements and their attributes (lucide's format). */
export type IconNode = [string, Record<string, string | number>][]

export function svgMarkup(node: IconNode, size = 24, stroke = 'currentColor', strokeWidth = 2): string {
  const inner = node
    .map(([tag, attrs]) => `<${tag} ${Object.entries(attrs).map(([k, v]) => `${k}="${v}"`).join(' ')}/>`)
    .join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`
}

export function icon(name: string): IconNode {
  return ((lucide as unknown as Record<string, IconNode>)[name] ?? lucide.Box) as IconNode
}

/** Tile colours, named in instance.json by these keys. */
export const TILE_COLORS: Record<string, string> = {
  ember: '#c9531f',
  rose: '#a5432f',
  sand: '#b28a48',
  moss: '#557a35',
  teal: '#3d8574',
  sky: '#2f5c9c',
  violet: '#6b4f8e',
  slate: '#6a645d'
}

/**
 * Draw an instance icon as a PNG (data: URL). The official launcher shows this
 * picture in its installation list, so it has to look right on its own.
 */
export async function renderIconPng(i: InstanceIcon, imageSrc?: string, size = 128): Promise<string> {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')!

  if (i.kind === 'image' && imageSrc) {
    const img = await loadImage(imageSrc)
    const s = Math.min(img.width, img.height)
    ctx.imageSmoothingEnabled = img.width >= size
    ctx.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size)
    return canvas.toDataURL('image/png')
  }

  const r = size * 0.14
  ctx.save()
  ctx.beginPath()
  ctx.roundRect(0, 0, size, size, r)
  ctx.clip()
  ctx.fillStyle = TILE_COLORS[(i as { color: string }).color] ?? TILE_COLORS.ember
  ctx.fillRect(0, 0, size, size)
  // A lighter top edge and darker bottom edge, like the face of a block.
  ctx.fillStyle = 'rgba(255,255,255,0.16)'
  ctx.fillRect(0, 0, size, size * 0.05)
  ctx.fillStyle = 'rgba(0,0,0,0.18)'
  ctx.fillRect(0, size * 0.92, size, size * 0.08)
  ctx.restore()

  // Snap the 12x12 glyph to whole pixels so it stays crisp in the launcher.
  const cell = Math.floor((size * 0.6) / 12)
  const offset = Math.round((size - cell * 12) / 2)
  for (const p of glyphPixels((i as { glyph: string }).glyph)) {
    ctx.fillStyle = p.half ? 'rgba(255,255,255,0.55)' : '#fff'
    ctx.fillRect(offset + p.x * cell, offset + p.y * cell - Math.round(size * 0.02), cell, cell)
  }
  return canvas.toDataURL('image/png')
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('The image could not be loaded.'))
    img.src = src
  })
}

/** Read a picked image file into a data: URL. */
export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

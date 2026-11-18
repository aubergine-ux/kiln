import * as lucide from './iconset'
import type { InstanceIcon } from '@shared/types'

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

/** Glyphs offered for instance icons. */
export const GLYPHS: Record<string, string> = {
  pickaxe: 'Pickaxe',
  sword: 'Sword',
  swords: 'Swords',
  axe: 'Axe',
  hammer: 'Hammer',
  shield: 'Shield',
  tree: 'Trees',
  leaf: 'Leaf',
  sprout: 'Sprout',
  mountain: 'Mountain',
  castle: 'Castle',
  tent: 'Tent',
  ship: 'Ship',
  compass: 'Compass',
  map: 'Map',
  gem: 'Gem',
  crown: 'Crown',
  flame: 'Flame',
  zap: 'Zap',
  potion: 'FlaskConical',
  wand: 'Wand',
  sparkles: 'Sparkles',
  star: 'Star',
  moon: 'Moon',
  sun: 'Sun',
  snowflake: 'Snowflake',
  fish: 'Fish',
  bird: 'Bird',
  cat: 'Cat',
  bone: 'Bone',
  skull: 'Skull',
  ghost: 'Ghost',
  heart: 'Heart',
  rocket: 'Rocket',
  puzzle: 'Puzzle',
  cherry: 'Cherry'
}

/** Tile colours: [from, to] gradient stops. */
export const TILE_COLORS: Record<string, [string, string]> = {
  ember: ['#f06a35', '#f8a64a'],
  rose: ['#e2487c', '#f5866b'],
  violet: ['#7457e6', '#c46ae6'],
  sky: ['#2f7fe0', '#4cc3ea'],
  teal: ['#159a8c', '#5bd1a6'],
  moss: ['#4a944a', '#9cc957'],
  sand: ['#c98d3d', '#ecc56e'],
  slate: ['#4b5563', '#8a96a8']
}

export function glyphNode(glyph: string): IconNode {
  return icon(GLYPHS[glyph] ?? 'Box')
}

/** Draw an instance icon to a PNG (data: URL). This is what the official launcher shows. */
export async function renderIconPng(i: InstanceIcon, imageSrc?: string, size = 128): Promise<string> {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')!
  const r = size * 0.22

  if (i.kind === 'image' && imageSrc) {
    const img = await loadImage(imageSrc)
    // Cover-crop to a square.
    const s = Math.min(img.width, img.height)
    ctx.imageSmoothingEnabled = img.width >= size
    ctx.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size)
    return canvas.toDataURL('image/png')
  }

  const [from, to] = TILE_COLORS[(i as { color: string }).color] ?? TILE_COLORS.ember
  const g = ctx.createLinearGradient(0, 0, size, size)
  g.addColorStop(0, from)
  g.addColorStop(1, to)
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.roundRect(0, 0, size, size, r)
  ctx.fill()

  // Soft highlight at the top.
  const shine = ctx.createLinearGradient(0, 0, 0, size)
  shine.addColorStop(0, 'rgba(255,255,255,0.22)')
  shine.addColorStop(0.5, 'rgba(255,255,255,0)')
  ctx.fillStyle = shine
  ctx.beginPath()
  ctx.roundRect(0, 0, size, size, r)
  ctx.fill()

  const glyphSize = size * 0.56
  const svg = svgMarkup(glyphNode((i as { glyph: string }).glyph), glyphSize, 'white', 1.9)
  const img = await loadImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`)
  ctx.shadowColor = 'rgba(0,0,0,0.18)'
  ctx.shadowBlur = size * 0.04
  ctx.shadowOffsetY = size * 0.015
  ctx.drawImage(img, (size - glyphSize) / 2, (size - glyphSize) / 2, glyphSize, glyphSize)
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

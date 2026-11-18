import type { Instance } from '@shared/types'
import { LOADERS } from '@shared/loaders'

export function timeAgo(when: string | number | undefined): string {
  if (!when) return 'Never played'
  const t = typeof when === 'number' ? when : Date.parse(when)
  if (!t || Number.isNaN(t)) return 'Never played'
  const s = Math.round((Date.now() - t) / 1000)
  if (s < 60) return 'Just now'
  const m = Math.round(s / 60)
  if (m < 60) return `${m} min ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h} h ago`
  const d = Math.round(h / 24)
  if (d === 1) return 'Yesterday'
  if (d < 7) return `${d} days ago`
  if (d < 30) return `${Math.round(d / 7)} wk ago`
  return new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: d > 300 ? 'numeric' : undefined })
}

export function dateTime(t: number): string {
  return new Date(t).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

export function bytes(n: number): string {
  if (n < 1024) return `${n} B`
  const units = ['KB', 'MB', 'GB']
  let v = n / 1024
  let i = 0
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i++
  }
  return `${v < 10 ? v.toFixed(1) : Math.round(v)} ${units[i]}`
}

export function memory(mb: number): string {
  return mb % 1024 === 0 ? `${mb / 1024} GB` : `${(mb / 1024).toFixed(1)} GB`
}

export function loaderLabel(i: Pick<Instance, 'loader' | 'loaderVersion'>): string {
  return LOADERS[i.loader]?.label ?? 'Modded'
}

export function plural(n: number, word: string, many = `${word}s`): string {
  return `${n} ${n === 1 ? word : many}`
}

/** Split text with § formatting codes into styled runs. */
const MC_COLORS: Record<string, string> = {
  '0': '#000000', '1': '#0000AA', '2': '#00AA00', '3': '#00AAAA', '4': '#AA0000', '5': '#AA00AA', '6': '#FFAA00', '7': '#AAAAAA',
  '8': '#555555', '9': '#5555FF', a: '#55FF55', b: '#55FFFF', c: '#FF5555', d: '#FF55FF', e: '#FFFF55', f: '#FFFFFF'
}

export interface McRun {
  text: string
  color?: string
  bold?: boolean
  italic?: boolean
  underline?: boolean
  strike?: boolean
}

export function parseMcText(input: string): McRun[] {
  const runs: McRun[] = []
  let style: Omit<McRun, 'text'> = {}
  for (const [i, part] of input.split('§').entries()) {
    if (i === 0) {
      if (part) runs.push({ text: part, ...style })
      continue
    }
    const code = part[0]?.toLowerCase()
    const text = part.slice(1)
    if (code && MC_COLORS[code]) style = { color: MC_COLORS[code] }
    else if (code === 'l') style = { ...style, bold: true }
    else if (code === 'o') style = { ...style, italic: true }
    else if (code === 'n') style = { ...style, underline: true }
    else if (code === 'm') style = { ...style, strike: true }
    else if (code === 'r') style = {}
    if (text) runs.push({ text, ...style })
  }
  return runs
}

export function stripMc(input: string): string {
  return input.replace(/§./g, '')
}

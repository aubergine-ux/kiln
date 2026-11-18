import { app } from './state.svelte'

/** Apply theme, accent and motion settings to the document and the window controls. */
export function applyTheme(): void {
  const s = app.settings
  if (!s) return
  const media = window.matchMedia('(prefers-color-scheme: dark)')
  const dark = s.theme === 'dark' || (s.theme === 'system' && media.matches)
  app.dark = dark
  const root = document.documentElement
  root.dataset.theme = dark ? 'dark' : 'light'
  root.dataset.accent = s.accent
  root.dataset.motion = s.reduceMotion ? 'reduced' : 'full'
  window.kiln.setTitleBar({ color: '#00000000', symbolColor: dark ? '#e9e1d6' : '#3b2f25' })
}

export function watchSystemTheme(): void {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme)
}

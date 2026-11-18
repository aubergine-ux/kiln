import { isMac } from './api'

/** Keyboard shortcuts, listed in the help dialog (press ?). */
export const SHORTCUTS: { keys: string; label: string }[] = [
  { keys: 'Mod+K', label: 'Search instances' },
  { keys: 'Mod+N', label: 'New instance' },
  { keys: 'Mod+I', label: 'Import modpack or instance' },
  { keys: 'Mod+Enter', label: 'Play the open (or most recent) instance' },
  { keys: 'Mod+,', label: 'Settings' },
  { keys: 'Mod+1 … 8', label: 'Switch instance tabs' },
  { keys: 'Mod+F', label: 'Search inside a tab or log' },
  { keys: 'Esc', label: 'Close / go back' },
  { keys: '?', label: 'Show shortcuts' }
]

export function displayKeys(keys: string): string[] {
  return keys.split('+').map((k) => (k === 'Mod' ? (isMac ? '⌘' : 'Ctrl') : k))
}

export function isMod(e: KeyboardEvent): boolean {
  return isMac ? e.metaKey : e.ctrlKey
}

export function isTyping(e: KeyboardEvent): boolean {
  const t = e.target as HTMLElement
  return t?.tagName === 'INPUT' || t?.tagName === 'TEXTAREA' || t?.tagName === 'SELECT' || t?.isContentEditable
}

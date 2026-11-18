import type { GameVersion, Instance, LauncherStatus, Progress, Settings } from '@shared/types'
import { api, ApiError, onEvent } from './api'
import { renderIconPng } from './icons'

/**
 * App-wide state. Components read these objects directly; Svelte keeps the UI in sync.
 */

export type Tab = 'mods' | 'resourcepacks' | 'shaderpacks' | 'datapacks' | 'worlds' | 'screenshots' | 'logs' | 'settings'
export type Route = { view: 'home' } | { view: 'settings' } | { view: 'instance'; id: string; tab: Tab }

export const app = $state({
  ready: false,
  settings: null as Settings | null,
  instances: [] as Instance[],
  versions: [] as GameVersion[],
  launcher: null as LauncherStatus | null,
  route: { view: 'home' } as Route,
  search: '',
  /** Home screen: only show this folder (null = all). */
  folder: null as string | null,
  progress: {} as Record<string, Progress>,
  dark: false
})

export function navigate(route: Route): void {
  app.route = route
}

export function openInstance(id: string, tab: Tab = 'mods'): void {
  navigate({ view: 'instance', id, tab })
}

export const current = {
  get instance(): Instance | undefined {
    const r = app.route
    return r.view === 'instance' ? app.instances.find((i) => i.id === r.id) : undefined
  }
}

// ---------- Toasts ----------

export interface Toast {
  id: number
  kind: 'ok' | 'error' | 'info' | 'warn'
  title: string
  body?: string
  action?: { label: string; run: () => void }
}

export const toasts = $state<Toast[]>([])
let toastId = 0

export function toast(kind: Toast['kind'], title: string, body?: string, action?: Toast['action']): void {
  const id = ++toastId
  toasts.push({ id, kind, title, body, action })
  setTimeout(() => dismissToast(id), kind === 'error' ? 9000 : 4500)
}

export function dismissToast(id: number): void {
  const i = toasts.findIndex((t) => t.id === id)
  if (i >= 0) toasts.splice(i, 1)
}

/** Show an error from any failed action, with its "how to fix" hint. */
export function showError(err: unknown, title?: string): void {
  const e = err as ApiError
  toast('error', title ?? e.message ?? 'Something went wrong', title ? e.message + (e.hint ? `\n${e.hint}` : '') : e.hint)
}

/** Run an action and report failures as a toast. Returns undefined on failure. */
export async function attempt<T>(fn: () => Promise<T>, errorTitle?: string): Promise<T | undefined> {
  try {
    return await fn()
  } catch (e) {
    showError(e, errorTitle)
    return undefined
  }
}

// ---------- Confirm dialogs ----------

export interface ConfirmRequest {
  title: string
  body?: string
  confirm: string
  danger?: boolean
  /** Optional third choice, e.g. "Keep both". */
  alt?: string
  resolve: (choice: 'confirm' | 'alt' | 'cancel') => void
}

export const dialogs = $state({ confirm: null as ConfirmRequest | null })

export function confirm(opts: Omit<ConfirmRequest, 'resolve'>): Promise<'confirm' | 'alt' | 'cancel'> {
  return new Promise((resolve) => {
    dialogs.confirm = {
      ...opts,
      resolve: (c) => {
        dialogs.confirm = null
        resolve(c)
      }
    }
  })
}

// ---------- Loading data ----------

let refreshing: Promise<void> | null = null
let again = false

/** Reload the instance list. Calls that arrive while a reload is running are merged into one more. */
export function refreshInstances(): Promise<void> {
  if (refreshing) {
    again = true
    return refreshing
  }
  refreshing = loadInstances().finally(() => {
    refreshing = null
    if (again) {
      again = false
      refreshInstances()
    }
  })
  return refreshing
}

async function loadInstances(): Promise<void> {
  app.instances = await api.instances.list()
  // Instances made by an import have no icon picture yet; draw one so the launcher shows it too.
  for (const inst of app.instances) {
    if (!inst.iconUrl && inst.icon.kind === 'glyph') {
      const png = await renderIconPng(inst.icon)
      const updated = await api.instances.setIcon(inst.id, inst.icon, png).catch(() => null)
      if (updated) replaceInstance(updated)
    }
  }
}

export function replaceInstance(inst: Instance): void {
  const i = app.instances.findIndex((x) => x.id === inst.id)
  if (i >= 0) app.instances[i] = inst
  else app.instances.push(inst)
}

export async function refreshVersions(): Promise<void> {
  app.versions = await api.versions.list()
}

export async function refreshLauncher(): Promise<void> {
  app.launcher = await api.launcher.status()
}

export async function saveSettings(patch: Partial<Settings>): Promise<void> {
  app.settings = await api.settings.update(patch)
}

export async function init(): Promise<void> {
  app.settings = await api.settings.get()
  if (app.settings.setupComplete) await Promise.all([refreshInstances(), refreshVersions(), refreshLauncher()])
  app.ready = true

  onEvent('progress', (p) => {
    const prog = p as Progress
    if (prog.finished) delete app.progress[prog.task]
    else app.progress[prog.task] = prog
  })
  onEvent('versions-changed', async () => {
    await refreshVersions()
    await refreshInstances()
  })
  onEvent('instances-changed', () => refreshInstances())

  // Pick up changes made outside Kiln (a loader installer, the game itself) when the window comes back.
  window.addEventListener('focus', () => {
    if (!app.settings?.setupComplete) return
    refreshVersions().then(refreshInstances)
    refreshLauncher()
  })
}

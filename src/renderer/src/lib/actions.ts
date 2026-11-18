import type { Instance } from '@shared/types'
import { LOADERS } from '@shared/loaders'
import { api } from './api'
import { openModal } from './modals.svelte'
import type { MenuItem } from './menu.svelte'
import { app, attempt, confirm, navigate, openInstance, refreshInstances, refreshLauncher, replaceInstance, toast } from './state.svelte'

/** Actions used from several places (cards, the instance page, shortcuts). */

export async function play(inst: Instance): Promise<void> {
  if (!inst.versionInstalled) {
    const loader = LOADERS[inst.loader]?.label ?? 'The mod loader'
    const choice = await confirm({
      title: `${loader} isn't installed yet`,
      body: `The launcher can't start "${inst.versionId}" until it's installed. The Settings tab has the steps.`,
      confirm: 'Show the steps',
      alt: 'Play anyway'
    })
    if (choice === 'confirm') return navigate({ view: 'instance', id: inst.id, tab: 'settings' })
    if (choice === 'cancel') return
  }
  const result = await attempt(() => api.instances.play(inst.id), "Couldn't open the official launcher")
  if (!result) return
  toast(
    'ok',
    `Opening the launcher with "${inst.name}"`,
    result.launcherWasRunning
      ? 'The launcher was already open. If the profile is not selected, close the launcher and press Play again.'
      : 'It is selected on the Play tab. Sign in if asked, then press Play there.'
  )
  await refreshInstances()
  await refreshLauncher()
}

async function togglePin(inst: Instance): Promise<void> {
  const updated = await attempt(() => api.instances.update(inst.id, { pinned: !inst.pinned }))
  if (updated) replaceInstance(updated)
}

export async function moveToGroup(inst: Instance, group: string | undefined): Promise<void> {
  if ((inst.group ?? '') === (group ?? '')) return
  const updated = await attempt(() => api.instances.update(inst.id, { group: group ?? '' }))
  if (updated) {
    replaceInstance(updated)
    toast('ok', group ? `Moved to ${group}` : 'Removed from folder')
  }
}

export async function duplicate(inst: Instance): Promise<void> {
  const copy = await attempt(() => api.instances.duplicate(inst.id))
  if (copy) {
    replaceInstance(copy)
    toast('ok', `Duplicated "${inst.name}"`)
  }
}

export async function remove(inst: Instance): Promise<void> {
  const choice = await confirm({
    title: `Delete "${inst.name}"?`,
    body: 'Its folder goes to the trash, including worlds and screenshots, and its profile is removed from the official launcher.',
    confirm: 'Delete',
    danger: true
  })
  if (choice !== 'confirm') return
  const ok = await attempt(() => api.instances.remove(inst.id).then(() => true))
  if (!ok) return
  if (app.route.view === 'instance') navigate({ view: 'home' })
  app.instances = app.instances.filter((i) => i.id !== inst.id)
  toast('ok', `Deleted "${inst.name}"`, 'You can restore it from the trash.')
}

export function exportInstance(inst: Instance): void {
  openModal({ kind: 'export', instance: inst })
}

/** The "…" / right-click menu for an instance. */
export function instanceMenu(i: Instance): MenuItem[] {
  const groups = app.settings?.groups ?? []
  return [
    { label: 'Play', icon: 'Play', run: () => play(i) },
    { label: 'Open', icon: 'ArrowRight', run: () => openInstance(i.id) },
    { separator: true, label: '' },
    { label: i.pinned ? 'Unpin' : 'Pin to top', icon: i.pinned ? 'PinOff' : 'Pin', run: () => togglePin(i) },
    { label: 'Change icon…', icon: 'Palette', run: () => openModal({ kind: 'icon', instance: i }) },
    { label: 'Rename', icon: 'Pencil', run: () => openInstance(i.id, 'settings') },
    { label: 'Duplicate', icon: 'Copy', run: () => duplicate(i) },
    { label: 'Open folder', icon: 'FolderOpen', run: () => api.instances.openFolder(i.id) },
    { label: 'Export…', icon: 'Upload', run: () => exportInstance(i) },
    ...(groups.length
      ? [
          { separator: true, label: '' },
          { label: 'Move to folder', heading: true },
          { label: 'No folder', checked: !i.group, run: () => moveToGroup(i, undefined) },
          ...groups.map((g) => ({ label: g, checked: i.group === g, icon: 'Folder', run: () => moveToGroup(i, g) }))
        ]
      : []),
    { separator: true, label: '' },
    { label: 'Delete', icon: 'Trash2', danger: true, run: () => remove(i) }
  ]
}

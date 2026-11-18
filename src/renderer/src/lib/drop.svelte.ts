import type { ContentKind } from '@shared/types'
import { api } from './api'
import { openModal } from './modals.svelte'
import { app, attempt, refreshInstances, toast } from './state.svelte'

/**
 * Files dropped anywhere in Kiln end up here. We look inside each file to work out
 * what it is (mod, pack, world, modpack) and put it in the right place.
 */

export const dropState = $state({
  /** Data packs tab sets the world it is showing, so drops can go there. */
  datapackWorld: null as string | null,
  /** Bumped after a drop so open tabs reload. */
  version: 0
})

const KIND_LABEL: Record<string, string> = {
  mods: 'mod',
  resourcepacks: 'resource pack',
  shaderpacks: 'shader pack',
  datapacks: 'data pack',
  world: 'world'
}

export async function dropFiles(paths: string[], instanceId?: string): Promise<void> {
  if (!paths.length) return
  const classified = await attempt(() => api.content.classify(paths))
  if (!classified) return

  const modpacks = classified.filter((c) => c.kind === 'modpack')
  if (modpacks.length) openModal({ kind: 'import', file: modpacks[0].path })

  // A folder from another launcher dropped on the home screen.
  const unknown = classified.filter((c) => c.kind === 'unknown')
  if (!instanceId) {
    for (const u of unknown) {
      const found = await api.importers.scanFolder(u.path).catch(() => null)
      if (found?.length) {
        openModal({ kind: 'import' })
        return
      }
    }
    const content = classified.filter((c) => c.kind !== 'modpack')
    if (content.length) toast('info', 'Open an instance first', 'Drop mods and packs onto an instance, or open one and drop them there.')
    return
  }

  const counts: Record<string, number> = {}
  for (const c of classified) {
    if (c.kind === 'modpack') continue
    if (c.kind === 'unknown') {
      toast('warn', `Kiln can't tell what "${c.path.split(/[\\/]/).pop()}" is`, "It doesn't look like a mod, pack, world or modpack.")
      continue
    }
    let ok: unknown
    if (c.kind === 'world') ok = await attempt(() => api.worlds.import(instanceId, c.path))
    else if (c.kind === 'datapacks') {
      if (!dropState.datapackWorld) {
        toast('info', 'Pick a world for this data pack', 'Data packs live inside a world. Open the Data packs tab, pick a world and drop it there.')
        continue
      }
      ok = await attempt(() => api.content.install(instanceId, 'datapacks', [c.path], dropState.datapackWorld!))
    } else ok = await attempt(() => api.content.install(instanceId, c.kind as ContentKind, [c.path]))
    if (ok) counts[c.kind] = (counts[c.kind] ?? 0) + 1
  }

  const parts = Object.entries(counts).map(([k, n]) => `${n} ${KIND_LABEL[k]}${n === 1 ? '' : 's'}`)
  if (parts.length) {
    const name = app.instances.find((i) => i.id === instanceId)?.name
    toast('ok', `Added ${parts.join(', ')}`, name ? `to ${name}` : undefined)
    dropState.version++
    await refreshInstances()
  }
}

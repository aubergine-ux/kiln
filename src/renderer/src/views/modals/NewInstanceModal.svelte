<script lang="ts">
  import type { InstanceIcon } from '@shared/types'
  import { api } from '@/lib/api'
  import { renderIconPng } from '@/lib/icons'
  import { app, attempt, openInstance, replaceInstance, toast } from '@/lib/state.svelte'
  import Modal from '@/components/Modal.svelte'
  import IconPicker from '@/components/IconPicker.svelte'
  import VersionPicker, { type Choice } from '@/components/VersionPicker.svelte'
  import InstanceIcon_ from '@/components/InstanceIcon.svelte'
  import Icon from '@/components/Icon.svelte'

  let { onclose }: { onclose: () => void } = $props()

  const GLYPH_KEYS = ['pickaxe', 'sword', 'tree', 'gem', 'flame', 'castle', 'mountain', 'compass', 'rocket', 'sprout']
  const COLOR_KEYS = ['ember', 'rose', 'violet', 'sky', 'teal', 'moss', 'sand']
  const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)]

  let name = $state('')
  let icon = $state<InstanceIcon>({ kind: 'glyph', glyph: pick(GLYPH_KEYS), color: pick(COLOR_KEYS) })
  let imageUrl = $state<string>()
  let showIcons = $state(false)
  let group = $state(app.folder ?? '')
  let creating = $state(false)

  const firstVanilla = app.versions.find((v) => v.loader === 'vanilla')
  let version = $state<Choice>(
    firstVanilla
      ? { versionId: firstVanilla.id, loader: 'vanilla', mcVersion: firstVanilla.mcVersion, installed: true }
      : { versionId: 'latest-release', loader: 'vanilla', mcVersion: 'Latest release', installed: true }
  )

  const suggested = $derived(
    `${version.mcVersion.startsWith('Latest') ? 'Survival' : version.mcVersion}${version.loader !== 'vanilla' ? ` ${version.loader[0].toUpperCase()}${version.loader.slice(1)}` : ''}`
  )
  const valid = $derived(!!version.versionId && !!version.mcVersion)

  async function create() {
    if (!valid || creating) return
    creating = true
    const inst = await attempt(
      () =>
        api.instances.create({
          name: name.trim() || suggested,
          versionId: version.versionId,
          icon,
          group: group || undefined,
          ...(version.installed ? {} : { loader: version.loader, mcVersion: version.mcVersion })
        }),
      "Couldn't create the instance"
    )
    if (!inst) {
      creating = false
      return
    }
    const png = await renderIconPng(icon, imageUrl).catch(() => null)
    const withIcon = png ? await api.instances.setIcon(inst.id, icon, png).catch(() => inst) : inst
    replaceInstance(withIcon)
    toast('ok', `Created "${inst.name}"`, 'A matching profile was added to the official launcher.')
    onclose()
    openInstance(inst.id)
  }
</script>

<Modal title="New instance" subtitle="A separate setup with its own mods, worlds and settings." {onclose} width={600}>
  <div class="top">
    <button class="icon-btn" title="Change icon" onclick={() => (showIcons = !showIcons)}>
      <InstanceIcon_ {icon} url={icon.kind === 'image' ? imageUrl : undefined} size={64} />
      <span class="edit"><Icon name="Pencil" size={12} /></span>
    </button>
    <div class="name">
      <label class="label" for="new-name">Name</label>
      <!-- svelte-ignore a11y_autofocus -->
      <input id="new-name" class="input" bind:value={name} placeholder={suggested} autofocus onkeydown={(e) => e.key === 'Enter' && create()} />
    </div>
  </div>

  {#if showIcons}
    <div class="icons"><IconPicker bind:value={icon} bind:imageUrl /></div>
  {/if}

  <div class="field">
    <span class="label">Game version</span>
    <VersionPicker bind:value={version} />
  </div>

  {#if app.settings?.groups.length}
    <div class="field">
      <label class="label" for="new-group">Folder</label>
      <select id="new-group" class="input" bind:value={group}>
        <option value="">No folder</option>
        {#each app.settings.groups as g (g)}<option value={g}>{g}</option>{/each}
      </select>
    </div>
  {/if}

  {#snippet footer()}
    <button class="btn" onclick={onclose}>Cancel</button>
    <button class="btn primary" disabled={!valid || creating} onclick={create}>
      {#if creating}<Icon name="LoaderCircle" size={16} class="spin" />{:else}<Icon name="Plus" size={16} stroke={2.4} />{/if}
      Create instance
    </button>
  {/snippet}
</Modal>

<style>
  .top {
    display: flex;
    align-items: flex-end;
    gap: 16px;
  }
  .icon-btn {
    position: relative;
    border: none;
    background: none;
    padding: 0;
    border-radius: 18px;
  }
  .edit {
    position: absolute;
    right: -5px;
    bottom: -5px;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    background: var(--surface);
    border: 1px solid var(--border);
    color: var(--text-2);
  }
  .name {
    flex: 1;
  }
  .icons {
    margin-top: 16px;
    padding: 16px;
    border-radius: 14px;
    background: var(--surface-2);
    animation: pop-in 200ms var(--ease);
  }
  .field {
    margin-top: 18px;
  }
</style>

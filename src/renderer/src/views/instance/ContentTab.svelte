<script lang="ts">
  import { onMount, untrack } from 'svelte'
  import { flip } from 'svelte/animate'
  import type { ContentItem, ContentKind, Instance, World } from '@shared/types'
  import { LOADERS } from '@shared/loaders'
  import { api } from '@/lib/api'
  import { attempt, confirm, navigate, refreshInstances, toast } from '@/lib/state.svelte'
  import { dropState } from '@/lib/drop.svelte'
  import { openMenuAt } from '@/lib/menu.svelte'
  import { bytes, stripMc } from '@/lib/format'
  import { isMod } from '@/lib/shortcuts'
  import Icon from '@/components/Icon.svelte'
  import Toggle from '@/components/Toggle.svelte'
  import McText from '@/components/McText.svelte'
  import EmptyState from '@/components/EmptyState.svelte'

  let { instance: inst, kind }: { instance: Instance; kind: ContentKind } = $props()

  const COPY: Record<ContentKind, { one: string; many: string; icon: string; empty: string; body: string; ext: string[]; folder: string }> = {
    mods: {
      one: 'mod',
      many: 'mods',
      icon: 'Puzzle',
      empty: 'No mods yet',
      body: 'Drag .jar files here or click Add mods. A newer version of a mod you already have replaces the old file.',
      ext: ['jar'],
      folder: 'mods'
    },
    resourcepacks: {
      one: 'resource pack',
      many: 'resource packs',
      icon: 'Palette',
      empty: 'No resource packs yet',
      body: 'Drag .zip files here, then turn them on in the game under Options, Resource Packs.',
      ext: ['zip'],
      folder: 'resourcepacks'
    },
    shaderpacks: {
      one: 'shader pack',
      many: 'shader packs',
      icon: 'Aperture',
      empty: 'No shader packs yet',
      body: 'Drag .zip files here. Shaders also need a shader mod such as Iris or OptiFine.',
      ext: ['zip'],
      folder: 'shaderpacks'
    },
    datapacks: {
      one: 'data pack',
      many: 'data packs',
      icon: 'Package',
      empty: 'No data packs in this world',
      body: 'Drag .zip files here to add them to the world picked above.',
      ext: ['zip'],
      folder: 'saves'
    }
  }
  const copy = $derived(COPY[kind])

  let items = $state<ContentItem[]>([])
  let loading = $state(true)
  let query = $state('')
  let show = $state<'all' | 'on' | 'off'>('all')
  let worlds = $state<World[]>([])
  let world = $state<string | null>(null)
  let searchEl = $state<HTMLInputElement>()

  async function load() {
    if (kind === 'datapacks') {
      if (!worlds.length) worlds = (await attempt(() => api.worlds.list(inst.id))) ?? []
      if (!world && worlds.length) world = worlds[0].folder
      dropState.datapackWorld = world
      if (!world) {
        items = []
        loading = false
        return
      }
    }
    items = (await attempt(() => api.content.list(inst.id, kind, world ?? undefined))) ?? []
    loading = false
  }

  onMount(() => () => (dropState.datapackWorld = null))

  // Load now, and again after files are dropped anywhere on the window.
  $effect(() => {
    void dropState.version
    untrack(load)
  })

  const q = $derived(query.trim().toLowerCase())
  const filtered = $derived(
    items.filter(
      (i) =>
        (show === 'all' || (show === 'on') === i.enabled) &&
        (!q || [i.name, i.file, i.id ?? '', i.description ?? '', ...(i.authors ?? [])].some((f) => f.toLowerCase().includes(q)))
    )
  )
  const disabledCount = $derived(items.filter((i) => !i.enabled).length)

  async function toggle(item: ContentItem, enabled: boolean) {
    const old = item.enabled
    item.enabled = enabled
    const ok = await attempt(() => api.content.setEnabled(inst.id, kind, item.file, enabled, world ?? undefined).then(() => true))
    if (!ok) item.enabled = old
    await load()
    if (kind === 'mods') refreshInstances()
  }

  async function removeItem(item: ContentItem) {
    const c = await confirm({ title: `Delete ${item.name}?`, body: `The file goes to the trash.`, confirm: 'Delete', danger: true })
    if (c !== 'confirm') return
    const ok = await attempt(() => api.content.remove(inst.id, kind, [item.file], world ?? undefined).then(() => true))
    if (ok) {
      items = items.filter((i) => i.file !== item.file)
      toast('ok', `Deleted ${item.name}`)
      if (kind === 'mods') refreshInstances()
    }
  }

  async function add() {
    const files = await api.dialog.pickFiles(`Add ${copy.many}`, [{ name: copy.many, extensions: copy.ext }])
    if (!files.length) return
    const added = await attempt(() => api.content.install(inst.id, kind, files, world ?? undefined))
    if (added?.length) {
      toast('ok', `Added ${added.length} ${added.length === 1 ? copy.one : copy.many}`)
      await load()
      if (kind === 'mods') refreshInstances()
    }
  }

  function rowMenu(e: MouseEvent, item: ContentItem) {
    openMenuAt(e, [
      { label: item.enabled ? 'Disable' : 'Enable', icon: item.enabled ? 'EyeOff' : 'Eye', run: () => toggle(item, !item.enabled) },
      { label: 'Show in folder', icon: 'FolderOpen', run: () => api.instances.openFolder(inst.id, kind === 'datapacks' ? `saves/${world}/datapacks` : copy.folder) },
      { separator: true, label: '' },
      { label: 'Delete', icon: 'Trash2', danger: true, run: () => removeItem(item) }
    ])
  }

  const wrongLoader = (item: ContentItem) =>
    kind === 'mods' &&
    item.loader &&
    inst.loader !== 'vanilla' &&
    inst.loader !== 'other' &&
    item.loader !== inst.loader &&
    // Quilt runs most Fabric mods, and NeoForge 1.20.1 still reads Forge's mods.toml.
    !(inst.loader === 'quilt' && item.loader === 'fabric') &&
    !(inst.loader === 'neoforge' && item.loader === 'forge')

  function onkeydown(e: KeyboardEvent) {
    if (isMod(e) && e.key.toLowerCase() === 'f') {
      e.preventDefault()
      searchEl?.focus()
    }
  }
</script>

<svelte:window {onkeydown} />

<div class="toolbar">
  {#if kind === 'datapacks' && worlds.length}
    <label class="world-pick">
      <Icon name="Globe" size={16} />
      <select class="input" bind:value={world} onchange={() => load()} aria-label="World">
        {#each worlds as w (w.folder)}<option value={w.folder}>{stripMc(w.name)}</option>{/each}
      </select>
    </label>
  {/if}
  <div class="search">
    <Icon name="Search" size={15} />
    <input bind:this={searchEl} bind:value={query} placeholder="Search {copy.many}" />
  </div>
  <div class="seg" role="radiogroup" aria-label="Show">
    <button class:on={show === 'all'} onclick={() => (show = 'all')}>All <span>{items.length}</span></button>
    <button class:on={show === 'on'} onclick={() => (show = 'on')}>Enabled</button>
    <button class:on={show === 'off'} onclick={() => (show = 'off')}>Disabled {#if disabledCount}<span>{disabledCount}</span>{/if}</button>
  </div>
  <div class="spacer"></div>
  <button class="btn" disabled={kind === 'datapacks' && !world} onclick={() => api.instances.openFolder(inst.id, kind === 'datapacks' ? `saves/${world}/datapacks` : copy.folder)}>Open folder</button>
  <button class="btn primary" disabled={kind === 'datapacks' && !world} onclick={add}><Icon name="Plus" size={16} /> Add {copy.many}</button>
</div>

<div class="list-wrap">
  {#if kind === 'mods' && inst.loader === 'vanilla' && items.length > 0}
    <div class="note">
      <Icon name="Info" size={16} />
      Vanilla can't load mods.
      <button class="link" onclick={() => navigate({ view: 'instance', id: inst.id, tab: 'settings' })}>Choose a mod loader</button>
    </div>
  {/if}

  {#if kind === 'datapacks' && !worlds.length && !loading}
    <EmptyState art="world" title="No worlds yet" body="Data packs live inside a world. Create one in the game or add one on the Worlds tab first." />
  {:else if !loading && items.length === 0}
    <EmptyState art="crate" title={copy.empty} body={copy.body}>
      <button class="btn primary" onclick={add}><Icon name="Plus" size={16} /> Add {copy.many}</button>
      {#if kind === 'mods' && inst.loader === 'vanilla'}
        <button class="btn" onclick={() => navigate({ view: 'instance', id: inst.id, tab: 'settings' })}>Set up a mod loader</button>
      {/if}
    </EmptyState>
  {:else if !loading && filtered.length === 0}
    <EmptyState art="search" title="Nothing matches" body="Try another search, or show all {copy.many}.">
      <button class="btn" onclick={() => ((query = ''), (show = 'all'))}>Clear filters</button>
    </EmptyState>
  {:else}
    <ul class="list panel">
      {#each filtered as item (item.file)}
        <li class:off={!item.enabled} animate:flip={{ duration: 160 }} oncontextmenu={(e) => (e.preventDefault(), rowMenu(e, item))}>
          <div class="thumb slot">
            {#if item.iconUrl}<img src={item.iconUrl} alt="" draggable="false" />{:else}<Icon name={item.isFolder ? 'Folder' : copy.icon} size={22} stroke={1.7} />{/if}
          </div>
          <div class="text">
            <div class="line1">
              <span class="name" title={stripMc(item.name)}>{#if kind === 'mods'}{item.name}{:else}<McText text={item.name} />{/if}</span>
              {#if item.version}<span class="ver">{item.version}</span>{/if}
              {#if wrongLoader(item)}<span class="chip warn" title="This mod is made for a different loader">{LOADERS[item.loader!].label} mod</span>{/if}
            </div>
            {#if item.description}
              <div class="desc">{#if kind === 'mods'}{item.description}{:else}<McText text={item.description} />{/if}</div>
            {/if}
            <div class="file">{item.file.replace(/^\.disabled\//, '')}{item.authors?.length ? ` · by ${item.authors.slice(0, 3).join(', ')}` : ''}{item.isFolder ? '' : ` · ${bytes(item.size)}`}</div>
          </div>
          <Toggle checked={item.enabled} label={item.enabled ? `Disable ${item.name}` : `Enable ${item.name}`} onchange={(v) => toggle(item, v)} />
          <button class="btn ghost icon sm" aria-label="More" onclick={(e) => rowMenu(e, item)}><Icon name="Ellipsis" size={17} /></button>
        </li>
      {/each}
    </ul>
    <p class="drop-hint">You can also drag {copy.many} anywhere onto this window.</p>
  {/if}
</div>

<style>
  .toolbar {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 16px 28px 12px;
    flex-wrap: wrap;
  }
  .search {
    display: flex;
    align-items: center;
    gap: 7px;
    height: 34px;
    width: 230px;
    padding: 0 10px;
    border-radius: var(--r-2);
    border: 1px solid var(--border-strong);
    background: var(--surface);
    color: var(--muted);
  }
  .search:focus-within {
    border-color: var(--accent);
    box-shadow: 0 0 0 3px var(--accent-soft);
  }
  .search input {
    flex: 1;
    min-width: 0;
    border: none;
    outline: none;
    background: none;
    user-select: text;
  }
  .world-pick {
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--muted);
  }
  .world-pick select {
    width: 220px;
    height: 34px;
  }
  .seg {
    display: flex;
    padding: 2px;
    border-radius: var(--r-2);
    background: var(--surface-3);
  }
  .seg button {
    height: 28px;
    padding: 0 10px;
    border: none;
    border-radius: var(--r-1);
    background: none;
    color: var(--text-2);
    font-weight: 600;
    font-size: 13px;
    display: inline-flex;
    gap: 6px;
    align-items: center;
  }
  .seg button.on {
    background: var(--surface);
    color: var(--text);
    box-shadow: var(--shadow);
  }
  .seg span {
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--muted);
  }
  .spacer {
    flex: 1;
  }
  .list-wrap {
    flex: 1;
    overflow: auto;
    padding: 0 28px 40px;
  }
  .note {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 9px 12px;
    margin-bottom: 10px;
    border-radius: var(--r-2);
    background: color-mix(in oklab, var(--info) 9%, var(--surface));
    color: var(--text-2);
    font-size: 13px;
  }
  .link {
    border: none;
    background: none;
    color: var(--accent-text);
    font-weight: 600;
    padding: 0;
  }
  .list {
    list-style: none;
    margin: 0;
    padding: 0;
    overflow: hidden;
  }
  li {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 10px 8px 12px;
    background: var(--surface);
    transition: background var(--fast);
  }
  li + li {
    border-top: 1px solid var(--border);
  }
  li:hover {
    background: var(--surface-2);
  }
  li.off .thumb,
  li.off .text {
    opacity: 0.45;
  }
  .thumb {
    width: 40px;
    height: 40px;
    flex-shrink: 0;
    display: grid;
    place-items: center;
    padding: 4px;
    color: var(--muted);
  }
  .thumb img {
    width: 32px;
    height: 32px;
    object-fit: cover;
    image-rendering: pixelated;
  }
  .text {
    flex: 1;
    min-width: 0;
  }
  .line1 {
    display: flex;
    align-items: baseline;
    gap: 8px;
    min-width: 0;
  }
  .name {
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .ver {
    font-family: var(--font-mono);
    font-size: 11.5px;
    color: var(--muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 180px;
  }
  .desc {
    font-size: 13px;
    color: var(--text-2);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .file {
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--muted);
    margin-top: 1px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .drop-hint {
    margin-top: 12px;
    color: var(--muted);
    font-size: 12.5px;
    text-align: center;
  }
</style>

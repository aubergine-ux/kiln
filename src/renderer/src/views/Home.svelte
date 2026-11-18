<script lang="ts">
  import type { Instance } from '@shared/types'
  import { app, openInstance, saveSettings } from '@/lib/state.svelte'
  import { openModal } from '@/lib/modals.svelte'
  import { play } from '@/lib/actions'
  import { loaderLabel, memory, plural, timeAgo } from '@/lib/format'
  import { modKey } from '@/lib/api'
  import Icon from '@/components/Icon.svelte'
  import InstanceRow from '@/components/InstanceRow.svelte'
  import InstanceIcon from '@/components/InstanceIcon.svelte'
  import KilnBand from '@/components/KilnBand.svelte'
  import EmptyState from '@/components/EmptyState.svelte'
  import TopBar from '@/components/TopBar.svelte'

  type Sort = 'recent' | 'name' | 'created'
  let sort = $state<Sort>((localStorage.getItem('kiln.sort') as Sort) || 'recent')
  $effect(() => localStorage.setItem('kiln.sort', sort))

  const byRecent = (a: Instance, b: Instance) => (b.lastPlayed ?? b.created).localeCompare(a.lastPlayed ?? a.created)
  const sorter = $derived(
    sort === 'name'
      ? (a: Instance, b: Instance) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
      : sort === 'created'
        ? (a: Instance, b: Instance) => b.created.localeCompare(a.created)
        : byRecent
  )

  const query = $derived(app.search.trim().toLowerCase())
  const matches = (i: Instance) =>
    !query || [i.name, i.mcVersion, i.loader, i.group ?? '', i.versionId].some((f) => f.toLowerCase().includes(query))

  const visible = $derived(app.instances.filter((i) => matches(i) && (app.folder === null || i.group === app.folder)).sort(sorter))
  const browsing = $derived(app.folder === null && !query)
  const groups = $derived(app.settings?.groups ?? [])
  const collapsed = $derived(new Set(app.settings?.collapsedGroups ?? []))

  const hero = $derived(browsing ? [...app.instances].filter((i) => i.lastPlayed).sort(byRecent)[0] : undefined)

  const sections = $derived.by(() => {
    if (!browsing) return [{ key: '', title: '', items: visible }]
    const out: { key: string; title: string; items: Instance[] }[] = []
    const pinned = visible.filter((i) => i.pinned)
    const rest = visible.filter((i) => !i.pinned)
    if (pinned.length) out.push({ key: '__pinned', title: 'Pinned', items: pinned })
    for (const g of groups) {
      const items = rest.filter((i) => i.group === g)
      if (items.length) out.push({ key: g, title: g, items })
    }
    const loose = rest.filter((i) => !i.group || !groups.includes(i.group))
    if (loose.length) out.push({ key: '', title: out.length ? 'Not in a folder' : '', items: loose })
    return out
  })

  function toggleSection(key: string) {
    const list = new Set(app.settings?.collapsedGroups ?? [])
    if (list.has(key)) list.delete(key)
    else list.add(key)
    saveSettings({ collapsedGroups: [...list] })
  }
</script>

<TopBar>
  <h1 class="title">{app.folder ?? 'Instances'} <span class="total">{visible.length}</span></h1>
  <div class="search no-drag">
    <Icon name="Search" size={15} />
    <input id="search" placeholder="Search  ({modKey}+K)" bind:value={app.search} onkeydown={(e) => e.key === 'Escape' && ((app.search = ''), (e.currentTarget as HTMLInputElement).blur())} />
    {#if app.search}
      <button class="btn ghost icon sm" aria-label="Clear search" onclick={() => (app.search = '')}><Icon name="X" size={14} /></button>
    {/if}
  </div>
  <select class="input sort" bind:value={sort} aria-label="Sort instances">
    <option value="recent">Recently played</option>
    <option value="name">Name</option>
    <option value="created">Newest</option>
  </select>
  <button class="btn" onclick={() => openModal({ kind: 'import' })}>Import</button>
  <button class="btn primary" onclick={() => openModal({ kind: 'new' })}><Icon name="Plus" size={15} /> New instance</button>
</TopBar>

<div class="scroll">
  {#if app.instances.length === 0}
    <EmptyState art="kiln" title="No instances yet" body="An instance is its own game folder, so its mods, worlds and settings stay apart from your other setups.">
      <button class="btn primary" onclick={() => openModal({ kind: 'new' })}><Icon name="Plus" size={16} /> New instance</button>
      <button class="btn" onclick={() => openModal({ kind: 'import' })}>Import</button>
    </EmptyState>
  {:else if visible.length === 0}
    {#if query}
      <EmptyState art="search" title="No instance matches “{app.search}”" body="Search looks at names, game versions and loaders.">
        <button class="btn" onclick={() => (app.search = '')}>Clear search</button>
      </EmptyState>
    {:else}
      <EmptyState art="folder" title="This folder is empty" body="Drag an instance onto “{app.folder}” in the sidebar to put it here.">
        <button class="btn" onclick={() => (app.folder = null)}>Show all instances</button>
      </EmptyState>
    {/if}
  {:else}
    {#if hero}
      <KilnBand>
        <button class="hero-main" onclick={() => openInstance(hero.id)}>
          <InstanceIcon icon={hero.icon} url={hero.iconUrl} size={72} />
          <div class="hero-text">
            <span class="hero-label">Last played {timeAgo(hero.lastPlayed).toLowerCase()}</span>
            <h2>{hero.name}</h2>
            <div class="hero-meta">
              <span class="chip">{hero.mcVersion}</span>
              {#if hero.loader !== 'vanilla'}<span class="chip accent">{loaderLabel(hero).toLowerCase()} {hero.loaderVersion ?? ''}</span>{/if}
              <span class="chip">{plural(hero.modCount, 'mod')}</span>
              <span class="chip">{memory(hero.memoryMb)}</span>
            </div>
          </div>
        </button>
        <button class="btn primary lg play" onclick={() => play(hero)}><Icon name="Play" size={17} /> Play</button>
      </KilnBand>
    {/if}

    <div class="table" style:--cols="30px minmax(0, 1fr) 150px 44px 96px 118px">
      <div class="head">
        <span></span>
        <span>Name</span>
        <span>Version</span>
        <span class="right">Mods</span>
        <span>Played</span>
        <span></span>
      </div>
      {#each sections as section (section.key + section.title)}
        {@const key = section.key || '__loose'}
        {#if section.title}
          <button class="group" onclick={() => toggleSection(key)} aria-expanded={!collapsed.has(key)}>
            <span class="chev" class:closed={collapsed.has(key)}><Icon name="ChevronDown" size={14} /></span>
            {section.title}
            <span class="n">{section.items.length}</span>
          </button>
        {/if}
        {#if !section.title || !collapsed.has(key)}
          {#each section.items as inst (inst.id)}<InstanceRow instance={inst} />{/each}
        {/if}
      {/each}
    </div>
  {/if}
</div>

<style>
  .title {
    font-size: 24px;
    margin-right: auto;
    flex-shrink: 0;
  }
  .total {
    font-family: var(--font-mono);
    font-size: 13px;
    font-weight: 500;
    color: var(--muted);
    margin-left: 4px;
  }
  .search {
    display: flex;
    align-items: center;
    gap: 7px;
    height: 34px;
    flex: 0 1 240px;
    min-width: 150px;
    padding: 0 6px 0 10px;
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
    color: var(--text);
    user-select: text;
  }
  .sort {
    width: 150px;
    height: 34px;
  }
  .scroll {
    flex: 1;
    overflow: auto;
    padding: 8px 28px 48px;
  }

  .hero-main {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 18px;
    border: none;
    background: none;
    padding: 0;
    text-align: left;
    color: inherit;
  }
  .hero-text {
    min-width: 0;
  }
  .hero-label {
    font-size: 12.5px;
    color: var(--band-muted);
  }
  h2 {
    font-size: 30px;
    margin: 2px 0 8px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .hero-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 14px;
  }
  .play {
    height: 48px;
    padding: 0 26px 0 20px;
    font-size: 17px;
  }

  .table {
    margin-top: 22px;
  }
  .head {
    display: grid;
    grid-template-columns: var(--cols);
    gap: 14px;
    padding: 0 8px 7px 10px;
    font-size: 12px;
    color: var(--muted);
  }
  .right {
    text-align: right;
  }
  .group {
    display: flex;
    align-items: center;
    gap: 6px;
    width: 100%;
    padding: 18px 10px 7px 6px;
    border: none;
    border-top: 1px solid var(--border);
    background: none;
    font-weight: 700;
    font-size: 13px;
    color: var(--text);
    text-align: left;
  }
  .chev {
    display: inline-flex;
    color: var(--muted);
    transition: transform var(--med) var(--ease);
  }
  .chev.closed {
    transform: rotate(-90deg);
  }
  .n {
    font-family: var(--font-mono);
    font-weight: 500;
    font-size: 11.5px;
    color: var(--muted);
  }
</style>

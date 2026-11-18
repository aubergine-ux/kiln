<script lang="ts">
  import type { Instance } from '@shared/types'
  import { app, saveSettings } from '@/lib/state.svelte'
  import { openModal } from '@/lib/modals.svelte'
  import { play } from '@/lib/actions'
  import { loaderLabel, plural, timeAgo } from '@/lib/format'
  import { modKey } from '@/lib/api'
  import Icon from '@/components/Icon.svelte'
  import InstanceCard from '@/components/InstanceCard.svelte'
  import InstanceIcon from '@/components/InstanceIcon.svelte'
  import EmptyState from '@/components/EmptyState.svelte'
  import TopBar from '@/components/TopBar.svelte'
  import { openInstance } from '@/lib/state.svelte'

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
  const pinned = $derived(visible.filter((i) => i.pinned))
  const groups = $derived(app.settings?.groups ?? [])
  const collapsed = $derived(new Set(app.settings?.collapsedGroups ?? []))

  /** On "All instances" with no search, show a big card for the last played instance. */
  const hero = $derived(
    app.folder === null && !query && app.instances.length > 0 ? [...app.instances].filter((i) => i.lastPlayed).sort(byRecent)[0] : undefined
  )

  const sections = $derived.by(() => {
    if (app.folder !== null || query) return [{ key: '', title: '', items: visible }]
    const rest = visible.filter((i) => !i.pinned)
    const out: { key: string; title: string; items: Instance[] }[] = []
    for (const g of groups) {
      const items = rest.filter((i) => i.group === g)
      if (items.length) out.push({ key: g, title: g, items })
    }
    const loose = rest.filter((i) => !i.group || !groups.includes(i.group))
    if (loose.length) out.push({ key: '', title: out.length || pinned.length ? 'Instances' : '', items: loose })
    return out
  })

  function toggleSection(key: string) {
    const list = new Set(app.settings?.collapsedGroups ?? [])
    if (list.has(key)) list.delete(key)
    else list.add(key)
    saveSettings({ collapsedGroups: [...list] })
  }

  const title = $derived(app.folder ?? 'All instances')
</script>

<TopBar>
  <h1 class="title">{title}</h1>
  <div class="search no-drag">
    <Icon name="Search" size={16} />
    <input id="search" placeholder="Search instances" bind:value={app.search} onkeydown={(e) => e.key === 'Escape' && ((app.search = ''), (e.currentTarget as HTMLInputElement).blur())} />
    {#if app.search}
      <button class="btn ghost icon sm" aria-label="Clear search" onclick={() => (app.search = '')}><Icon name="X" size={14} /></button>
    {:else}
      <span class="kbd">{modKey}</span><span class="kbd">K</span>
    {/if}
  </div>
  <select class="input sort" bind:value={sort} aria-label="Sort instances">
    <option value="recent">Recently played</option>
    <option value="name">Name</option>
    <option value="created">Newest</option>
  </select>
  <button class="btn" onclick={() => openModal({ kind: 'import' })}><Icon name="FolderInput" size={17} /> Import</button>
  <button class="btn primary" onclick={() => openModal({ kind: 'new' })}><Icon name="Plus" size={17} stroke={2.4} /> New instance</button>
</TopBar>

<div class="scroll">
  {#if app.instances.length === 0}
    <EmptyState icon="Flame" title="Fire up your first instance" body="An instance is a separate game setup with its own mods, worlds and settings. Create one, or bring in a modpack or instances from another launcher.">
      <button class="btn primary lg" onclick={() => openModal({ kind: 'new' })}><Icon name="Plus" /> New instance</button>
      <button class="btn lg" onclick={() => openModal({ kind: 'import' })}><Icon name="FolderInput" /> Import</button>
    </EmptyState>
  {:else if visible.length === 0}
    {#if query}
      <EmptyState icon="Search" title="Nothing matches “{app.search}”" body="Try a different name, version or loader.">
        <button class="btn" onclick={() => (app.search = '')}>Clear search</button>
      </EmptyState>
    {:else}
      <EmptyState icon="FolderOpen" title="This folder is empty" body="Drag instance cards onto “{app.folder}” in the sidebar, or use “Move to folder” in a card's menu.">
        <button class="btn" onclick={() => (app.folder = null)}>Show all instances</button>
      </EmptyState>
    {/if}
  {:else}
    {#if hero}
      <section class="hero" style:--hero-a="var(--accent)">
        <div class="hero-bg"></div>
        <button class="hero-main" onclick={() => openInstance(hero.id)}>
          <InstanceIcon icon={hero.icon} url={hero.iconUrl} size={88} />
          <div class="hero-text">
            <span class="eyebrow">Jump back in</span>
            <h2>{hero.name}</h2>
            <div class="hero-meta">
              <span>{hero.mcVersion}</span>
              {#if hero.loader !== 'vanilla'}<span class="dot">•</span><span>{loaderLabel(hero)}</span>{/if}
              <span class="dot">•</span><span>{plural(hero.modCount, 'mod')}</span>
              <span class="dot">•</span><span>Played {timeAgo(hero.lastPlayed).toLowerCase()}</span>
            </div>
          </div>
        </button>
        <button class="big-play" onclick={() => play(hero)}>
          <Icon name="Play" size={26} stroke={2.4} />
          <span>Play</span>
        </button>
      </section>
    {/if}

    {#if pinned.length && app.folder === null && !query}
      <h4 class="section-title"><Icon name="Pin" size={14} /> Pinned</h4>
      <div class="grid">
        {#each pinned as inst, i (inst.id)}<InstanceCard instance={inst} index={i} />{/each}
      </div>
    {/if}

    {#each sections as section (section.key + section.title)}
      {#if section.title}
        <button class="section-title toggle" onclick={() => toggleSection(section.key || '__loose')}>
          <span class="chev" class:closed={collapsed.has(section.key || '__loose')}><Icon name="ChevronDown" size={15} /></span>
          {#if section.key}<Icon name="Folder" size={14} />{/if}
          {section.title}
          <span class="n">{section.items.length}</span>
        </button>
      {/if}
      {#if !section.title || !collapsed.has(section.key || '__loose')}
        <div class="grid">
          {#each section.items as inst, i (inst.id)}<InstanceCard instance={inst} index={i} />{/each}
        </div>
      {/if}
    {/each}
  {/if}
</div>

<style>
  .title {
    font-size: 24px;
    margin-right: auto;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .search {
    display: flex;
    align-items: center;
    gap: 8px;
    height: 38px;
    width: 280px;
    padding: 0 8px 0 12px;
    border-radius: 11px;
    border: 1px solid var(--border);
    background: var(--surface);
    color: var(--muted);
    transition: border-color var(--fast), box-shadow var(--fast), width var(--med) var(--ease);
  }
  .search:focus-within {
    border-color: var(--accent);
    box-shadow: var(--focus);
    width: 340px;
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
    width: 170px;
    height: 38px;
  }
  .scroll {
    flex: 1;
    overflow: auto;
    padding: 12px 28px 48px;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
    gap: 16px;
  }
  .section-title {
    display: flex;
    align-items: center;
    gap: 7px;
    margin: 26px 0 12px;
    font-family: var(--font);
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--muted);
  }
  .section-title.toggle {
    border: none;
    background: none;
    padding: 4px 8px 4px 4px;
    margin-left: -4px;
    border-radius: 8px;
  }
  .section-title.toggle:hover {
    color: var(--text);
    background: color-mix(in oklab, var(--text) 5%, transparent);
  }
  .chev {
    display: inline-flex;
    transition: transform var(--med) var(--ease);
  }
  .chev.closed {
    transform: rotate(-90deg);
  }
  .n {
    font-weight: 600;
    opacity: 0.7;
  }

  .hero {
    position: relative;
    display: flex;
    align-items: center;
    gap: 24px;
    padding: 28px 32px;
    margin: 6px 0 8px;
    border-radius: var(--radius-xl);
    overflow: hidden;
    border: 1px solid color-mix(in oklab, var(--accent) 25%, var(--border));
    animation: pop-in 400ms var(--ease) both;
  }
  .hero-bg {
    position: absolute;
    inset: 0;
    background:
      radial-gradient(600px 300px at 0% 0%, color-mix(in oklab, var(--accent) 22%, transparent), transparent 70%),
      radial-gradient(500px 260px at 100% 100%, color-mix(in oklab, var(--accent-2) 20%, transparent), transparent 70%),
      var(--surface);
  }
  .hero-bg::after {
    content: '';
    position: absolute;
    inset: 0;
    background-image: radial-gradient(color-mix(in oklab, var(--text) 9%, transparent) 1px, transparent 1px);
    background-size: 18px 18px;
    mask-image: linear-gradient(90deg, transparent, black 60%);
  }
  .hero-main {
    position: relative;
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 22px;
    border: none;
    background: none;
    padding: 0;
    text-align: left;
    color: inherit;
  }
  .hero-text {
    min-width: 0;
  }
  .eyebrow {
    font-size: 12px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--accent-text);
  }
  .hero h2 {
    font-size: 32px;
    margin: 4px 0 8px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .hero-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    color: var(--text-2);
    font-size: 13.5px;
  }
  .dot {
    opacity: 0.5;
  }
  .big-play {
    position: relative;
    display: inline-flex;
    align-items: center;
    gap: 10px;
    height: 64px;
    padding: 0 34px 0 28px;
    border: none;
    border-radius: 20px;
    color: white;
    font-family: var(--font-display);
    font-size: 22px;
    font-weight: 700;
    background: linear-gradient(135deg, var(--accent), color-mix(in oklab, var(--accent) 55%, var(--accent-2)));
    box-shadow: 0 1px 0 rgb(255 255 255 / 0.3) inset, 0 10px 30px color-mix(in oklab, var(--accent) 45%, transparent);
    transition: transform var(--fast) var(--ease-spring), box-shadow var(--med);
  }
  .big-play:hover {
    transform: scale(1.05);
    box-shadow: 0 1px 0 rgb(255 255 255 / 0.3) inset, 0 14px 40px color-mix(in oklab, var(--accent) 55%, transparent);
  }
  .big-play:active {
    transform: scale(0.97);
  }
</style>

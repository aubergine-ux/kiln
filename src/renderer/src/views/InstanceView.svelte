<script lang="ts">
  import { app, current, navigate, type Tab } from '@/lib/state.svelte'
  import { openMenuAt } from '@/lib/menu.svelte'
  import { openModal } from '@/lib/modals.svelte'
  import { instanceMenu, play } from '@/lib/actions'
  import { loaderLabel, memory, plural, timeAgo } from '@/lib/format'
  import { isMod, isTyping } from '@/lib/shortcuts'
  import { api } from '@/lib/api'
  import Icon from '@/components/Icon.svelte'
  import InstanceIcon from '@/components/InstanceIcon.svelte'
  import TopBar from '@/components/TopBar.svelte'
  import LoaderGuide from '@/components/LoaderGuide.svelte'
  import KilnBand from '@/components/KilnBand.svelte'
  import ContentTab from './instance/ContentTab.svelte'
  import WorldsTab from './instance/WorldsTab.svelte'
  import ScreenshotsTab from './instance/ScreenshotsTab.svelte'
  import LogsTab from './instance/LogsTab.svelte'
  import SettingsTab from './instance/SettingsTab.svelte'

  const inst = $derived(current.instance)
  const tab = $derived(app.route.view === 'instance' ? app.route.tab : 'mods')

  const TABS: { id: Tab; label: string; icon: string }[] = [
    { id: 'mods', label: 'Mods', icon: 'Puzzle' },
    { id: 'resourcepacks', label: 'Resource packs', icon: 'Palette' },
    { id: 'shaderpacks', label: 'Shaders', icon: 'Aperture' },
    { id: 'datapacks', label: 'Data packs', icon: 'Package' },
    { id: 'worlds', label: 'Worlds', icon: 'Globe' },
    { id: 'screenshots', label: 'Screenshots', icon: 'Camera' },
    { id: 'logs', label: 'Logs', icon: 'ScrollText' },
    { id: 'settings', label: 'Settings', icon: 'Settings' }
  ]

  function setTab(t: Tab) {
    if (inst) navigate({ view: 'instance', id: inst.id, tab: t })
  }

  function onkeydown(e: KeyboardEvent) {
    if (isMod(e) && /^[1-8]$/.test(e.key)) {
      e.preventDefault()
      setTab(TABS[Number(e.key) - 1].id)
    }
    if (e.key === 'Backspace' && !isTyping(e) && e.altKey) navigate({ view: 'home' })
  }

  // The instance was deleted or never existed.
  $effect(() => {
    if (app.instances.length && !inst) navigate({ view: 'home' })
  })
</script>

<svelte:window {onkeydown} />

{#if inst}
  <TopBar>
    <button class="btn ghost sm back" onclick={() => navigate({ view: 'home' })}><Icon name="ChevronLeft" size={16} /> Instances</button>
  </TopBar>

  <div class="head">
    <KilnBand>
      <button class="icon-btn" onclick={() => openModal({ kind: 'icon', instance: inst })} title="Change icon">
        <InstanceIcon icon={inst.icon} url={inst.iconUrl} size={72} />
      </button>
      <div class="info">
        <h1 title={inst.name}>{inst.name}</h1>
        <div class="meta">
          <span class="chip">{inst.mcVersion}</span>
          {#if inst.loader !== 'vanilla'}<span class="chip accent">{loaderLabel(inst).toLowerCase()} {inst.loaderVersion ?? ''}</span>{/if}
          <span class="chip">{plural(inst.modCount, 'mod')}</span>
          <span class="chip">{memory(inst.memoryMb)}</span>
          <span class="chip">{inst.lastPlayed ? `played ${timeAgo(inst.lastPlayed).toLowerCase()}` : 'never played'}</span>
        </div>
      </div>
      <div class="head-actions">
        <button class="band-btn" title="Open folder" aria-label="Open folder" onclick={() => api.instances.openFolder(inst.id)}><Icon name="FolderOpen" size={18} /></button>
        <button class="band-btn" title="More" aria-label="More options" onclick={(e) => openMenuAt(e, instanceMenu(inst))}><Icon name="Ellipsis" size={18} /></button>
        <button class="btn primary lg play" onclick={() => play(inst)}><Icon name="Play" size={17} /> Play</button>
      </div>
    </KilnBand>
  </div>

  {#if inst.warning}
    <div class="guide-wrap">
      <div class="warning"><Icon name="TriangleAlert" size={18} /> <span>{inst.warning}</span></div>
    </div>
  {:else if !inst.versionInstalled && tab !== 'settings'}
    <div class="guide-wrap"><LoaderGuide instance={inst} compact /></div>
  {/if}

  <div class="tabs" role="tablist">
    {#each TABS as t, i (t.id)}
      <button role="tab" aria-selected={tab === t.id} class:active={tab === t.id} onclick={() => setTab(t.id)} title="{t.label} ({i + 1})">
        {t.label}
        {#if t.id === 'mods' && inst.modCount}<span class="count">{inst.modCount}</span>{/if}
      </button>
    {/each}
  </div>

  <div class="tab-body">
    {#key tab}
      {#if tab === 'mods' || tab === 'resourcepacks' || tab === 'shaderpacks' || tab === 'datapacks'}
        <ContentTab instance={inst} kind={tab} />
      {:else if tab === 'worlds'}
        <WorldsTab instance={inst} />
      {:else if tab === 'screenshots'}
        <ScreenshotsTab instance={inst} />
      {:else if tab === 'logs'}
        <LogsTab instance={inst} />
      {:else}
        <SettingsTab instance={inst} />
      {/if}
    {/key}
  </div>
{/if}

<style>
  .back {
    margin-left: -8px;
    color: var(--text-2);
  }
  .head {
    padding: 0 28px 16px;
  }
  .icon-btn {
    border: none;
    background: none;
    padding: 0;
    border-radius: var(--r-2);
  }
  .info {
    flex: 1;
    min-width: 0;
  }
  h1 {
    font-size: 30px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .meta {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 14px;
    margin-top: 8px;
  }
  .head-actions {
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .band-btn {
    width: 36px;
    height: 36px;
    display: grid;
    place-items: center;
    border: none;
    border-radius: var(--r-2);
    background: none;
    color: var(--band-muted);
  }
  .band-btn:hover {
    color: var(--band-text);
    background: rgb(255 255 255 / 0.08);
  }
  .play {
    height: 46px;
    padding: 0 24px 0 18px;
    margin-left: 8px;
    font-size: 16px;
  }
  .guide-wrap {
    padding: 0 28px 14px;
  }
  .warning {
    display: flex;
    gap: 12px;
    align-items: flex-start;
    padding: 12px 14px;
    border-radius: var(--r-3);
    background: color-mix(in oklab, var(--warn) 8%, var(--surface));
    border: 1px solid color-mix(in oklab, var(--warn) 30%, var(--border));
    color: var(--text-2);
    line-height: 1.5;
  }
  .warning :global(.icon) {
    color: var(--warn);
    margin-top: 1px;
  }
  .tabs {
    display: flex;
    gap: 2px;
    padding: 0 22px;
    border-bottom: 1px solid var(--border);
    overflow-x: auto;
    overflow-y: hidden;
    scrollbar-width: none;
    flex-shrink: 0;
  }
  .tabs button {
    position: relative;
    display: inline-flex;
    align-items: center;
    gap: 7px;
    height: 40px;
    padding: 0 11px;
    border: none;
    background: none;
    color: var(--muted);
    font-weight: 600;
    white-space: nowrap;
  }
  .tabs button:hover,
  .tabs button.active {
    color: var(--text);
  }
  /* The underline slides in so you can see which tab you moved to. */
  .tabs button::after {
    content: '';
    position: absolute;
    left: 9px;
    right: 9px;
    bottom: -1px;
    height: 2px;
    background: var(--accent);
    transform: scaleX(0);
    transition: transform var(--med) var(--ease);
  }
  .tabs button.active::after {
    transform: scaleX(1);
  }
  .count {
    font-family: var(--font-mono);
    font-size: 11px;
    padding: 0 5px;
    border-radius: var(--r-1);
    background: var(--surface-3);
    color: var(--text-2);
  }
  .tab-body {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }
</style>

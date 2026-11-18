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
    { id: 'shaderpacks', label: 'Shaders', icon: 'Sparkles' },
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
    <button class="icon-btn" onclick={() => openModal({ kind: 'icon', instance: inst })} title="Change icon">
      <InstanceIcon icon={inst.icon} url={inst.iconUrl} size={84} />
      <span class="edit"><Icon name="Pencil" size={14} /></span>
    </button>
    <div class="info">
      <h1 title={inst.name}>{inst.name}</h1>
      <div class="meta">
        <span class="chip">{inst.mcVersion}</span>
        {#if inst.loader !== 'vanilla'}<span class="chip accent">{loaderLabel(inst)}{inst.loaderVersion ? ` ${inst.loaderVersion}` : ''}</span>{/if}
        {#if inst.group}<span class="chip"><Icon name="Folder" size={12} /> {inst.group}</span>{/if}
        <span class="sub">{plural(inst.modCount, 'mod')} · {memory(inst.memoryMb)} memory · {inst.lastPlayed ? `Played ${timeAgo(inst.lastPlayed).toLowerCase()}` : 'Never played'}</span>
      </div>
    </div>
    <div class="head-actions">
      <button class="btn icon" title="Open folder" aria-label="Open folder" onclick={() => api.instances.openFolder(inst.id)}><Icon name="FolderOpen" /></button>
      <button class="btn icon" title="More" aria-label="More options" onclick={(e) => openMenuAt(e, instanceMenu(inst))}><Icon name="Ellipsis" /></button>
      <button class="play" onclick={() => play(inst)}>
        <Icon name="Play" size={22} stroke={2.4} /> Play
      </button>
    </div>
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
        <Icon name={t.icon} size={16} />
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
    margin-left: -10px;
    color: var(--text-2);
  }
  .head {
    display: flex;
    align-items: center;
    gap: 22px;
    padding: 4px 28px 18px;
  }
  .icon-btn {
    position: relative;
    border: none;
    background: none;
    padding: 0;
    border-radius: 22px;
    transition: transform var(--med) var(--ease-spring);
  }
  .icon-btn:hover {
    transform: rotate(-3deg) scale(1.04);
  }
  .edit {
    position: absolute;
    right: -6px;
    bottom: -6px;
    width: 28px;
    height: 28px;
    display: grid;
    place-items: center;
    border-radius: 50%;
    background: var(--surface);
    border: 1px solid var(--border);
    box-shadow: var(--shadow-sm);
    color: var(--text-2);
    opacity: 0;
    transition: opacity var(--fast);
  }
  .icon-btn:hover .edit {
    opacity: 1;
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
    align-items: center;
    gap: 8px;
    margin-top: 8px;
  }
  .sub {
    color: var(--muted);
    font-size: 13px;
    margin-left: 4px;
  }
  .head-actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .play {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    height: 52px;
    padding: 0 28px 0 22px;
    margin-left: 6px;
    border: none;
    border-radius: 16px;
    color: white;
    font-family: var(--font-display);
    font-size: 19px;
    font-weight: 700;
    background: linear-gradient(135deg, var(--accent), color-mix(in oklab, var(--accent) 55%, var(--accent-2)));
    box-shadow: 0 1px 0 rgb(255 255 255 / 0.3) inset, 0 8px 24px color-mix(in oklab, var(--accent) 40%, transparent);
    transition: transform var(--fast) var(--ease-spring), box-shadow var(--med);
  }
  .play:hover {
    transform: scale(1.05);
  }
  .play:active {
    transform: scale(0.97);
  }
  .guide-wrap {
    padding: 0 28px 14px;
  }
  .warning {
    display: flex;
    gap: 12px;
    align-items: flex-start;
    padding: 14px 16px;
    border-radius: var(--radius-lg);
    background: color-mix(in oklab, var(--warn) 9%, var(--surface));
    border: 1px solid color-mix(in oklab, var(--warn) 30%, var(--border));
    color: var(--text-2);
    line-height: 1.5;
  }
  .warning :global(.icon) {
    color: color-mix(in oklab, var(--warn) 85%, var(--text));
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
    height: 42px;
    padding: 0 12px;
    border: none;
    background: none;
    color: var(--muted);
    font-weight: 600;
    white-space: nowrap;
    border-radius: 10px 10px 0 0;
    transition: color var(--fast);
  }
  .tabs button:hover {
    color: var(--text);
  }
  .tabs button.active {
    color: var(--text);
  }
  .tabs button.active :global(.icon) {
    color: var(--accent-text);
  }
  .tabs button::after {
    content: '';
    position: absolute;
    left: 10px;
    right: 10px;
    bottom: -1px;
    height: 2.5px;
    border-radius: 3px 3px 0 0;
    background: var(--accent);
    transform: scaleX(0);
    transition: transform var(--med) var(--ease);
  }
  .tabs button.active::after {
    transform: scaleX(1);
  }
  .count {
    font-size: 11px;
    padding: 1px 6px;
    border-radius: 99px;
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

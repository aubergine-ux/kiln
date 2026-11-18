<script lang="ts">
  import type { Instance } from '@shared/types'
  import { pathForFile } from '@/lib/api'
  import { openInstance } from '@/lib/state.svelte'
  import { openMenu, openMenuAt } from '@/lib/menu.svelte'
  import { dropFiles } from '@/lib/drop.svelte'
  import { instanceMenu, play } from '@/lib/actions'
  import { loaderLabel, plural, timeAgo } from '@/lib/format'
  import Icon from './Icon.svelte'
  import InstanceIcon from './InstanceIcon.svelte'

  let { instance: inst, index = 0 }: { instance: Instance; index?: number } = $props()
  let fileOver = $state(false)

  function ondrop(e: DragEvent) {
    if (!e.dataTransfer?.types.includes('Files')) return
    // preventDefault tells the window-level handler this drop is already taken care of.
    e.preventDefault()
    fileOver = false
    dropFiles([...e.dataTransfer.files].map(pathForFile), inst.id)
  }
</script>

<div
  class="card"
  class:file-over={fileOver}
  style:--delay="{Math.min(index, 12) * 30}ms"
  role="button"
  tabindex="0"
  draggable="true"
  ondragstart={(e) => {
    e.dataTransfer?.setData('application/x-kiln-instance', inst.id)
    if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'
  }}
  ondragover={(e) => {
    if (e.dataTransfer?.types.includes('Files')) {
      e.preventDefault()
      fileOver = true
    }
  }}
  ondragleave={() => (fileOver = false)}
  {ondrop}
  onclick={() => openInstance(inst.id)}
  onkeydown={(e) => {
    if (e.key === 'Enter') openInstance(inst.id)
  }}
  oncontextmenu={(e) => {
    e.preventDefault()
    openMenu(instanceMenu(inst), e.clientX + 200, e.clientY)
  }}
>
  <div class="glow" style:--tile={inst.icon.kind === 'glyph' ? `var(--tile-${inst.icon.color})` : 'var(--accent)'}></div>
  <div class="top">
    <InstanceIcon icon={inst.icon} url={inst.iconUrl} size={64} />
    <div class="actions">
      {#if inst.pinned}<span class="pin" title="Pinned"><Icon name="Pin" size={14} /></span>{/if}
      <button class="btn ghost icon sm" aria-label="More options" onclick={(e) => openMenuAt(e, instanceMenu(inst))}><Icon name="Ellipsis" size={18} /></button>
    </div>
  </div>

  <h3 title={inst.name}>{inst.name}</h3>
  <div class="chips">
    <span class="chip">{inst.mcVersion}</span>
    {#if inst.loader !== 'vanilla'}<span class="chip accent">{loaderLabel(inst)}</span>{/if}
    {#if !inst.versionInstalled}<span class="chip warn" title="Install the loader to play this instance"><Icon name="TriangleAlert" size={12} /> Setup needed</span>{/if}
  </div>

  <div class="bottom">
    <div class="meta">
      <span><Icon name="Puzzle" size={14} /> {plural(inst.modCount, 'mod')}</span>
      <span><Icon name="Clock" size={14} /> {timeAgo(inst.lastPlayed)}</span>
    </div>
    <button class="play" aria-label="Play {inst.name}" onclick={(e) => (e.stopPropagation(), play(inst))}>
      <Icon name="Play" size={18} stroke={2.4} />
      <span>Play</span>
    </button>
  </div>

  {#if fileOver}
    <div class="drop-hint"><Icon name="Download" size={22} /> Drop to add</div>
  {/if}
</div>

<style>
  .card {
    --tile-ember: #f06a35;
    --tile-rose: #e2487c;
    --tile-violet: #7457e6;
    --tile-sky: #2f7fe0;
    --tile-teal: #159a8c;
    --tile-moss: #4a944a;
    --tile-sand: #c98d3d;
    --tile-slate: #6b7280;
    position: relative;
    overflow: hidden;
    padding: 18px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    cursor: pointer;
    outline: none;
    transition: transform var(--med) var(--ease), box-shadow var(--med) var(--ease), border-color var(--med);
    animation: pop-in 360ms var(--ease) both;
    animation-delay: var(--delay);
  }
  .card:hover,
  .card:focus-visible {
    transform: translateY(-3px);
    box-shadow: var(--shadow);
    border-color: var(--border-strong);
  }
  .card:focus-visible {
    box-shadow: var(--focus), var(--shadow);
  }
  .glow {
    position: absolute;
    inset: -40% -20% auto auto;
    width: 220px;
    height: 220px;
    border-radius: 50%;
    background: radial-gradient(circle, color-mix(in oklab, var(--tile) 22%, transparent), transparent 70%);
    opacity: 0.55;
    pointer-events: none;
    transition: opacity var(--med);
  }
  .card:hover .glow {
    opacity: 1;
  }
  .top {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    position: relative;
  }
  .actions {
    display: flex;
    align-items: center;
    gap: 4px;
    margin: -6px -8px 0 0;
  }
  .pin {
    color: var(--accent-text);
    display: inline-flex;
  }
  h3 {
    font-size: 18px;
    margin-top: 6px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    position: relative;
  }
  .chips {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
    position: relative;
  }
  .bottom {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    gap: 10px;
    margin-top: 8px;
    position: relative;
  }
  .meta {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 12.5px;
    color: var(--muted);
    min-width: 0;
  }
  .meta span {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    white-space: nowrap;
  }
  .play {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 42px;
    padding: 0 18px 0 14px;
    border: none;
    border-radius: 13px;
    color: white;
    font-weight: 650;
    font-size: 15px;
    background: linear-gradient(135deg, var(--accent), color-mix(in oklab, var(--accent) 65%, var(--accent-2)));
    box-shadow: 0 1px 0 rgb(255 255 255 / 0.25) inset, 0 6px 18px color-mix(in oklab, var(--accent) 35%, transparent);
    transition: transform var(--fast) var(--ease-spring), box-shadow var(--fast);
  }
  .play:hover {
    transform: scale(1.06);
    box-shadow: 0 1px 0 rgb(255 255 255 / 0.25) inset, 0 10px 26px color-mix(in oklab, var(--accent) 45%, transparent);
  }
  .play:active {
    transform: scale(0.96);
  }
  .file-over {
    border-color: var(--accent);
    box-shadow: 0 0 0 3px color-mix(in oklab, var(--accent) 30%, transparent);
  }
  .drop-hint {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    font-weight: 650;
    color: var(--accent-text);
    background: color-mix(in oklab, var(--surface) 85%, transparent);
    backdrop-filter: blur(3px);
    z-index: 2;
  }
</style>

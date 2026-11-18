<script lang="ts">
  import type { Instance } from '@shared/types'
  import { pathForFile } from '@/lib/api'
  import { openInstance } from '@/lib/state.svelte'
  import { openMenu, openMenuAt } from '@/lib/menu.svelte'
  import { dropFiles } from '@/lib/drop.svelte'
  import { instanceMenu, play } from '@/lib/actions'
  import { loaderLabel, timeAgo } from '@/lib/format'
  import Icon from './Icon.svelte'
  import InstanceIcon from './InstanceIcon.svelte'

  let { instance: inst }: { instance: Instance } = $props()
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
  class="row"
  class:file-over={fileOver}
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
  onkeydown={(e) => e.key === 'Enter' && openInstance(inst.id)}
  oncontextmenu={(e) => {
    e.preventDefault()
    openMenu(instanceMenu(inst), e.clientX + 200, e.clientY)
  }}
>
  <InstanceIcon icon={inst.icon} url={inst.iconUrl} size={30} />
  <div class="name">
    <span title={inst.name}>{inst.name}</span>
    {#if inst.pinned}<span class="pin" title="Pinned"><Icon name="Pin" size={12} /></span>{/if}
    {#if !inst.versionInstalled}<span class="chip warn" title="Install the mod loader to play this instance">needs {loaderLabel(inst)}</span>{/if}
  </div>
  <div class="version">
    <span class="chip">{inst.mcVersion}</span>
    {#if inst.loader !== 'vanilla'}<span class="chip accent">{loaderLabel(inst).toLowerCase()}</span>{/if}
  </div>
  <span class="num">{inst.modCount || ''}</span>
  <span class="when">{timeAgo(inst.lastPlayed)}</span>
  <div class="actions">
    <button class="btn sm primary" aria-label="Play {inst.name}" onclick={(e) => (e.stopPropagation(), play(inst))}><Icon name="Play" size={13} /> Play</button>
    <button class="btn ghost icon sm" aria-label="More options" onclick={(e) => openMenuAt(e, instanceMenu(inst))}><Icon name="Ellipsis" size={16} /></button>
  </div>
</div>

<style>
  .row {
    display: grid;
    grid-template-columns: var(--cols);
    align-items: center;
    gap: 14px;
    min-height: 46px;
    padding: 6px 8px 6px 10px;
    cursor: pointer;
    outline: none;
    border-top: 1px solid var(--border);
  }
  .row:hover,
  .row:focus-visible {
    background: var(--surface-2);
  }
  .name {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
    font-weight: 600;
  }
  .name > span:first-child {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .pin {
    display: inline-flex;
    color: var(--muted);
  }
  .version {
    display: flex;
    gap: 8px;
  }
  .num,
  .when {
    font-size: 13px;
    color: var(--text-2);
    white-space: nowrap;
  }
  .num {
    font-family: var(--font-mono);
    font-size: 12px;
    text-align: right;
  }
  .actions {
    display: flex;
    gap: 2px;
    justify-content: flex-end;
    opacity: 0;
    transition: opacity var(--fast);
  }
  /* Actions show on hover so a long list stays readable. */
  .row:hover .actions,
  .row:focus-within .actions {
    opacity: 1;
  }
  .file-over {
    background: var(--accent-soft) !important;
    box-shadow: inset 0 0 0 2px var(--accent);
  }
</style>

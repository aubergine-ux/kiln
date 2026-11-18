<script lang="ts">
  import { fade, scale } from 'svelte/transition'
  import type { Instance, Screenshot } from '@shared/types'
  import { api } from '@/lib/api'
  import { attempt, confirm, toast } from '@/lib/state.svelte'
  import { openMenuAt } from '@/lib/menu.svelte'
  import { bytes, dateTime } from '@/lib/format'
  import Icon from '@/components/Icon.svelte'
  import EmptyState from '@/components/EmptyState.svelte'

  let { instance: inst }: { instance: Instance } = $props()
  let shots = $state<Screenshot[]>([])
  let loading = $state(true)
  let open = $state<number | null>(null)

  async function load() {
    shots = (await attempt(() => api.screenshots.list(inst.id))) ?? []
    loading = false
  }
  load()

  async function copy(s: Screenshot) {
    if (await attempt(() => api.screenshots.copy(inst.id, s.file).then(() => true))) toast('ok', 'Copied to clipboard', s.file)
  }

  async function remove(s: Screenshot) {
    const c = await confirm({ title: 'Delete this screenshot?', body: `${s.file} goes to the trash.`, confirm: 'Delete', danger: true })
    if (c !== 'confirm') return
    if (await attempt(() => api.screenshots.remove(inst.id, [s.file]).then(() => true))) {
      const i = shots.indexOf(s)
      shots = shots.filter((x) => x !== s)
      if (open !== null) open = shots.length ? Math.min(i, shots.length - 1) : null
    }
  }

  function menu(e: MouseEvent, s: Screenshot) {
    openMenuAt(e, [
      { label: 'Open', icon: 'ExternalLink', run: () => api.screenshots.open(inst.id, s.file) },
      { label: 'Copy image', icon: 'Copy', run: () => copy(s) },
      { label: 'Show in folder', icon: 'FolderOpen', run: () => api.screenshots.reveal(inst.id, s.file) },
      { separator: true, label: '' },
      { label: 'Delete', icon: 'Trash2', danger: true, run: () => remove(s) }
    ])
  }

  function onkeydown(e: KeyboardEvent) {
    if (open === null) return
    if (e.key === 'ArrowRight') open = (open + 1) % shots.length
    else if (e.key === 'ArrowLeft') open = (open - 1 + shots.length) % shots.length
    else if (e.key === 'Escape') {
      e.stopPropagation()
      open = null
    } else if (e.key === 'Delete') remove(shots[open])
    else if ((e.ctrlKey || e.metaKey) && e.key === 'c') copy(shots[open])
  }

  const current = $derived(open !== null ? shots[open] : null)
</script>

<svelte:window onkeydowncapture={onkeydown} />

<div class="toolbar">
  <h3>{shots.length} {shots.length === 1 ? 'screenshot' : 'screenshots'}</h3>
  <div class="spacer"></div>
  <button class="btn" onclick={() => api.instances.openFolder(inst.id, 'screenshots')}><Icon name="FolderOpen" size={16} /> Open folder</button>
</div>

<div class="scroll">
  {#if !loading && shots.length === 0}
    <EmptyState icon="Camera" title="No screenshots yet" body="Press F2 in the game to take one. They'll show up here, ready to open, copy or share." />
  {:else}
    <div class="grid">
      {#each shots as s, i (s.file)}
        <button class="shot" style:--d="{Math.min(i, 20) * 20}ms" onclick={() => (open = i)} oncontextmenu={(e) => (e.preventDefault(), menu(e, s))}>
          <img src={s.url} alt={s.file} loading="lazy" draggable="false" />
          <span class="cap">{dateTime(s.created)}</span>
        </button>
      {/each}
    </div>
  {/if}
</div>

{#if current}
  <div class="lightbox" transition:fade={{ duration: 150 }} role="dialog" aria-label="Screenshot">
    <button class="close-area" aria-label="Close" onclick={() => (open = null)}></button>
    {#key current.file}
      <img src={current.url} alt={current.file} in:scale={{ start: 0.97, duration: 180 }} />
    {/key}
    <button class="nav prev" aria-label="Previous" onclick={() => (open = (open! - 1 + shots.length) % shots.length)}><Icon name="ChevronLeft" size={26} /></button>
    <button class="nav next" aria-label="Next" onclick={() => (open = (open! + 1) % shots.length)}><Icon name="ChevronRight" size={26} /></button>
    <div class="bar">
      <div class="bar-text">
        <strong>{current.file}</strong>
        <span>{dateTime(current.created)} · {bytes(current.size)} · {open! + 1} of {shots.length}</span>
      </div>
      <button class="btn sm" onclick={() => api.screenshots.open(inst.id, current.file)}><Icon name="ExternalLink" size={15} /> Open</button>
      <button class="btn sm" onclick={() => copy(current)}><Icon name="Copy" size={15} /> Copy</button>
      <button class="btn sm" onclick={() => api.screenshots.reveal(inst.id, current.file)}><Icon name="FolderOpen" size={15} /> Show</button>
      <button class="btn sm danger" onclick={() => remove(current)}><Icon name="Trash2" size={15} /> Delete</button>
      <button class="btn sm icon" aria-label="Close" onclick={() => (open = null)}><Icon name="X" size={16} /></button>
    </div>
  </div>
{/if}

<style>
  .toolbar {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 16px 28px 12px;
  }
  .toolbar h3 {
    font-size: 16px;
  }
  .spacer {
    flex: 1;
  }
  .scroll {
    flex: 1;
    overflow: auto;
    padding: 0 28px 40px;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
    gap: 12px;
  }
  .shot {
    position: relative;
    padding: 0;
    border: 1px solid var(--border);
    border-radius: 14px;
    overflow: hidden;
    aspect-ratio: 16 / 9;
    background: var(--surface-2);
    animation: pop-in 300ms var(--ease) both;
    animation-delay: var(--d);
    transition: transform var(--med) var(--ease), box-shadow var(--med);
  }
  .shot:hover {
    transform: translateY(-2px) scale(1.01);
    box-shadow: var(--shadow);
  }
  .shot img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
  .cap {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    padding: 18px 10px 8px;
    font-size: 12px;
    color: white;
    text-align: left;
    background: linear-gradient(transparent, rgb(0 0 0 / 0.6));
    opacity: 0;
    transition: opacity var(--fast);
  }
  .shot:hover .cap {
    opacity: 1;
  }
  .lightbox {
    position: fixed;
    inset: 0;
    z-index: 120;
    background: rgb(8 6 4 / 0.9);
    backdrop-filter: blur(10px);
    display: grid;
    place-items: center;
    padding: 60px 80px 100px;
    -webkit-app-region: no-drag;
  }
  .close-area {
    position: absolute;
    inset: 0;
    border: none;
    background: none;
    cursor: zoom-out;
  }
  .lightbox img {
    position: relative;
    max-width: 100%;
    max-height: 100%;
    border-radius: 12px;
    box-shadow: 0 20px 60px rgb(0 0 0 / 0.5);
    pointer-events: none;
  }
  .nav {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    width: 48px;
    height: 48px;
    border-radius: 50%;
    border: none;
    color: white;
    background: rgb(255 255 255 / 0.12);
    display: grid;
    place-items: center;
    transition: background var(--fast);
  }
  .nav:hover {
    background: rgb(255 255 255 / 0.22);
  }
  .prev {
    left: 18px;
  }
  .next {
    right: 18px;
  }
  .bar {
    position: absolute;
    bottom: 22px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 8px 8px 16px;
    border-radius: 16px;
    background: var(--surface);
    border: 1px solid var(--border);
    box-shadow: var(--shadow-lg);
    max-width: calc(100vw - 40px);
  }
  .bar-text {
    display: flex;
    flex-direction: column;
    margin-right: 8px;
    min-width: 0;
  }
  .bar-text strong {
    font-weight: 600;
    font-size: 13px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .bar-text span {
    font-size: 12px;
    color: var(--muted);
    white-space: nowrap;
  }
</style>

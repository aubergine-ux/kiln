<script lang="ts">
  import { tick } from 'svelte'
  import { closeMenu, menu } from '@/lib/menu.svelte'
  import Icon from './Icon.svelte'

  let el = $state<HTMLDivElement>()
  let pos = $state({ x: 0, y: 0 })

  // Keep the menu on screen: flip left/up when it would overflow.
  $effect(() => {
    if (!menu.open) return
    const { x, y } = menu
    pos = { x: -9999, y: -9999 }
    tick().then(() => {
      if (!el) return
      const r = el.getBoundingClientRect()
      const px = x - r.width < 8 ? x : x - r.width
      const py = y + r.height > window.innerHeight - 8 ? Math.max(8, y - r.height - 12) : y
      pos = { x: Math.min(px, window.innerWidth - r.width - 8), y: py }
      el.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus()
    })
  })

  function onkeydown(e: KeyboardEvent) {
    if (!menu.open) return
    if (e.key === 'Escape') {
      e.stopPropagation()
      closeMenu()
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      const buttons = [...(el?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? [])]
      const i = buttons.indexOf(document.activeElement as HTMLButtonElement)
      buttons[(i + (e.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length]?.focus()
    }
  }
</script>

<svelte:window {onkeydown} onresize={closeMenu} />

{#if menu.open}
  <div class="catcher" role="presentation" onmousedown={closeMenu} oncontextmenu={(e) => (e.preventDefault(), closeMenu())}></div>
  <div class="menu" bind:this={el} style:left="{pos.x}px" style:top="{pos.y}px" role="menu">
    {#each menu.items as item, i (i)}
      {#if item.separator}
        <div class="sep"></div>
      {:else if item.heading}
        <div class="heading">{item.label}</div>
      {:else}
        <button
          role="menuitem"
          class:danger={item.danger}
          disabled={item.disabled}
          onclick={() => {
            closeMenu()
            item.run?.()
          }}
        >
          <span class="ic">
            {#if item.checked}<Icon name="Check" size={16} />{:else if item.icon}<Icon name={item.icon} size={16} />{/if}
          </span>
          <span class="label">{item.label}</span>
          {#if item.shortcut}<span class="kbd">{item.shortcut}</span>{/if}
        </button>
      {/if}
    {/each}
  </div>
{/if}

<style>
  .catcher {
    position: fixed;
    inset: 0;
    z-index: 200;
    -webkit-app-region: no-drag;
  }
  .menu {
    position: fixed;
    z-index: 201;
    min-width: 210px;
    max-height: 70vh;
    overflow: auto;
    padding: 4px;
    background: var(--surface);
    border: 1px solid var(--border-strong);
    border-radius: var(--r-3);
    box-shadow: var(--shadow-pop);
    -webkit-app-region: no-drag;
  }
  button {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    height: 32px;
    padding: 0 10px 0 8px;
    border: none;
    background: none;
    border-radius: var(--r-2);
    text-align: left;
    color: var(--text);
    font-size: 13.5px;
    outline: none;
  }
  button:hover:not(:disabled),
  button:focus-visible {
    background: var(--accent-soft);
    box-shadow: none;
  }
  button:disabled {
    opacity: 0.45;
  }
  button.danger {
    color: var(--danger);
  }
  button.danger:hover,
  button.danger:focus-visible {
    background: color-mix(in oklab, var(--danger) 12%, transparent);
  }
  .ic {
    width: 18px;
    display: inline-flex;
    color: var(--muted);
  }
  .danger .ic {
    color: inherit;
  }
  .label {
    flex: 1;
  }
  .sep {
    height: 1px;
    background: var(--border);
    margin: 5px 6px;
  }
  .heading {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--muted);
    padding: 8px 10px 4px;
  }
</style>

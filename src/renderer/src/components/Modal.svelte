<script lang="ts">
  import type { Snippet } from 'svelte'
  import { fade, scale } from 'svelte/transition'
  import Icon from './Icon.svelte'

  let {
    title,
    subtitle,
    onclose,
    width = 520,
    children,
    footer
  }: { title: string; subtitle?: string; onclose: () => void; width?: number; children: Snippet; footer?: Snippet } = $props()

  function onkeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.stopPropagation()
      onclose()
    }
  }
</script>

<svelte:window {onkeydown} />

<div class="backdrop" transition:fade={{ duration: 120 }} onmousedown={(e) => e.target === e.currentTarget && onclose()} role="presentation">
  <div class="modal" style:width="min({width}px, calc(100vw - 48px))" transition:scale={{ start: 0.98, duration: 140 }} role="dialog" aria-modal="true" aria-label={title}>
    <header>
      <div>
        <h2>{title}</h2>
        {#if subtitle}<p class="hint">{subtitle}</p>{/if}
      </div>
      <button class="btn ghost icon sm" onclick={onclose} aria-label="Close"><Icon name="X" /></button>
    </header>
    <div class="body">{@render children()}</div>
    {#if footer}<footer>{@render footer()}</footer>{/if}
  </div>
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: var(--overlay);
    display: grid;
    place-items: center;
    z-index: 100;
    -webkit-app-region: no-drag;
  }
  .modal {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--r-4);
    box-shadow: var(--shadow-pop);
    max-height: calc(100vh - 80px);
    display: flex;
    flex-direction: column;
  }
  header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 16px;
    padding: 20px 20px 4px 24px;
  }
  h2 {
    font-size: 20px;
  }
  header .hint {
    margin-top: 4px;
  }
  .body {
    padding: 14px 24px 20px;
    overflow: auto;
  }
  footer {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    padding: 14px 24px;
    border-top: 1px solid var(--border);
    background: var(--surface-2);
    border-radius: 0 0 var(--r-4) var(--r-4);
  }
</style>

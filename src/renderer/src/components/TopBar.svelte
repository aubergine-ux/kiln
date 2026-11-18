<script lang="ts">
  import type { Snippet } from 'svelte'

  /** The draggable strip at the top of each page. Leaves room for the window buttons. */
  let { children }: { children: Snippet } = $props()
</script>

<header class="topbar drag-region" class:mac={window.kiln.platform === 'darwin'}>
  {@render children()}
</header>

<style>
  .topbar {
    height: 64px;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 150px 0 28px;
  }
  .topbar.mac {
    padding-right: 28px;
  }
  .topbar :global(button),
  .topbar :global(input),
  .topbar :global(select),
  .topbar :global(.no-drag) {
    -webkit-app-region: no-drag;
  }
</style>

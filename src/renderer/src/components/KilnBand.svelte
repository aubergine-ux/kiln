<script lang="ts">
  import type { Snippet } from 'svelte'

  /** The dark brick strip at the top of the home and instance pages. Same in both themes. */
  let { children }: { children: Snippet } = $props()
</script>

<section class="band">{@render children()}</section>

<style>
  .band {
    --band-text: #f3ece2;
    --band-muted: #b5a493;
    position: relative;
    display: flex;
    align-items: center;
    gap: 20px;
    padding: 22px 24px 25px;
    border-radius: var(--r-3);
    color: var(--band-text);
    background-color: #2b211b;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='48' height='24'%3E%3Cpath d='M0 .5h48M0 12.5h48M.5 0v12M24.5 12v12' stroke='%23000' stroke-opacity='.28'/%3E%3C/svg%3E");
    border-bottom: 3px solid var(--accent);
  }
  .band :global(.chip) {
    color: var(--band-muted);
  }
  .band :global(.chip.accent) {
    color: color-mix(in oklab, var(--accent) 60%, white);
  }
</style>

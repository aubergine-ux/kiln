<script lang="ts">
  import type { Snippet } from 'svelte'
  import Illustration, { type Art } from './Illustration.svelte'

  let { art, title, body, children }: { art: Art; title: string; body?: string; children?: Snippet } = $props()
</script>

<div class="empty">
  <Illustration {art} />
  <h3>{title}</h3>
  {#if body}<p>{body}</p>{/if}
  {#if children}<div class="actions">{@render children()}</div>{/if}
</div>

<style>
  .empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    padding: 48px 24px;
  }
  h3 {
    font-size: 18px;
    margin-top: 14px;
  }
  p {
    color: var(--muted);
    max-width: 360px;
    margin-top: 6px;
    line-height: 1.55;
  }
  .actions {
    display: flex;
    gap: 8px;
    margin-top: 18px;
  }
</style>

<script lang="ts">
  import type { Snippet } from 'svelte'
  import Icon from './Icon.svelte'

  let { icon, title, body, children }: { icon: string; title: string; body?: string; children?: Snippet } = $props()
</script>

<div class="empty">
  <div class="art">
    <div class="ring"></div>
    <Icon name={icon} size={34} stroke={1.7} />
  </div>
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
    padding: 56px 24px;
    animation: pop-in 300ms var(--ease);
  }
  .art {
    position: relative;
    width: 84px;
    height: 84px;
    display: grid;
    place-items: center;
    border-radius: 26px;
    color: var(--accent-text);
    background: var(--accent-soft);
    margin-bottom: 18px;
  }
  .ring {
    position: absolute;
    inset: -8px;
    border-radius: 32px;
    border: 1.5px dashed color-mix(in oklab, var(--accent) 35%, transparent);
  }
  h3 {
    font-size: 19px;
  }
  p {
    color: var(--muted);
    max-width: 380px;
    margin-top: 8px;
    line-height: 1.55;
  }
  .actions {
    display: flex;
    gap: 10px;
    margin-top: 20px;
  }
</style>

<script lang="ts">
  import { flip } from 'svelte/animate'
  import { fade, fly } from 'svelte/transition'
  import { dismissToast, toasts } from '@/lib/state.svelte'
  import Icon from './Icon.svelte'

  const icons = { ok: 'CircleCheck', error: 'CircleAlert', info: 'Info', warn: 'TriangleAlert' }
</script>

<div class="toasts" aria-live="polite">
  {#each toasts as t (t.id)}
    <div class="toast {t.kind}" animate:flip={{ duration: 200 }} in:fly={{ y: 10, duration: 160 }} out:fade={{ duration: 120 }}>
      <span class="ic"><Icon name={icons[t.kind]} size={20} /></span>
      <div class="text">
        <strong>{t.title}</strong>
        {#if t.body}<p class="selectable">{t.body}</p>{/if}
        {#if t.action}
          <button class="btn sm" onclick={() => (t.action?.run(), dismissToast(t.id))}>{t.action.label}</button>
        {/if}
      </div>
      <button class="btn ghost icon sm close" onclick={() => dismissToast(t.id)} aria-label="Dismiss"><Icon name="X" size={16} /></button>
    </div>
  {/each}
</div>

<style>
  .toasts {
    position: fixed;
    right: 20px;
    bottom: 20px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    z-index: 300;
    width: min(380px, calc(100vw - 40px));
    pointer-events: none;
  }
  .toast {
    pointer-events: auto;
    display: flex;
    gap: 10px;
    align-items: flex-start;
    padding: 12px 8px 12px 12px;
    border-radius: var(--r-3);
    background: var(--surface);
    border: 1px solid var(--border-strong);
    border-left: 3px solid var(--kind);
    box-shadow: var(--shadow-pop);
  }
  .ok { --kind: var(--ok); }
  .error { --kind: var(--danger); }
  .info { --kind: var(--info); }
  .warn { --kind: var(--warn); }
  .ic {
    margin-top: 1px;
    color: var(--kind);
  }
  .text {
    flex: 1;
    min-width: 0;
  }
  strong {
    font-weight: 600;
    display: block;
  }
  p {
    color: var(--text-2);
    font-size: 13px;
    margin-top: 2px;
    white-space: pre-line;
  }
  .text .btn {
    margin-top: 8px;
  }
  .close {
    margin-top: -3px;
  }
</style>

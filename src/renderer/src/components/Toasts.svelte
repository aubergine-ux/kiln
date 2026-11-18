<script lang="ts">
  import { flip } from 'svelte/animate'
  import { fly } from 'svelte/transition'
  import { dismissToast, toasts } from '@/lib/state.svelte'
  import Icon from './Icon.svelte'

  const icons = { ok: 'CircleCheck', error: 'CircleAlert', info: 'Info', warn: 'TriangleAlert' }
</script>

<div class="toasts" aria-live="polite">
  {#each toasts as t (t.id)}
    <div class="toast {t.kind}" animate:flip={{ duration: 200 }} in:fly={{ y: 16, duration: 220 }} out:fly={{ x: 40, duration: 180 }}>
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
    gap: 10px;
    z-index: 300;
    width: min(400px, calc(100vw - 40px));
    pointer-events: none;
  }
  .toast {
    pointer-events: auto;
    display: flex;
    gap: 12px;
    align-items: flex-start;
    padding: 14px 10px 14px 14px;
    border-radius: 16px;
    background: var(--surface);
    border: 1px solid var(--border);
    box-shadow: var(--shadow-lg);
  }
  .ic {
    margin-top: 1px;
  }
  .ok .ic { color: var(--ok); }
  .error .ic { color: var(--danger); }
  .info .ic { color: var(--info); }
  .warn .ic { color: var(--warn); }
  .error { border-color: color-mix(in oklab, var(--danger) 35%, var(--border)); }
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
    margin-top: 3px;
    white-space: pre-line;
  }
  .text .btn {
    margin-top: 10px;
  }
  .close {
    margin-top: -4px;
  }
</style>

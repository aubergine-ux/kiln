<script lang="ts">
  import { fly } from 'svelte/transition'
  import { app } from '@/lib/state.svelte'
  import Icon from './Icon.svelte'

  const jobs = $derived(Object.values(app.progress))
</script>

{#if jobs.length}
  <div class="dock" transition:fly={{ y: 10, duration: 160 }}>
    {#each jobs as p (p.task)}
      <div class="job">
        <Icon name="LoaderCircle" size={18} class="spin" />
        <div class="info">
          <div class="row">
            <span class="label">{p.label}</span>
            {#if p.total}<span class="count">{p.done} / {p.total}</span>{/if}
          </div>
          <div class="bar" class:indeterminate={!p.total}>
            <div class="fill" style:width="{p.total ? Math.min(100, (p.done / p.total) * 100) : 40}%"></div>
          </div>
        </div>
      </div>
    {/each}
  </div>
{/if}

<style>
  .dock {
    position: fixed;
    left: calc(var(--sidebar) + 20px);
    bottom: 20px;
    z-index: 250;
    width: 340px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .job {
    display: flex;
    gap: 10px;
    align-items: center;
    padding: 11px 12px;
    border-radius: var(--r-3);
    background: var(--surface);
    border: 1px solid var(--border-strong);
    box-shadow: var(--shadow-pop);
    color: var(--accent-text);
  }
  .info {
    flex: 1;
    min-width: 0;
  }
  .row {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    font-size: 13px;
    color: var(--text);
    margin-bottom: 6px;
  }
  .label {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-weight: 600;
  }
  .count {
    color: var(--muted);
    font-family: var(--font-mono);
    font-size: 12px;
  }
  .bar {
    height: 5px;
    border-radius: 99px;
    background: var(--surface-3);
    overflow: hidden;
  }
  .fill {
    height: 100%;
    background: var(--accent);
    transition: width 200ms var(--ease);
  }
  .indeterminate .fill {
    animation: slide 1.2s var(--ease) infinite;
  }
  @keyframes slide {
    from { transform: translateX(-100%); }
    to { transform: translateX(250%); }
  }
</style>

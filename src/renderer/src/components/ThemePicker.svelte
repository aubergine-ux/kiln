<script lang="ts">
  import type { Accent, Theme } from '@shared/types'
  import { app, saveSettings } from '@/lib/state.svelte'
  import Icon from './Icon.svelte'

  const THEMES: { id: Theme; label: string; icon: string }[] = [
    { id: 'system', label: 'System', icon: 'SunMoon' },
    { id: 'light', label: 'Light', icon: 'Sun' },
    { id: 'dark', label: 'Dark', icon: 'Moon' }
  ]
  const ACCENTS: { id: Accent; label: string; color: string }[] = [
    { id: 'ember', label: 'Ember', color: '#e5602f' },
    { id: 'moss', label: 'Moss', color: '#4f9a4a' },
    { id: 'sky', label: 'Sky', color: '#2f80e0' },
    { id: 'violet', label: 'Violet', color: '#7c5ce0' },
    { id: 'rose', label: 'Rose', color: '#dc4778' }
  ]
</script>

<div class="themes" role="radiogroup" aria-label="Theme">
  {#each THEMES as t (t.id)}
    <button role="radio" aria-checked={app.settings?.theme === t.id} class:on={app.settings?.theme === t.id} onclick={() => saveSettings({ theme: t.id })}>
      <div class="preview {t.id}">
        <div class="pv-side"></div>
        <div class="pv-main"><div class="pv-card"></div><div class="pv-card"></div></div>
      </div>
      <span><Icon name={t.icon} size={15} /> {t.label}</span>
    </button>
  {/each}
</div>

<div class="accents" role="radiogroup" aria-label="Accent colour">
  {#each ACCENTS as a (a.id)}
    <button role="radio" aria-checked={app.settings?.accent === a.id} class:on={app.settings?.accent === a.id} onclick={() => saveSettings({ accent: a.id })} title={a.label}>
      <span class="dot" style:background={a.color}>{#if app.settings?.accent === a.id}<Icon name="Check" size={14} stroke={3} />{/if}</span>
      {a.label}
    </button>
  {/each}
</div>

<style>
  .themes {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 10px;
  }
  .themes button {
    padding: 8px 8px 10px;
    border-radius: 14px;
    border: 1.5px solid var(--border);
    background: var(--surface);
    display: flex;
    flex-direction: column;
    gap: 8px;
    transition: border-color var(--fast), transform var(--fast);
  }
  .themes button:hover {
    transform: translateY(-1px);
  }
  .themes button.on {
    border-color: var(--accent);
    box-shadow: var(--focus);
  }
  .themes span {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    font-weight: 600;
    font-size: 13px;
  }
  .preview {
    height: 64px;
    border-radius: 9px;
    display: flex;
    overflow: hidden;
    border: 1px solid var(--border);
  }
  .pv-side {
    width: 28%;
  }
  .pv-main {
    flex: 1;
    display: flex;
    gap: 5px;
    padding: 8px;
  }
  .pv-card {
    flex: 1;
    border-radius: 5px;
  }
  .light { background: #faf7f2; }
  .light .pv-side { background: #f2ede5; }
  .light .pv-card { background: #fff; border: 1px solid #e6ddd0; }
  .dark { background: #15110e; }
  .dark .pv-side { background: #100d0a; }
  .dark .pv-card { background: #1e1915; border: 1px solid #342b24; }
  .system { background: linear-gradient(90deg, #faf7f2 50%, #15110e 50%); }
  .system .pv-side { background: #f2ede5; }
  .system .pv-card:first-child { background: #fff; border: 1px solid #e6ddd0; }
  .system .pv-card:last-child { background: #1e1915; border: 1px solid #342b24; }
  .accents {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 14px;
  }
  .accents button {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    height: 36px;
    padding: 0 14px 0 8px;
    border-radius: 99px;
    border: 1.5px solid var(--border);
    background: var(--surface);
    font-weight: 600;
    font-size: 13px;
  }
  .accents button.on {
    border-color: var(--accent);
  }
  .dot {
    width: 22px;
    height: 22px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    color: white;
  }
</style>

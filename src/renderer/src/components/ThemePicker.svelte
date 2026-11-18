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
    { id: 'ember', label: 'Ember', color: '#d4531c' },
    { id: 'moss', label: 'Moss', color: '#4d7c38' },
    { id: 'sky', label: 'Lapis', color: '#2e5ea8' },
    { id: 'violet', label: 'Amethyst', color: '#77519f' },
    { id: 'rose', label: 'Clay', color: '#b04a35' }
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
    gap: 8px;
  }
  .themes button {
    padding: 6px 6px 8px;
    border-radius: var(--r-3);
    border: 1px solid var(--border);
    background: var(--surface);
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .themes button.on {
    border-color: var(--accent);
    box-shadow: 0 0 0 1px var(--accent);
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
    height: 60px;
    border-radius: var(--r-2);
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
    flex-direction: column;
    gap: 4px;
    padding: 8px;
  }
  .pv-card {
    flex: 1;
    border-radius: 2px;
  }
  .light { background: #f2efe9; }
  .light .pv-side { background: #e8e3db; }
  .light .pv-card { background: #fbfaf7; border: 1px solid #ddd5c9; }
  .dark { background: #1a1815; }
  .dark .pv-side { background: #141210; }
  .dark .pv-card { background: #221f1b; border: 1px solid #36302a; }
  .system { background: linear-gradient(90deg, #f2efe9 50%, #1a1815 50%); }
  .system .pv-side { background: #e8e3db; }
  .system .pv-card:first-child { background: #fbfaf7; border: 1px solid #ddd5c9; }
  .system .pv-card:last-child { background: #221f1b; border: 1px solid #36302a; }
  .accents {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 12px;
  }
  .accents button {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    height: 32px;
    padding: 0 12px 0 6px;
    border-radius: var(--r-2);
    border: 1px solid var(--border);
    background: var(--surface);
    font-weight: 600;
    font-size: 13px;
  }
  .accents button.on {
    border-color: var(--accent);
    box-shadow: 0 0 0 1px var(--accent);
  }
  .dot {
    width: 20px;
    height: 20px;
    border-radius: var(--r-1);
    display: grid;
    place-items: center;
    color: white;
    box-shadow: inset 0 -2px 0 rgb(0 0 0 / 0.2);
  }
</style>

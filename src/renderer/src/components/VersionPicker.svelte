<script module lang="ts">
  import type { Loader } from '@shared/types'

  export interface Choice {
    versionId: string
    loader: Loader
    mcVersion: string
    loaderVersion?: string
    installed: boolean
  }
</script>

<script lang="ts">
  import { expectedVersionId, LOADERS } from '@shared/loaders'
  import { app } from '@/lib/state.svelte'
  import Icon from './Icon.svelte'

  /**
   * Choose a loader and a game version. Installed versions come from the launcher's
   * versions folder. Picking a loader that isn't installed yet is fine: Kiln shows
   * install steps and switches over once the installer has run.
   */

  let { value = $bindable() }: { value: Choice } = $props()

  const LOADER_TABS: Loader[] = ['vanilla', 'fabric', 'forge', 'neoforge', 'quilt']
  let loader = $state<Loader>(value.loader === 'other' || value.loader === 'optifine' ? 'vanilla' : value.loader)
  // A loader that isn't installed yet starts in "install for another version" with its game version filled in.
  // svelte-ignore state_referenced_locally
  let custom = $state(value.loader !== 'vanilla' && !value.installed ? value.mcVersion : '')
  // svelte-ignore state_referenced_locally
  let mode = $state<'installed' | 'new'>(value.loader !== 'vanilla' && !value.installed ? 'new' : 'installed')

  const installedForLoader = $derived(app.versions.filter((v) => (loader === 'vanilla' ? v.loader === 'vanilla' : v.loader === loader)))
  const vanillaVersions = $derived(app.versions.filter((v) => v.loader === 'vanilla'))
  const mcSuggestions = $derived([...new Set(app.versions.map((v) => v.mcVersion))])

  function pickInstalled(id: string) {
    const v = app.versions.find((x) => x.id === id)
    if (v) value = { versionId: v.id, loader: v.loader, mcVersion: v.mcVersion, loaderVersion: v.loaderVersion, installed: true }
    else if (id === 'latest-release' || id === 'latest-snapshot')
      value = { versionId: id, loader: 'vanilla', mcVersion: id === 'latest-release' ? 'Latest release' : 'Latest snapshot', installed: true }
  }

  function setLoader(l: Loader) {
    loader = l
    custom = ''
    if (l === 'vanilla') {
      mode = 'installed'
      pickInstalled(vanillaVersions[0]?.id ?? 'latest-release')
    } else if (installedForLoader.length) {
      mode = 'installed'
      pickInstalled(installedForLoader[0].id)
    } else {
      mode = 'new'
      planLoader(value.mcVersion && !value.mcVersion.startsWith('Latest') ? value.mcVersion : (vanillaVersions[0]?.mcVersion ?? ''))
    }
  }

  /** A loader that the user still has to install. */
  function planLoader(mc: string) {
    custom = mc
    value = { versionId: expectedVersionId(loader, mc.trim()), loader, mcVersion: mc.trim(), installed: false }
  }

  /** A vanilla version that isn't in the versions folder: the launcher downloads it by itself. */
  function customVanilla(id: string) {
    custom = id
    value = { versionId: id.trim(), loader: 'vanilla', mcVersion: id.trim(), installed: true }
  }
</script>

<div class="picker">
  <div class="loaders" role="radiogroup" aria-label="Mod loader">
    {#each LOADER_TABS as l (l)}
      <button role="radio" aria-checked={loader === l} class:on={loader === l} onclick={() => setLoader(l)}>{LOADERS[l].label}</button>
    {/each}
  </div>

  {#if loader !== 'vanilla'}
    <div class="modes">
      <button class:on={mode === 'installed'} disabled={!installedForLoader.length} onclick={() => ((mode = 'installed'), installedForLoader[0] && pickInstalled(installedForLoader[0].id))}>
        Installed ({installedForLoader.length})
      </button>
      <button class:on={mode === 'new'} onclick={() => ((mode = 'new'), planLoader(value.mcVersion.startsWith('Latest') ? '' : value.mcVersion))}>Install for another version</button>
    </div>
  {/if}

  {#if loader === 'vanilla'}
    <select class="input" value={custom ? '__custom' : value.versionId} onchange={(e) => {
      const v = (e.currentTarget as HTMLSelectElement).value
      if (v === '__custom') customVanilla(custom || '')
      else { custom = ''; pickInstalled(v) }
    }}>
      <option value="latest-release">Latest release (updates automatically)</option>
      <option value="latest-snapshot">Latest snapshot</option>
      {#if vanillaVersions.length}
        <optgroup label="Installed">
          {#each vanillaVersions as v (v.id)}<option value={v.id}>{v.id}{v.type && v.type !== 'release' ? ` (${v.type.replace('old_', '')})` : ''}</option>{/each}
        </optgroup>
      {/if}
      <option value="__custom">Another version…</option>
    </select>
    {#if custom !== '' || value.versionId === ''}
      <input class="input mt" placeholder="Version, e.g. 1.20.1" value={custom} oninput={(e) => customVanilla((e.currentTarget as HTMLInputElement).value)} list="mc-versions" />
      <p class="hint mt-s">The official launcher downloads vanilla versions by itself the first time you play.</p>
    {/if}
  {:else if mode === 'installed' && installedForLoader.length}
    <select class="input" value={value.versionId} onchange={(e) => pickInstalled((e.currentTarget as HTMLSelectElement).value)}>
      {#each installedForLoader as v (v.id)}<option value={v.id}>{v.mcVersion} · {LOADERS[v.loader].label} {v.loaderVersion ?? ''}</option>{/each}
    </select>
  {:else}
    <input class="input" placeholder="Game version, e.g. 1.21.1" value={custom} oninput={(e) => planLoader((e.currentTarget as HTMLInputElement).value)} list="mc-versions" />
    <p class="hint mt-s note"><Icon name="Info" size={14} /> {LOADERS[loader].label} isn't installed for this version yet. After creating, Kiln shows how to run the official installer and picks it up automatically.</p>
  {/if}

  <datalist id="mc-versions">
    {#each mcSuggestions as v (v)}<option value={v}></option>{/each}
  </datalist>
</div>

<style>
  .picker {
    display: flex;
    flex-direction: column;
  }
  .loaders,
  .modes {
    display: flex;
    gap: 4px;
    padding: 3px;
    border-radius: 12px;
    background: var(--surface-2);
    border: 1px solid var(--border);
    margin-bottom: 10px;
  }
  .loaders button,
  .modes button {
    flex: 1;
    height: 32px;
    border: none;
    border-radius: 9px;
    background: none;
    color: var(--muted);
    font-weight: 600;
    font-size: 13px;
    transition: background var(--fast), color var(--fast);
  }
  .loaders button.on,
  .modes button.on {
    background: var(--surface);
    color: var(--text);
    box-shadow: var(--shadow-sm);
  }
  .modes {
    background: none;
    border: none;
    padding: 0;
  }
  .modes button {
    flex: none;
    padding: 0 12px;
    height: 28px;
  }
  .modes button:disabled {
    opacity: 0.4;
  }
  .mt {
    margin-top: 8px;
  }
  .mt-s {
    margin-top: 6px;
  }
  .note {
    display: flex;
    gap: 6px;
    align-items: flex-start;
  }
  .note :global(.icon) {
    margin-top: 2px;
  }
</style>

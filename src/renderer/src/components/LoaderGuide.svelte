<script lang="ts">
  import type { Instance } from '@shared/types'
  import { LOADERS } from '@shared/loaders'
  import { api } from '@/lib/api'
  import { app, attempt, replaceInstance, toast } from '@/lib/state.svelte'
  import Icon from './Icon.svelte'

  /** Explains how to install a mod loader and switches the instance over once it shows up. */
  let { instance: inst, compact = false }: { instance: Instance; compact?: boolean } = $props()

  const info = $derived(LOADERS[inst.loader])
  const url = $derived(info.installer?.(inst.mcVersion))

  // Installers do not always use the same version names, so match on loader + game version.
  const match = $derived(
    app.versions.find(
      (v) => v.loader === inst.loader && v.mcVersion === inst.mcVersion && (!inst.loaderVersion || v.loaderVersion === inst.loaderVersion)
    ) ?? app.versions.find((v) => v.loader === inst.loader && v.mcVersion === inst.mcVersion)
  )

  let applying = false
  $effect(() => {
    if (match && match.id !== inst.versionId && !applying) {
      applying = true
      attempt(() => api.instances.update(inst.id, { versionId: match.id })).then((u) => {
        applying = false
        if (u) {
          replaceInstance(u)
          toast('ok', `${info.label} is installed`, `"${inst.name}" now uses ${match.id}.`)
        }
      })
    }
  })
</script>

<div class="guide" class:compact>
  <div class="icon"><Icon name="Wrench" size={20} /></div>
  <div class="body">
    <strong>Install {info.label} {inst.loaderVersion ?? ''} for {inst.mcVersion} to play this instance</strong>
    {#if !compact}
      <ol>
        <li>Open the official launcher once, so the installer can find it.</li>
        <li>Get the installer from the official {info.label} website.</li>
        <li>{info.steps ?? 'Run the installer for this game version.'}{inst.loaderVersion ? ` Choose loader version ${inst.loaderVersion} if asked.` : ''}</li>
        <li>Come back here. Kiln checks the launcher's versions folder and switches the instance over automatically.</li>
      </ol>
    {:else}
      <p>Run the official installer. Kiln will notice when it's done.</p>
    {/if}
    <div class="row">
      {#if url}<button class="btn sm primary" onclick={() => api.shell.openExternal(url)}><Icon name="ExternalLink" size={15} /> Get the {info.label} installer</button>{/if}
      <span class="watch"><Icon name="LoaderCircle" size={14} class="spin" /> Watching for {inst.versionId}</span>
    </div>
  </div>
</div>

<style>
  .guide {
    display: flex;
    gap: 14px;
    padding: 16px 18px;
    border-radius: var(--radius-lg);
    background: color-mix(in oklab, var(--warn) 9%, var(--surface));
    border: 1px solid color-mix(in oklab, var(--warn) 30%, var(--border));
  }
  .icon {
    width: 38px;
    height: 38px;
    border-radius: 12px;
    flex-shrink: 0;
    display: grid;
    place-items: center;
    color: color-mix(in oklab, var(--warn) 85%, var(--text));
    background: color-mix(in oklab, var(--warn) 16%, transparent);
  }
  .body {
    flex: 1;
    min-width: 0;
  }
  strong {
    font-weight: 650;
  }
  p {
    color: var(--text-2);
    margin-top: 2px;
    font-size: 13px;
  }
  ol {
    margin: 10px 0 0;
    padding-left: 20px;
    color: var(--text-2);
    line-height: 1.7;
  }
  .row {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 14px;
    margin-top: 12px;
  }
  .watch {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 12.5px;
    color: var(--muted);
  }
</style>

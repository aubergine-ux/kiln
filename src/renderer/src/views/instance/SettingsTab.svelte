<script lang="ts">
  import type { Instance } from '@shared/types'
  import { api } from '@/lib/api'
  import { app, attempt, replaceInstance, toast } from '@/lib/state.svelte'
  import { openModal } from '@/lib/modals.svelte'
  import { duplicate, exportInstance, remove } from '@/lib/actions'
  import { memory } from '@/lib/format'
  import Icon from '@/components/Icon.svelte'
  import InstanceIcon from '@/components/InstanceIcon.svelte'
  import VersionPicker, { type Choice } from '@/components/VersionPicker.svelte'
  import LoaderGuide from '@/components/LoaderGuide.svelte'

  let { instance: inst }: { instance: Instance } = $props()

  // svelte-ignore state_referenced_locally
  let name = $state(inst.name)
  // svelte-ignore state_referenced_locally
  let notes = $state(inst.notes ?? '')
  // svelte-ignore state_referenced_locally
  let memoryMb = $state(inst.memoryMb)
  // svelte-ignore state_referenced_locally
  let extra = $state(inst.extraJavaArgs ?? '')
  // svelte-ignore state_referenced_locally
  let version = $state<Choice>({ versionId: inst.versionId, loader: inst.loader, mcVersion: inst.mcVersion, loaderVersion: inst.loaderVersion, installed: inst.versionInstalled })

  async function save(patch: Parameters<typeof api.instances.update>[1], message?: string) {
    const u = await attempt(() => api.instances.update(inst.id, patch))
    if (u) {
      replaceInstance(u)
      if (message) toast('ok', message)
    }
  }

  const versionChanged = $derived(version.versionId !== inst.versionId || version.mcVersion !== inst.mcVersion)

  function applyVersion() {
    save(
      version.installed && app.versions.some((v) => v.id === version.versionId)
        ? { versionId: version.versionId }
        : { versionId: version.versionId, loader: version.loader, mcVersion: version.mcVersion, loaderVersion: version.loaderVersion },
      'Version updated'
    )
  }

  const systemGb = 16
</script>

<div class="scroll">
  <div class="cols">
    <section class="panel">
      <h3>General</h3>
      <div class="field">
        <label class="label" for="inst-name">Name</label>
        <input id="inst-name" class="input" bind:value={name} onblur={() => name.trim() && name !== inst.name && save({ name }, 'Renamed')} onkeydown={(e) => e.key === 'Enter' && (e.currentTarget as HTMLInputElement).blur()} />
        <p class="hint">Also used for the profile in the official launcher.</p>
      </div>
      <div class="field">
        <span class="label">Icon</span>
        <button class="icon-row" onclick={() => openModal({ kind: 'icon', instance: inst })}>
          <InstanceIcon icon={inst.icon} url={inst.iconUrl} size={44} />
          <span>Change icon</span>
          <Icon name="ChevronRight" size={16} />
        </button>
      </div>
      <div class="field">
        <label class="label" for="inst-folder">Folder</label>
        <select id="inst-folder" class="input" value={inst.group ?? ''} onchange={(e) => save({ group: (e.currentTarget as HTMLSelectElement).value })}>
          <option value="">No folder</option>
          {#each app.settings?.groups ?? [] as g (g)}<option value={g}>{g}</option>{/each}
        </select>
      </div>
      <div class="field">
        <label class="label" for="inst-notes">Notes</label>
        <textarea id="inst-notes" class="input" rows="3" bind:value={notes} placeholder="Server address, seed, what this pack is for…" onblur={() => notes !== (inst.notes ?? '') && save({ notes })}></textarea>
      </div>
    </section>

    <section class="panel">
      <h3>Game version</h3>
      <VersionPicker bind:value={version} />
      {#if versionChanged}
        <div class="apply">
          <button class="btn primary sm" onclick={applyVersion}>Use {version.mcVersion || 'this version'}{version.loader !== 'vanilla' ? ` with ${version.loader}` : ''}</button>
          <button class="btn sm ghost" onclick={() => (version = { versionId: inst.versionId, loader: inst.loader, mcVersion: inst.mcVersion, loaderVersion: inst.loaderVersion, installed: inst.versionInstalled })}>Cancel</button>
        </div>
      {/if}
      {#if !inst.versionInstalled}
        <div class="guide"><LoaderGuide instance={inst} /></div>
      {/if}
      <p class="hint mt">Launcher version id: <code class="selectable">{inst.versionId}</code></p>
    </section>

    <section class="panel">
      <h3>Memory</h3>
      <div class="mem">
        <input type="range" min="1024" max={systemGb * 1024} step="512" bind:value={memoryMb} onchange={() => save({ memoryMb }, `Memory set to ${memory(memoryMb)}`)} style:--p="{((memoryMb - 1024) / (systemGb * 1024 - 1024)) * 100}%" />
        <span class="mem-val">{memory(memoryMb)}</span>
      </div>
      <p class="hint">Vanilla and small packs run well on 2 to 4 GB. Big modpacks usually want 6 to 8 GB. Giving more than that rarely helps.</p>
      <div class="field mt">
        <label class="label" for="inst-jvm">Extra Java arguments</label>
        <input id="inst-jvm" class="input mono" bind:value={extra} placeholder="Optional, e.g. -Dfml.readTimeout=180" onblur={() => extra !== (inst.extraJavaArgs ?? '') && save({ extraJavaArgs: extra }, 'Java arguments saved')} />
      </div>
    </section>

    <section class="panel">
      <h3>Manage</h3>
      <div class="manage">
        <button class="btn" onclick={() => api.instances.openFolder(inst.id)}>Open instance folder</button>
        <button class="btn" onclick={() => duplicate(inst)}>Duplicate</button>
        <button class="btn" onclick={() => exportInstance(inst)}>Export as modpack</button>
      </div>
      <div class="danger-zone">
        <div>
          <strong>Delete instance</strong>
          <p class="hint">Moves the folder to the trash and removes its profile from the official launcher.</p>
        </div>
        <button class="btn danger" onclick={() => remove(inst)}>Delete</button>
      </div>
      <p class="hint mt">Profile in the official launcher: <code class="selectable">{inst.profileId}</code></p>
    </section>
  </div>
</div>

<style>
  .scroll {
    flex: 1;
    overflow: auto;
    padding: 18px 28px 40px;
  }
  .cols {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(380px, 1fr));
    gap: 16px;
    align-items: start;
  }
  section {
    padding: 20px 22px 22px;
  }
  h3 {
    font-size: 16px;
    margin-bottom: 16px;
  }
  .field + .field {
    margin-top: 16px;
  }
  .field .hint {
    margin-top: 6px;
  }
  .mt {
    margin-top: 14px;
  }
  .icon-row {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    padding: 8px 12px 8px 8px;
    border-radius: var(--r-2);
    border: 1px solid var(--border);
    background: var(--surface);
    color: var(--text);
    font-weight: 500;
    text-align: left;
  }
  .icon-row span {
    flex: 1;
  }
  .icon-row:hover {
    background: var(--surface-2);
  }
  .apply {
    display: flex;
    gap: 8px;
    margin-top: 12px;
  }
  .guide {
    margin-top: 14px;
  }
  code {
    font-family: var(--font-mono);
    font-size: 12px;
    padding: 1px 6px;
    border-radius: var(--r-1);
    background: var(--surface-2);
  }
  .mem {
    display: flex;
    align-items: center;
    gap: 14px;
    margin-bottom: 10px;
  }
  .mem-val {
    font-family: var(--font-mono);
    font-weight: 600;
    font-size: 15px;
    min-width: 64px;
    text-align: right;
  }
  input[type='range'] {
    flex: 1;
    appearance: none;
    height: 6px;
    border-radius: 99px;
    background: linear-gradient(90deg, var(--accent) var(--p), var(--surface-3) var(--p));
    outline: none;
  }
  input[type='range']::-webkit-slider-thumb {
    appearance: none;
    width: 18px;
    height: 18px;
    border-radius: var(--r-1);
    background: var(--surface);
    border: 2px solid var(--accent);
    cursor: grab;
  }
  .manage {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .danger-zone {
    display: flex;
    align-items: center;
    gap: 14px;
    justify-content: space-between;
    margin-top: 18px;
    padding: 12px 14px;
    border-radius: var(--r-2);
    border: 1px solid color-mix(in oklab, var(--danger) 30%, var(--border));
    background: color-mix(in oklab, var(--danger) 5%, transparent);
  }
  .danger-zone strong {
    font-weight: 600;
  }
</style>

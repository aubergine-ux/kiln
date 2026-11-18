<script lang="ts">
  import type { ExportOptions, Instance } from '@shared/types'
  import { api } from '@/lib/api'
  import { attempt, toast } from '@/lib/state.svelte'
  import Modal from '@/components/Modal.svelte'
  import Icon from '@/components/Icon.svelte'

  let { instance: inst, onclose }: { instance: Instance; onclose: () => void } = $props()

  let include = $state<ExportOptions['include']>({ mods: true, config: true, resourcepacks: true, shaderpacks: true, saves: false, options: true })
  let busy = $state(false)

  const OPTIONS: { key: keyof ExportOptions['include']; label: string; hint: string }[] = [
    { key: 'mods', label: 'Mods', hint: 'The mods folder' },
    { key: 'config', label: 'Mod settings', hint: 'config, defaultconfigs and kubejs' },
    { key: 'resourcepacks', label: 'Resource packs', hint: '' },
    { key: 'shaderpacks', label: 'Shader packs', hint: '' },
    { key: 'options', label: 'Game options & servers', hint: 'options.txt and the server list' },
    { key: 'saves', label: 'Worlds', hint: 'Can make the file much bigger' }
  ]

  async function run() {
    busy = true
    const path = await attempt(() => api.modpacks.export(inst.id, { include }), "Couldn't export the instance")
    busy = false
    if (path) {
      toast('ok', 'Exported', path)
      onclose()
    }
  }
</script>

<Modal title="Export {inst.name}" subtitle="Creates a modpack file your friends can import into Kiln, Prism Launcher or the Modrinth App." {onclose} width={500}>
  <div class="opts">
    {#each OPTIONS as o (o.key)}
      <label>
        <input type="checkbox" bind:checked={include[o.key]} />
        <span><strong>{o.label}</strong>{#if o.hint}<em>{o.hint}</em>{/if}</span>
      </label>
    {/each}
  </div>
  {#snippet footer()}
    <button class="btn" onclick={onclose}>Cancel</button>
    <button class="btn primary" disabled={busy} onclick={run}>
      {#if busy}<Icon name="LoaderCircle" size={16} class="spin" />{:else}<Icon name="Upload" size={16} />{/if} Export…
    </button>
  {/snippet}
</Modal>

<style>
  .opts {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }
  label {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 12px;
    border-radius: 12px;
    border: 1px solid var(--border);
    cursor: pointer;
  }
  label:hover {
    background: var(--surface-2);
  }
  input {
    accent-color: var(--accent);
    width: 16px;
    height: 16px;
    margin-top: 2px;
  }
  span {
    display: flex;
    flex-direction: column;
  }
  strong {
    font-weight: 600;
  }
  em {
    font-style: normal;
    font-size: 12px;
    color: var(--muted);
  }
</style>

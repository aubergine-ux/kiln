<script lang="ts">
  import { api } from '@/lib/api'
  import { app, attempt, saveSettings } from '@/lib/state.svelte'
  import Modal from '@/components/Modal.svelte'

  /** Create a folder, or rename one when `rename` is set. */
  let { rename, onclose }: { rename?: string; onclose: () => void } = $props()
  // svelte-ignore state_referenced_locally
  let name = $state(rename ?? '')
  let error = $state('')

  async function save() {
    const n = name.trim()
    if (!n) return
    const groups = app.settings?.groups ?? []
    if (rename) {
      const s = await attempt(() => api.instances.renameGroup(rename, n))
      if (!s) return
      app.settings = s
      if (app.folder === rename) app.folder = n
      app.instances = await api.instances.list()
    } else {
      if (groups.includes(n)) {
        error = 'There is already a folder with that name.'
        return
      }
      await saveSettings({ groups: [...groups, n] })
    }
    onclose()
  }
</script>

<Modal title={rename ? 'Rename folder' : 'New folder'} subtitle={rename ? undefined : 'Folders keep the home screen tidy. Drag instances onto them in the sidebar.'} {onclose} width={420}>
  <!-- svelte-ignore a11y_autofocus -->
  <input class="input" bind:value={name} placeholder="e.g. Survival, Modpacks, With friends" autofocus onkeydown={(e) => e.key === 'Enter' && save()} oninput={() => (error = '')} />
  {#if error}<p class="err">{error}</p>{/if}
  {#snippet footer()}
    <button class="btn" onclick={onclose}>Cancel</button>
    <button class="btn primary" disabled={!name.trim()} onclick={save}>{rename ? 'Rename' : 'Create folder'}</button>
  {/snippet}
</Modal>

<style>
  .err {
    color: var(--danger);
    font-size: 13px;
    margin-top: 8px;
  }
</style>

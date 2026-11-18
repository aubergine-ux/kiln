<script lang="ts">
  import type { Instance, InstanceIcon } from '@shared/types'
  import { api } from '@/lib/api'
  import { renderIconPng } from '@/lib/icons'
  import { attempt, replaceInstance, toast } from '@/lib/state.svelte'
  import Modal from '@/components/Modal.svelte'
  import IconPicker from '@/components/IconPicker.svelte'

  let { instance: inst, onclose }: { instance: Instance; onclose: () => void } = $props()
  // svelte-ignore state_referenced_locally
  let icon = $state<InstanceIcon>(inst.icon)
  // svelte-ignore state_referenced_locally
  let imageUrl = $state<string | undefined>(inst.icon.kind === 'image' ? inst.iconUrl : undefined)
  let saving = $state(false)

  async function save() {
    saving = true
    const png = await attempt(() => renderIconPng(icon, imageUrl))
    const u = png ? await attempt(() => api.instances.setIcon(inst.id, icon, png)) : undefined
    saving = false
    if (u) {
      replaceInstance(u)
      toast('ok', 'Icon updated', 'The official launcher shows it too.')
      onclose()
    }
  }
</script>

<Modal title="Choose an icon" subtitle={inst.name} {onclose} width={560}>
  <IconPicker bind:value={icon} bind:imageUrl />
  {#snippet footer()}
    <button class="btn" onclick={onclose}>Cancel</button>
    <button class="btn primary" disabled={saving} onclick={save}>Save icon</button>
  {/snippet}
</Modal>

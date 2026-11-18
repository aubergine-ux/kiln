<script lang="ts">
  import { dialogs } from '@/lib/state.svelte'
  import Modal from './Modal.svelte'

  const req = $derived(dialogs.confirm)
</script>

{#if req}
  <Modal title={req.title} onclose={() => req.resolve('cancel')} width={460}>
    {#if req.body}<p class="body">{req.body}</p>{/if}
    {#snippet footer()}
      <button class="btn" onclick={() => req.resolve('cancel')}>Cancel</button>
      {#if req.alt}<button class="btn" onclick={() => req.resolve('alt')}>{req.alt}</button>{/if}
      <!-- svelte-ignore a11y_autofocus -->
      <button class="btn {req.danger ? 'danger solid' : 'primary'}" autofocus onclick={() => req.resolve('confirm')}>{req.confirm}</button>
    {/snippet}
  </Modal>
{/if}

<style>
  .body {
    color: var(--text-2);
    line-height: 1.55;
  }
</style>

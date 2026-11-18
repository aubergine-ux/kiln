<script lang="ts">
  import { displayKeys, SHORTCUTS } from '@/lib/shortcuts'
  import Modal from '@/components/Modal.svelte'

  let { onclose }: { onclose: () => void } = $props()
</script>

<Modal title="Keyboard shortcuts" {onclose} width={460}>
  <ul>
    {#each SHORTCUTS as s (s.keys)}
      <li>
        <span>{s.label}</span>
        <span class="keys">{#each displayKeys(s.keys) as k (k)}<span class="kbd">{k}</span>{/each}</span>
      </li>
    {/each}
  </ul>
</Modal>

<style>
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  li {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 9px 0;
  }
  li + li {
    border-top: 1px solid var(--border);
  }
  .keys {
    display: flex;
    gap: 4px;
  }
</style>

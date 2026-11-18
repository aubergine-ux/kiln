<script lang="ts">
  import { parseMcText } from '@/lib/format'

  /** Text with § colour codes, as used in pack descriptions. */
  let { text }: { text: string } = $props()
  const runs = $derived(parseMcText(text))
</script>

{#each runs as r, i (i)}<span
    class="run"
    style:color={r.color ? `color-mix(in oklab, ${r.color} 78%, var(--text))` : undefined}
    style:font-weight={r.bold ? 700 : undefined}
    style:font-style={r.italic ? 'italic' : undefined}
    style:text-decoration={r.underline ? 'underline' : r.strike ? 'line-through' : undefined}>{r.text}</span
  >{/each}

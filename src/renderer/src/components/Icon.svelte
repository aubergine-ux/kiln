<script lang="ts">
  import { icon as lookup, svgMarkup } from '@/lib/icons'

  let { name, size = 18, stroke = 2, class: cls = '' }: { name: string; size?: number; stroke?: number; class?: string } = $props()
  const markup = $derived(svgMarkup(lookup(name), size, 'currentColor', stroke))
</script>

<span class="icon {cls}" style:width="{size}px" style:height="{size}px" aria-hidden="true">{@html markup}</span>

<style>
  .icon {
    display: inline-flex;
    flex-shrink: 0;
  }
  .icon :global(svg) {
    display: block;
  }
</style>

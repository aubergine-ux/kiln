<script lang="ts">
  import type { InstanceIcon } from '@shared/types'
  import { glyphNode, svgMarkup, TILE_COLORS } from '@/lib/icons'

  let { icon, url, size = 56 }: { icon: InstanceIcon; url?: string; size?: number } = $props()
  const colors = $derived(icon.kind === 'glyph' ? (TILE_COLORS[icon.color] ?? TILE_COLORS.ember) : null)
  const glyph = $derived(icon.kind === 'glyph' ? svgMarkup(glyphNode(icon.glyph), Math.round(size * 0.56), 'white', 1.9) : '')
</script>

<div class="tile" style:width="{size}px" style:height="{size}px" style:border-radius="{Math.round(size * 0.24)}px">
  {#if icon.kind === 'image' && url}
    <img src={url} alt="" draggable="false" />
  {:else if colors}
    <div class="glyph" style:background="linear-gradient(135deg, {colors[0]}, {colors[1]})">{@html glyph}</div>
  {:else}
    <div class="glyph" style:background="linear-gradient(135deg, #8a7c6e, #b5a796)">{@html svgMarkup(glyphNode('pickaxe'), Math.round(size * 0.56), 'white', 1.9)}</div>
  {/if}
</div>

<style>
  .tile {
    flex-shrink: 0;
    overflow: hidden;
    position: relative;
    box-shadow: 0 1px 2px rgb(0 0 0 / 0.12), 0 4px 12px rgb(0 0 0 / 0.08);
  }
  .tile::after {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: inherit;
    box-shadow: inset 0 0 0 1px rgb(255 255 255 / 0.12);
    background: linear-gradient(180deg, rgb(255 255 255 / 0.18), transparent 50%);
    pointer-events: none;
  }
  .glyph {
    width: 100%;
    height: 100%;
    display: grid;
    place-items: center;
  }
  .glyph :global(svg) {
    filter: drop-shadow(0 1px 1px rgb(0 0 0 / 0.15));
  }
  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    image-rendering: auto;
  }
</style>

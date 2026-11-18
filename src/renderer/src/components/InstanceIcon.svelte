<script lang="ts">
  import type { InstanceIcon } from '@shared/types'
  import { TILE_COLORS } from '@/lib/icons'
  import { glyphSvg } from '@/lib/glyphs'

  let { icon, url, size = 56 }: { icon: InstanceIcon; url?: string; size?: number } = $props()
  const color = $derived(icon.kind === 'glyph' ? (TILE_COLORS[icon.color] ?? TILE_COLORS.ember) : TILE_COLORS.slate)
  // Whole-pixel scaling keeps the pixel art sharp.
  const glyphSize = $derived(Math.max(1, Math.round((size * 0.62) / 12)) * 12)
  const glyph = $derived(glyphSvg(icon.kind === 'glyph' ? icon.glyph : 'pickaxe', glyphSize))
</script>

<div class="tile" style:width="{size}px" style:height="{size}px" style:border-radius="{Math.max(3, Math.round(size * 0.08))}px" style:--tile={color}>
  {#if icon.kind === 'image' && url}
    <img src={url} alt="" draggable="false" />
  {:else}
    <div class="glyph">{@html glyph}</div>
  {/if}
</div>

<style>
  .tile {
    flex-shrink: 0;
    overflow: hidden;
    position: relative;
    background: var(--tile);
  }
  /* Same block bevel as the PNG that goes to the launcher. */
  .tile::after {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: inherit;
    box-shadow:
      inset 0 2px 0 rgb(255 255 255 / 0.16),
      inset 0 -3px 0 rgb(0 0 0 / 0.18);
    pointer-events: none;
  }
  .glyph {
    width: 100%;
    height: 100%;
    display: grid;
    place-items: center;
    padding-bottom: 3%;
  }
  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
</style>

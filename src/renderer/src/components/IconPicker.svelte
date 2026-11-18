<script lang="ts">
  import type { InstanceIcon as Icon_ } from '@shared/types'
  import { fileToDataUrl, TILE_COLORS } from '@/lib/icons'
  import { GLYPH_NAMES, glyphSvg } from '@/lib/glyphs'
  import InstanceIcon from './InstanceIcon.svelte'

  /** Pick a glyph + colour, or upload an image. `imageUrl` holds an uploaded image (data: URL). */
  let { value = $bindable(), imageUrl = $bindable() }: { value: Icon_; imageUrl?: string } = $props()

  const glyph = $derived(value.kind === 'glyph' ? value.glyph : 'pickaxe')
  const color = $derived(value.kind === 'glyph' ? value.color : 'ember')
  let fileInput = $state<HTMLInputElement>()

  async function upload(e: Event) {
    const file = (e.currentTarget as HTMLInputElement).files?.[0]
    if (!file) return
    imageUrl = await fileToDataUrl(file)
    value = { kind: 'image', file: 'icon.png' }
  }
</script>

<div class="picker">
  <div class="preview">
    <InstanceIcon icon={value} url={value.kind === 'image' ? imageUrl : undefined} size={88} />
    <button class="btn sm" onclick={() => fileInput?.click()}>Use an image</button>
    <input bind:this={fileInput} type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden onchange={upload} />
  </div>
  <div class="choices">
    <div class="colors" role="radiogroup" aria-label="Colour">
      {#each Object.entries(TILE_COLORS) as [name, color] (name)}
        <button
          role="radio"
          aria-checked={value.kind === 'glyph' && color === name}
          aria-label={name}
          class="swatch"
          class:on={value.kind === 'glyph' && color === name}
          style:background={color}
          onclick={() => (value = { kind: 'glyph', glyph, color: name })}
        ></button>
      {/each}
    </div>
    <div class="glyphs" role="radiogroup" aria-label="Symbol" style:--tile={TILE_COLORS[color] ?? TILE_COLORS.ember}>
      {#each GLYPH_NAMES as g (g)}
        <button role="radio" aria-checked={value.kind === 'glyph' && glyph === g} aria-label={g} title={g} class:on={value.kind === 'glyph' && glyph === g} onclick={() => (value = { kind: 'glyph', glyph: g, color })}>
          {@html glyphSvg(g, 24)}
        </button>
      {/each}
    </div>
  </div>
</div>

<style>
  .picker {
    display: flex;
    gap: 22px;
  }
  .preview {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    padding-top: 4px;
  }
  .choices {
    flex: 1;
    min-width: 0;
  }
  .colors {
    display: flex;
    gap: 8px;
    margin-bottom: 12px;
  }
  .swatch {
    width: 26px;
    height: 26px;
    border-radius: var(--r-1);
    border: none;
    box-shadow: inset 0 -2px 0 rgb(0 0 0 / 0.2);
  }
  .swatch.on {
    box-shadow: inset 0 -2px 0 rgb(0 0 0 / 0.2), 0 0 0 2px var(--surface), 0 0 0 4px var(--text);
  }
  .glyphs {
    display: grid;
    grid-template-columns: repeat(8, 38px);
    gap: 6px;
    padding: 4px;
  }
  .glyphs button {
    height: 38px;
    border-radius: var(--r-1);
    border: none;
    background: var(--tile);
    display: grid;
    place-items: center;
    opacity: 0.55;
    box-shadow: inset 0 -2px 0 rgb(0 0 0 / 0.2);
  }
  .glyphs button:hover {
    opacity: 0.85;
  }
  .glyphs button.on {
    opacity: 1;
    box-shadow: inset 0 -2px 0 rgb(0 0 0 / 0.2), 0 0 0 2px var(--surface), 0 0 0 4px var(--text);
  }
</style>

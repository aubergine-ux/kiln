<script lang="ts">
  import type { InstanceIcon as Icon_ } from '@shared/types'
  import { fileToDataUrl, GLYPHS, TILE_COLORS } from '@/lib/icons'
  import InstanceIcon from './InstanceIcon.svelte'
  import Icon from './Icon.svelte'

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
    <button class="btn sm" onclick={() => fileInput?.click()}><Icon name="Upload" size={15} /> Upload image</button>
    <input bind:this={fileInput} type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden onchange={upload} />
  </div>
  <div class="choices">
    <div class="colors" role="radiogroup" aria-label="Colour">
      {#each Object.entries(TILE_COLORS) as [name, [a, b]] (name)}
        <button
          role="radio"
          aria-checked={value.kind === 'glyph' && color === name}
          aria-label={name}
          class="swatch"
          class:on={value.kind === 'glyph' && color === name}
          style:background="linear-gradient(135deg, {a}, {b})"
          onclick={() => (value = { kind: 'glyph', glyph, color: name })}
        ></button>
      {/each}
    </div>
    <div class="glyphs" role="radiogroup" aria-label="Symbol">
      {#each Object.keys(GLYPHS) as g (g)}
        <button role="radio" aria-checked={value.kind === 'glyph' && glyph === g} aria-label={g} title={g} class:on={value.kind === 'glyph' && glyph === g} onclick={() => (value = { kind: 'glyph', glyph: g, color })}>
          <Icon name={GLYPHS[g]} size={20} />
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
    width: 28px;
    height: 28px;
    border-radius: 9px;
    border: none;
    transition: transform var(--fast) var(--ease-spring);
  }
  .swatch:hover {
    transform: scale(1.12);
  }
  .swatch.on {
    box-shadow: 0 0 0 2px var(--surface), 0 0 0 4px var(--text);
  }
  .glyphs {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(38px, 1fr));
    gap: 4px;
    max-height: 168px;
    overflow: auto;
    padding: 2px;
  }
  .glyphs button {
    height: 38px;
    border-radius: 10px;
    border: 1px solid transparent;
    background: none;
    color: var(--text-2);
    display: grid;
    place-items: center;
    transition: background var(--fast);
  }
  .glyphs button:hover {
    background: var(--surface-2);
  }
  .glyphs button.on {
    background: var(--accent-soft);
    border-color: color-mix(in oklab, var(--accent) 40%, transparent);
    color: var(--accent-text);
  }
</style>

<script module lang="ts">
  export type Art = 'kiln' | 'crate' | 'world' | 'camera' | 'scroll' | 'search' | 'folder'
</script>

<script lang="ts">
  /** Small line drawings for empty states. Strokes follow the text colour, with one accent detail. */
  let { art }: { art: Art } = $props()
</script>

<svg viewBox="0 0 120 96" width="120" height="96" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round">
  {#if art === 'kiln'}
    <path d="M20 84h80" />
    <rect x="54" y="10" width="12" height="12" fill="var(--surface)" />
    <path d="M28 84V50a32 32 0 0 1 64 0v34" fill="var(--surface)" />
    <path d="M34 46h52M32 60h10M78 60h10M32 72h10M78 72h10" stroke-opacity=".35" />
    <path d="M46 84V64a14 14 0 0 1 28 0v20" fill="var(--surface-3)" />
    <circle cx="55" cy="79" r="1.6" fill="var(--accent)" stroke="none" />
    <circle cx="62" cy="81" r="1.2" fill="var(--accent)" stroke="none" />
    <circle cx="66" cy="78" r="1" fill="var(--accent)" stroke="none" />
    <path d="M60 6c-3-3 3-5 0-8" stroke-opacity=".4" />
  {:else if art === 'crate'}
    <path d="M18 86h84" />
    <rect x="30" y="44" width="60" height="42" fill="var(--surface)" />
    <path d="M30 58h60M30 72h60M44 44v42M76 44v42" stroke-opacity=".35" />
    <path d="M30 44l6-16h60l-6 16" fill="var(--surface-3)" />
    <rect x="52" y="16" width="16" height="16" fill="var(--accent)" stroke="var(--accent)" transform="rotate(12 60 24)" />
  {:else if art === 'world'}
    <rect x="20" y="16" width="80" height="64" rx="4" fill="var(--surface)" />
    <path d="M20 62l14-10 10 6 16-14 14 10 10-6 16 12v16a4 4 0 0 1-4 4H24a4 4 0 0 1-4-4z" fill="var(--surface-3)" />
    <rect x="78" y="24" width="10" height="10" fill="var(--accent)" stroke="var(--accent)" />
    <path d="M30 30h14M34 36h18" stroke-opacity=".35" />
  {:else if art === 'camera'}
    <rect x="22" y="30" width="76" height="50" rx="4" fill="var(--surface)" />
    <path d="M42 30l6-10h24l6 10" fill="var(--surface-3)" />
    <circle cx="60" cy="55" r="14" fill="var(--surface-3)" />
    <circle cx="60" cy="55" r="6" />
    <rect x="84" y="36" width="6" height="4" fill="var(--accent)" stroke="var(--accent)" />
  {:else if art === 'scroll'}
    <path d="M34 14h52v66a6 6 0 0 1-6 6H40" fill="var(--surface)" />
    <path d="M28 20a6 6 0 0 1 6-6h0a6 6 0 0 1 6 6v60a6 6 0 0 1-6 6h0a6 6 0 0 1-6-6z" fill="var(--surface-3)" />
    <path d="M48 28h28M48 38h22M48 48h28M48 58h16" stroke-opacity=".4" />
    <path d="M48 68h24" stroke="var(--accent)" />
  {:else if art === 'search'}
    <path d="M24 26h40M24 36h30M24 46h36M24 56h22" stroke-opacity=".35" />
    <circle cx="70" cy="50" r="16" fill="var(--surface)" />
    <path d="M82 62l14 14" stroke-width="4" stroke="var(--accent)" />
  {:else if art === 'folder'}
    <path d="M22 30h26l6 8h44v42H22z" fill="var(--surface-3)" />
    <path d="M22 80l8-32h76l-8 32z" fill="var(--surface)" />
    <path d="M58 58h20" stroke="var(--accent)" />
  {/if}
</svg>

<style>
  svg {
    display: block;
    color: var(--text-2);
  }
</style>

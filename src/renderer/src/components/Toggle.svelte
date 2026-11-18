<script lang="ts">
  let { checked, onchange, label, disabled = false }: { checked: boolean; onchange: (v: boolean) => void; label: string; disabled?: boolean } = $props()
</script>

<button
  class="toggle"
  class:on={checked}
  role="switch"
  aria-checked={checked}
  aria-label={label}
  title={label}
  {disabled}
  onclick={(e) => {
    e.stopPropagation()
    onchange(!checked)
  }}
>
  <span class="knob"></span>
</button>

<style>
  .toggle {
    width: 36px;
    height: 20px;
    border-radius: 99px;
    border: none;
    padding: 0;
    background: var(--border-strong);
    position: relative;
    flex-shrink: 0;
    transition: background var(--med) var(--ease);
  }
  .toggle.on {
    background: var(--text-2);
  }
  .knob {
    position: absolute;
    top: 2px;
    left: 2px;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: white;
    box-shadow: 0 1px 2px rgb(0 0 0 / 0.25);
    transition: transform var(--med) var(--ease);
  }
  .on .knob {
    transform: translateX(16px);
  }
  .toggle:disabled {
    opacity: 0.5;
  }
</style>

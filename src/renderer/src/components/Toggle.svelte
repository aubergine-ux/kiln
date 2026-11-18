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
    width: 40px;
    height: 24px;
    border-radius: 99px;
    border: none;
    padding: 0;
    background: var(--surface-3);
    position: relative;
    flex-shrink: 0;
    transition: background var(--med) var(--ease);
    box-shadow: inset 0 1px 2px rgb(0 0 0 / 0.08);
  }
  .toggle.on {
    background: var(--accent);
  }
  .knob {
    position: absolute;
    top: 3px;
    left: 3px;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: white;
    box-shadow: 0 1px 3px rgb(0 0 0 / 0.25);
    transition: transform var(--med) var(--ease-spring);
  }
  .on .knob {
    transform: translateX(16px);
  }
  .toggle:disabled {
    opacity: 0.5;
  }
</style>

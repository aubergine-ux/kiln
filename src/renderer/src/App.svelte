<script lang="ts">
  import { onMount } from 'svelte'
  import { fade } from 'svelte/transition'
  import { pathForFile } from '@/lib/api'
  import { app, init, navigate, current } from '@/lib/state.svelte'
  import { applyTheme, watchSystemTheme } from '@/lib/theme.svelte'
  import { closeModal, modal, openModal } from '@/lib/modals.svelte'
  import { dropFiles } from '@/lib/drop.svelte'
  import { isMod, isTyping } from '@/lib/shortcuts'
  import { play } from '@/lib/actions'
  import Sidebar from '@/components/Sidebar.svelte'
  import Toasts from '@/components/Toasts.svelte'
  import ProgressDock from '@/components/ProgressDock.svelte'
  import ContextMenu from '@/components/ContextMenu.svelte'
  import ConfirmDialog from '@/components/ConfirmDialog.svelte'
  import Icon from '@/components/Icon.svelte'
  import Home from '@/views/Home.svelte'
  import InstanceView from '@/views/InstanceView.svelte'
  import SettingsView from '@/views/SettingsView.svelte'
  import Setup from '@/views/Setup.svelte'
  import NewInstanceModal from '@/views/modals/NewInstanceModal.svelte'
  import ImportModal from '@/views/modals/ImportModal.svelte'
  import ExportModal from '@/views/modals/ExportModal.svelte'
  import ShortcutsModal from '@/views/modals/ShortcutsModal.svelte'
  import IconModal from '@/views/modals/IconModal.svelte'
  import FolderModal from '@/views/modals/FolderModal.svelte'

  let dragging = $state(false)
  let dragDepth = 0

  onMount(async () => {
    await init()
    applyTheme()
    watchSystemTheme()
  })

  $effect(() => {
    // Re-apply whenever theme settings change.
    void app.settings?.theme
    void app.settings?.accent
    void app.settings?.reduceMotion
    applyTheme()
  })

  const hasFiles = (e: DragEvent) => e.dataTransfer?.types.includes('Files') ?? false

  function ondragenter(e: DragEvent) {
    if (!hasFiles(e) || !app.settings?.setupComplete) return
    dragDepth++
    dragging = true
  }
  function ondragleave(e: DragEvent) {
    if (!hasFiles(e)) return
    dragDepth = Math.max(0, dragDepth - 1)
    if (dragDepth === 0) dragging = false
  }
  function ondragover(e: DragEvent) {
    if (hasFiles(e)) e.preventDefault()
  }
  function ondrop(e: DragEvent) {
    if (!hasFiles(e)) return
    dragDepth = 0
    dragging = false
    if (e.defaultPrevented) return // an instance card already handled it
    e.preventDefault()
    const paths = [...(e.dataTransfer?.files ?? [])].map(pathForFile).filter(Boolean)
    dropFiles(paths, current.instance?.id)
  }

  function onkeydown(e: KeyboardEvent) {
    if (!app.settings?.setupComplete) return
    if (isMod(e) && e.key.toLowerCase() === 'n') {
      e.preventDefault()
      openModal({ kind: 'new' })
    } else if (isMod(e) && e.key.toLowerCase() === 'i') {
      e.preventDefault()
      openModal({ kind: 'import' })
    } else if (isMod(e) && e.key === ',') {
      e.preventDefault()
      navigate({ view: 'settings' })
    } else if (isMod(e) && e.key === 'Enter') {
      e.preventDefault()
      const target = current.instance ?? [...app.instances].sort((a, b) => (b.lastPlayed ?? '').localeCompare(a.lastPlayed ?? ''))[0]
      if (target) play(target)
    } else if (isMod(e) && e.key.toLowerCase() === 'k') {
      e.preventDefault()
      if (app.route.view !== 'home') navigate({ view: 'home' })
      setTimeout(() => document.getElementById('search')?.focus(), 30)
    } else if (e.key === '?' && !isTyping(e)) {
      openModal({ kind: 'shortcuts' })
    } else if (e.key === 'Escape' && !isTyping(e) && !modal.current && app.route.view !== 'home') {
      navigate({ view: 'home' })
    }
  }
</script>

<svelte:window {onkeydown} {ondragenter} {ondragleave} {ondragover} {ondrop} />

{#if app.ready && app.settings}
  {#if !app.settings.setupComplete}
    <Setup />
  {:else}
    <div class="shell" class:mac={window.kiln.platform === 'darwin'}>
      <Sidebar />
      <main>
        {#key app.route.view === 'instance' ? `i:${app.route.id}` : app.route.view}
          <div class="view" in:fade={{ duration: 160 }}>
            {#if app.route.view === 'home'}
              <Home />
            {:else if app.route.view === 'instance'}
              <InstanceView />
            {:else if app.route.view === 'settings'}
              <SettingsView />
            {/if}
          </div>
        {/key}
      </main>
    </div>

    {#if modal.current?.kind === 'new'}<NewInstanceModal onclose={closeModal} />{/if}
    {#if modal.current?.kind === 'import'}<ImportModal file={modal.current.file} onclose={closeModal} />{/if}
    {#if modal.current?.kind === 'export'}<ExportModal instance={modal.current.instance} onclose={closeModal} />{/if}
    {#if modal.current?.kind === 'shortcuts'}<ShortcutsModal onclose={closeModal} />{/if}
    {#if modal.current?.kind === 'icon'}<IconModal instance={modal.current.instance} onclose={closeModal} />{/if}
    {#if modal.current?.kind === 'folder'}<FolderModal rename={modal.current.rename} onclose={closeModal} />{/if}

    {#if dragging}
      <div class="drop-overlay" transition:fade={{ duration: 120 }}>
        <div class="drop-card">
          <div class="drop-icon"><Icon name="Download" size={30} /></div>
          <h2>{current.instance ? `Drop to add to ${current.instance.name}` : 'Drop a modpack to import it'}</h2>
          <p>
            {current.instance
              ? 'Mods, resource packs, shader packs, data packs and worlds go to the right place automatically.'
              : 'Modrinth .mrpack and CurseForge .zip files work. To add mods, drop them on an instance card.'}
          </p>
        </div>
      </div>
    {/if}
  {/if}
  <ConfirmDialog />
  <ContextMenu />
  <Toasts />
  <ProgressDock />
{/if}

<style>
  .shell {
    display: flex;
    height: 100vh;
  }
  main {
    flex: 1;
    min-width: 0;
    position: relative;
    background: var(--bg);
  }
  .view {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
  }
  .drop-overlay {
    position: fixed;
    inset: 10px;
    border-radius: 22px;
    border: 2.5px dashed var(--accent);
    background: color-mix(in oklab, var(--bg) 82%, transparent);
    backdrop-filter: blur(8px);
    display: grid;
    place-items: center;
    z-index: 150;
    pointer-events: none;
  }
  .drop-card {
    text-align: center;
    max-width: 420px;
    animation: pop-in 200ms var(--ease);
  }
  .drop-icon {
    width: 72px;
    height: 72px;
    margin: 0 auto 16px;
    border-radius: 22px;
    display: grid;
    place-items: center;
    color: white;
    background: linear-gradient(135deg, var(--accent), var(--accent-2));
    box-shadow: 0 10px 30px color-mix(in oklab, var(--accent) 40%, transparent);
    animation: bob 1.4s var(--ease) infinite alternate;
  }
  @keyframes bob {
    to { transform: translateY(-6px); }
  }
  .drop-card h2 {
    font-size: 22px;
  }
  .drop-card p {
    margin-top: 8px;
    color: var(--text-2);
  }
</style>

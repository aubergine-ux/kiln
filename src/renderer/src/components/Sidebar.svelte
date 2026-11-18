<script lang="ts">
  import { app, navigate, openInstance } from '@/lib/state.svelte'
  import { openModal } from '@/lib/modals.svelte'
  import { openMenuAt } from '@/lib/menu.svelte'
  import { moveToGroup } from '@/lib/actions'
  import { api } from '@/lib/api'
  import { attempt, confirm, saveSettings } from '@/lib/state.svelte'
  import Icon from './Icon.svelte'
  import Logo from './Logo.svelte'
  import InstanceIcon from './InstanceIcon.svelte'

  const groups = $derived(app.settings?.groups ?? [])
  const pinned = $derived(app.instances.filter((i) => i.pinned).sort((a, b) => a.name.localeCompare(b.name)))
  let dropTarget = $state<string | null>(null)

  const isHome = $derived(app.route.view === 'home')

  function showFolder(g: string | null) {
    app.folder = g
    navigate({ view: 'home' })
  }

  function folderMenu(e: MouseEvent, g: string) {
    openMenuAt(e, [
      { label: 'Rename folder', icon: 'Pencil', run: () => openModal({ kind: 'folder', rename: g }) },
      {
        label: 'Delete folder',
        icon: 'Trash2',
        danger: true,
        run: async () => {
          const c = await confirm({ title: `Delete the "${g}" folder?`, body: 'Instances inside it are kept and move back to "All instances".', confirm: 'Delete folder', danger: true })
          if (c !== 'confirm') return
          const s = await attempt(() => api.instances.setGroups(groups.filter((x) => x !== g)))
          if (s) {
            app.settings = s
            if (app.folder === g) app.folder = null
            app.instances = await api.instances.list()
          }
        }
      }
    ])
  }

  function ondrop(e: DragEvent, g: string | undefined) {
    const id = e.dataTransfer?.getData('application/x-kiln-instance')
    dropTarget = null
    if (!id) return
    e.preventDefault()
    const inst = app.instances.find((i) => i.id === id)
    if (inst) moveToGroup(inst, g)
  }

  function ondragover(e: DragEvent, key: string) {
    if (e.dataTransfer?.types.includes('application/x-kiln-instance')) {
      e.preventDefault()
      dropTarget = key
    }
  }

  // Reorder folders by dragging them.
  let draggingGroup = $state<string | null>(null)
  async function reorder(target: string) {
    if (!draggingGroup || draggingGroup === target) return
    const list = groups.filter((g) => g !== draggingGroup)
    list.splice(list.indexOf(target), 0, draggingGroup)
    draggingGroup = null
    await saveSettings({ groups: list })
  }

  const launcherOk = $derived(app.launcher?.launcherFound && app.launcher?.minecraftDirFound)
</script>

<aside>
  <div class="brand drag-region">
    <Logo size={30} />
    <span class="name">Kiln</span>
  </div>

  <nav class="no-drag">
    <button class="item" class:active={isHome && app.folder === null} onclick={() => showFolder(null)}
      ondragover={(e) => ondragover(e, '__all')} ondragleave={() => (dropTarget = null)} ondrop={(e) => ondrop(e, undefined)} class:target={dropTarget === '__all'}>
      <Icon name="LayoutGrid" size={18} /> <span>All instances</span>
      <span class="count">{app.instances.length}</span>
    </button>

    <div class="section">
      <span>Folders</span>
      <button class="btn ghost icon sm" title="New folder" aria-label="New folder" onclick={() => openModal({ kind: 'folder' })}><Icon name="FolderPlus" size={16} /></button>
    </div>
    {#each groups as g (g)}
      <div
        class="item folder"
        class:active={isHome && app.folder === g}
        class:target={dropTarget === g}
        role="button"
        tabindex="0"
        draggable="true"
        ondragstart={(e) => {
          draggingGroup = g
          e.dataTransfer?.setData('application/x-kiln-group', g)
        }}
        ondragend={() => (draggingGroup = null)}
        onclick={() => showFolder(g)}
        onkeydown={(e) => e.key === 'Enter' && showFolder(g)}
        oncontextmenu={(e) => (e.preventDefault(), folderMenu(e, g))}
        ondragover={(e) => {
          if (draggingGroup) e.preventDefault()
          else ondragover(e, g)
        }}
        ondragleave={() => (dropTarget = null)}
        ondrop={(e) => (draggingGroup ? reorder(g) : ondrop(e, g))}
      >
        <Icon name={app.folder === g && isHome ? 'FolderOpen' : 'Folder'} size={18} />
        <span>{g}</span>
        <span class="count">{app.instances.filter((i) => i.group === g).length}</span>
        <button class="more btn ghost icon sm" aria-label="Folder options" onclick={(e) => folderMenu(e, g)}><Icon name="Ellipsis" size={16} /></button>
      </div>
    {:else}
      <p class="empty-hint">Drag instances onto a folder to sort them.</p>
    {/each}

    {#if pinned.length}
      <div class="section"><span>Pinned</span></div>
      {#each pinned as inst (inst.id)}
        <button class="item pinned" class:active={app.route.view === 'instance' && app.route.id === inst.id} onclick={() => openInstance(inst.id)}>
          <InstanceIcon icon={inst.icon} url={inst.iconUrl} size={22} />
          <span>{inst.name}</span>
        </button>
      {/each}
    {/if}
  </nav>

  <div class="bottom no-drag">
    <button class="item" onclick={() => openModal({ kind: 'import' })}><Icon name="FolderInput" size={18} /> <span>Import</span></button>
    <button class="item" class:active={app.route.view === 'settings'} onclick={() => navigate({ view: 'settings' })}><Icon name="Settings" size={18} /> <span>Settings</span></button>
    <button class="status" onclick={() => navigate({ view: 'settings' })} title={launcherOk ? 'The official launcher was found' : 'Click to fix'}>
      <span class="dot" class:ok={launcherOk}></span>
      {launcherOk ? 'Official launcher ready' : 'Launcher not found'}
    </button>
  </div>
</aside>

<style>
  aside {
    width: var(--sidebar);
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    background: var(--bg-sunken);
    border-right: 1px solid var(--border);
  }
  .brand {
    height: 64px;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 18px 0;
  }
  :global(.mac) .brand {
    padding-top: 40px;
    height: 84px;
  }
  .name {
    font-family: var(--font-display);
    font-weight: 700;
    font-size: 21px;
    letter-spacing: -0.02em;
  }
  nav {
    flex: 1;
    overflow: auto;
    padding: 10px 10px;
  }
  .item {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    height: 36px;
    padding: 0 10px;
    border: none;
    border-radius: 10px;
    background: transparent;
    color: var(--text-2);
    font-weight: 550;
    text-align: left;
    transition: background var(--fast), color var(--fast), transform var(--fast);
    cursor: pointer;
    outline: none;
  }
  .item span:not(.count) {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .item:hover {
    background: color-mix(in oklab, var(--text) 6%, transparent);
    color: var(--text);
  }
  .item.active {
    background: var(--surface);
    color: var(--text);
    box-shadow: var(--shadow-sm);
  }
  .item.active :global(.icon) {
    color: var(--accent-text);
  }
  .item.target {
    background: var(--accent-soft);
    color: var(--accent-text);
    transform: scale(1.02);
    box-shadow: inset 0 0 0 1.5px var(--accent);
  }
  .count {
    font-size: 12px;
    color: var(--muted);
    font-variant-numeric: tabular-nums;
  }
  .folder .more {
    display: none;
    margin-right: -6px;
  }
  .folder:hover .more {
    display: inline-flex;
  }
  .folder:hover .count {
    display: none;
  }
  .section {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 18px 6px 6px 10px;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.07em;
    text-transform: uppercase;
    color: var(--muted);
  }
  .empty-hint {
    font-size: 12.5px;
    color: var(--muted);
    padding: 4px 10px;
  }
  .pinned {
    height: 34px;
  }
  .bottom {
    padding: 10px;
    border-top: 1px solid var(--border);
  }
  .status {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    margin-top: 6px;
    padding: 8px 10px;
    border: none;
    border-radius: 10px;
    background: none;
    font-size: 12px;
    color: var(--muted);
    text-align: left;
  }
  .status:hover {
    background: color-mix(in oklab, var(--text) 5%, transparent);
  }
  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--danger);
    box-shadow: 0 0 0 3px color-mix(in oklab, var(--danger) 20%, transparent);
  }
  .dot.ok {
    background: var(--ok);
    box-shadow: 0 0 0 3px color-mix(in oklab, var(--ok) 20%, transparent);
  }
</style>

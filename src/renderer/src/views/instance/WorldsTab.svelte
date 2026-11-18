<script lang="ts">
  import { untrack } from 'svelte'
  import type { Instance, World, WorldBackup } from '@shared/types'
  import { api } from '@/lib/api'
  import { app, attempt, confirm, toast } from '@/lib/state.svelte'
  import { dropState } from '@/lib/drop.svelte'
  import { openMenuAt } from '@/lib/menu.svelte'
  import { bytes, dateTime, stripMc, timeAgo } from '@/lib/format'
  import Icon from '@/components/Icon.svelte'
  import McText from '@/components/McText.svelte'
  import EmptyState from '@/components/EmptyState.svelte'

  let { instance: inst }: { instance: Instance } = $props()
  let worlds = $state<World[]>([])
  let backups = $state<WorldBackup[]>([])
  let loading = $state(true)
  let busy = $state<string | null>(null)

  async function load() {
    const [w, b] = await Promise.all([attempt(() => api.worlds.list(inst.id)), attempt(() => api.worlds.backups(inst.id))])
    worlds = w ?? []
    backups = b ?? []
    loading = false
  }

  $effect(() => {
    void dropState.version
    untrack(load)
  })

  async function backup(w: World) {
    busy = w.folder
    const b = await attempt(() => api.worlds.backup(inst.id, w.folder), `Couldn't back up ${stripMc(w.name)}`)
    busy = null
    if (b) {
      toast('ok', `Backed up ${stripMc(w.name)}`, `${bytes(b.size)} saved to Kiln's backups folder.`)
      await load()
    }
  }

  async function restore(b: WorldBackup) {
    const exists = worlds.some((w) => w.folder === b.world)
    let mode: 'replace' | 'copy' = 'copy'
    if (exists) {
      const c = await confirm({
        title: `Restore "${b.world}"?`,
        body: `This world already exists. Replace it with the backup from ${dateTime(b.created)} (the current one goes to the trash), or keep both?`,
        confirm: 'Replace',
        alt: 'Keep both',
        danger: true
      })
      if (c === 'cancel') return
      mode = c === 'confirm' ? 'replace' : 'copy'
    }
    const folder = await attempt(() => api.worlds.restore(inst.id, b.path, mode), "Couldn't restore the backup")
    if (folder) {
      toast('ok', `Restored ${folder}`)
      await load()
    }
  }

  async function removeBackup(b: WorldBackup) {
    const c = await confirm({ title: 'Delete this backup?', body: `${b.file} goes to the trash.`, confirm: 'Delete', danger: true })
    if (c !== 'confirm') return
    if (await attempt(() => api.worlds.deleteBackup(inst.id, b.file).then(() => true))) await load()
  }

  async function removeWorld(w: World) {
    const c = await confirm({
      title: `Delete "${stripMc(w.name)}"?`,
      body: 'The world folder goes to the trash. Tip: make a backup first.',
      confirm: 'Delete world',
      alt: 'Back up first',
      danger: true
    })
    if (c === 'alt') return backup(w)
    if (c !== 'confirm') return
    if (await attempt(() => api.worlds.remove(inst.id, w.folder).then(() => true))) {
      toast('ok', `Deleted ${stripMc(w.name)}`)
      await load()
    }
  }

  async function copyTo(w: World, targetId: string) {
    const target = app.instances.find((i) => i.id === targetId)
    const folder = await attempt(() => api.worlds.copy(inst.id, w.folder, targetId), "Couldn't copy the world")
    if (folder) {
      toast('ok', `Copied ${stripMc(w.name)}`, `to ${target?.name}${targetId === inst.id ? ` as "${folder}"` : ''}`)
      if (targetId === inst.id) await load()
    }
  }

  function worldMenu(e: MouseEvent, w: World) {
    const others = app.instances.filter((i) => i.id !== inst.id)
    openMenuAt(e, [
      { label: 'Back up now', icon: 'Archive', run: () => backup(w) },
      { label: 'Open folder', icon: 'FolderOpen', run: () => api.instances.openFolder(inst.id, `saves/${w.folder}`) },
      { label: 'Duplicate here', icon: 'Copy', run: () => copyTo(w, inst.id) },
      { separator: true, label: '' },
      { label: 'Copy to instance', heading: true },
      ...(others.length ? others.map((o) => ({ label: o.name, icon: 'ArrowRight', run: () => copyTo(w, o.id) })) : [{ label: 'No other instances', disabled: true }]),
      { separator: true, label: '' },
      { label: 'Delete world', icon: 'Trash2', danger: true, run: () => removeWorld(w) }
    ])
  }

  async function addWorld() {
    const files = await api.dialog.pickFiles('Add a world (zip)', [{ name: 'World archive', extensions: ['zip'] }], false)
    if (!files.length) return
    const folder = await attempt(() => api.worlds.import(inst.id, files[0]), "Couldn't add the world")
    if (folder) {
      toast('ok', `Added ${folder}`)
      await load()
    }
  }
</script>

<div class="toolbar">
  <h3>{worlds.length} {worlds.length === 1 ? 'world' : 'worlds'}</h3>
  <div class="spacer"></div>
  <button class="btn" onclick={() => api.worlds.openBackups(inst.id)}><Icon name="Archive" size={16} /> Backups folder</button>
  <button class="btn" onclick={() => api.instances.openFolder(inst.id, 'saves')}><Icon name="FolderOpen" size={16} /> Open saves</button>
  <button class="btn primary" onclick={addWorld}><Icon name="Plus" size={16} stroke={2.4} /> Add world</button>
</div>

<div class="scroll">
  {#if !loading && worlds.length === 0}
    <EmptyState icon="Globe" title="No worlds yet" body="Worlds you create in the game show up here. You can also drag a world folder or .zip into this window." />
  {:else}
    <div class="grid">
      {#each worlds as w (w.folder)}
        <div class="world card" role="group" oncontextmenu={(e) => (e.preventDefault(), worldMenu(e, w))}>
          <div class="cover">
            {#if w.iconUrl}<img src={w.iconUrl} alt="" draggable="false" />{:else}<div class="ph"><Icon name="Mountain" size={34} stroke={1.6} /></div>{/if}
            {#if w.hardcore}<span class="badge hard"><Icon name="Heart" size={12} /> Hardcore</span>{:else if w.gameMode}<span class="badge">{w.gameMode}</span>{/if}
          </div>
          <div class="body">
            <div class="name"><McText text={w.name} /></div>
            <div class="meta">
              <span>{timeAgo(w.lastPlayed)}</span>
              {#if w.version}<span>· {w.version}</span>{/if}
            </div>
            <div class="folder">{w.folder}</div>
            <div class="actions">
              <button class="btn sm" disabled={busy === w.folder} onclick={() => backup(w)}>
                {#if busy === w.folder}<Icon name="LoaderCircle" size={15} class="spin" /> Backing up…{:else}<Icon name="Archive" size={15} /> Back up{/if}
              </button>
              <button class="btn sm ghost icon" aria-label="More" onclick={(e) => worldMenu(e, w)}><Icon name="Ellipsis" size={17} /></button>
            </div>
          </div>
        </div>
      {/each}
    </div>
  {/if}

  {#if backups.length}
    <h4 class="sub">Backups</h4>
    <ul class="backups">
      {#each backups as b (b.file)}
        <li>
          <Icon name="Archive" size={18} />
          <div class="b-text">
            <strong>{b.world}</strong>
            <span>{dateTime(b.created)} · {bytes(b.size)}</span>
          </div>
          <button class="btn sm" onclick={() => restore(b)}><Icon name="RotateCcw" size={15} /> Restore</button>
          <button class="btn sm ghost icon" aria-label="Show in folder" title="Show in folder" onclick={() => api.shell.showItem(b.path)}><Icon name="FolderOpen" size={16} /></button>
          <button class="btn sm ghost icon danger" aria-label="Delete backup" title="Delete backup" onclick={() => removeBackup(b)}><Icon name="Trash2" size={16} /></button>
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .toolbar {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 16px 28px 12px;
  }
  .toolbar h3 {
    font-size: 16px;
  }
  .spacer {
    flex: 1;
  }
  .scroll {
    flex: 1;
    overflow: auto;
    padding: 0 28px 40px;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
    gap: 14px;
  }
  .world {
    overflow: hidden;
    animation: pop-in 300ms var(--ease) both;
    transition: transform var(--med) var(--ease), box-shadow var(--med);
  }
  .world:hover {
    transform: translateY(-2px);
    box-shadow: var(--shadow);
  }
  .cover {
    position: relative;
    aspect-ratio: 16 / 8;
    background: var(--surface-2);
    overflow: hidden;
  }
  .cover img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    image-rendering: pixelated;
  }
  .ph {
    width: 100%;
    height: 100%;
    display: grid;
    place-items: center;
    color: color-mix(in oklab, var(--accent) 60%, var(--muted));
    background:
      radial-gradient(circle at 30% 20%, var(--accent-soft), transparent 60%),
      linear-gradient(180deg, var(--surface-2), var(--surface-3));
  }
  .badge {
    position: absolute;
    top: 10px;
    left: 10px;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 3px 9px;
    border-radius: 99px;
    font-size: 11.5px;
    font-weight: 650;
    color: white;
    background: rgb(0 0 0 / 0.5);
    backdrop-filter: blur(6px);
  }
  .badge.hard {
    background: color-mix(in oklab, var(--danger) 80%, black);
  }
  .body {
    padding: 12px 14px 14px;
  }
  .name {
    font-weight: 650;
    font-size: 15px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .meta {
    font-size: 12.5px;
    color: var(--text-2);
    margin-top: 2px;
  }
  .folder {
    font-size: 11.5px;
    color: var(--muted);
    margin-top: 2px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .actions {
    display: flex;
    justify-content: space-between;
    margin-top: 12px;
  }
  .sub {
    margin: 30px 0 12px;
    font-family: var(--font);
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--muted);
  }
  .backups {
    list-style: none;
    margin: 0;
    padding: 0;
    border: 1px solid var(--border);
    border-radius: 14px;
    background: var(--surface);
    overflow: hidden;
  }
  .backups li {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 12px 10px 16px;
    color: var(--muted);
  }
  .backups li + li {
    border-top: 1px solid var(--border);
  }
  .b-text {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }
  .b-text strong {
    color: var(--text);
    font-weight: 600;
  }
  .b-text span {
    font-size: 12.5px;
  }
</style>

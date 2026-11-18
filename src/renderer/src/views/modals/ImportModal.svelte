<script lang="ts">
  import { untrack } from 'svelte'
  import type { ExternalInstance, ModpackResult, ModpackSummary } from '@shared/types'
  import { LOADERS } from '@shared/loaders'
  import { api, pathForFile } from '@/lib/api'
  import { attempt, openInstance, refreshInstances, toast } from '@/lib/state.svelte'
  import Modal from '@/components/Modal.svelte'
  import Icon from '@/components/Icon.svelte'

  let { file: initialFile, onclose }: { file?: string; onclose: () => void } = $props()

  let tab = $state<'modpack' | 'launchers'>('modpack')

  let file = $state<string | null>(null)
  let summary = $state<ModpackSummary | null>(null)
  let name = $state('')
  let importing = $state(false)
  let result = $state<ModpackResult | null>(null)
  let over = $state(false)

  async function inspect(path: string) {
    file = path
    summary = null
    result = null
    summary = (await attempt(() => api.modpacks.inspect(path))) ?? null
    if (!summary) file = null
    else name = summary.name
  }
  $effect.pre(() => {
    if (initialFile) untrack(() => inspect(initialFile))
  })

  async function pickPack() {
    const files = await api.dialog.pickFiles('Choose a modpack', [{ name: 'Modpacks', extensions: ['mrpack', 'zip'] }], false)
    if (files[0]) inspect(files[0])
  }

  async function importPack() {
    if (!file || !summary) return
    importing = true
    result = (await attempt(() => api.modpacks.import(file!, name), "Couldn't import the modpack")) ?? null
    importing = false
    if (result) {
      await refreshInstances()
      if (!result.manual.length) {
        toast('ok', `Imported ${name}`, `${result.downloaded} files downloaded and checked.`)
        onclose()
        openInstance(result.instanceId)
      }
    }
  }

  let found = $state<ExternalInstance[] | null>(null)
  let selected = $state<Set<string>>(new Set())
  let importingExternal = $state(false)

  async function scan() {
    found = (await attempt(() => api.importers.scan())) ?? []
  }

  async function pickFolder() {
    const dir = await api.dialog.pickFolder('Choose an instance folder (Prism, MultiMC or CurseForge)')
    if (!dir) return
    const more = await attempt(() => api.importers.scanFolder(dir))
    if (more) {
      const known = new Set((found ?? []).map((f) => f.path))
      found = [...(found ?? []), ...more.filter((m) => !known.has(m.path))]
      for (const m of more) selected.add(m.path)
      selected = new Set(selected)
    }
  }

  async function importSelected() {
    importingExternal = true
    let count = 0
    let last: string | undefined
    for (const path of selected) {
      const inst = await attempt(() => api.importers.import(path), `Couldn't import ${path.split(/[\\/]/).pop()}`)
      if (inst) {
        count++
        last = inst.id
      }
    }
    importingExternal = false
    await refreshInstances()
    if (count) {
      toast('ok', `Imported ${count} ${count === 1 ? 'instance' : 'instances'}`, 'Files were copied; the originals are untouched.')
      onclose()
      if (count === 1 && last) openInstance(last)
    }
  }

  $effect(() => {
    if (tab === 'launchers' && found === null) scan()
  })

  const SOURCE = { prism: 'Prism Launcher', multimc: 'MultiMC', curseforge: 'CurseForge' }

  function ondrop(e: DragEvent) {
    e.preventDefault()
    over = false
    const f = e.dataTransfer?.files[0]
    if (f) inspect(pathForFile(f))
  }
</script>

<Modal title="Import" subtitle="Bring in a modpack file or instances from another launcher." {onclose} width={620}>
  <div class="tabs">
    <button class:on={tab === 'modpack'} onclick={() => (tab = 'modpack')}><Icon name="Package" size={16} /> Modpack file</button>
    <button class:on={tab === 'launchers'} onclick={() => (tab = 'launchers')}><Icon name="FolderInput" size={16} /> Other launchers</button>
  </div>

  {#if tab === 'modpack'}
    {#if result}
      <div class="result">
        <div class="ok"><Icon name="CircleCheck" size={22} /> <strong>{name} was imported</strong></div>
        <p class="hint">{result.downloaded} files were downloaded and checked against the pack's checksums.</p>
        {#if result.manual.length}
          <div class="manual">
            <strong><Icon name="TriangleAlert" size={16} /> {result.manual.length} files need to be added by hand</strong>
            <p class="hint">
              CurseForge packs only list project numbers, not download links. Download these from their pages and drop them onto the instance.
            </p>
            <ul>
              {#each result.manual as m, i (i)}
                <li>
                  <span class="mname">{m.name}</span>
                  <span class="reason">{m.reason}</span>
                  {#if m.url?.startsWith('https://')}<button class="btn sm" onclick={() => api.shell.openExternal(m.url!)}><Icon name="ExternalLink" size={14} /> Open</button>{/if}
                </li>
              {/each}
            </ul>
          </div>
        {/if}
      </div>
    {:else if summary}
      <div class="summary">
        <div class="pack-icon"><Icon name="Package" size={26} /></div>
        <div class="pack-text">
          <strong>{summary.name}</strong>
          <span>
            {summary.format === 'mrpack' ? 'Modrinth pack' : 'CurseForge pack'}{summary.version ? ` · v${summary.version}` : ''}{summary.author ? ` · by ${summary.author}` : ''}
          </span>
          {#if summary.summary}<p>{summary.summary}</p>{/if}
          <div class="chips">
            <span class="chip">{summary.mcVersion}</span>
            {#if summary.loader !== 'vanilla'}<span class="chip accent">{LOADERS[summary.loader].label} {summary.loaderVersion ?? ''}</span>{/if}
            <span class="chip">{summary.fileCount} files</span>
          </div>
        </div>
        <button class="btn ghost sm" onclick={() => ((summary = null), (file = null))}>Change</button>
      </div>
      {#if summary.manualCount}
        <p class="warn"><Icon name="TriangleAlert" size={15} /> {summary.manualCount} of {summary.fileCount} files have no direct download link (CurseForge only lists project numbers). Kiln will import everything else and list those for you.</p>
      {/if}
      <label class="label mt" for="pack-name">Instance name</label>
      <input id="pack-name" class="input" bind:value={name} />
    {:else}
      <button
        class="drop"
        class:over
        onclick={pickPack}
        ondragover={(e) => {
          e.preventDefault()
          e.stopPropagation()
          over = true
        }}
        ondragleave={() => (over = false)}
        ondrop={(e) => (e.stopPropagation(), ondrop(e))}
      >
        <Icon name="Download" size={28} />
        <strong>Drop a modpack here, or click to choose</strong>
        <span>Modrinth .mrpack or CurseForge .zip</span>
      </button>
    {/if}
  {:else}
    {#if found === null}
      <p class="hint loading"><Icon name="LoaderCircle" size={16} class="spin" /> Looking for other launchers</p>
    {:else if found.length === 0}
      <p class="hint">Kiln didn't find Prism Launcher or CurseForge instances in their usual places. Choose a folder to import from.</p>
    {:else}
      <ul class="ext">
        {#each found as f (f.path)}
          <li>
            <label>
              <input
                type="checkbox"
                checked={selected.has(f.path)}
                onchange={(e) => {
                  if ((e.currentTarget as HTMLInputElement).checked) selected.add(f.path)
                  else selected.delete(f.path)
                  selected = new Set(selected)
                }}
              />
              {#if f.iconUrl}<img src={f.iconUrl} alt="" />{:else}<span class="ph"><Icon name="Box" size={16} /></span>{/if}
              <span class="ext-text">
                <strong>{f.name}</strong>
                <span>{SOURCE[f.source]} · {f.mcVersion || 'unknown version'}{f.loader !== 'vanilla' ? ` · ${LOADERS[f.loader].label}` : ''}</span>
              </span>
            </label>
          </li>
        {/each}
      </ul>
    {/if}
    <button class="btn sm mt" onclick={pickFolder}>Choose a folder…</button>
    <p class="hint mt">Kiln copies the instance's files; nothing in the other launcher is changed.</p>
  {/if}

  {#snippet footer()}
    {#if tab === 'modpack'}
      {#if result}
        <button class="btn primary" onclick={() => (onclose(), openInstance(result!.instanceId))}>Open instance</button>
      {:else}
        <button class="btn" onclick={onclose}>Cancel</button>
        <button class="btn primary" disabled={!summary || importing || !name.trim()} onclick={importPack}>
          {#if importing}<Icon name="LoaderCircle" size={16} class="spin" /> Importing…{:else}Import modpack{/if}
        </button>
      {/if}
    {:else}
      <button class="btn" onclick={onclose}>Cancel</button>
      <button class="btn primary" disabled={!selected.size || importingExternal} onclick={importSelected}>
        {#if importingExternal}<Icon name="LoaderCircle" size={16} class="spin" /> Copying…{:else}Import {selected.size || ''} {selected.size === 1 ? 'instance' : 'instances'}{/if}
      </button>
    {/if}
  {/snippet}
</Modal>

<style>
  .tabs {
    display: flex;
    gap: 2px;
    padding: 2px;
    border-radius: var(--r-2);
    background: var(--surface-3);
    margin-bottom: 18px;
  }
  .tabs button {
    flex: 1;
    height: 34px;
    border: none;
    border-radius: var(--r-1);
    background: none;
    color: var(--muted);
    font-weight: 600;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
  }
  .tabs button.on {
    background: var(--surface);
    color: var(--text);
    box-shadow: var(--shadow);
  }
  .drop {
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    padding: 38px 20px;
    border-radius: var(--r-3);
    border: 2px dashed var(--border-strong);
    background: var(--surface-2);
    color: var(--muted);
    transition: border-color var(--fast), background var(--fast);
  }
  .drop strong {
    color: var(--text);
    font-weight: 600;
    margin-top: 6px;
  }
  .drop:hover,
  .drop.over {
    border-color: var(--accent);
    background: var(--accent-soft);
    color: var(--accent-text);
  }
  .summary {
    display: flex;
    gap: 14px;
    padding: 16px;
    border-radius: var(--r-3);
    border: 1px solid var(--border);
    background: var(--surface-2);
    align-items: flex-start;
  }
  .pack-icon {
    width: 52px;
    height: 52px;
    border-radius: var(--r-3);
    flex-shrink: 0;
    display: grid;
    place-items: center;
    color: var(--accent-text);
    background: var(--accent-soft);
  }
  .pack-text {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .pack-text strong {
    font-size: 16px;
  }
  .pack-text span,
  .pack-text p {
    color: var(--text-2);
    font-size: 13px;
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 8px;
  }
  .warn {
    display: flex;
    gap: 8px;
    margin-top: 12px;
    font-size: 13px;
    color: color-mix(in oklab, var(--warn) 75%, var(--text));
  }
  .mt {
    margin-top: 14px;
  }
  .result .ok {
    display: flex;
    align-items: center;
    gap: 10px;
    color: var(--ok);
    font-size: 16px;
  }
  .result .ok strong {
    color: var(--text);
  }
  .result > .hint {
    margin: 6px 0 0 32px;
  }
  .manual {
    margin-top: 16px;
    padding: 14px;
    border-radius: var(--r-3);
    border: 1px solid color-mix(in oklab, var(--warn) 30%, var(--border));
    background: color-mix(in oklab, var(--warn) 6%, transparent);
  }
  .manual > strong {
    display: flex;
    gap: 8px;
    align-items: center;
  }
  .manual ul {
    list-style: none;
    margin: 12px 0 0;
    padding: 0;
    max-height: 220px;
    overflow: auto;
  }
  .manual li {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 6px 0;
  }
  .mname {
    flex: 1;
    font-weight: 550;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .reason {
    font-size: 12px;
    color: var(--muted);
  }
  .loading {
    display: flex;
    gap: 8px;
    align-items: center;
  }
  .ext {
    list-style: none;
    margin: 0;
    padding: 0;
    max-height: 300px;
    overflow: auto;
    border: 1px solid var(--border);
    border-radius: var(--r-3);
  }
  .ext li + li {
    border-top: 1px solid var(--border);
  }
  .ext label {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 14px;
    cursor: pointer;
  }
  .ext label:hover {
    background: var(--surface-2);
  }
  .ext input {
    accent-color: var(--accent);
    width: 16px;
    height: 16px;
  }
  .ext img,
  .ph {
    width: 32px;
    height: 32px;
    border-radius: var(--r-1);
    flex-shrink: 0;
  }
  .ph {
    display: grid;
    place-items: center;
    background: var(--surface-3);
    color: var(--muted);
  }
  .ext-text {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
  .ext-text span {
    font-size: 12.5px;
    color: var(--muted);
  }
</style>

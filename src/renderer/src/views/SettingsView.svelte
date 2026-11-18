<script lang="ts">
  import type { LauncherCandidate } from '@shared/types'
  import { api } from '@/lib/api'
  import { app, attempt, refreshLauncher, refreshVersions, refreshInstances, saveSettings, toast } from '@/lib/state.svelte'
  import { openModal } from '@/lib/modals.svelte'
  import { memory } from '@/lib/format'
  import Icon from '@/components/Icon.svelte'
  import TopBar from '@/components/TopBar.svelte'
  import ThemePicker from '@/components/ThemePicker.svelte'
  import Toggle from '@/components/Toggle.svelte'
  import Logo from '@/components/Logo.svelte'
  import NotAffiliated from '@/components/NotAffiliated.svelte'

  let info = $state<{ version: string; totalMemMb: number } | null>(null)
  api.app.info().then((i) => (info = i))
  refreshLauncher()

  let found = $state<LauncherCandidate[] | null>(null)
  let detecting = $state(false)
  let defaultMem = $state(app.settings?.defaultMemoryMb ?? 4096)
  const maxMem = $derived(Math.max(4096, Math.min(32768, Math.floor((info?.totalMemMb ?? 16384) / 1024) * 1024)))

  async function detect() {
    detecting = true
    const d = await attempt(() => api.setup.detect())
    detecting = false
    if (!d) return
    found = d.launchers
    if (d.launchers.length && !app.launcher?.launcherFound) await useLauncher(d.launchers[0])
    else if (!d.launchers.length) toast('warn', 'No official launcher found', 'Install it from minecraft.net, open it once, then click Detect. You can also use Browse.')
  }

  async function useLauncher(c: LauncherCandidate) {
    await saveSettings({ launcher: c })
    await refreshLauncher()
    toast('ok', 'Launcher updated', c.label)
  }

  async function browse() {
    const file = await api.dialog.pickLauncher()
    if (!file) return
    const c = await attempt(() => api.setup.customLauncher(file))
    if (c) await useLauncher(c)
  }

  async function changeGameDir() {
    const dir = await api.dialog.pickFolder('Choose the game folder (.minecraft)', app.settings?.minecraftDir)
    if (!dir) return
    await saveSettings({ minecraftDir: dir })
    await Promise.all([refreshLauncher(), refreshVersions()])
    await refreshInstances()
    toast('ok', 'Game folder updated', 'Profiles are written there from now on. Press Play on an instance to add its profile.')
  }

  const l = $derived(app.launcher)
</script>

<TopBar>
  <h1>Settings</h1>
</TopBar>

<div class="scroll">
  <div class="wrap">
    <section class="panel">
      <h3>Appearance</h3>
      <ThemePicker />
      <div class="row-setting">
        <div>
          <strong>Reduce motion</strong>
          <p class="hint">Turns off most animations.</p>
        </div>
        <Toggle checked={app.settings?.reduceMotion ?? false} label="Reduce motion" onchange={(v) => saveSettings({ reduceMotion: v })} />
      </div>
    </section>

    <section class="panel">
      <h3>Official launcher</h3>
      <div class="status" class:ok={l?.launcherFound} class:bad={l && !l.launcherFound}>
        <Icon name={l?.launcherFound ? 'CircleCheck' : 'CircleAlert'} size={20} />
        <div class="status-text">
          <strong>{l?.launcherFound ? 'Found' : 'Official launcher not found'}</strong>
          {#if l?.launcher}<code class="selectable">{l.launcher.kind === 'store' ? 'Microsoft Store app' : l.launcher.path}</code>{/if}
          {#if l && !l.launcherFound}
            <p>Install it from minecraft.net, open it once, then click Detect. If it lives somewhere unusual, use Browse.</p>
          {/if}
          {#if l?.running}<p class="running"><Icon name="Info" size={14} /> The launcher is open right now. Kiln's changes show up the next time it starts.</p>{/if}
        </div>
      </div>
      <div class="buttons">
        <button class="btn sm" onclick={detect} disabled={detecting}>Detect</button>
        <button class="btn sm" onclick={browse}>Browse…</button>
        {#if l && !l.launcherFound}<button class="btn sm primary" onclick={() => api.shell.openExternal('https://www.minecraft.net/download')}><Icon name="ExternalLink" size={14} /> Get the launcher</button>{/if}
      </div>
      {#if found && found.length > 1}
        <div class="found">
          {#each found as c (c.path)}
            <button class="btn sm" class:primary={l?.launcher?.path === c.path} onclick={() => useLauncher(c)}>{c.label}</button>
          {/each}
        </div>
      {/if}

      <div class="path-row">
        <div>
          <strong>Game folder</strong>
          <code class="selectable">{app.settings?.minecraftDir}</code>
          {#if l && !l.minecraftDirFound}<p class="bad-text">This folder doesn't exist yet. Open the official launcher once to create it.</p>{/if}
        </div>
        <div class="buttons">
          <button class="btn sm" onclick={() => api.shell.openMinecraftDir()}>Open</button>
          <button class="btn sm" onclick={changeGameDir}>Change</button>
        </div>
      </div>
      <div class="path-row">
        <div>
          <strong>Profile backups</strong>
          <p class="hint">Kiln copies {l?.profilesFile?.split(/[\\/]/).pop() ?? 'launcher_profiles.json'} here before every change and keeps the last 40.</p>
        </div>
        <button class="btn sm" onclick={() => api.launcher.openBackups()}>Open</button>
      </div>
    </section>

    <section class="panel">
      <h3>Storage & defaults</h3>
      <div class="path-row">
        <div>
          <strong>Instances folder</strong>
          <code class="selectable">{app.settings?.dataDir}</code>
        </div>
        <button class="btn sm" onclick={() => api.shell.openDataDir()}>Open</button>
      </div>
      <div class="mem">
        <div>
          <strong>Memory for new instances</strong>
          <p class="hint">Each instance can override this in its own settings.</p>
        </div>
        <div class="mem-ctl">
          <input type="range" min="1024" max={maxMem} step="512" bind:value={defaultMem} onchange={() => saveSettings({ defaultMemoryMb: defaultMem })} style:--p="{((defaultMem - 1024) / (maxMem - 1024)) * 100}%" />
          <span>{memory(defaultMem)}</span>
        </div>
      </div>
    </section>

    <section class="panel">
      <h3>Keyboard</h3>
      <div class="row-setting">
        <p class="hint">Most actions have a shortcut.</p>
        <button class="btn sm" onclick={() => openModal({ kind: 'shortcuts' })}>Show shortcuts <span class="kbd">?</span></button>
      </div>
    </section>

    <section class="panel about">
      <Logo size={56} />
      <div>
        <h3 class="no-icon">Kiln {info?.version ?? ''}</h3>
        <p class="hint">Free and open source under the MIT license.</p>
        <div class="buttons">
          <button class="btn sm" onclick={() => api.shell.openExternal('https://github.com/aubergine-ux/kiln')}><Icon name="ExternalLink" size={14} /> Source code</button>
          <button class="btn sm" onclick={() => api.shell.openExternal('https://github.com/aubergine-ux/kiln/issues')}>Report a problem</button>
        </div>
        <div class="notice"><NotAffiliated /></div>
      </div>
    </section>
  </div>
</div>

<style>
  h1 {
    font-size: 24px;
  }
  .scroll {
    flex: 1;
    overflow: auto;
    padding: 12px 28px 48px;
  }
  .wrap {
    max-width: 760px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  section {
    padding: 20px 22px;
  }
  h3 {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 16px;
    margin-bottom: 14px;
  }
  .row-setting,
  .path-row,
  .mem {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    margin-top: 18px;
    padding-top: 16px;
    border-top: 1px solid var(--border);
  }
  .row-setting:first-of-type {
    margin-top: 18px;
  }
  .path-row > div:first-child,
  .mem > div:first-child {
    min-width: 0;
  }
  strong {
    font-weight: 600;
  }
  code {
    display: block;
    margin-top: 3px;
    font-family: var(--font-mono);
    font-size: 11.5px;
    color: var(--muted);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .status {
    display: flex;
    gap: 12px;
    padding: 12px 14px;
    border-radius: var(--r-2);
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-left: 3px solid var(--muted);
  }
  .status.ok {
    border-left-color: var(--ok);
  }
  .status.ok :global(.icon) {
    color: var(--ok);
  }
  .status.bad {
    border-left-color: var(--danger);
  }
  .status.bad > :global(.icon) {
    color: var(--danger);
  }
  .status-text {
    min-width: 0;
    flex: 1;
  }
  .status-text p {
    margin-top: 6px;
    font-size: 13px;
    color: var(--text-2);
  }
  .running {
    display: flex;
    gap: 6px;
    align-items: center;
  }
  .bad-text {
    color: var(--danger);
    font-size: 12.5px;
    margin-top: 4px;
  }
  .buttons {
    display: flex;
    gap: 8px;
    margin-top: 12px;
    flex-wrap: wrap;
  }
  .path-row .buttons {
    margin-top: 0;
    flex-shrink: 0;
  }
  .found {
    display: flex;
    gap: 6px;
    margin-top: 10px;
  }
  .mem-ctl {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 300px;
    flex-shrink: 0;
  }
  .mem-ctl span {
    font-family: var(--font-mono);
    font-weight: 600;
    min-width: 56px;
    text-align: right;
  }
  input[type='range'] {
    flex: 1;
    appearance: none;
    height: 6px;
    border-radius: 99px;
    background: linear-gradient(90deg, var(--accent) var(--p), var(--surface-3) var(--p));
  }
  input[type='range']::-webkit-slider-thumb {
    appearance: none;
    width: 18px;
    height: 18px;
    border-radius: var(--r-1);
    background: var(--surface);
    border: 2px solid var(--accent);
  }
  .about {
    display: flex;
    gap: 18px;
    align-items: flex-start;
  }
  .about h3 {
    margin-bottom: 4px;
  }
  .notice {
    margin-top: 16px;
  }
</style>

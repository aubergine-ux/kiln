<script lang="ts">
  import { fly } from 'svelte/transition'
  import type { LauncherCandidate, SetupDetection } from '@shared/types'
  import { api } from '@/lib/api'
  import { app, attempt, init, saveSettings } from '@/lib/state.svelte'
  import Icon from '@/components/Icon.svelte'
  import Logo from '@/components/Logo.svelte'
  import ThemePicker from '@/components/ThemePicker.svelte'
  import NotAffiliated from '@/components/NotAffiliated.svelte'

  let step = $state(0)
  let detection = $state<SetupDetection | null>(null)
  let detecting = $state(false)
  let launcher = $state<LauncherCandidate | null>(app.settings?.launcher ?? null)
  let minecraftDir = $state(app.settings?.minecraftDir ?? '')
  let minecraftFound = $state(false)
  let dataDir = $state(app.settings?.dataDir ?? '')

  async function detect() {
    detecting = true
    const d = await attempt(() => api.setup.detect())
    // Without a short pause the spinner flashes for a few milliseconds, which reads as a glitch.
    await new Promise((r) => setTimeout(r, 400))
    detecting = false
    if (!d) return
    detection = d
    launcher = d.launchers[0] ?? launcher
    if (d.minecraftDirs[0]) {
      minecraftDir = d.minecraftDirs[0]
      minecraftFound = true
    }
    dataDir = dataDir || d.defaultDataDir
  }

  async function browseLauncher() {
    const file = await api.dialog.pickLauncher()
    if (!file) return
    const c = await attempt(() => api.setup.customLauncher(file))
    if (c) launcher = c
  }

  async function browseGameDir() {
    const dir = await api.dialog.pickFolder('Choose the game folder (.minecraft)', minecraftDir)
    if (dir) {
      minecraftDir = dir
      minecraftFound = true
    }
  }

  async function browseDataDir() {
    const dir = await api.dialog.pickFolder('Where should Kiln keep instances?', dataDir)
    if (dir) dataDir = dir
  }

  async function finish() {
    await saveSettings({ launcher, minecraftDir, dataDir, setupComplete: true })
    await init()
  }

  function next() {
    step++
    if (step === 1 && !detection) detect()
  }

  const isMac = window.kiln.platform === 'darwin'
  const isWin = window.kiln.platform === 'win32'
  const STEPS = ['Welcome', 'Launcher', 'Look']
</script>

<div class="setup">
  <div class="drag drag-region"></div>

  <div class="panel">
    <div class="steps">
      {#each STEPS as s, i (s)}
        <span class:done={i < step} class:on={i === step}><b>{#if i < step}<Icon name="Check" size={12} />{:else}{i + 1}{/if}</b> {s}</span>
      {/each}
    </div>

    {#key step}
      <div class="content" in:fly={{ x: 16, duration: 180 }}>
        {#if step === 0}
          <div class="welcome">
            <Logo size={88} />
            <h1>Welcome to Kiln</h1>
            <p class="lead">Kiln keeps a separate game folder for each of your setups and opens the official launcher when you want to play. It never asks for your account.</p>
            <p class="lead small-print">In the launcher's folder, Kiln only ever changes launcher_profiles.json, and it copies that file to a backup first.</p>
            <button class="btn primary lg" onclick={next}>Continue </button>
          </div>
        {:else if step === 1}
          <h2>Find the official launcher</h2>
          <p class="lead small">Kiln uses it to sign in and play. This is what Kiln found on this computer.</p>

          <div class="check" class:ok={!!launcher} class:bad={!launcher && !detecting}>
            <div class="state">
              {#if detecting}<Icon name="LoaderCircle" size={22} class="spin" />{:else if launcher}<Icon name="CircleCheck" size={22} />{:else}<Icon name="CircleAlert" size={22} />{/if}
            </div>
            <div class="check-body">
              <strong>{detecting ? 'Looking for the official launcher' : launcher ? 'Official launcher found' : 'Official launcher not found'}</strong>
              {#if launcher}
                <code class="selectable">{launcher.kind === 'store' ? 'Microsoft Store app' : launcher.kind === 'flatpak' ? `Flatpak: ${launcher.path}` : launcher.path}</code>
                {#if detection && detection.launchers.length > 1}
                  <select class="input sm-select" onchange={(e) => (launcher = detection!.launchers[Number((e.currentTarget as HTMLSelectElement).value)])}>
                    {#each detection.launchers as l, i (l.path)}<option value={i} selected={l.path === launcher.path}>{l.label}</option>{/each}
                  </select>
                {/if}
              {:else if !detecting}
                <p>
                  Install it from minecraft.net{isWin ? ' or the Microsoft Store' : isMac ? ' and move it to Applications' : ''}, open it once, then click Detect again.
                  {#if !isWin && !isMac}If it lives somewhere unusual, use Browse to point Kiln at it.{/if}
                </p>
                <div class="row">
                  <button class="btn sm primary" onclick={() => api.shell.openExternal('https://www.minecraft.net/download')}><Icon name="ExternalLink" size={14} /> Get the launcher</button>
                  <button class="btn sm" onclick={detect}>Detect again</button>
                  <button class="btn sm ghost" onclick={browseLauncher}>Browse…</button>
                </div>
              {/if}
            </div>
            {#if launcher}<button class="btn sm ghost" onclick={browseLauncher}>Change</button>{/if}
          </div>

          <div class="check" class:ok={minecraftFound} class:bad={!minecraftFound && !detecting}>
            <div class="state">
              {#if detecting}<Icon name="LoaderCircle" size={22} class="spin" />{:else if minecraftFound}<Icon name="CircleCheck" size={22} />{:else}<Icon name="CircleAlert" size={22} />{/if}
            </div>
            <div class="check-body">
              <strong>{minecraftFound ? 'Game folder found' : detecting ? 'Looking for the game folder' : 'Game folder not found yet'}</strong>
              <code class="selectable">{minecraftDir}</code>
              {#if !minecraftFound && !detecting}
                <p>The launcher creates this folder the first time it runs. Open it once and click Detect again, or pick the folder yourself.</p>
              {/if}
            </div>
            <button class="btn sm ghost" onclick={browseGameDir}>{minecraftFound ? 'Change' : 'Browse…'}</button>
          </div>

          <div class="check neutral">
            <div class="state"><Icon name="Folder" size={22} /></div>
            <div class="check-body">
              <strong>Kiln's instances folder</strong>
              <code class="selectable">{dataDir}</code>
              <p>Each instance gets its own folder in here.</p>
            </div>
            <button class="btn sm ghost" onclick={browseDataDir}>Change</button>
          </div>

          <div class="nav">
            <button class="btn ghost" onclick={() => step--}>Back</button>
            <button class="btn primary" disabled={detecting} onclick={next}>{launcher && minecraftFound ? 'Continue' : 'Continue anyway'} </button>
          </div>
        {:else}
          <h2>Pick a look</h2>
          <p class="lead small">You can change this later in Settings.</p>
          <ThemePicker />
          <p class="tip">Press <span class="kbd">?</span> any time to see the keyboard shortcuts.</p>
          <div class="nav">
            <button class="btn ghost" onclick={() => step--}>Back</button>
            <button class="btn primary lg" onclick={finish}>Done</button>
          </div>
        {/if}
      </div>
    {/key}

    <div class="foot"><NotAffiliated /></div>
  </div>
</div>

<style>
  .setup {
    position: fixed;
    inset: 0;
    display: grid;
    place-items: center;
    background: var(--bg-sunken);
    overflow: auto;
  }
  .drag {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 44px;
  }
  .panel {
    position: relative;
    width: min(600px, calc(100vw - 48px));
    margin: 60px 0 30px;
    padding: 26px 32px 22px;
    border-radius: var(--r-4);
    background: var(--surface);
    border: 1px solid var(--border);
    box-shadow: var(--shadow-pop);
  }
  .steps {
    display: flex;
    gap: 18px;
    font-size: 12.5px;
    font-weight: 600;
    color: var(--muted);
    margin-bottom: 26px;
  }
  .steps span {
    display: inline-flex;
    align-items: center;
    gap: 7px;
  }
  .steps b {
    width: 20px;
    height: 20px;
    border-radius: var(--r-1);
    display: grid;
    place-items: center;
    font-family: var(--font-mono);
    font-size: 11px;
    background: var(--surface-3);
  }
  .steps .on {
    color: var(--text);
  }
  .steps .on b,
  .steps .done b {
    background: var(--accent);
    color: white;
  }
  .welcome {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
  }
  .welcome h1 {
    margin-top: 20px;
  }
  .welcome .btn {
    margin-top: 24px;
  }
  h1 {
    font-size: 32px;
  }
  h2 {
    font-size: 24px;
  }
  .lead {
    color: var(--text-2);
    font-size: 15px;
    line-height: 1.6;
    margin-top: 10px;
    max-width: 500px;
  }
  .lead.small {
    font-size: 14px;
    margin: 6px 0 18px;
  }
  .small-print {
    font-size: 13.5px;
    color: var(--muted);
  }
  .check {
    display: flex;
    gap: 12px;
    align-items: flex-start;
    padding: 14px;
    border-radius: var(--r-3);
    border: 1px solid var(--border);
    border-left-width: 3px;
    background: var(--surface-2);
    margin-bottom: 8px;
  }
  .check.ok {
    border-left-color: var(--ok);
  }
  .check.ok .state {
    color: var(--ok);
  }
  .check.bad {
    border-left-color: var(--danger);
  }
  .check.bad .state {
    color: var(--danger);
  }
  .state {
    margin-top: 1px;
    color: var(--muted);
  }
  .check-body {
    flex: 1;
    min-width: 0;
  }
  .check-body strong {
    font-weight: 600;
  }
  .check-body p {
    font-size: 13px;
    color: var(--text-2);
    margin-top: 6px;
    line-height: 1.55;
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
  .sm-select {
    margin-top: 8px;
    height: 30px;
    width: auto;
  }
  .row {
    display: flex;
    gap: 8px;
    margin-top: 12px;
    flex-wrap: wrap;
  }
  .nav {
    display: flex;
    justify-content: space-between;
    margin-top: 24px;
  }
  .tip {
    margin-top: 18px;
    font-size: 13px;
    color: var(--muted);
  }
  .foot {
    margin-top: 22px;
    padding-top: 14px;
    border-top: 1px solid var(--border);
  }
</style>

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
    // A short pause so the check feels deliberate rather than flickering.
    await new Promise((r) => setTimeout(r, 450))
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
  const STEPS = ['Welcome', 'Find the launcher', 'Make it yours']
</script>

<div class="setup">
  <div class="drag drag-region"></div>
  <div class="glow"></div>

  <div class="panel">
    <div class="steps">
      {#each STEPS as s, i (s)}
        <span class:done={i < step} class:on={i === step}><b>{i < step ? '✓' : i + 1}</b> {s}</span>
      {/each}
    </div>

    {#key step}
      <div class="content" in:fly={{ x: 30, duration: 260, delay: 80 }}>
        {#if step === 0}
          <div class="welcome">
            <div class="logo-wrap"><Logo size={96} /></div>
            <h1>Welcome to Kiln</h1>
            <p class="lead">Keep every modded setup separate, tidy and one click away. Kiln manages your instances, mods, packs and worlds, then hands off to the official launcher to sign in and play.</p>
            <ul class="points">
              <li><Icon name="Layers" size={18} /> Separate instances with their own mods, worlds and settings</li>
              <li><Icon name="Play" size={18} /> Play opens the official launcher with the right profile selected</li>
              <li><Icon name="Shield" size={18} /> No accounts, no API keys. Only the launcher's profiles file is touched, and it's backed up first</li>
            </ul>
            <button class="btn primary lg" onclick={next}>Get started <Icon name="ArrowRight" size={18} /></button>
          </div>
        {:else if step === 1}
          <h2>Let's find your game</h2>
          <p class="lead small">Kiln works alongside the official launcher. Here's what we found on this computer.</p>

          <div class="check" class:ok={!!launcher} class:bad={!launcher && !detecting}>
            <div class="state">
              {#if detecting}<Icon name="LoaderCircle" size={22} class="spin" />{:else if launcher}<Icon name="CircleCheck" size={22} />{:else}<Icon name="CircleAlert" size={22} />{/if}
            </div>
            <div class="check-body">
              <strong>{detecting ? 'Looking for the official launcher…' : launcher ? 'Official launcher found' : 'Official launcher not found'}</strong>
              {#if launcher}
                <code class="selectable">{launcher.kind === 'store' ? 'Microsoft Store app' : launcher.kind === 'flatpak' ? `Flatpak: ${launcher.path}` : launcher.path}</code>
                {#if detection && detection.launchers.length > 1}
                  <select class="input sm-select" onchange={(e) => (launcher = detection!.launchers[Number((e.currentTarget as HTMLSelectElement).value)])}>
                    {#each detection.launchers as l, i (l.path)}<option value={i} selected={l.path === launcher.path}>{l.label}</option>{/each}
                  </select>
                {/if}
              {:else if !detecting}
                <p>
                  Here's how to fix it: install the official launcher from minecraft.net{isWin ? ' (or the Microsoft Store)' : isMac ? ' and move it to Applications' : ' (the .deb, the Arch package, or the Flatpak)'}, open it once, then click “Detect again”.
                  {#if !isWin && !isMac}If it's installed somewhere unusual, point Kiln at it with “Browse”.{/if}
                </p>
                <div class="row">
                  <button class="btn sm primary" onclick={() => api.shell.openExternal('https://www.minecraft.net/download')}><Icon name="ExternalLink" size={14} /> Get the launcher</button>
                  <button class="btn sm" onclick={detect}><Icon name="RefreshCw" size={14} /> Detect again</button>
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
              <strong>{minecraftFound ? 'Game folder found' : detecting ? 'Looking for the game folder…' : 'Game folder not found yet'}</strong>
              <code class="selectable">{minecraftDir}</code>
              {#if !minecraftFound && !detecting}
                <p>The official launcher creates this folder the first time it runs. Open the launcher once, then click “Detect again”, or choose the folder yourself.</p>
              {/if}
            </div>
            <button class="btn sm ghost" onclick={browseGameDir}>{minecraftFound ? 'Change' : 'Browse…'}</button>
          </div>

          <div class="check neutral">
            <div class="state"><Icon name="Folder" size={22} /></div>
            <div class="check-body">
              <strong>Kiln's instances folder</strong>
              <code class="selectable">{dataDir}</code>
              <p>Every instance gets its own game folder in here.</p>
            </div>
            <button class="btn sm ghost" onclick={browseDataDir}>Change</button>
          </div>

          <div class="nav">
            <button class="btn ghost" onclick={() => step--}>Back</button>
            <button class="btn primary" disabled={detecting} onclick={next}>{launcher && minecraftFound ? 'Continue' : 'Continue anyway'} <Icon name="ArrowRight" size={16} /></button>
          </div>
        {:else}
          <h2>Make it yours</h2>
          <p class="lead small">Pick a look. You can change this any time in Settings.</p>
          <ThemePicker />
          <div class="tips">
            <span><span class="kbd">{isMac ? '⌘' : 'Ctrl'}</span><span class="kbd">K</span> search</span>
            <span><span class="kbd">{isMac ? '⌘' : 'Ctrl'}</span><span class="kbd">N</span> new instance</span>
            <span><span class="kbd">?</span> all shortcuts</span>
          </div>
          <div class="nav">
            <button class="btn ghost" onclick={() => step--}>Back</button>
            <button class="btn primary lg" onclick={finish}><Icon name="Flame" size={18} /> Start using Kiln</button>
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
    background: var(--bg);
    overflow: auto;
  }
  .drag {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 44px;
  }
  .glow {
    position: absolute;
    inset: 0;
    background:
      radial-gradient(700px 400px at 15% 0%, color-mix(in oklab, var(--accent) 18%, transparent), transparent 70%),
      radial-gradient(600px 400px at 100% 100%, color-mix(in oklab, var(--accent-2) 14%, transparent), transparent 70%);
    pointer-events: none;
  }
  .panel {
    position: relative;
    width: min(640px, calc(100vw - 48px));
    margin: 60px 0 30px;
    padding: 28px 36px 24px;
    border-radius: 28px;
    background: var(--surface);
    border: 1px solid var(--border);
    box-shadow: var(--shadow-lg);
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
    width: 22px;
    height: 22px;
    border-radius: 50%;
    display: grid;
    place-items: center;
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
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  .logo-wrap {
    animation: float 3s ease-in-out infinite alternate;
    margin-bottom: 18px;
  }
  @keyframes float {
    to { transform: translateY(-6px) rotate(-2deg); }
  }
  h1 {
    font-size: 34px;
  }
  h2 {
    font-size: 26px;
  }
  .lead {
    color: var(--text-2);
    font-size: 15px;
    line-height: 1.6;
    margin: 10px 0 0;
    max-width: 520px;
  }
  .lead.small {
    font-size: 14px;
    margin-bottom: 20px;
  }
  .points {
    list-style: none;
    padding: 0;
    margin: 22px 0 26px;
    text-align: left;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .points li {
    display: flex;
    gap: 12px;
    align-items: flex-start;
    color: var(--text-2);
  }
  .points :global(.icon) {
    color: var(--accent-text);
    margin-top: 1px;
  }
  .check {
    display: flex;
    gap: 14px;
    align-items: flex-start;
    padding: 16px;
    border-radius: 16px;
    border: 1px solid var(--border);
    background: var(--surface-2);
    margin-bottom: 10px;
    transition: border-color var(--med), background var(--med);
  }
  .check.ok {
    border-color: color-mix(in oklab, var(--ok) 35%, var(--border));
  }
  .check.ok .state {
    color: var(--ok);
  }
  .check.bad {
    border-color: color-mix(in oklab, var(--danger) 35%, var(--border));
    background: color-mix(in oklab, var(--danger) 5%, var(--surface-2));
  }
  .check.bad .state {
    color: var(--danger);
  }
  .neutral .state {
    color: var(--muted);
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
    font-weight: 650;
  }
  .check-body p {
    font-size: 13px;
    color: var(--text-2);
    margin-top: 6px;
    line-height: 1.55;
  }
  code {
    display: block;
    margin-top: 4px;
    font-family: var(--font-mono);
    font-size: 12px;
    color: var(--muted);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .sm-select {
    margin-top: 8px;
    height: 32px;
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
  .tips {
    display: flex;
    gap: 18px;
    margin-top: 22px;
    font-size: 12.5px;
    color: var(--muted);
  }
  .tips > span {
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }
  .foot {
    margin-top: 24px;
    padding-top: 16px;
    border-top: 1px solid var(--border);
    text-align: center;
  }
</style>

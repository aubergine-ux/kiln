<script lang="ts">
  import type { Instance, LogFile } from '@shared/types'
  import { api } from '@/lib/api'
  import { attempt, toast } from '@/lib/state.svelte'
  import { bytes, timeAgo } from '@/lib/format'
  import { isMod } from '@/lib/shortcuts'
  import Icon from '@/components/Icon.svelte'
  import EmptyState from '@/components/EmptyState.svelte'

  let { instance: inst }: { instance: Instance } = $props()

  type Level = 'info' | 'warn' | 'error'
  interface Line {
    n: number
    text: string
    level: Level
  }

  let files = $state<LogFile[]>([])
  let selected = $state<string | null>(null)
  let lines = $state<Line[]>([])
  let loading = $state(true)
  let query = $state('')
  let levels = $state({ info: true, warn: true, error: true })
  let matchIndex = $state(0)
  let scroller = $state<HTMLDivElement>()
  let scrollTop = $state(0)
  let viewHeight = $state(600)
  let searchEl = $state<HTMLInputElement>()
  let crashSummary = $state<string | null>(null)

  const LINE = 20

  async function loadFiles() {
    files = (await attempt(() => api.logs.list(inst.id))) ?? []
    loading = false
    if (!selected && files.length) open(files.find((f) => f.file === 'logs/latest.log')?.file ?? files[0].file)
  }
  loadFiles()

  function classify(text: string, prev: Level): Level {
    if (/\b(ERROR|FATAL|SEVERE)\b|Exception in thread|^\s*(Caused by|Exception|java\.\S+(Exception|Error))/.test(text)) return 'error'
    if (/\bWARN(ING)?\b/.test(text)) return 'warn'
    // Stack trace lines belong with the error above them.
    if (/^\s+(at |\.\.\. \d+ more)/.test(text)) return prev
    return 'info'
  }

  async function open(file: string) {
    selected = file
    const text = await attempt(() => api.logs.read(inst.id, file))
    if (text === undefined) return
    let prev: Level = 'info'
    lines = text.split(/\r?\n/).map((t, i) => {
      prev = classify(t, prev)
      return { n: i + 1, text: t, level: prev }
    })
    const desc = text.match(/^Description: (.+)$/m)?.[1]
    const cause = text.match(/^([\w.$]+(?:Exception|Error)[^\n]*)$/m)?.[1]
    crashSummary = file.startsWith('crash-reports/') ? [desc, cause].filter(Boolean).join(': ') || null : null
    matchIndex = 0
    scroller?.scrollTo({ top: file.startsWith('crash') ? 0 : lines.length * LINE })
  }

  const q = $derived(query.trim().toLowerCase())
  const visible = $derived(lines.filter((l) => levels[l.level]))
  const matches = $derived(q ? visible.reduce<number[]>((acc, l, i) => (l.text.toLowerCase().includes(q) && acc.push(i), acc), []) : [])
  const counts = $derived({
    warn: lines.filter((l) => l.level === 'warn').length,
    error: lines.filter((l) => l.level === 'error').length
  })

  const start = $derived(Math.max(0, Math.floor(scrollTop / LINE) - 30))
  const end = $derived(Math.min(visible.length, Math.ceil((scrollTop + viewHeight) / LINE) + 30))
  const slice = $derived(visible.slice(start, end))

  function jump(dir: 1 | -1) {
    if (!matches.length) return
    matchIndex = (matchIndex + dir + matches.length) % matches.length
    scroller?.scrollTo({ top: matches[matchIndex] * LINE - viewHeight / 2 })
  }

  $effect(() => {
    void q
    matchIndex = 0
    if (matches.length) scroller?.scrollTo({ top: matches[0] * LINE - viewHeight / 2 })
  })

  function parts(text: string): { t: string; hit: boolean }[] {
    if (!q) return [{ t: text, hit: false }]
    const out: { t: string; hit: boolean }[] = []
    const lower = text.toLowerCase()
    let i = 0
    for (;;) {
      const j = lower.indexOf(q, i)
      if (j < 0) break
      if (j > i) out.push({ t: text.slice(i, j), hit: false })
      out.push({ t: text.slice(j, j + q.length), hit: true })
      i = j + q.length
    }
    out.push({ t: text.slice(i), hit: false })
    return out
  }

  function onkeydown(e: KeyboardEvent) {
    if (isMod(e) && e.key.toLowerCase() === 'f') {
      e.preventDefault()
      searchEl?.focus()
      searchEl?.select()
    }
  }

  async function copyAll() {
    await navigator.clipboard.writeText(visible.map((l) => l.text).join('\n'))
    toast('ok', 'Log copied to clipboard')
  }

  function firstError() {
    const i = visible.findIndex((l) => l.level === 'error')
    if (i >= 0) scroller?.scrollTo({ top: i * LINE - 40 })
  }
</script>

<svelte:window {onkeydown} />

{#if !loading && files.length === 0}
  <EmptyState art="scroll" title="No logs yet" body="Logs and crash reports show up here after you play this instance." />
{:else}
  <div class="layout">
    <aside>
      {#each files as f (f.file)}
        <button class="file" class:active={selected === f.file} class:crash={f.kind === 'crash'} onclick={() => open(f.file)}>
          <Icon name={f.kind === 'crash' ? 'Bug' : 'FileText'} size={16} />
          <div>
            <span class="fname">{f.file.split('/').pop()}</span>
            <span class="fmeta">{timeAgo(f.modified)}, {bytes(f.size)}</span>
          </div>
        </button>
      {/each}
    </aside>

    <section class="viewer">
      <div class="bar">
        <div class="search">
          <Icon name="Search" size={15} />
          <input bind:this={searchEl} bind:value={query} placeholder="Search log" onkeydown={(e) => e.key === 'Enter' && jump(e.shiftKey ? -1 : 1)} />
          {#if q}<span class="mcount">{matches.length ? matchIndex + 1 : 0} / {matches.length}</span>{/if}
          <button class="btn ghost icon sm" aria-label="Previous match" onclick={() => jump(-1)} disabled={!matches.length}><Icon name="ArrowUp" size={15} /></button>
          <button class="btn ghost icon sm" aria-label="Next match" onclick={() => jump(1)} disabled={!matches.length}><Icon name="ArrowDown" size={15} /></button>
        </div>
        <div class="levels">
          <button class="lvl info" class:on={levels.info} onclick={() => (levels.info = !levels.info)}>Info</button>
          <button class="lvl warn" class:on={levels.warn} onclick={() => (levels.warn = !levels.warn)}>Warnings <span>{counts.warn}</span></button>
          <button class="lvl error" class:on={levels.error} onclick={() => (levels.error = !levels.error)}>Errors <span>{counts.error}</span></button>
        </div>
        <div class="spacer"></div>
        {#if counts.error}<button class="btn sm" onclick={firstError}>First error</button>{/if}
        <button class="btn sm" onclick={copyAll}>Copy</button>
        <button class="btn sm icon" title="Open in text editor" aria-label="Open in text editor" onclick={() => selected && api.shell.openPath(`${inst.gameDir}/${selected}`)}><Icon name="ExternalLink" size={15} /></button>
      </div>

      {#if crashSummary}
        <div class="crash-summary"><Icon name="Bug" size={16} /> <span class="selectable">{crashSummary}</span></div>
      {/if}

      <div class="lines selectable" bind:this={scroller} bind:clientHeight={viewHeight} onscroll={(e) => (scrollTop = (e.currentTarget as HTMLDivElement).scrollTop)}>
        <div style:height="{visible.length * LINE}px" style:position="relative">
          {#each slice as l, i (l.n)}
            <div class="line {l.level}" class:current={matches[matchIndex] === start + i} style:top="{(start + i) * LINE}px">
              <span class="ln">{l.n}</span>
              <span class="lt">{#each parts(l.text) as p, k (k)}{#if p.hit}<mark>{p.t}</mark>{:else}{p.t}{/if}{/each}</span>
            </div>
          {/each}
        </div>
      </div>
    </section>
  </div>
{/if}

<style>
  .layout {
    flex: 1;
    min-height: 0;
    display: flex;
    gap: 14px;
    padding: 16px 28px 24px;
  }
  aside {
    width: 230px;
    flex-shrink: 0;
    overflow: auto;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .file {
    display: flex;
    gap: 10px;
    align-items: flex-start;
    padding: 8px 10px;
    border: none;
    border-radius: var(--r-2);
    background: none;
    text-align: left;
    color: var(--text-2);
  }
  .file > div {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
  .file :global(.icon) {
    margin-top: 2px;
  }
  .file:hover {
    background: color-mix(in oklab, var(--text) 5%, transparent);
  }
  .file.active {
    background: var(--surface);
    box-shadow: inset 0 0 0 1px var(--border);
    color: var(--text);
  }
  .file.crash :global(.icon) {
    color: var(--danger);
  }
  .fname {
    font-weight: 600;
    font-size: 13px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .fmeta {
    font-size: 11.5px;
    color: var(--muted);
  }
  .viewer {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    border: 1px solid var(--border);
    border-radius: var(--r-3);
    background: var(--surface);
    overflow: hidden;
  }
  .bar {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px;
    border-bottom: 1px solid var(--border);
  }
  .search {
    display: flex;
    align-items: center;
    gap: 6px;
    height: 32px;
    flex: 0 1 260px;
    min-width: 150px;
    padding: 0 4px 0 10px;
    border-radius: var(--r-2);
    border: 1px solid var(--border-strong);
    background: var(--bg);
    color: var(--muted);
  }
  .search:focus-within {
    border-color: var(--accent);
    box-shadow: 0 0 0 3px var(--accent-soft);
  }
  .search input {
    flex: 1;
    min-width: 0;
    border: none;
    outline: none;
    background: none;
    user-select: text;
  }
  .mcount {
    font-family: var(--font-mono);
    font-size: 11.5px;
  }
  .levels {
    display: flex;
    gap: 4px;
  }
  .lvl {
    height: 28px;
    padding: 0 9px;
    border-radius: var(--r-2);
    border: 1px solid var(--border);
    background: none;
    color: var(--muted);
    font-size: 12.5px;
    font-weight: 600;
    opacity: 0.6;
  }
  .lvl.on {
    opacity: 1;
    background: var(--surface-2);
  }
  .lvl.warn.on {
    color: var(--warn);
  }
  .lvl.error.on {
    color: var(--danger);
  }
  .lvl span {
    margin-left: 3px;
    font-family: var(--font-mono);
    font-size: 11px;
  }
  .spacer {
    flex: 1;
  }
  .crash-summary {
    display: flex;
    gap: 10px;
    align-items: center;
    padding: 10px 14px;
    background: color-mix(in oklab, var(--danger) 10%, var(--surface));
    color: color-mix(in oklab, var(--danger) 70%, var(--text));
    font-weight: 600;
    font-size: 13px;
    border-bottom: 1px solid var(--border);
  }
  .lines {
    flex: 1;
    overflow: auto;
    font-family: var(--font-mono);
    font-size: 12px;
    background: var(--bg);
  }
  .line {
    position: absolute;
    left: 0;
    right: 0;
    height: 20px;
    line-height: 20px;
    display: flex;
    white-space: pre;
    padding-right: 12px;
  }
  .ln {
    width: 58px;
    flex-shrink: 0;
    text-align: right;
    padding-right: 12px;
    color: var(--muted);
    opacity: 0.6;
    user-select: none;
  }
  .lt {
    color: var(--text-2);
  }
  .line.warn {
    background: color-mix(in oklab, var(--warn) 7%, transparent);
  }
  .line.warn .lt {
    color: color-mix(in oklab, var(--warn) 75%, var(--text));
  }
  .line.error {
    background: color-mix(in oklab, var(--danger) 8%, transparent);
  }
  .line.error .lt {
    color: color-mix(in oklab, var(--danger) 75%, var(--text));
  }
  .line.current {
    box-shadow: inset 3px 0 0 var(--accent);
    background: var(--accent-soft);
  }
  mark {
    background: color-mix(in oklab, var(--accent) 35%, transparent);
    color: var(--text);
    border-radius: 3px;
  }
</style>

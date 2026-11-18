/// <reference lib="dom" />
/// <reference path="../../src/preload/index.d.ts" />
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { _electron as electron, test, type ElectronApplication, type Page } from '@playwright/test'
import { makeMinecraftDir, makeZip, levelDat } from '../../tests/fixtures/build'

/**
 * Builds a demo setup with made-up instances, mods and worlds, then captures the
 * README screenshots in light and dark mode. Pictures (mod icons, "in-game"
 * screenshots) are drawn procedurally, so nothing here comes from a real game.
 */

const OUT = path.resolve(process.env.KILN_SHOTS_OUT ?? 'docs/screenshots')
const THEMES = (process.env.KILN_SHOTS_THEMES ?? 'light,dark').split(',') as ('light' | 'dark')[]
const HOUR = 3600_000

let app: ElectronApplication
let win: Page
let root: string

const invoke = <T = unknown>(channel: string, ...args: unknown[]): Promise<T> =>
  win.evaluate(
    async ([c, a]) => {
      const r = (await window.kiln.invoke(c as string, a as unknown[])) as { ok: boolean; value?: unknown; error?: { message: string; hint?: string } }
      if (!r.ok) throw new Error(`${r.error?.message} ${r.error?.hint ?? ''}`)
      return r.value
    },
    [channel, args] as const
  ) as Promise<T>

/** Draw a blocky landscape or a pixel icon in the page and return PNG bytes. */
async function draw(kind: 'scene' | 'icon', seed: number, w: number, h: number): Promise<Buffer> {
  const data = await win.evaluate(
    ([kind, seed, w, h]) => {
      let s = seed as number
      const rand = () => ((s = (s * 16807) % 2147483647) / 2147483647)
      const c = document.createElement('canvas')
      c.width = w as number
      c.height = h as number
      const g = c.getContext('2d')!
      const W = w as number
      const H = h as number
      if (kind === 'icon') {
        const px = W / 8
        const hue = Math.floor(rand() * 360)
        for (let y = 0; y < 8; y++)
          for (let x = 0; x < 8; x++) {
            const l = 35 + rand() * 35
            g.fillStyle = `hsl(${hue + (rand() * 40 - 20)}, ${55 + rand() * 25}%, ${l}%)`
            g.fillRect(x * px, y * px, px, px)
          }
        return c.toDataURL('image/png')
      }
      const palettes = [
        ['#7ec8f2', '#cfeefd', '#5aa35a', '#3f7d3f', '#2d5e2d'],
        ['#f6a46b', '#ffe0b5', '#7f9b4a', '#5f7a36', '#3f5524'],
        ['#1d2b53', '#5d4e8c', '#3c6e71', '#2a4d50', '#1b3335'],
        ['#9fd3e8', '#f0f8ff', '#e9eef2', '#b9c7d1', '#8fa3b1']
      ]
      const p = palettes[Math.floor(rand() * palettes.length)]
      const sky = g.createLinearGradient(0, 0, 0, H)
      sky.addColorStop(0, p[0])
      sky.addColorStop(0.7, p[1])
      g.fillStyle = sky
      g.fillRect(0, 0, W, H)
      const b = Math.max(4, Math.round(W / 96))
      g.fillStyle = 'rgba(255,255,255,0.85)'
      g.fillRect(Math.round(W * (0.6 + rand() * 0.3)), Math.round(H * 0.12), b * 6, b * 6)
      for (let i = 0; i < 6; i++) {
        g.fillStyle = 'rgba(255,255,255,0.7)'
        g.fillRect(Math.round(rand() * W), Math.round(rand() * H * 0.3), b * (8 + Math.round(rand() * 10)), b * 2)
      }
      for (const [layer, color] of [[0.55, p[2]], [0.68, p[3]], [0.8, p[4]]] as [number, string][]) {
        g.fillStyle = color
        let y = H * layer
        for (let x = 0; x < W; x += b * 2) {
          y += (rand() - 0.5) * b * 3
          g.fillRect(x, Math.round(y / b) * b, b * 2, H)
          if (rand() < 0.06 && layer > 0.6) {
            g.fillStyle = '#5b3a1e'
            g.fillRect(x, Math.round(y / b) * b - b * 4, b, b * 4)
            g.fillStyle = '#2f6b2f'
            g.fillRect(x - b * 2, Math.round(y / b) * b - b * 8, b * 5, b * 4)
            g.fillStyle = color
          }
        }
      }
      return c.toDataURL('image/png')
    },
    [kind, seed, w, h] as const
  )
  return Buffer.from(data.split(',')[1], 'base64')
}

async function modJar(dir: string, i: number, name: string, version: string, description: string, author: string) {
  const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-')
  await makeZip(path.join(dir, `${id}-${version}.jar`), {
    'fabric.mod.json': JSON.stringify({ schemaVersion: 1, id, name, version, description, authors: [author], icon: 'icon.png' }),
    'icon.png': await draw('icon', 97 + i * 31, 64, 64)
  })
}

async function setPlayed(id: string, hoursAgo: number) {
  const file = path.join(root, 'kiln', 'instances', id, 'instance.json')
  const cfg = JSON.parse(await fs.readFile(file, 'utf8'))
  cfg.lastPlayed = new Date(Date.now() - hoursAgo * HOUR).toISOString()
  await fs.writeFile(file, JSON.stringify(cfg, null, 2))
}

test.beforeAll(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'kiln-shots-'))
  const mc = await makeMinecraftDir(path.join(root, '.minecraft'))
  const v = async (id: string, json: object) => {
    await fs.mkdir(path.join(mc, 'versions', id), { recursive: true })
    await fs.writeFile(path.join(mc, 'versions', id, `${id}.json`), JSON.stringify({ id, ...json }))
  }
  await v('1.20.1', { type: 'release', releaseTime: '2023-06-12T00:00:00+00:00' })
  await v('1.20.1-forge-47.3.0', { inheritsFrom: '1.20.1', libraries: [{ name: 'net.minecraftforge:fmlloader:1.20.1-47.3.0' }], arguments: { game: ['--fml.forgeVersion', '47.3.0'] } })
  await v('quilt-loader-0.26.4-1.21.1', { inheritsFrom: '1.21.1', libraries: [{ name: 'org.quiltmc:quilt-loader:0.26.4' }] })
  const userData = path.join(root, 'userdata')
  await fs.mkdir(userData, { recursive: true })
  const launcher = path.join(root, 'launcher.sh')
  await fs.writeFile(launcher, '#!/bin/sh\n', { mode: 0o755 })
  await fs.writeFile(
    path.join(userData, 'settings.json'),
    JSON.stringify({ setupComplete: true, minecraftDir: mc, dataDir: path.join(root, 'kiln'), launcher: { kind: 'command', path: launcher, label: 'Official launcher' }, theme: 'light', groups: ['Survival', 'Modpacks'] })
  )
  app = await electron.launch({ args: ['--force-device-scale-factor=2', '.'], env: { ...process.env, KILN_USER_DATA: userData, KILN_NO_TRASH: '1' } })
  win = await app.firstWindow()
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setContentSize(1280, 800))
  await win.waitForTimeout(800)
})

test.afterAll(async () => {
  await app?.close()
  await fs.rm(root, { recursive: true, force: true }).catch(() => {})
})

test('capture README screenshots', async () => {
  type Inst = { id: string; gameDir: string }
  const make = (name: string, versionId: string, glyph: string, color: string, extra: object = {}) =>
    invoke<Inst>('instances.create', { name, versionId, icon: { kind: 'glyph', glyph, color }, ...extra })

  const cozy = await make('Cozy Survival', '1.21.1', 'tree', 'moss', { group: 'Survival' })
  const sky = await make('Skyblock Sprint', 'fabric-loader-0.16.9-1.21.1', 'star', 'sky')
  const clock = await make('Clockwork Factory', '1.20.1-forge-47.3.0', 'axe', 'ember', { group: 'Modpacks' })
  const ocean = await make('Ocean Explorers', 'neoforge-21.1.77', 'fish', 'teal', { loader: 'neoforge', mcVersion: '1.21.1', loaderVersion: '21.1.77', group: 'Modpacks' })
  const hard = await make('Hardcore Nights', 'quilt-loader-0.26.4-1.21.1', 'skull', 'violet', { group: 'Survival' })
  const snap = await make('Snapshot Playground', 'latest-snapshot', 'potion', 'rose')
  await invoke('instances.update', cozy.id, { pinned: true, memoryMb: 6144 })

  const mods: [string, string, string, string][] = [
    ['Brightside Renderer', '0.6.2', 'A faster renderer with smooth lighting and fewer stutters.', 'Lumen Labs'],
    ['Pocket Map', '2.4.0', 'A minimap with waypoints and cave mode.', 'Wren'],
    ['Sort It Out', '1.3.1', 'Middle-click to sort chests and your inventory.', 'tidybits'],
    ['Cozy Campfires', '1.0.4', 'Campfires that cook food and warm you up.', 'Hearthwood'],
    ['Trail Markers', '0.9.0', 'Leave glowing markers to find your way home.', 'Pathfinder Co.'],
    ['Starfall Skies', '1.2.0', 'Shooting stars, auroras and better clouds.', 'Nightowl'],
    ['Quick Stack', '3.1.0', 'Send items to nearby chests that already hold them.', 'tidybits'],
    ['Tidy Tooltips', '1.1.2', 'Cleaner, colour-coded item tooltips.', 'Wren']
  ]
  for (const [i, m] of mods.entries()) await modJar(path.join(sky.gameDir, 'mods'), i, ...m)
  await invoke('content.setEnabled', sky.id, 'mods', 'quick-stack-3.1.0.jar', false)
  for (let i = 0; i < 31; i++) await modJar(path.join(clock.gameDir, 'mods'), 40 + i, `Gearwork Module ${i + 1}`, '1.0.0', 'Part of the factory pack.', 'Clockwork Team')
  for (let i = 0; i < 12; i++) await modJar(path.join(ocean.gameDir, 'mods'), 80 + i, `Tide Module ${i + 1}`, '1.0.0', 'Ocean things.', 'Reef')
  for (let i = 0; i < 5; i++) await modJar(path.join(hard.gameDir, 'mods'), 120 + i, `Night Module ${i + 1}`, '1.0.0', 'Spooky.', 'Moth')

  // Worlds with drawn icons.
  const worlds: [string, string, number, number][] = [
    ['Maple Hollow', 'maple', 2, 0],
    ['Lighthouse Bay', 'bay', 30, 0],
    ['Creative Sandbox', 'sandbox', 120, 1],
    ['Frostpeak Expedition', 'frost', 400, 0]
  ]
  for (const [i, [name, folder, hours, mode]] of worlds.entries()) {
    const dir = path.join(cozy.gameDir, 'saves', folder)
    await fs.mkdir(dir, { recursive: true })
    await fs.writeFile(path.join(dir, 'level.dat'), levelDat(name, Date.now() - hours * HOUR, mode))
    await fs.writeFile(path.join(dir, 'icon.png'), await draw('scene', 7 + i * 13, 128, 128))
  }
  await invoke('worlds.backup', cozy.id, 'maple')

  // "In-game" screenshots.
  for (let i = 0; i < 9; i++) {
    const file = path.join(cozy.gameDir, 'screenshots', `2026-11-${String(10 + i).padStart(2, '0')}_18.0${i}.12.png`)
    await fs.writeFile(file, await draw('scene', 1000 + i * 77, 960, 540))
    const t = new Date(Date.now() - (i + 1) * 20 * HOUR)
    await fs.utimes(file, t, t)
  }

  // A log with a few warnings and errors.
  await fs.mkdir(path.join(sky.gameDir, 'logs'), { recursive: true })
  const lines = [
    '[18:02:11] [main/INFO]: Loading for game 1.21.1',
    '[18:02:11] [main/INFO]: Loading 9 mods:',
    ...mods.map(([n, v]) => `\t- ${n.toLowerCase().replace(/ /g, '-')} ${v}`),
    '[18:02:13] [main/WARN]: Pocket Map: config file missing, using defaults',
    '[18:02:14] [Render thread/INFO]: Backend library: LWJGL version 3.3.3',
    '[18:02:15] [Render thread/INFO]: Brightside Renderer: using the fast path',
    '[18:02:16] [Render thread/WARN]: Texture atlas is getting large (8192x4096)',
    '[18:02:18] [Render thread/INFO]: Reloading ResourceManager: vanilla, fabric',
    '[18:02:20] [Server thread/INFO]: Preparing spawn area: 84%',
    '[18:02:21] [Server thread/ERROR]: Trail Markers: could not read markers.json',
    'java.io.FileNotFoundException: markers.json (No such file or directory)',
    '\tat java.base/java.io.FileInputStream.open0(Native Method)',
    '\tat trailmarkers.Store.load(Store.java:42)',
    '[18:02:22] [Server thread/INFO]: Done (2.1s)! For help, type "help"',
    '[18:02:24] [Render thread/INFO]: Connecting to local server',
    '[18:02:25] [Render thread/INFO]: Loaded 1290 advancements',
    ...Array.from({ length: 30 }, (_, i) => `[18:0${3 + Math.floor(i / 10)}:${String(10 + (i % 50)).padStart(2, '0')}] [Render thread/INFO]: Chunk batch ${i + 1} ready`)
  ]
  const log = path.join(sky.gameDir, 'logs', 'latest.log')
  await fs.writeFile(log, lines.join('\n'))
  await fs.utimes(log, new Date(Date.now() - 26 * HOUR), new Date(Date.now() - 26 * HOUR))

  for (const [inst, h] of [[cozy, 2], [sky, 26], [clock, 72], [hard, 200], [snap, 500]] as [Inst, number][]) await setPlayed(inst.id, h)
  await win.reload()
  await win.waitForTimeout(1500)

  const shoot = async (name: string, theme: 'light' | 'dark') => {
    await win.waitForTimeout(700)
    await win.screenshot({ path: path.join(OUT, `${theme}-${name}.png`) })
  }
  const open = async (name: string, tab: string) => {
    await win.getByRole('button', { name: /All instances/ }).click()
    await win.locator('.table .row', { hasText: name }).first().click()
    await win.getByRole('tab', { name: tab }).click()
  }

  for (const theme of THEMES) {
    await invoke('settings.update', { theme })
    await win.reload()
    await win.waitForTimeout(1200)
    await shoot('home', theme)
    await open('Skyblock Sprint', 'Mods')
    await shoot('mods', theme)
    await open('Cozy Survival', 'Worlds')
    await shoot('worlds', theme)
    await open('Cozy Survival', 'Screenshots')
    await shoot('screenshots', theme)
    await open('Skyblock Sprint', 'Logs')
    await win.getByPlaceholder('Search log').fill('trail')
    await shoot('logs', theme)
    await win.getByRole('button', { name: /All instances/ }).click()
    await win.keyboard.press('Control+n')
    await win.fill('#new-name', 'Weekend Adventure')
    await win.getByRole('radio', { name: 'Fabric' }).click()
    await shoot('new-instance', theme)
    await win.keyboard.press('Escape')
    await open('Ocean Explorers', 'Settings')
    await shoot('loader', theme)
    await open('Cozy Survival', 'Mods')
    await shoot('empty', theme)
    await win.getByRole('button', { name: 'Settings', exact: true }).click()
    await shoot('settings', theme)
  }
})

test('capture the first-run screen', async () => {
  const userData = path.join(root, 'fresh')
  await fs.mkdir(userData, { recursive: true })
  await fs.writeFile(path.join(userData, 'settings.json'), JSON.stringify({ theme: THEMES[0] }))
  const fresh = await electron.launch({ args: ['.'], env: { ...process.env, KILN_USER_DATA: userData } })
  const page = await fresh.firstWindow()
  await fresh.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setContentSize(1280, 800))
  await page.waitForTimeout(1200)
  await page.screenshot({ path: path.join(OUT, `${THEMES[0]}-setup.png`) })
  await fresh.close()
})

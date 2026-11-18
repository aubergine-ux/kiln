/// <reference lib="dom" />
/// <reference path="../../src/preload/index.d.ts" />
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { _electron as electron, expect, test, type ElectronApplication, type Page } from '@playwright/test'
import { listZip } from '../../src/main/util/zip'
import { dataPack, fabricMod, forgeMod, makeMinecraftDir, makeWorld, makeZip, PNG, resourcePack } from '../fixtures/build'

/**
 * Drives the built app against a throwaway .minecraft folder and a stand-in for the
 * official launcher (a script that records how it was started).
 */

let app: ElectronApplication
let win: Page
let root: string
let mc: string
let fixtures: string
let launcherLog: string

const profiles = async () => JSON.parse(await fs.readFile(path.join(mc, 'launcher_profiles.json'), 'utf8')).profiles
const invoke = <T = unknown>(channel: string, ...args: unknown[]): Promise<T> =>
  win.evaluate(
    async ([c, a]) => {
      const r = (await window.kiln.invoke(c as string, a as unknown[])) as { ok: boolean; value?: unknown; error?: { message: string } }
      if (!r.ok) throw new Error(r.error?.message)
      return r.value
    },
    [channel, args] as const
  ) as Promise<T>

async function instances(): Promise<{ id: string; name: string; gameDir: string; profileId: string; pinned: boolean; group?: string }[]> {
  return invoke('instances.list')
}

async function openTab(name: string) {
  await win.getByRole('tab', { name }).click()
}

test.beforeAll(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'kiln-e2e-'))
  mc = await makeMinecraftDir(path.join(root, '.minecraft'))
  fixtures = path.join(root, 'fixtures')
  const userData = path.join(root, 'userdata')
  await fs.mkdir(userData, { recursive: true })

  // Stand-in for the official launcher.
  launcherLog = path.join(root, 'launcher-calls.log')
  const launcher = path.join(root, 'minecraft-launcher')
  await fs.writeFile(launcher, `#!/bin/sh\necho "$*" >> "${launcherLog}"\n`, { mode: 0o755 })

  await fs.writeFile(
    path.join(userData, 'settings.json'),
    JSON.stringify({
      setupComplete: true,
      minecraftDir: mc,
      dataDir: path.join(root, 'kiln'),
      launcher: { kind: 'command', path: launcher, label: 'Official launcher' },
      theme: 'light'
    })
  )

  app = await electron.launch({
    args: [...(process.env.CI ? ['--no-sandbox'] : []), '.'],
    env: { ...process.env, KILN_USER_DATA: userData, KILN_NO_TRASH: '1' }
  })
  win = await app.firstWindow()
  await win.setViewportSize({ width: 1280, height: 820 })
})

test.afterAll(async () => {
  // Under xvfb on CI, Electron sometimes never finishes closing; don't let that fail the run.
  const proc = app?.process()
  const closed = await Promise.race([app?.close().then(() => true), new Promise<boolean>((r) => setTimeout(() => r(false), 10_000))])
  if (!closed) proc?.kill('SIGKILL')
  await fs.rm(root, { recursive: true, force: true }).catch(() => {})
})

test.describe.serial('Kiln', () => {
  test('shows a friendly empty home screen', async () => {
    await expect(win.getByText('No instances yet')).toBeVisible()
    await expect(win.getByText('Official launcher ready')).toBeVisible()
  })

  test('creates an instance with an installed Fabric version', async () => {
    await win.keyboard.press('Control+n')
    await win.fill('#new-name', 'Fabric Fun')
    await win.getByRole('radio', { name: 'Fabric' }).click()
    await win.getByRole('button', { name: 'Create instance' }).click()
    await expect(win.getByRole('heading', { name: 'Fabric Fun' })).toBeVisible()

    const [inst] = await instances()
    const p = (await profiles())[inst.profileId]
    expect(p).toMatchObject({ name: 'Fabric Fun', type: 'custom', lastVersionId: 'fabric-loader-0.16.9-1.21.1', gameDir: inst.gameDir })
    expect(p.icon).toMatch(/^data:image\/png;base64,/)
    expect(p.javaArgs).toMatch(/^-Xmx4G/)
  })

  test('Play selects the profile and opens the launcher', async () => {
    const before = Date.now()
    await win.locator('.head-actions .play').click()
    await expect(win.getByText('Opening the launcher with "Fabric Fun"')).toBeVisible()
    await expect.poll(() => fs.readFile(launcherLog, 'utf8').catch(() => '')).toContain('--workDir')
    const [inst] = await instances()
    expect(Date.parse((await profiles())[inst.profileId].lastUsed)).toBeGreaterThanOrEqual(before - 1000)
    const backups = await fs.readdir(path.join(root, 'kiln', 'backups', 'launcher-profiles'))
    expect(backups.length).toBeGreaterThan(0)
  })

  test('mods: reads names from jars, disables and deletes', async () => {
    const [inst] = await instances()
    await invoke('content.install', inst.id, 'mods', [await fabricMod(fixtures, 'sodium', 'Sodium', '0.6.0'), await forgeMod(fixtures, 'jei', 'Just Enough Items')])
    await openTab('Resource packs')
    await openTab('Mods')
    await expect(win.getByText('Sodium', { exact: true })).toBeVisible()
    await expect(win.getByText('Forge mod', { exact: true })).toBeVisible()

    await win.getByRole('switch', { name: 'Disable Sodium' }).click()
    await expect.poll(() => fs.readdir(path.join(inst.gameDir, 'mods'))).toContain('sodium-0.6.0.jar.disabled')
    await win.getByRole('button', { name: 'Disabled' }).click()
    await expect(win.getByText('Sodium', { exact: true })).toBeVisible()
    await win.locator('.seg button').first().click()

    // Dropping a newer version replaces the old file.
    await invoke('content.install', inst.id, 'mods', [await fabricMod(fixtures, 'sodium', 'Sodium', '0.6.1')])
    const files = await fs.readdir(path.join(inst.gameDir, 'mods'))
    expect(files).toContain('sodium-0.6.1.jar')
    expect(files).not.toContain('sodium-0.6.0.jar.disabled')

    await openTab('Shaders')
    await openTab('Mods')
    await win.locator('li', { hasText: 'Just Enough Items' }).getByRole('button', { name: 'More' }).click()
    await win.getByRole('menuitem', { name: 'Delete' }).click()
    await win.getByRole('button', { name: 'Delete', exact: true }).click()
    await expect.poll(() => fs.readdir(path.join(inst.gameDir, 'mods'))).not.toContain('jei-forge.jar')
  })

  test('resource packs show their icon and coloured description', async () => {
    const [inst] = await instances()
    await invoke('content.install', inst.id, 'resourcepacks', [await resourcePack(fixtures, 'Crisp', [{ text: 'Sharp ', color: 'gold' }, { text: 'textures' }])])
    await openTab('Resource packs')
    await expect(win.getByText('Crisp', { exact: true })).toBeVisible()
    await expect(win.getByText('Sharp')).toBeVisible()
  })

  test('worlds: lists, backs up, restores and copies', async () => {
    const [inst] = await instances()
    await makeWorld(path.join(inst.gameDir, 'saves'), 'Sunny', 'Sunny Plains')
    await openTab('Worlds')
    await expect(win.getByText('Sunny Plains')).toBeVisible()
    await win.getByRole('button', { name: 'Back up', exact: true }).click()
    await expect(win.getByRole('heading', { name: 'Backups' })).toBeVisible()
    await win.getByRole('button', { name: 'Restore' }).click()
    await win.getByRole('button', { name: 'Keep both' }).click()
    await expect(win.getByText('Sunny Plains')).toHaveCount(2)
    await expect.poll(() => fs.readdir(path.join(inst.gameDir, 'saves'))).toContain('Sunny (restored)')
  })

  test('data packs install into the chosen world', async () => {
    const [inst] = await instances()
    await openTab('Data packs')
    await expect(win.getByText('No data packs in this world')).toBeVisible()
    const world = await win.locator('.world-pick select').inputValue()
    await invoke('content.install', inst.id, 'datapacks', [await dataPack(fixtures, 'MoreLoot')], world)
    await openTab('Worlds')
    await openTab('Data packs')
    await expect(win.getByText('MoreLoot', { exact: true })).toBeVisible()
  })

  test('screenshots open in a lightbox', async () => {
    const [inst] = await instances()
    await fs.writeFile(path.join(inst.gameDir, 'screenshots', '2026-01-01_12.00.00.png'), PNG)
    await openTab('Screenshots')
    await win.locator('button.shot').first().click()
    await expect(win.getByText('2026-01-01_12.00.00.png')).toBeVisible()
    await win.keyboard.press('Escape')
    await expect(win.locator('.lightbox')).toHaveCount(0)
  })

  test('logs can be searched and show crash summaries', async () => {
    const [inst] = await instances()
    await fs.mkdir(path.join(inst.gameDir, 'logs'), { recursive: true })
    await fs.writeFile(
      path.join(inst.gameDir, 'logs', 'latest.log'),
      ['[12:00:00] [main/INFO]: Loading', '[12:00:01] [main/WARN]: Something odd', '[12:00:02] [main/ERROR]: Boom happened', '\tat foo.Bar(Bar.java:1)', '[12:00:03] [main/INFO]: boom again'].join('\n')
    )
    await fs.mkdir(path.join(inst.gameDir, 'crash-reports'), { recursive: true })
    await fs.writeFile(path.join(inst.gameDir, 'crash-reports', 'crash-2026-01-01_12.00.00-client.txt'), '---- Minecraft Crash Report ----\nDescription: Rendering overlay\n\njava.lang.NullPointerException: oops\n')
    await openTab('Logs')
    await win.getByPlaceholder('Search log').fill('boom')
    await expect(win.locator('.mcount')).toHaveText('1 / 2')
    await expect(win.locator('mark')).toHaveCount(2)
    await win.getByRole('button', { name: /crash-2026/ }).click()
    await expect(win.getByText('Rendering overlay: java.lang.NullPointerException: oops')).toBeVisible()
  })

  test('folders, pinning, duplicating and renaming', async () => {
    await win.getByRole('button', { name: 'New folder' }).click()
    await win.getByPlaceholder(/Survival, Modpacks/).fill('Modded')
    await win.getByRole('button', { name: 'Create folder' }).click()
    const [inst] = await instances()
    await invoke('instances.update', inst.id, { group: 'Modded', pinned: true })
    await invoke('instances.duplicate', inst.id)
    await win.getByRole('button', { name: /All instances/ }).click()
    await expect(win.getByText('Fabric Fun (copy)')).toBeVisible()

    const copy = (await instances()).find((i) => i.name === 'Fabric Fun (copy)')!
    await invoke('instances.update', copy.id, { name: 'Second Run' })
    expect((await profiles())[copy.profileId].name).toBe('Second Run')
    expect(copy.profileId).not.toBe(inst.profileId)

    await win.locator('.item.folder', { hasText: 'Modded' }).click()
    await expect(win.getByRole('heading', { name: 'Modded' })).toBeVisible()
    await expect(win.locator('.table .row', { hasText: 'Fabric Fun' })).toBeVisible()
  })

  test('search filters instances', async () => {
    await win.getByRole('button', { name: /All instances/ }).click()
    await win.keyboard.press('Control+k')
    await expect(win.locator('#search')).toBeFocused()
    await win.keyboard.type('second')
    await expect(win.locator('.table .row')).toHaveCount(1)
    await win.keyboard.press('Escape')
  })

  test('imports a Modrinth pack, listing files that failed to download', async () => {
    const pack = await makeZip(path.join(fixtures, 'Cozy.mrpack'), {
      'modrinth.index.json': JSON.stringify({
        formatVersion: 1,
        game: 'minecraft',
        versionId: '1.2.0',
        name: 'Cozy Pack',
        summary: 'A small pack',
        files: [
          { path: 'mods/unreachable.jar', hashes: { sha1: 'x', sha512: 'y' }, downloads: ['https://127.0.0.1:9/unreachable.jar'], fileSize: 1 },
          { path: 'mods/server-only.jar', hashes: { sha1: 'x', sha512: 'y' }, env: { client: 'unsupported', server: 'required' }, downloads: ['https://127.0.0.1:9/s.jar'], fileSize: 1 }
        ],
        dependencies: { minecraft: '1.21.1', 'fabric-loader': '0.16.9' }
      }),
      'overrides/config/cozy.toml': 'cozy = true',
      'client-overrides/options.txt': 'fov:0.5'
    })
    const summary = await invoke<{ name: string; fileCount: number; versionId: string }>('modpacks.inspect', pack)
    expect(summary).toMatchObject({ name: 'Cozy Pack', fileCount: 1, versionId: 'fabric-loader-0.16.9-1.21.1' })
    const result = await invoke<{ instanceId: string; manual: { name: string }[] }>('modpacks.import', pack, 'Cozy')
    expect(result.manual.map((m) => m.name)).toEqual(['unreachable.jar'])
    const inst = (await instances()).find((i) => i.id === result.instanceId)!
    expect(await fs.readFile(path.join(inst.gameDir, 'config', 'cozy.toml'), 'utf8')).toBe('cozy = true')
    expect(await fs.readFile(path.join(inst.gameDir, 'options.txt'), 'utf8')).toBe('fov:0.5')
  })

  test('rejects modpacks that try to write outside the instance', async () => {
    const evil = await makeZip(path.join(fixtures, 'Evil.mrpack'), {
      'modrinth.index.json': JSON.stringify({ formatVersion: 1, name: 'Evil', files: [{ path: '../../escape.jar', hashes: {}, downloads: ['https://127.0.0.1:9/x'] }], dependencies: { minecraft: '1.21.1' } })
    })
    await expect(invoke('modpacks.import', evil)).rejects.toThrow(/outside its instance folder/)
    expect((await instances()).some((i) => i.name === 'Evil')).toBe(false)
  })

  test('imports a CurseForge zip and lists mods to get by hand', async () => {
    const pack = await makeZip(path.join(fixtures, 'Tech.zip'), {
      'manifest.json': JSON.stringify({
        manifestType: 'minecraftModpack',
        name: 'Tech Pack',
        version: '3.0',
        author: 'Someone',
        overrides: 'overrides',
        minecraft: { version: '1.20.1', modLoaders: [{ id: 'forge-47.2.0', primary: true }] },
        files: [{ projectID: 238222, fileID: 4712866, required: true }]
      }),
      'modlist.html': '<ul><li><a href="https://www.curseforge.com/minecraft/mc-mods/jei">Just Enough Items (by mezz)</a></li></ul>',
      'overrides/config/tech.cfg': 'x=1'
    })
    const result = await invoke<{ instanceId: string; manual: { name: string; url: string }[] }>('modpacks.import', pack)
    expect(result.manual).toEqual([expect.objectContaining({ name: 'Just Enough Items', url: 'https://www.curseforge.com/minecraft/mc-mods/jei' })])
    const inst = (await instances()).find((i) => i.id === result.instanceId)!
    expect(inst).toMatchObject({ name: 'Tech Pack' })
    expect((await profiles())[inst.profileId].lastVersionId).toBe('1.20.1-forge-47.2.0')
  })

  test('imports a Prism Launcher instance', async () => {
    const prism = path.join(fixtures, 'prism', 'instances', 'Old Times')
    await fs.mkdir(path.join(prism, '.minecraft', 'mods'), { recursive: true })
    await fs.writeFile(path.join(prism, 'instance.cfg'), '[General]\nname=Old Times\niconKey=default\n')
    await fs.writeFile(
      path.join(prism, 'mmc-pack.json'),
      JSON.stringify({ components: [{ uid: 'net.minecraft', version: '1.20.1' }, { uid: 'net.fabricmc.fabric-loader', version: '0.15.11' }], formatVersion: 1 })
    )
    await fabricMod(path.join(prism, '.minecraft', 'mods'), 'lithium', 'Lithium')
    const found = await invoke<{ name: string; loader: string }[]>('importers.scanFolder', path.dirname(prism))
    expect(found).toEqual([expect.objectContaining({ name: 'Old Times', loader: 'fabric', mcVersion: '1.20.1' })])
    const inst = await invoke<{ gameDir: string; versionInstalled: boolean }>('importers.import', prism)
    expect(await fs.readdir(path.join(inst.gameDir, 'mods'))).toEqual(['lithium-1.0.0.jar'])
    expect(inst.versionInstalled).toBe(false)
  })

  test('shows install steps for a loader that is not installed', async () => {
    await win.getByRole('button', { name: /All instances/ }).click()
    await win.locator('.table .row', { hasText: 'Old Times' }).click()
    await expect(win.getByText('Install Fabric 0.15.11 for 1.20.1 to play this instance')).toBeVisible()
  })

  test('exports an instance as a modpack', async () => {
    const [inst] = (await instances()).filter((i) => i.name === 'Fabric Fun')
    const dest = path.join(root, 'export.mrpack')
    await app.evaluate(({ dialog }, file) => {
      dialog.showSaveDialog = (async () => ({ canceled: false, filePath: file })) as typeof dialog.showSaveDialog
    }, dest)
    await invoke('modpacks.export', inst.id, { include: { mods: true, config: true, resourcepacks: true, shaderpacks: true, saves: true, options: true } })
    const entries = await listZip(dest)
    expect(entries).toContain('modrinth.index.json')
    expect(entries).toContain('overrides/mods/sodium-0.6.1.jar')
    expect(entries.some((e) => e.startsWith('overrides/saves/Sunny/'))).toBe(true)
  })

  test('explains a missing launcher', async () => {
    await invoke('settings.update', { launcher: { kind: 'command', path: path.join(root, 'nope'), label: 'Gone' } })
    await win.getByRole('button', { name: /All instances/ }).click()
    await win.locator('.table .row', { hasText: 'Second Run' }).getByRole('button', { name: /^Play/ }).click()
    await expect(win.getByText("Couldn't open the official launcher")).toBeVisible()
    await expect(win.getByText(/Official launcher not found/).first()).toBeVisible()
  })

  test('deleting an instance removes its launcher profile', async () => {
    const copy = (await instances()).find((i) => i.name === 'Second Run')!
    await invoke('instances.remove', copy.id)
    expect((await profiles())[copy.profileId]).toBeUndefined()
  })

  test('switches to the dark theme', async () => {
    await win.getByRole('button', { name: 'Settings', exact: true }).click()
    await win.getByRole('radio', { name: /Dark/ }).click()
    await expect(win.locator('html')).toHaveAttribute('data-theme', 'dark')
  })
})

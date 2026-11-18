import { mkdtemp, mkdir, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import { classifyPath, componentToString, readModMeta, readPackMeta } from '../../src/main/instances/metadata'
import { dataPack, fabricMod, forgeMod, legacyMod, makeWorld, makeZip, quiltMod, resourcePack, shaderPack } from '../fixtures/build'

let dir: string
beforeAll(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), 'kiln-meta-'))
})

describe('mod metadata', () => {
  it('reads fabric.mod.json with icon and mixed author formats', async () => {
    const meta = await readModMeta(await fabricMod(dir, 'sodium', 'Sodium', '0.6.0'))
    expect(meta).toMatchObject({ id: 'sodium', name: 'Sodium', version: '0.6.0', loader: 'fabric', authors: ['Ada', 'Grace'] })
    expect(meta.icon?.length).toBeGreaterThan(0)
  })

  it('reads mods.toml and falls back to the manifest version', async () => {
    const meta = await readModMeta(await forgeMod(dir, 'jei', 'Just Enough Items'))
    expect(meta).toMatchObject({ id: 'jei', name: 'Just Enough Items', version: '2.3.4', loader: 'forge', description: 'A forge mod.' })
    expect(meta.icon).toBeDefined()
  })

  it('reads quilt.mod.json', async () => {
    const meta = await readModMeta(await quiltMod(dir, 'qsl', 'Quilt Standard Libraries'))
    expect(meta).toMatchObject({ id: 'qsl', name: 'Quilt Standard Libraries', version: '0.5.0', loader: 'quilt', authors: ['Tess'] })
  })

  it('reads legacy mcmod.info even with raw tabs inside strings', async () => {
    const meta = await readModMeta(await legacyMod(dir, 'buildcraft', 'BuildCraft'))
    expect(meta).toMatchObject({ id: 'buildcraft', name: 'BuildCraft', version: '1.4', authors: ['Notch'] })
  })

  it('returns nothing (not an error) for jars without metadata', async () => {
    expect(await readModMeta(await makeZip(path.join(dir, 'plain.jar'), { 'a.class': 'x' }))).toEqual({})
  })
})

describe('pack metadata', () => {
  it('turns text components into § codes', () => {
    expect(componentToString([{ text: 'Hi ', color: 'gold' }, { text: 'there', bold: true }])).toBe('§6Hi §r§lthere§r')
    expect(componentToString('plain')).toBe('plain')
  })

  it('reads pack.mcmeta and pack.png from a zip', async () => {
    const meta = await readPackMeta(await resourcePack(dir, 'Faithful', { text: 'Classic', color: 'aqua' }))
    expect(meta.description).toBe('§bClassic§r')
    expect(meta.icon).toBeDefined()
  })

  it('reads a folder pack', async () => {
    const folder = path.join(dir, 'FolderPack')
    await mkdir(folder, { recursive: true })
    await writeFile(path.join(folder, 'pack.mcmeta'), JSON.stringify({ pack: { description: 'In a folder' } }))
    expect((await readPackMeta(folder)).description).toBe('In a folder')
  })
})

describe('classifyPath', () => {
  it('tells mods, packs, worlds and modpacks apart', async () => {
    expect(await classifyPath(await fabricMod(dir, 'lithium', 'Lithium'))).toBe('mods')
    expect(await classifyPath(await resourcePack(dir, 'rp', 'x'))).toBe('resourcepacks')
    expect(await classifyPath(await dataPack(dir, 'dp'))).toBe('datapacks')
    expect(await classifyPath(await shaderPack(dir, 'BSL'))).toBe('shaderpacks')
    expect(await classifyPath(await makeZip(path.join(dir, 'pack.mrpack'), { 'modrinth.index.json': '{}' }))).toBe('modpack')
    expect(await classifyPath(await makeZip(path.join(dir, 'cf.zip'), { 'manifest.json': '{}' }))).toBe('modpack')
    expect(await classifyPath(await makeWorld(dir, 'MyWorld', 'My World'))).toBe('world')
    expect(await classifyPath(await makeZip(path.join(dir, 'world.zip'), { 'MyWorld/level.dat': 'x' }))).toBe('world')
    expect(await classifyPath(await makeZip(path.join(dir, 'random.zip'), { 'readme.txt': 'x' }))).toBe('unknown')
  })
})

describe('classifyPath with unusual packs', () => {
  it('recognises a resource pack zipped inside an extra folder', async () => {
    expect(await classifyPath(await makeZip(path.join(dir, 'wrapped.zip'), { 'My Pack/pack.mcmeta': '{}', 'My Pack/assets/minecraft/x.png': 'x' }))).toBe('resourcepacks')
    expect(await classifyPath(await makeZip(path.join(dir, 'nomcmeta.zip'), { 'Edit/assets/minecraft/shaders/post/a.json': '{}' }))).toBe('resourcepacks')
  })
})

describe('damaged zips', () => {
  it('skips entries with unsafe names instead of failing', async () => {
    const file = await resourcePack(dir, 'Odd', 'Still works')
    // Patch a harmless entry name into "/" in both the local and central headers.
    const { readFile, writeFile: write } = await import('node:fs/promises')
    const buf = await readFile(file)
    const target = Buffer.from('assets/minecraft/textures/block/stone.png')
    let i = buf.indexOf(target)
    while (i >= 0) {
      buf.write('/'.padEnd(target.length, '\0'), i, 'latin1')
      i = buf.indexOf(target, i + 1)
    }
    await write(file, buf)
    expect((await readPackMeta(file)).description).toBe('Still works')
    expect(await classifyPath(file)).toBe('resourcepacks')
  })
})

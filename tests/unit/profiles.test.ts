import { mkdtemp, readdir, readFile, writeFile, mkdir } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import { buildJavaArgs, removeProfile, upsertProfile } from '../../src/main/launcher/profiles'
import { readNbt } from '../../src/main/util/nbt'
import { safeJoin, slugify } from '../../src/main/util/fs'
import { levelDat } from '../fixtures/build'

let mc: string
let data: string
const input = { id: 'kiln-test-abc', name: 'Test', versionId: '1.21.1', gameDir: '/games/test', javaArgs: '-Xmx4G' }

beforeEach(async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'kiln-prof-'))
  mc = path.join(root, '.minecraft')
  data = path.join(root, 'data')
  await mkdir(mc, { recursive: true })
})

const read = async (f = 'launcher_profiles.json') => JSON.parse(await readFile(path.join(mc, f), 'utf8'))

describe('launcher_profiles.json', () => {
  it('creates the file when it does not exist', async () => {
    await upsertProfile(mc, data, null, input)
    const file = await read()
    expect(file.version).toBe(3)
    expect(file.profiles['kiln-test-abc']).toMatchObject({ name: 'Test', type: 'custom', lastVersionId: '1.21.1', gameDir: '/games/test', javaArgs: '-Xmx4G', icon: 'Furnace' })
  })

  it('keeps other profiles and settings untouched, and backs up first', async () => {
    const original = { profiles: { other: { name: 'Mine', type: 'latest-release', lastVersionId: 'latest-release' } }, settings: { keepLauncherOpen: true }, version: 3, extra: 1 }
    await writeFile(path.join(mc, 'launcher_profiles.json'), JSON.stringify(original))
    await upsertProfile(mc, data, null, input, true)
    const file = await read()
    expect(file.profiles.other).toEqual(original.profiles.other)
    expect(file.settings).toEqual({ keepLauncherOpen: true })
    expect(file.extra).toBe(1)
    expect(Date.parse(file.profiles['kiln-test-abc'].lastUsed)).toBeGreaterThan(Date.now() - 60000)

    const backups = await readdir(path.join(data, 'backups', 'launcher-profiles'))
    expect(backups).toHaveLength(1)
    expect(JSON.parse(await readFile(path.join(data, 'backups', 'launcher-profiles', backups[0]), 'utf8'))).toEqual(original)
  })

  it('updates the Microsoft Store file too when it exists', async () => {
    await writeFile(path.join(mc, 'launcher_profiles_microsoft_store.json'), JSON.stringify({ profiles: {}, version: 3 }))
    await upsertProfile(mc, data, null, input)
    expect((await read('launcher_profiles_microsoft_store.json')).profiles['kiln-test-abc']).toBeDefined()
  })

  it('removes a profile', async () => {
    await upsertProfile(mc, data, null, input)
    await removeProfile(mc, data, null, input.id)
    expect((await read()).profiles['kiln-test-abc']).toBeUndefined()
  })

  it('refuses to overwrite a damaged file', async () => {
    await writeFile(path.join(mc, 'launcher_profiles.json'), '{ not json')
    await expect(upsertProfile(mc, data, null, input)).rejects.toThrow(/could not be read/)
    expect(await readFile(path.join(mc, 'launcher_profiles.json'), 'utf8')).toBe('{ not json')
  })

  it('builds java arguments with the memory flag first', () => {
    expect(buildJavaArgs(6144, '-Xmx1G -Dfoo=bar')).toMatch(/^-Xmx6G .* -Dfoo=bar$/)
    expect(buildJavaArgs(3584)).toMatch(/^-Xmx3584M /)
  })
})

describe('helpers', () => {
  it('reads level.dat', () => {
    const nbt = readNbt(levelDat('Hello', 1700000000000, 1))
    expect(nbt.Data).toMatchObject({ LevelName: 'Hello', LastPlayed: 1700000000000, GameType: 1 })
  })
  it('makes safe folder names', () => {
    expect(slugify('  My Pack: Ünïcode / 1.21!  ')).toBe('My-Pack-Unicode-1.21')
    expect(slugify('...')).toBe('instance')
  })
  it('rejects paths that escape their folder', () => {
    expect(() => safeJoin('/a/b', '../c')).toThrow()
    expect(() => safeJoin('/a/b', '/etc/passwd')).toThrow()
    expect(() => safeJoin('/a/b', 'C:\\x')).toThrow()
    expect(safeJoin('/a/b', 'mods/x.jar')).toBe(path.resolve('/a/b/mods/x.jar'))
  })
})

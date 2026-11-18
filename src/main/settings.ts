import path from 'node:path'
import { app } from 'electron'
import type { Settings } from '@shared/types'
import { readJson, writeJson } from './util/fs'
import { defaultDataDir, defaultMinecraftDirs } from './paths'

const defaults = (): Settings => ({
  setupComplete: false,
  minecraftDir: defaultMinecraftDirs()[0],
  dataDir: defaultDataDir(),
  launcher: null,
  theme: 'system',
  accent: 'ember',
  groups: [],
  collapsedGroups: [],
  defaultMemoryMb: 4096,
  reduceMotion: false
})

let cache: Settings | null = null

const file = () => path.join(app.getPath('userData'), 'settings.json')

export async function getSettings(): Promise<Settings> {
  if (!cache) cache = { ...defaults(), ...((await readJson<Partial<Settings>>(file())) ?? {}) }
  return cache
}

export async function updateSettings(patch: Partial<Settings>): Promise<Settings> {
  const next = { ...(await getSettings()), ...patch }
  await writeJson(file(), next)
  cache = next
  return next
}

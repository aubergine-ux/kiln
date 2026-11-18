import path from 'node:path'
import type { ExportOptions } from '@shared/types'
import { getSettings } from '../settings'
import { exists } from '../util/fs'
import { createZip, type ZipSource } from '../util/zip'
import { progressReporter } from '../progress'
import { gameDir, readConfig } from '../instances/store'

/**
 * Export an instance as a Modrinth-style pack: a modrinth.index.json plus an
 * "overrides" folder holding the chosen files. Kiln, Prism Launcher and the
 * Modrinth App can all import it, whether it is named .zip or .mrpack.
 */
export async function exportInstance(id: string, dest: string, options: ExportOptions): Promise<string> {
  const config = await readConfig(id)
  const game = gameDir(await getSettings(), id)

  const dependencies: Record<string, string> = { minecraft: config.mcVersion }
  if (config.loaderVersion) {
    const key = { fabric: 'fabric-loader', quilt: 'quilt-loader', forge: 'forge', neoforge: 'neoforge' }[config.loader as string]
    if (key) dependencies[key] = config.loaderVersion
  }
  const index = {
    formatVersion: 1,
    game: 'minecraft',
    versionId: new Date().toISOString().slice(0, 10),
    name: config.name,
    summary: config.notes || `Exported from Kiln`,
    files: [],
    dependencies
  }

  const sources: ZipSource[] = [{ data: Buffer.from(JSON.stringify(index, null, 2)), to: 'modrinth.index.json' }]
  const pick: [keyof ExportOptions['include'], string][] = [
    ['mods', 'mods'],
    ['config', 'config'],
    ['config', 'defaultconfigs'],
    ['config', 'kubejs'],
    ['resourcepacks', 'resourcepacks'],
    ['shaderpacks', 'shaderpacks'],
    ['saves', 'saves'],
    ['options', 'options.txt'],
    ['options', 'servers.dat']
  ]
  for (const [option, rel] of pick) {
    const from = path.join(game, rel)
    if (options.include[option] && (await exists(from))) sources.push({ from, to: `overrides/${rel}` })
  }

  const progress = progressReporter(`export:${id}`, `Exporting ${config.name}`)
  await createZip(dest, sources, () => progress.tick())
  progress.finish()
  return dest
}

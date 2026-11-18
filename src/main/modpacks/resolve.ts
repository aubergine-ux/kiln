import type { GameVersion, Loader } from '@shared/types'
import { expectedVersionId } from '@shared/loaders'

/**
 * Pick the launcher version id for a game version + loader. Prefer something that is
 * already installed (installers do not always use the same naming), otherwise return
 * the id the official installer will create.
 */
export function resolveVersionId(installed: GameVersion[], loader: Loader, mc: string, loaderVersion?: string): string {
  const match = installed.find((v) => v.loader === loader && v.mcVersion === mc && (!loaderVersion || v.loaderVersion === loaderVersion))
  if (match) return match.id
  return expectedVersionId(loader, mc, loaderVersion)
}

/** Modrinth's "dependencies" block → loader + versions. */
export function loaderFromMrpack(deps: Record<string, string>): { mc: string; loader: Loader; loaderVersion?: string } {
  const mc = deps.minecraft ?? ''
  if (deps['fabric-loader']) return { mc, loader: 'fabric', loaderVersion: deps['fabric-loader'] }
  if (deps['quilt-loader']) return { mc, loader: 'quilt', loaderVersion: deps['quilt-loader'] }
  if (deps.neoforge) return { mc, loader: 'neoforge', loaderVersion: deps.neoforge }
  if (deps.forge) return { mc, loader: 'forge', loaderVersion: deps.forge }
  return { mc, loader: 'vanilla' }
}

/** CurseForge loader ids look like "forge-47.2.0", "neoforge-21.1.77" or "fabric-0.15.11". */
export function loaderFromCurseForge(id: string | undefined): { loader: Loader; loaderVersion?: string } {
  if (!id) return { loader: 'vanilla' }
  const [name, ...rest] = id.split('-')
  const version = rest.join('-') || undefined
  switch (name.toLowerCase()) {
    case 'fabric':
      return { loader: 'fabric', loaderVersion: version }
    case 'quilt':
      return { loader: 'quilt', loaderVersion: version }
    case 'neoforge':
      return { loader: 'neoforge', loaderVersion: version?.replace(/^1\.20\.1-/, '') }
    case 'forge':
      return { loader: 'forge', loaderVersion: version }
    default:
      return { loader: 'other', loaderVersion: version }
  }
}

/** Prism/MultiMC component uids → loader. */
export function loaderFromComponents(components: { uid: string; version?: string }[]): { mc: string; loader: Loader; loaderVersion?: string } {
  const get = (uid: string) => components.find((c) => c.uid === uid)?.version
  const mc = get('net.minecraft') ?? ''
  if (get('net.fabricmc.fabric-loader')) return { mc, loader: 'fabric', loaderVersion: get('net.fabricmc.fabric-loader') }
  if (get('org.quiltmc.quilt-loader')) return { mc, loader: 'quilt', loaderVersion: get('org.quiltmc.quilt-loader') }
  if (get('net.neoforged')) return { mc, loader: 'neoforge', loaderVersion: get('net.neoforged') }
  if (get('net.minecraftforge')) return { mc, loader: 'forge', loaderVersion: get('net.minecraftforge') }
  return { mc, loader: 'vanilla' }
}

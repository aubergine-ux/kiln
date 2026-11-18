import type { Loader } from './types'

/** Display names, colours and where to get each loader's official installer. */
export const LOADERS: Record<Loader, { label: string; installer?: (mc: string) => string; steps?: string }> = {
  vanilla: { label: 'Vanilla' },
  fabric: {
    label: 'Fabric',
    installer: () => 'https://fabricmc.net/use/installer/',
    steps: 'Download and open the Fabric installer, choose the "Client" tab, pick the game version, leave "Create profile" checked and click Install.'
  },
  quilt: {
    label: 'Quilt',
    installer: () => 'https://quiltmc.org/en/install/client/',
    steps: 'Download and open the Quilt installer, pick the game version and click Install.'
  },
  forge: {
    label: 'Forge',
    installer: (mc) => (mc ? `https://files.minecraftforge.net/net/minecraftforge/forge/index_${mc}.html` : 'https://files.minecraftforge.net/'),
    steps: 'Download the "Installer" for your game version, open it, choose "Install client" and click OK.'
  },
  neoforge: {
    label: 'NeoForge',
    installer: () => 'https://neoforged.net/',
    steps: 'Download the NeoForge installer for your game version, open it, choose "Install client" and click Proceed.'
  },
  optifine: { label: 'OptiFine', installer: () => 'https://optifine.net/downloads', steps: 'Download OptiFine for your version, open the jar and click Install.' },
  other: { label: 'Modded' }
}

/**
 * The version id the loader's official installer creates in .minecraft/versions.
 * These are the names the installers use today; Kiln also matches by loader and
 * game version, so small naming differences are fine.
 */
export function expectedVersionId(loader: Loader, mc: string, loaderVersion = 'latest'): string {
  switch (loader) {
    case 'fabric':
      return `fabric-loader-${loaderVersion}-${mc}`
    case 'quilt':
      return `quilt-loader-${loaderVersion}-${mc}`
    case 'forge':
      return `${mc}-forge-${loaderVersion}`
    case 'neoforge':
      return `neoforge-${loaderVersion}`
    default:
      return mc
  }
}

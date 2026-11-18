import os from 'node:os'
import path from 'node:path'

const home = os.homedir()

/** Default location of the official launcher's data folder. */
export function defaultMinecraftDirs(): string[] {
  switch (process.platform) {
    case 'win32': {
      const appData = process.env.APPDATA || path.join(home, 'AppData', 'Roaming')
      return [path.join(appData, '.minecraft')]
    }
    case 'darwin':
      return [path.join(home, 'Library', 'Application Support', 'minecraft')]
    default:
      return [path.join(home, '.minecraft'), path.join(home, '.var', 'app', 'com.mojang.Minecraft', '.minecraft')]
  }
}

/** Default folder for Kiln's instances and backups. */
export function defaultDataDir(): string {
  switch (process.platform) {
    case 'win32':
      return path.join(process.env.APPDATA || path.join(home, 'AppData', 'Roaming'), 'Kiln')
    case 'darwin':
      return path.join(home, 'Library', 'Application Support', 'Kiln')
    default:
      return path.join(process.env.XDG_DATA_HOME || path.join(home, '.local', 'share'), 'kiln')
  }
}

/** Layout of Kiln's data folder. */
export const layout = {
  instances: (dataDir: string) => path.join(dataDir, 'instances'),
  instance: (dataDir: string, id: string) => path.join(dataDir, 'instances', id),
  gameDir: (dataDir: string, id: string) => path.join(dataDir, 'instances', id, 'minecraft'),
  profileBackups: (dataDir: string) => path.join(dataDir, 'backups', 'launcher-profiles'),
  worldBackups: (dataDir: string, id: string) => path.join(dataDir, 'backups', 'worlds', id)
}

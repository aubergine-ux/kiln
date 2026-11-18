import { spawn } from 'node:child_process'
import type { LauncherCandidate } from '@shared/types'
import { KilnError } from '../util/errors'
import path from 'node:path'
import { defaultMinecraftDirs } from '../paths'
import { launcherHelp } from './detect'

/**
 * Open the official launcher. Resolves once it has been started.
 * If the game folder is not the usual one, the launcher is told where it is with --workDir.
 */
export function openLauncher(launcher: LauncherCandidate | null, minecraftDir?: string): Promise<void> {
  if (!launcher) {
    throw new KilnError('Official launcher not found.', launcherHelp())
  }
  const custom = !!minecraftDir && !defaultMinecraftDirs().some((d) => path.resolve(d) === path.resolve(minecraftDir))
  const workDir = custom ? ['--workDir', minecraftDir!] : []
  let command: string
  let args: string[] = []
  switch (launcher.kind) {
    case 'app':
      command = 'open'
      args = ['-a', launcher.path, ...(workDir.length ? ['--args', ...workDir] : [])]
      break
    case 'store':
      command = 'explorer.exe'
      args = [`shell:AppsFolder\\${launcher.path}`]
      break
    case 'flatpak':
      command = 'flatpak'
      args = ['run', launcher.path, ...workDir]
      break
    default:
      command = launcher.path
      args = workDir
  }

  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { detached: true, stdio: 'ignore', windowsHide: false })
    const timer = setTimeout(() => {
      child.unref()
      resolve()
    }, 700)
    child.once('error', (err) => {
      clearTimeout(timer)
      reject(new KilnError(`The official launcher could not be started (${(err as NodeJS.ErrnoException).code ?? err.message}).`, launcherHelp()))
    })
  })
}

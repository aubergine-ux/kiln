import { execFile } from 'node:child_process'
import os from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import type { LauncherCandidate, SetupDetection } from '@shared/types'
import { exists } from '../util/fs'
import { defaultDataDir, defaultMinecraftDirs } from '../paths'

const run = promisify(execFile)

/** Microsoft Store / Xbox app package of the official launcher. */
const STORE_APP_ID = 'Microsoft.4297127D64EC6_8wekyb3d8bbwe!Minecraft'
const FLATPAK_ID = 'com.mojang.Minecraft'

async function onPath(command: string): Promise<string | null> {
  try {
    const finder = process.platform === 'win32' ? 'where' : 'which'
    const { stdout } = await run(finder, [command])
    return stdout.split(/\r?\n/)[0].trim() || null
  } catch {
    return null
  }
}

async function findWindows(): Promise<LauncherCandidate[]> {
  const found: LauncherCandidate[] = []
  const pf86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)'
  const pf = process.env.ProgramFiles || 'C:\\Program Files'
  const local = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local')
  const exes = [
    path.join(pf86, 'Minecraft Launcher', 'MinecraftLauncher.exe'),
    path.join(pf, 'Minecraft Launcher', 'MinecraftLauncher.exe'),
    path.join(local, 'Programs', 'Minecraft Launcher', 'MinecraftLauncher.exe')
  ]
  for (const exe of exes) if (await exists(exe)) found.push({ kind: 'exe', path: exe, label: 'Official launcher' })

  // The Microsoft Store version lives in WindowsApps, which we cannot list. Ask PowerShell instead.
  try {
    const { stdout } = await run('powershell.exe', [
      '-NoProfile',
      '-Command',
      'Get-AppxPackage -Name Microsoft.4297127D64EC6 | Select-Object -ExpandProperty PackageFamilyName'
    ])
    if (stdout.trim()) found.push({ kind: 'store', path: STORE_APP_ID, label: 'Official launcher (Microsoft Store)' })
  } catch {
    // PowerShell missing or the package is not installed.
  }
  return found
}

async function findMac(): Promise<LauncherCandidate[]> {
  const apps = ['/Applications/Minecraft.app', path.join(os.homedir(), 'Applications', 'Minecraft.app')]
  const found: LauncherCandidate[] = []
  for (const app of apps) if (await exists(app)) found.push({ kind: 'app', path: app, label: 'Official launcher' })
  return found
}

async function findLinux(): Promise<LauncherCandidate[]> {
  const found: LauncherCandidate[] = []
  const cmd = await onPath('minecraft-launcher')
  if (cmd) found.push({ kind: 'command', path: cmd, label: 'Official launcher' })
  for (const p of ['/opt/minecraft-launcher/minecraft-launcher', path.join(os.homedir(), 'minecraft-launcher', 'minecraft-launcher')]) {
    if (p !== cmd && (await exists(p))) found.push({ kind: 'exe', path: p, label: 'Official launcher' })
  }
  try {
    const { stdout } = await run('flatpak', ['info', FLATPAK_ID])
    if (stdout) found.push({ kind: 'flatpak', path: FLATPAK_ID, label: 'Official launcher (Flatpak)' })
  } catch {
    // Flatpak not installed, or the launcher is not installed through it.
  }
  return found
}

async function findLaunchers(): Promise<LauncherCandidate[]> {
  if (process.platform === 'win32') return findWindows()
  if (process.platform === 'darwin') return findMac()
  return findLinux()
}

export async function detectSetup(): Promise<SetupDetection> {
  const dirs = defaultMinecraftDirs()
  const minecraftDirs: string[] = []
  for (const d of dirs) if (await exists(d)) minecraftDirs.push(d)
  return {
    launchers: await findLaunchers(),
    minecraftDirs,
    defaultDataDir: defaultDataDir(),
    platform: process.platform
  }
}

export async function launcherExists(c: LauncherCandidate | null): Promise<boolean> {
  if (!c) return false
  if (c.kind === 'store' || c.kind === 'flatpak') return (await findLaunchers()).some((l) => l.kind === c.kind)
  return exists(c.path)
}

/** Best-effort check whether the official launcher is already open. */
export async function isLauncherRunning(): Promise<boolean> {
  try {
    if (process.platform === 'win32') {
      const { stdout } = await run('tasklist', ['/FI', 'IMAGENAME eq Minecraft.exe', '/NH'])
      const { stdout: legacy } = await run('tasklist', ['/FI', 'IMAGENAME eq MinecraftLauncher.exe', '/NH'])
      return /Minecraft(Launcher)?\.exe/i.test(stdout + legacy)
    }
    const pattern = process.platform === 'darwin' ? 'Minecraft.app/Contents/MacOS' : 'minecraft-launcher'
    const { stdout } = await run('pgrep', ['-f', pattern])
    return stdout.trim().length > 0
  } catch {
    return false
  }
}

/** Help text shown when no launcher could be found. */
export function launcherHelp(): string {
  switch (process.platform) {
    case 'win32':
      return 'Install the official launcher from minecraft.net/download (or the Microsoft Store), open it once, then click "Detect again".'
    case 'darwin':
      return 'Download the official launcher from minecraft.net/download, drag it into Applications, open it once, then click "Detect again".'
    default:
      return 'Install the official launcher from minecraft.net/download (the .deb, the Arch "minecraft-launcher" package, or the Flatpak), open it once, then click "Detect again". You can also point Kiln at the launcher file yourself.'
  }
}

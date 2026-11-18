// Types shared by the main process and the UI.

export type Loader = 'vanilla' | 'fabric' | 'quilt' | 'forge' | 'neoforge' | 'optifine' | 'other'

export type Theme = 'system' | 'light' | 'dark'
export type Accent = 'ember' | 'moss' | 'sky' | 'violet' | 'rose'

export type LauncherKind = 'exe' | 'app' | 'store' | 'flatpak' | 'command'

export interface Settings {
  setupComplete: boolean
  /** The official launcher's data folder (".minecraft"). */
  minecraftDir: string
  /** Where Kiln keeps its instances and backups. */
  dataDir: string
  launcher: LauncherCandidate | null
  theme: Theme
  accent: Accent
  /** Folder names, in display order. */
  groups: string[]
  collapsedGroups: string[]
  defaultMemoryMb: number
  reduceMotion: boolean
}

export interface LauncherCandidate {
  kind: LauncherKind
  /** Executable, .app bundle, store app id, flatpak id, or command on PATH. */
  path: string
  label: string
}

export interface SetupDetection {
  launchers: LauncherCandidate[]
  minecraftDirs: string[]
  defaultDataDir: string
  platform: NodeJS.Platform
}

export interface LauncherStatus {
  launcher: LauncherCandidate | null
  launcherFound: boolean
  minecraftDirFound: boolean
  profilesFile: string | null
  running: boolean
}

/** A built-in glyph on a coloured tile, or a custom image stored in the instance folder. */
export type InstanceIcon =
  | { kind: 'glyph'; glyph: string; color: string }
  | { kind: 'image'; file: string }

/** What is stored in instances/<id>/instance.json */
export interface InstanceConfig {
  name: string
  icon: InstanceIcon
  /** Version id understood by the official launcher, e.g. "1.21.1" or "fabric-loader-0.16.9-1.21.1". */
  versionId: string
  mcVersion: string
  loader: Loader
  loaderVersion?: string
  group?: string
  pinned: boolean
  memoryMb: number
  /** Extra JVM arguments added after the memory flag. */
  extraJavaArgs?: string
  created: string
  lastPlayed?: string
  /** Key of the matching entry in launcher_profiles.json */
  profileId: string
  notes?: string
  /** Shown on the instance page, e.g. when an import uses something the official launcher can't run. */
  warning?: string
}

export interface Instance extends InstanceConfig {
  id: string
  gameDir: string
  iconUrl?: string
  modCount: number
  /** False when the version (or loader) is not in the versions folder yet. */
  versionInstalled: boolean
}

export interface NewInstance {
  name: string
  versionId: string
  icon?: InstanceIcon
  group?: string
  memoryMb?: number
  /** Only needed for a loader that is not installed yet (otherwise read from the version). */
  mcVersion?: string
  loader?: Loader
  loaderVersion?: string
}

export interface GameVersion {
  id: string
  mcVersion: string
  loader: Loader
  loaderVersion?: string
  /** "release", "snapshot", "old_beta", ... (vanilla only) */
  type?: string
  releaseTime?: string
}

export type ContentKind = 'mods' | 'resourcepacks' | 'shaderpacks' | 'datapacks'

export interface ContentItem {
  file: string
  name: string
  id?: string
  version?: string
  description?: string
  authors?: string[]
  iconUrl?: string
  enabled: boolean
  isFolder: boolean
  size: number
  modified: number
  /** For mods: which loader the metadata belongs to. */
  loader?: Loader
}

export interface World {
  folder: string
  name: string
  lastPlayed?: number
  gameMode?: string
  hardcore?: boolean
  version?: string
  iconUrl?: string
}

export interface WorldBackup {
  file: string
  path: string
  world: string
  created: number
  size: number
}

export interface Screenshot {
  file: string
  url: string
  created: number
  size: number
}

export interface LogFile {
  file: string
  kind: 'log' | 'crash'
  modified: number
  size: number
}

export interface ModpackSummary {
  format: 'mrpack' | 'curseforge'
  name: string
  version?: string
  summary?: string
  author?: string
  mcVersion: string
  loader: Loader
  loaderVersion?: string
  versionId: string
  fileCount: number
  /** CurseForge entries that have no direct download URL. */
  manualCount: number
}

export interface ModpackResult {
  instanceId: string
  downloaded: number
  /** Files that could not be downloaded automatically, with a page to get them from. */
  manual: { name: string; url?: string; reason: string }[]
}

export interface ExportOptions {
  include: { mods: boolean; config: boolean; resourcepacks: boolean; shaderpacks: boolean; saves: boolean; options: boolean }
}

export interface ExternalInstance {
  source: 'prism' | 'multimc' | 'curseforge'
  path: string
  name: string
  mcVersion: string
  loader: Loader
  loaderVersion?: string
  iconUrl?: string
}

export interface Progress {
  task: string
  label: string
  done: number
  total: number
  /** Set once the task finished (successfully or not). */
  finished?: boolean
}

/** Errors returned to the UI carry an optional hint that explains how to fix them. */
export interface KilnErrorInfo {
  message: string
  hint?: string
}

export type IpcResult<T> = { ok: true; value: T } | { ok: false; error: KilnErrorInfo }

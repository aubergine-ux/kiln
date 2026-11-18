import { promises as fs } from 'node:fs'
import path from 'node:path'
import type { ModpackResult, ModpackSummary } from '@shared/types'
import { getSettings } from '../settings'
import { KilnError } from '../util/errors'
import { safeJoin } from '../util/fs'
import { extractZip, listZip, readZipEntries } from '../util/zip'
import { progressReporter } from '../progress'
import { listInstalledVersions } from '../launcher/versions'
import { createInstanceFolder, deleteInstanceFolder, gameDir, syncProfile } from '../instances/store'
import { downloadAll, type DownloadJob } from './download'
import { loaderFromCurseForge, loaderFromMrpack, resolveVersionId } from './resolve'

/**
 * Modpack import for Modrinth (.mrpack) and CurseForge (.zip with manifest.json).
 * Files are fetched from the links listed in the pack, checked against the listed
 * hashes, and the pack's "overrides" folder is copied over the top.
 */

interface MrpackIndex {
  formatVersion: number
  name: string
  versionId?: string
  summary?: string
  files: {
    path: string
    hashes: { sha1?: string; sha512?: string }
    env?: { client?: string; server?: string }
    downloads: string[]
    fileSize?: number
  }[]
  dependencies: Record<string, string>
}

interface CurseManifest {
  manifestType?: string
  name?: string
  version?: string
  author?: string
  overrides?: string
  minecraft?: { version: string; modLoaders?: { id: string; primary?: boolean }[] }
  files?: { projectID: number; fileID: number; required?: boolean; downloadUrl?: string; fileName?: string }[]
}

type Parsed =
  | { format: 'mrpack'; index: MrpackIndex; summary: ModpackSummary }
  | { format: 'curseforge'; manifest: CurseManifest; modlist: { name: string; url: string }[]; summary: ModpackSummary }

function parseJson<T>(buf: Buffer | undefined, what: string): T {
  try {
    return JSON.parse(buf!.toString('utf8').replace(/^﻿/, '')) as T
  } catch {
    throw new KilnError(`The modpack's ${what} could not be read.`, 'The file may be damaged or incomplete. Try downloading it again.')
  }
}

/** Pull "Name (by Author)" links out of a CurseForge modlist.html. */
function parseModlist(html: string | undefined): { name: string; url: string }[] {
  if (!html) return []
  return [...html.matchAll(/<a href="([^"]+)">([^<]+)<\/a>/g)].map((m) => ({ url: m[1], name: m[2].replace(/\s*\(by [^)]*\)\s*$/, '').trim() }))
}

async function parse(file: string): Promise<Parsed> {
  const entries = await readZipEntries(file, (n) => n === 'modrinth.index.json' || n === 'manifest.json' || n === 'modlist.html').catch(() => {
    throw new KilnError('This file is not a modpack Kiln can read.', 'Kiln imports Modrinth .mrpack files and CurseForge modpack .zip files.')
  })
  const installed = await listInstalledVersions((await getSettings()).minecraftDir)

  if (entries.has('modrinth.index.json')) {
    const index = parseJson<MrpackIndex>(entries.get('modrinth.index.json'), 'index')
    const { mc, loader, loaderVersion } = loaderFromMrpack(index.dependencies ?? {})
    const files = (index.files ?? []).filter((f) => f.env?.client !== 'unsupported')
    return {
      format: 'mrpack',
      index,
      summary: {
        format: 'mrpack',
        name: index.name || path.basename(file, path.extname(file)),
        version: index.versionId,
        summary: index.summary,
        mcVersion: mc,
        loader,
        loaderVersion,
        versionId: resolveVersionId(installed, loader, mc, loaderVersion),
        fileCount: files.length,
        manualCount: 0
      }
    }
  }

  if (entries.has('manifest.json')) {
    const manifest = parseJson<CurseManifest>(entries.get('manifest.json'), 'manifest')
    if (!manifest.minecraft?.version) throw new KilnError('This zip has a manifest.json, but it is not a CurseForge modpack.')
    const mc = manifest.minecraft.version
    const primary = manifest.minecraft.modLoaders?.find((l) => l.primary) ?? manifest.minecraft.modLoaders?.[0]
    const { loader, loaderVersion } = loaderFromCurseForge(primary?.id)
    const files = manifest.files ?? []
    return {
      format: 'curseforge',
      manifest,
      modlist: parseModlist(entries.get('modlist.html')?.toString('utf8')),
      summary: {
        format: 'curseforge',
        name: manifest.name || path.basename(file, '.zip'),
        version: manifest.version,
        author: manifest.author,
        mcVersion: mc,
        loader,
        loaderVersion,
        versionId: resolveVersionId(installed, loader, mc, loaderVersion),
        fileCount: files.length,
        manualCount: files.filter((f) => !f.downloadUrl).length
      }
    }
  }

  throw new KilnError('This file is not a modpack Kiln can read.', 'Kiln imports Modrinth .mrpack files and CurseForge modpack .zip files.')
}

export async function inspectModpack(file: string): Promise<ModpackSummary> {
  return (await parse(file)).summary
}

export async function importModpack(file: string, name?: string): Promise<ModpackResult> {
  const pack = await parse(file)
  const s = pack.summary
  // Check every listed path before creating anything.
  if (pack.format === 'mrpack') {
    for (const f of pack.index.files ?? []) {
      try {
        safeJoin('/instance', f.path)
      } catch {
        throw new KilnError('This modpack tries to put files outside its instance folder, so Kiln stopped.', `Unsafe path: ${f.path}`)
      }
    }
  }
  const id = await createInstanceFolder({
    name: name?.trim() || s.name,
    versionId: s.versionId,
    mcVersion: s.mcVersion,
    loader: s.loader,
    loaderVersion: s.loaderVersion,
    notes: [s.summary, s.version && `Modpack version ${s.version}`].filter(Boolean).join('\n') || undefined
  })
  const game = gameDir(await getSettings(), id)
  const progress = progressReporter(`import:${file}`, `Importing ${s.name}`)
  const manual: ModpackResult['manual'] = []
  let downloaded = 0

  try {
    // 1. Download the listed files.
    const jobs: (DownloadJob & { label: string })[] = []
    if (pack.format === 'mrpack') {
      for (const f of pack.index.files ?? []) {
        if (f.env?.client === 'unsupported') continue
        jobs.push({ urls: f.downloads ?? [], dest: safeJoin(game, f.path), sha1: f.hashes?.sha1, sha512: f.hashes?.sha512, size: f.fileSize, label: f.path })
      }
    } else {
      const files = pack.manifest.files ?? []
      files.forEach((f, i) => {
        if (f.downloadUrl) {
          const fileName = f.fileName || decodeURIComponent(new URL(f.downloadUrl).pathname.split('/').pop() || `${f.fileID}.jar`)
          jobs.push({ urls: [f.downloadUrl], dest: safeJoin(path.join(game, 'mods'), fileName), label: fileName })
        } else {
          // CurseForge manifests only list project and file numbers; downloading those needs
          // CurseForge's API key, so these are left for the user to fetch.
          const listed = files.length === pack.modlist.length ? pack.modlist[i] : undefined
          manual.push({
            name: listed?.name ?? `CurseForge project ${f.projectID}`,
            url: listed?.url ?? `https://www.curseforge.com/projects/${f.projectID}`,
            reason: 'CurseForge does not include a direct download link'
          })
        }
      })
    }

    const overridesPrefix = pack.format === 'mrpack' ? ['overrides/', 'client-overrides/'] : [`${(pack.manifest.overrides || 'overrides').replace(/\/$/, '')}/`]
    const names = await listZip(file)
    const overrideCount = names.filter((n) => !n.endsWith('/') && overridesPrefix.some((p) => n.startsWith(p))).length
    progress.setTotal(jobs.length + overrideCount)
    progress.setLabel(`Downloading ${jobs.length} files for ${s.name}`)

    const failed = await downloadAll(jobs, () => progress.tick())
    downloaded = jobs.length - failed.length
    for (const { job, error } of failed) {
      manual.push({
        name: path.basename(job.dest),
        url: job.urls[0],
        reason: (error as Error)?.message?.startsWith('Checksum') ? 'The download did not match its checksum' : `Download failed: ${(error as Error)?.message ?? error}`
      })
    }

    // 2. Copy overrides (configs, resource packs, ...) on top.
    progress.setLabel(`Copying files for ${s.name}`)
    for (const prefix of overridesPrefix) await extractZip(file, game, prefix, () => progress.tick())

    await syncProfile(id)
  } catch (e) {
    progress.finish()
    await deleteInstanceFolder(id)
    throw e
  }
  progress.finish()
  await fs.mkdir(path.join(game, 'mods'), { recursive: true })
  return { instanceId: id, downloaded, manual }
}

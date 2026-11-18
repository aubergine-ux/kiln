import { createHash } from 'node:crypto'
import { createWriteStream, promises as fs } from 'node:fs'
import path from 'node:path'
import { Readable, Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { app } from 'electron'

export interface DownloadJob {
  urls: string[]
  dest: string
  sha1?: string
  sha512?: string
  size?: number
}

const userAgent = () => `Kiln/${app.getVersion()} (desktop instance manager)`

/** Download one file to a temp name, check its hashes, then move it into place. */
async function downloadFile(job: DownloadJob): Promise<void> {
  let lastError: unknown
  for (const url of job.urls) {
    if (!/^https:\/\//i.test(url)) {
      lastError = new Error(`Refusing non-HTTPS link: ${url}`)
      continue
    }
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        await fetchTo(url, job)
        return
      } catch (e) {
        lastError = e
        if ((e as Error).message.startsWith('Checksum')) break
      }
    }
  }
  throw lastError ?? new Error('No download link')
}

async function fetchTo(url: string, job: DownloadJob): Promise<void> {
  const res = await fetch(url, { headers: { 'User-Agent': userAgent() }, redirect: 'follow' })
  if (!res.ok || !res.body) throw new Error(`HTTP ${res.status} from ${new URL(url).host}`)
  await fs.mkdir(path.dirname(job.dest), { recursive: true })
  const tmp = `${job.dest}.download`
  const sha1 = createHash('sha1')
  const sha512 = createHash('sha512')
  const hasher = new Transform({
    transform(chunk, _enc, cb) {
      sha1.update(chunk)
      sha512.update(chunk)
      cb(null, chunk)
    }
  })
  try {
    await pipeline(Readable.fromWeb(res.body as import('node:stream/web').ReadableStream), hasher, createWriteStream(tmp))
    const got1 = sha1.digest('hex')
    const got512 = sha512.digest('hex')
    if (job.sha512 && got512 !== job.sha512.toLowerCase()) throw new Error('Checksum mismatch (sha512)')
    if (job.sha1 && got1 !== job.sha1.toLowerCase()) throw new Error('Checksum mismatch (sha1)')
    await fs.rename(tmp, job.dest)
  } catch (e) {
    await fs.rm(tmp, { force: true })
    throw e
  }
}

/** Run downloads a few at a time. Failures are collected rather than stopping everything. */
export async function downloadAll(
  jobs: DownloadJob[],
  onDone: (job: DownloadJob, error?: unknown) => void,
  concurrency = 6
): Promise<{ job: DownloadJob; error: unknown }[]> {
  const failed: { job: DownloadJob; error: unknown }[] = []
  let next = 0
  const worker = async () => {
    while (next < jobs.length) {
      const job = jobs[next++]
      try {
        await downloadFile(job)
        onDone(job)
      } catch (error) {
        failed.push({ job, error })
        onDone(job, error)
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, jobs.length) }, worker))
  return failed
}

import type { Api } from '../../../main/api'
import type { KilnErrorInfo, IpcResult } from '@shared/types'

/**
 * Typed access to the main process: `api.instances.list()` etc.
 * Calls that fail throw an `ApiError` carrying a friendly message and an optional hint.
 */

type Promisify<T> = {
  [G in keyof T]: {
    [F in keyof T[G]]: T[G][F] extends (...args: infer A) => infer R ? (...args: A) => Promise<Awaited<R>> : never
  }
}

export class ApiError extends Error {
  hint?: string
  constructor(info: KilnErrorInfo) {
    super(info.message)
    this.hint = info.hint
  }
}

async function call(channel: string, args: unknown[]): Promise<unknown> {
  // $state proxies can't cross the bridge, so send plain copies.
  const plain = JSON.parse(JSON.stringify(args ?? [])) as unknown[]
  const result = (await window.kiln.invoke(channel, plain)) as IpcResult<unknown>
  if (!result.ok) throw new ApiError(result.error)
  return result.value
}

export const api = new Proxy({} as Promisify<Api>, {
  get: (_t, group: string) => new Proxy({}, { get: (_g, name: string) => (...args: unknown[]) => call(`${group}.${name}`, args) })
})

export function onEvent(event: 'progress' | 'versions-changed' | 'instances-changed', cb: (payload: unknown) => void): () => void {
  return window.kiln.on(event, cb)
}

export const pathForFile = (file: File): string => window.kiln.pathForFile(file)
export const platform = window.kiln.platform
export const isMac = platform === 'darwin'
export const modKey = isMac ? '⌘' : 'Ctrl'

const queues = new Map<string, Promise<unknown>>()

/**
 * Run `fn` only after earlier calls with the same key have finished.
 * Used for read-modify-write on shared files (launcher_profiles.json, instance.json).
 */
export function withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prev = queues.get(key) ?? Promise.resolve()
  const next = prev.catch(() => {}).then(fn)
  queues.set(key, next)
  next.finally(() => {
    if (queues.get(key) === next) queues.delete(key)
  }).catch(() => {})
  return next
}

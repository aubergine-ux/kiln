/** An error with a friendly message and an optional "here's how to fix it" hint. */
export class KilnError extends Error {
  constructor(
    message: string,
    public hint?: string
  ) {
    super(message)
    this.name = 'KilnError'
  }
}

export function toErrorInfo(err: unknown): { message: string; hint?: string } {
  if (err instanceof KilnError) return { message: err.message, hint: err.hint }
  const e = err as NodeJS.ErrnoException
  switch (e?.code) {
    case 'ENOENT':
      return { message: 'A file or folder could not be found.', hint: e.path ? `Missing: ${e.path}` : undefined }
    case 'EACCES':
    case 'EPERM':
      return {
        message: 'Kiln does not have permission to change a file.',
        hint: `Close any program that may be using it (the game, the launcher or a file explorer) and try again.${e.path ? `\n${e.path}` : ''}`
      }
    case 'EBUSY':
      return { message: 'A file is in use by another program.', hint: 'Close the game or launcher and try again.' }
    case 'ENOSPC':
      return { message: 'The disk is full.', hint: 'Free up some space and try again.' }
  }
  return { message: e?.message || String(err) }
}

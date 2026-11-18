import { BrowserWindow } from 'electron'
import type { Progress } from '@shared/types'

/** Send progress updates to the UI, throttled so big jobs don't flood it. */
export function progressReporter(task: string, label: string, total = 0) {
  let done = 0
  let last = 0
  const send = (p: Progress) => {
    for (const w of BrowserWindow.getAllWindows()) w.webContents.send('kiln:progress', p)
  }
  send({ task, label, done, total })
  return {
    setTotal(n: number) {
      total = n
    },
    setLabel(l: string) {
      label = l
    },
    tick(n = 1) {
      done += n
      const now = Date.now()
      if (now - last > 80 || done >= total) {
        last = now
        send({ task, label, done, total })
      }
    },
    finish() {
      send({ task, label, done: total, total, finished: true })
    }
  }
}

export function notify(channel: 'versions-changed' | 'instances-changed'): void {
  for (const w of BrowserWindow.getAllWindows()) w.webContents.send(`kiln:${channel}`)
}

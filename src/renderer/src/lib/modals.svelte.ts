import type { Instance } from '@shared/types'

export type Modal =
  | { kind: 'new' }
  | { kind: 'import'; file?: string }
  | { kind: 'export'; instance: Instance }
  | { kind: 'shortcuts' }
  | { kind: 'icon'; instance: Instance }
  | { kind: 'folder'; rename?: string }

export const modal = $state({ current: null as Modal | null })

export function openModal(m: Modal): void {
  modal.current = m
}

export function closeModal(): void {
  modal.current = null
}

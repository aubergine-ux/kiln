/** One shared pop-up menu, used for "…" buttons and right-click menus. */

export interface MenuItem {
  label: string
  icon?: string
  run?: () => void
  danger?: boolean
  disabled?: boolean
  checked?: boolean
  /** Small grey heading instead of a clickable item. */
  heading?: boolean
  separator?: boolean
  shortcut?: string
}

export const menu = $state({ items: [] as MenuItem[], x: 0, y: 0, open: false })

export function openMenu(items: MenuItem[], x: number, y: number): void {
  menu.items = items
  menu.x = x
  menu.y = y
  menu.open = true
}

/** Open below (and right-aligned to) the element that was clicked. */
export function openMenuAt(e: MouseEvent, items: MenuItem[]): void {
  e.stopPropagation()
  const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
  openMenu(items, r.right, r.bottom + 6)
}

export function closeMenu(): void {
  menu.open = false
}

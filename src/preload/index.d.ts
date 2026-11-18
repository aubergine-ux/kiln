import type { Bridge } from './index'

declare global {
  interface Window {
    kiln: Bridge
  }
}

import type { ScribaApi } from './index'

declare global {
  interface Window {
    api: ScribaApi
  }
}

export {}

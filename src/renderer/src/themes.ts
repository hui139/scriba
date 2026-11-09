export interface ThemeOption {
  id: string
  name: string
  kind: 'builtin' | 'user' | 'plugin'
  css?: string
}

export const builtinThemes: ThemeOption[] = [
  { id: 'violet-night', name: 'Violet Night', kind: 'builtin' },
  { id: 'light', name: 'Light', kind: 'builtin' },
  { id: 'dark', name: 'Dark', kind: 'builtin' },
  { id: 'solarized-light', name: 'Solarized Light', kind: 'builtin' },
  { id: 'solarized-dark', name: 'Solarized Dark', kind: 'builtin' },
  { id: 'nord', name: 'Nord', kind: 'builtin' }
]

const THEME_NAME_KEYS: Record<string, string> = {
  'violet-night': 'theme.violetNight',
  light: 'theme.light',
  dark: 'theme.dark',
  'solarized-light': 'theme.solarizedLight',
  'solarized-dark': 'theme.solarizedDark',
  nord: 'theme.nord'
}

/** i18n key for built-in theme names; user/plugin themes keep their own name. */
export function themeNameKey(id: string): string | undefined {
  return THEME_NAME_KEYS[id]
}

export function isDarkTheme(id: string): boolean {
  return id === 'violet-night' || /dark|nord/i.test(id)
}

export function applyTheme(id: string, allThemes: ThemeOption[]): void {
  document.documentElement.dataset.theme = id
  const theme = allThemes.find((item) => item.id === id)
  let style = document.getElementById('scriba-theme-css') as HTMLStyleElement | null
  if (!style) {
    style = document.createElement('style')
    style.id = 'scriba-theme-css'
    document.head.appendChild(style)
  }
  style.textContent = theme?.css ?? ''
  syncTitleBar(theme?.css)
}

/**
 * Repaints the Windows title-bar overlay to match the theme.
 *
 * The overlay buttons are drawn by the OS from the values passed to
 * `setTitleBarOverlay`, not from CSS, so without this they keep the colour of whatever
 * theme was active when the window was created.
 */
function syncTitleBar(themeCss: string | undefined): void {
  const api = window.api
  if (!api?.window?.setTitleBarTheme) return

  // A user or plugin theme may override the variables in `theme.css`, which is injected
  // as a <style> tag; reading the computed value after it applies picks that up.
  requestAnimationFrame(() => {
    const computed = getComputedStyle(document.documentElement)
    const background = computed.getPropertyValue('--bg-sidebar').trim()
    const symbol = computed.getPropertyValue('--text-secondary').trim()
    if (background && symbol) {
      api.window.setTitleBarTheme({ background: toHex(background), symbol: toHex(symbol) })
    }
  })
  void themeCss
}

/**
 * Converts a computed colour to `#rrggbb`, which is the only format Electron accepts for
 * the overlay. Computed values arrive as `rgb(r, g, b)` (or an empty string for a
 * variable the theme does not define).
 */
function toHex(color: string): string {
  if (color.startsWith('#')) return color
  const match = color.match(/rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/)
  if (!match) return '#181423'
  const [, r, g, b] = match
  const part = (value: string): string => Number(value).toString(16).padStart(2, '0')
  return `#${part(r)}${part(g)}${part(b)}`
}

/**
 * User-customizable keyboard shortcuts.
 *
 * Shortcuts are described as data instead of being hard-coded in the key handler,
 * so the settings UI can list them, show the current binding, and let the user
 * rebind or reset each one. Bindings are persisted in `localStorage`.
 */

/** Every rebindable command, in the order the settings UI shows them. */
export interface ShortcutDefinition {
  /** Stable identifier; also the i18n key suffix under `shortcut.`. */
  id: string
  /** Grouping label key used by the settings UI. */
  group: 'format' | 'insert' | 'paragraph' | 'view' | 'file'
  /** Default binding, in the normalized form produced by `normalizeCombo`. */
  defaultCombo: string
}

/**
 * Normalized combo format: lowercase modifiers in a fixed order, then the key.
 * Examples: `mod+b`, `mod+shift+x`, `mod+alt+p`, `mod+1`.
 */
export type ShortcutMap = Record<string, string>

export const SHORTCUT_DEFINITIONS: ShortcutDefinition[] = [
  // Inline formatting
  { id: 'bold', group: 'format', defaultCombo: 'mod+b' },
  { id: 'italic', group: 'format', defaultCombo: 'mod+i' },
  { id: 'underline', group: 'format', defaultCombo: 'mod+u' },
  { id: 'strike', group: 'format', defaultCombo: 'mod+shift+x' },
  { id: 'highlight', group: 'format', defaultCombo: 'mod+shift+h' },
  { id: 'inlineCode', group: 'format', defaultCombo: 'mod+e' },
  { id: 'link', group: 'format', defaultCombo: 'mod+k' },
  { id: 'clearFormat', group: 'format', defaultCombo: 'mod+shift+backspace' },

  // Paragraph
  { id: 'heading1', group: 'paragraph', defaultCombo: 'mod+1' },
  { id: 'heading2', group: 'paragraph', defaultCombo: 'mod+2' },
  { id: 'heading3', group: 'paragraph', defaultCombo: 'mod+3' },
  { id: 'heading4', group: 'paragraph', defaultCombo: 'mod+4' },
  { id: 'heading5', group: 'paragraph', defaultCombo: 'mod+5' },
  { id: 'heading6', group: 'paragraph', defaultCombo: 'mod+6' },
  { id: 'paragraph', group: 'paragraph', defaultCombo: 'mod+0' },
  { id: 'promoteHeading', group: 'paragraph', defaultCombo: 'mod+=' },
  { id: 'demoteHeading', group: 'paragraph', defaultCombo: 'mod+-' },
  { id: 'quote', group: 'paragraph', defaultCombo: 'mod+shift+q' },
  { id: 'orderedList', group: 'paragraph', defaultCombo: 'mod+shift+[' },
  { id: 'bulletList', group: 'paragraph', defaultCombo: 'mod+shift+]' },
  { id: 'taskList', group: 'paragraph', defaultCombo: 'mod+shift+t' },
  { id: 'indent', group: 'paragraph', defaultCombo: 'mod+]' },
  { id: 'outdent', group: 'paragraph', defaultCombo: 'mod+[' },

  // Insert
  { id: 'insertTable', group: 'insert', defaultCombo: 'mod+t' },
  { id: 'insertCodeBlock', group: 'insert', defaultCombo: 'mod+shift+k' },
  { id: 'insertMath', group: 'insert', defaultCombo: 'mod+shift+m' },
  { id: 'insertImage', group: 'insert', defaultCombo: 'mod+shift+g' },
  { id: 'insertFootnote', group: 'insert', defaultCombo: 'mod+shift+f' },
  { id: 'insertHr', group: 'insert', defaultCombo: 'mod+shift+-' },

  // View
  { id: 'find', group: 'view', defaultCombo: 'mod+f' },
  { id: 'replace', group: 'view', defaultCombo: 'mod+h' },
  { id: 'palette', group: 'view', defaultCombo: 'mod+p' },
  { id: 'sourceMode', group: 'view', defaultCombo: 'mod+/' },
  { id: 'sidebar', group: 'view', defaultCombo: 'mod+\\' },
  { id: 'settings', group: 'view', defaultCombo: 'mod+,' },
  { id: 'focusMode', group: 'view', defaultCombo: 'f8' },
  { id: 'typewriter', group: 'view', defaultCombo: 'f9' },

  // File
  { id: 'save', group: 'file', defaultCombo: 'mod+s' },
  { id: 'saveAs', group: 'file', defaultCombo: 'mod+shift+s' },
  { id: 'newFile', group: 'file', defaultCombo: 'mod+n' },
  { id: 'openFile', group: 'file', defaultCombo: 'mod+o' },
  { id: 'openFolder', group: 'file', defaultCombo: 'mod+shift+o' }
]

const STORAGE_KEY = 'scriba-shortcuts'

/**
 * Converts a keyboard event into the normalized combo string.
 * Returns null for bare modifier presses, which are not valid bindings.
 */
export function comboFromEvent(event: KeyboardEvent | React.KeyboardEvent): string | null {
  const key = normalizeKey(event.key)
  if (!key) return null
  // A modifier alone cannot be a shortcut.
  if (['control', 'shift', 'alt', 'meta'].includes(key)) return null

  const parts: string[] = []
  if (event.ctrlKey || event.metaKey) parts.push('mod')
  if (event.altKey) parts.push('alt')
  if (event.shiftKey) parts.push('shift')
  parts.push(key)
  return parts.join('+')
}

/** Lowercases and maps a few keys to stable names. */
export function normalizeKey(key: string): string {
  const lower = key.toLowerCase()
  const aliases: Record<string, string> = {
    ' ': 'space',
    arrowup: 'up',
    arrowdown: 'down',
    arrowleft: 'left',
    arrowright: 'right',
    escape: 'esc'
  }
  return aliases[lower] ?? lower
}

/** Splits a combo into its parts for display. */
export function comboParts(combo: string): string[] {
  return combo.split('+').filter(Boolean)
}

/** Human-readable label, e.g. `mod+shift+x` -> `Ctrl + Shift + X`. */
export function formatCombo(combo: string, isMac = false): string {
  return comboParts(combo)
    .map((part) => {
      if (part === 'mod') return isMac ? '⌘' : 'Ctrl'
      if (part === 'alt') return isMac ? '⌥' : 'Alt'
      if (part === 'shift') return isMac ? '⇧' : 'Shift'
      if (part === 'backspace') return 'Backspace'
      if (part === 'enter') return 'Enter'
      if (part === 'space') return 'Space'
      if (part === 'esc') return 'Esc'
      if (/^f\d+$/.test(part)) return part.toUpperCase()
      return part.length === 1 ? part.toUpperCase() : part.charAt(0).toUpperCase() + part.slice(1)
    })
    .join(isMac ? '' : ' + ')
}

/** Defaults for every command. */
export function defaultShortcuts(): ShortcutMap {
  const map: ShortcutMap = {}
  for (const definition of SHORTCUT_DEFINITIONS) {
    map[definition.id] = definition.defaultCombo
  }
  return map
}

/**
 * Loads saved bindings, filling in defaults for any command added since the user
 * last saved. Unknown ids are dropped so removed commands do not linger.
 */
export function loadShortcuts(): ShortcutMap {
  const defaults = defaultShortcuts()
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaults
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object') return defaults

    const result = { ...defaults }
    for (const [id, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (id in defaults && typeof value === 'string' && value) result[id] = value
    }
    return result
  } catch {
    return defaults
  }
}

export function saveShortcuts(map: ShortcutMap): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map))
  } catch {
    // Shortcuts are a convenience; failing to persist must not break the app.
  }
}

/** Returns the command id already bound to `combo`, excluding `exceptId`. */
export function findConflict(
  map: ShortcutMap,
  combo: string,
  exceptId: string
): string | null {
  for (const [id, value] of Object.entries(map)) {
    if (id !== exceptId && value === combo) return id
  }
  return null
}

/**
 * Applies one rebind, clearing the same combo from any other command so a key is
 * never bound twice (the settings UI reports which command was displaced).
 */
export function applyBinding(map: ShortcutMap, id: string, combo: string): ShortcutMap {
  const next = { ...map }
  for (const [otherId, value] of Object.entries(next)) {
    if (otherId !== id && value === combo) next[otherId] = ''
  }
  next[id] = combo
  return next
}

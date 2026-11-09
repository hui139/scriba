import { create } from 'zustand'
import {
  applyBinding,
  defaultShortcuts,
  findConflict,
  loadShortcuts,
  saveShortcuts,
  type ShortcutMap
} from './shortcuts'

interface ShortcutState {
  map: ShortcutMap
  /** Rebinds one command, displacing any command that already used the combo. */
  bind: (id: string, combo: string) => { displaced: string | null }
  /** Restores a single command to its default binding. */
  resetOne: (id: string) => void
  /** Restores every command to its default binding. */
  resetAll: () => void
}

export const useShortcuts = create<ShortcutState>((set, get) => ({
  map: loadShortcuts(),

  bind: (id, combo) => {
    const current = get().map
    const displaced = findConflict(current, combo, id)
    const next = applyBinding(current, id, combo)
    saveShortcuts(next)
    set({ map: next })
    return { displaced }
  },

  resetOne: (id) => {
    const defaults = defaultShortcuts()
    if (!(id in defaults)) return
    const next = { ...get().map, [id]: defaults[id] }
    saveShortcuts(next)
    set({ map: next })
  },

  resetAll: () => {
    const next = defaultShortcuts()
    saveShortcuts(next)
    set({ map: next })
  }
}))

/** Combo currently bound to a command, or '' when it has no binding. */
export function comboFor(map: ShortcutMap, id: string): string {
  return map[id] ?? ''
}

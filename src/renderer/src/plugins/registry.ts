import { create } from 'zustand'
import { t } from '../i18n'
import type {
  CodeBlockRenderer,
  Command,
  SidebarPanel,
  StatusBarItem,
  ThemeContribution
} from './types'

interface RegistryState {
  commands: Command[]
  statusItems: StatusBarItem[]
  panels: SidebarPanel[]
  themes: ThemeContribution[]
  codeRenderers: Record<string, CodeBlockRenderer>
  /** Plugin keybindings as a plain object so React can subscribe to changes. */
  pluginBindings: Record<string, { combo: string; pluginId: string }>
}

export const commandMap = new Map<string, Command>()
export const statusItemMap = new Map<string, StatusBarItem>()
export const panelMap = new Map<string, SidebarPanel>()
export const themeMap = new Map<string, ThemeContribution>()
export const codeRendererMap = new Map<string, CodeBlockRenderer>()
const codeRendererOwner = new Map<string, string>()

/**
 * Keybindings contributed by plugins, keyed by command id.
 *
 * They are kept separate from the user's own bindings so a plugin reload can
 * replace them without touching what the user configured.
 */
export const pluginKeybindingMap = new Map<string, { combo: string; pluginId: string }>()

export const useRegistry = create<RegistryState>(() => ({
  commands: [],
  statusItems: [],
  panels: [],
  themes: [],
  codeRenderers: {},
  pluginBindings: {}
}))

export function publishRegistry(): void {
  useRegistry.setState({
    commands: [...commandMap.values()],
    statusItems: [...statusItemMap.values()].sort((a, b) => (a.order ?? 100) - (b.order ?? 100)),
    panels: [...panelMap.values()],
    themes: [...themeMap.values()],
    codeRenderers: Object.fromEntries(codeRendererMap),
    pluginBindings: Object.fromEntries(pluginKeybindingMap)
  })
}

export function registerCommand(command: Command): void {
  if (commandMap.has(command.id)) {
    console.warn(`[scriba] command "${command.id}" is already registered`)
    return
  }
  commandMap.set(command.id, command)
  publishRegistry()
}

export function registerCodeRenderer(
  language: string,
  renderer: CodeBlockRenderer,
  pluginId?: string
): void {
  codeRendererMap.set(language.toLowerCase(), renderer)
  if (pluginId) codeRendererOwner.set(language.toLowerCase(), pluginId)
  publishRegistry()
}

/** Records a plugin-contributed keybinding; later registrations win. */
export function registerPluginKeybinding(
  commandId: string,
  combo: string,
  pluginId: string
): void {
  pluginKeybindingMap.set(commandId, { combo, pluginId })
  publishRegistry()
}

export function commandName(command: Command): string {
  return command.nameKey ? t(command.nameKey) : command.name
}

/**
 * Removes one of a plugin's own contributions.
 *
 * Ownership is checked by the caller (the runtime), because the registry only needs to
 * know that the id belongs to the plugin before deleting it. Returning false lets the
 * caller warn instead of silently doing nothing.
 */
export function removeCommandOfPlugin(id: string, pluginId: string): boolean {
  const command = commandMap.get(id)
  if (!command || command.pluginId !== pluginId) return false
  commandMap.delete(id)
  pluginKeybindingMap.delete(id)
  publishRegistry()
  return true
}

export function removeStatusItemOfPlugin(id: string, pluginId: string): boolean {
  const item = statusItemMap.get(id)
  if (!item || item.pluginId !== pluginId) return false
  statusItemMap.delete(id)
  publishRegistry()
  return true
}

export function removePanelOfPlugin(id: string, pluginId: string): boolean {
  const panel = panelMap.get(id)
  if (!panel || panel.pluginId !== pluginId) return false
  panelMap.delete(id)
  publishRegistry()
  return true
}

export function removeThemeOfPlugin(id: string, pluginId: string): boolean {
  const theme = themeMap.get(id)
  if (!theme || theme.pluginId !== pluginId) return false
  themeMap.delete(id)
  publishRegistry()
  return true
}

export function executeCommand(id: string): Promise<void> {
  const command = commandMap.get(id)
  if (!command) {
    console.warn(`[scriba] unknown command "${id}"`)
    return Promise.resolve()
  }
  return Promise.resolve(command.run())
}

export function removePluginContributions(pluginId: string): void {
  for (const [id, command] of commandMap) {
    if (command.pluginId === pluginId) commandMap.delete(id)
  }
  for (const [id, item] of statusItemMap) {
    if (item.pluginId === pluginId) statusItemMap.delete(id)
  }
  for (const [id, panel] of panelMap) {
    if (panel.pluginId === pluginId) panelMap.delete(id)
  }
  for (const [id, theme] of themeMap) {
    if (theme.pluginId === pluginId) themeMap.delete(id)
  }
  for (const [language, owner] of codeRendererOwner) {
    if (owner === pluginId) {
      codeRendererMap.delete(language)
      codeRendererOwner.delete(language)
    }
  }
  for (const [commandId, binding] of pluginKeybindingMap) {
    if (binding.pluginId === pluginId) pluginKeybindingMap.delete(commandId)
  }
  publishRegistry()
}

export function clearPluginContributions(): void {
  for (const [id, command] of commandMap) {
    if (command.pluginId) commandMap.delete(id)
  }
  for (const [id, item] of statusItemMap) {
    if (item.pluginId) statusItemMap.delete(id)
  }
  for (const [id, panel] of panelMap) {
    if (panel.pluginId) panelMap.delete(id)
  }
  for (const [id, theme] of themeMap) {
    if (theme.pluginId) themeMap.delete(id)
  }
  codeRendererMap.clear()
  codeRendererOwner.clear()
  pluginKeybindingMap.clear()
  publishRegistry()
}

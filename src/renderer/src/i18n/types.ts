export type TranslationVars = Record<string, string | number>

export interface LanguageDefinition {
  id: string
  name: string
  translations: Record<string, string>
  /** Set for languages contributed by a plugin. */
  pluginId?: string
}

export interface LanguageInfo {
  id: string
  name: string
}

import { useCallback } from 'react'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { enUS } from './locales/en-US'
import { zhCN } from './locales/zh-CN'
import type {
  LanguageDefinition,
  LanguageInfo,
  TranslationVars
} from './types'

export type { LanguageDefinition, LanguageInfo, TranslationVars }

const BUILTIN_LANGUAGES: LanguageDefinition[] = [enUS, zhCN]
const FALLBACK_LANGUAGE = 'en-US'

type Messages = Record<string, Record<string, string>>

interface I18nState {
  language: string
  languages: LanguageDefinition[]
  /** Compiled lookup table: language id -> flat message dictionary. */
  messages: Messages
  /** Plugin translations, kept separately so they can be removed on reload. */
  pluginMessages: Record<string, Record<string, Record<string, string>>>

  setLanguage: (id: string) => void
  registerLanguage: (pluginId: string, language: LanguageDefinition) => () => void
  registerTranslations: (
    pluginId: string,
    languageId: string,
    translations: Record<string, string>
  ) => () => void
  removePluginTranslations: (pluginId: string) => void
  t: (key: string, vars?: TranslationVars) => string
}

function detectLanguage(): string {
  const tag =
    typeof navigator !== 'undefined' && typeof navigator.language === 'string'
      ? navigator.language
      : FALLBACK_LANGUAGE
  const normalized = normalizeLanguageId(tag)
  return BUILTIN_LANGUAGES.some((language) => language.id === normalized)
    ? normalized
    : FALLBACK_LANGUAGE
}

/**
 * Maps a BCP-47 tag to one of the language ids known to the renderer.
 * Chinese locales collapse to `zh-CN`; everything else falls back to English.
 */
export function normalizeLanguageId(id: string): string {
  return id.toLowerCase().startsWith('zh') ? 'zh-CN' : FALLBACK_LANGUAGE
}

function compileMessages(
  languages: LanguageDefinition[],
  pluginMessages: I18nState['pluginMessages']
): Messages {
  const compiled: Messages = {}
  for (const language of languages) {
    compiled[language.id] = { ...language.translations }
  }
  for (const byLanguage of Object.values(pluginMessages)) {
    for (const [languageId, translations] of Object.entries(byLanguage)) {
      compiled[languageId] = { ...(compiled[languageId] ?? {}), ...translations }
    }
  }
  return compiled
}

function baseLanguage(id: string): string {
  return id.split('-')[0] ?? id
}

function resolveTemplate(messages: Messages, language: string, key: string): string | undefined {
  const exact = messages[language]?.[key]
  if (exact !== undefined) return exact

  const base = baseLanguage(language)
  const regional = Object.keys(messages).find(
    (id) => id !== language && baseLanguage(id) === base
  )
  if (regional && messages[regional]?.[key] !== undefined) return messages[regional][key]
  return messages[FALLBACK_LANGUAGE]?.[key]
}

function interpolate(template: string, vars?: TranslationVars): string {
  if (!vars) return template
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    vars[name] === undefined ? match : String(vars[name])
  )
}

function applyDocumentLanguage(language: string): void {
  if (typeof document !== 'undefined') document.documentElement.lang = language
}

export const useI18n = create<I18nState>()(
  persist(
    (set, get) => ({
      language: detectLanguage(),
      languages: BUILTIN_LANGUAGES.map((language) => ({ ...language })),
      messages: compileMessages(BUILTIN_LANGUAGES, {}),
      pluginMessages: {},

      setLanguage: (id) => {
        if (!get().languages.some((language) => language.id === id)) return
        set({ language: id })
        applyDocumentLanguage(id)
        void window.api?.app.setLanguage(id)
      },

      registerLanguage: (pluginId, language) => {
        const state = get()
        if (state.languages.some((item) => item.id === language.id)) {
          return () => undefined
        }
        const languages = [...state.languages, { ...language, pluginId }]
        const messages = compileMessages(languages, state.pluginMessages)
        set({ languages, messages })
        return () => get().removePluginTranslations(pluginId)
      },

      registerTranslations: (pluginId, languageId, translations) => {
        const state = get()
        const pluginMessages = {
          ...state.pluginMessages,
          [pluginId]: {
            ...(state.pluginMessages[pluginId] ?? {}),
            [languageId]: {
              ...(state.pluginMessages[pluginId]?.[languageId] ?? {}),
              ...translations
            }
          }
        }
        set({
          pluginMessages,
          messages: compileMessages(state.languages, pluginMessages)
        })
        return () => get().removePluginTranslations(pluginId)
      },

      removePluginTranslations: (pluginId) => {
        const state = get()
        const hasMessages = Boolean(state.pluginMessages[pluginId])
        const hasLanguages = state.languages.some((item) => item.pluginId === pluginId)
        if (!hasMessages && !hasLanguages) return
        const pluginMessages = { ...state.pluginMessages }
        delete pluginMessages[pluginId]
        const languages = state.languages.filter(
          (language) => !(language.pluginId === pluginId)
        )
        const language = languages.some((item) => item.id === state.language)
          ? state.language
          : FALLBACK_LANGUAGE
        set({
          pluginMessages,
          languages,
          language,
          messages: compileMessages(languages, pluginMessages)
        })
        if (language !== state.language) {
          applyDocumentLanguage(language)
          void window.api?.app.setLanguage(language)
        }
      },

      t: (key, vars) => {
        const state = get()
        const template = resolveTemplate(state.messages, state.language, key)
        return template === undefined ? key : interpolate(template, vars)
      }
    }),
    {
      name: 'scriba-i18n',
      partialize: (state) => ({ language: state.language })
    }
  )
)

/** Translate outside React (editor widgets, plugin runtime, stores). */
export function t(key: string, vars?: TranslationVars): string {
  return useI18n.getState().t(key, vars)
}

/** Re-render the calling component whenever the language changes. */
export function useT(): (key: string, vars?: TranslationVars) => string {
  const language = useI18n((state) => state.language)
  const messages = useI18n((state) => state.messages)
  const translate = useI18n((state) => state.t)
  return useCallback(
    (key: string, vars?: TranslationVars) => translate(key, vars),
    // `language` / `messages` are intentionally part of the dependencies:
    // `translate` reads the current state from the store, and the
    // subscriptions above make components update when either changes.
    [language, messages, translate]
  )
}

export function useLanguage(): string {
  return useI18n((state) => state.language)
}

export function useLanguages(): LanguageInfo[] {
  return useI18n((state) => state.languages).map(({ id, name }) => ({ id, name }))
}

/** Apply the persisted language to the document and the native menu. */
export function initializeI18n(): void {
  const { language } = useI18n.getState()
  applyDocumentLanguage(language)
  void window.api?.app.setLanguage(language)
}

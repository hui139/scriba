import { useEffect, useState } from 'react'
import type { AppInfo } from '@shared/types'
import aboutLogo from '../assets/logo.png'
import { useI18n, useT } from '../i18n'
import type { ThemeOption } from '../themes'
import { themeNameKey } from '../themes'
import { useSettings, type EditorFont } from '../store/settings'
import { useUI } from '../store/ui'
import { useShortcuts } from '../shortcuts/store'
import {
  SHORTCUT_DEFINITIONS,
  comboFromEvent,
  defaultShortcuts,
  formatCombo
} from '../shortcuts/shortcuts'

interface SettingsDialogProps {
  open: boolean
  onClose: () => void
  themes: ThemeOption[]
  appInfo: AppInfo | null
}

type Section = 'appearance' | 'editor' | 'shortcuts' | 'workspace' | 'about'

const SECTIONS: Array<{ id: Section; labelKey: string }> = [
  { id: 'appearance', labelKey: 'settings.appearance' },
  { id: 'editor', labelKey: 'settings.editor' },
  { id: 'shortcuts', labelKey: 'settings.shortcutsSection' },
  { id: 'workspace', labelKey: 'settings.workspace' },
  { id: 'about', labelKey: 'settings.about' }
]

const FONT_OPTIONS: Array<{ id: EditorFont; labelKey: string }> = [
  { id: 'serif', labelKey: 'settings.fontSerif' },
  { id: 'sans', labelKey: 'settings.fontSans' },
  { id: 'mono', labelKey: 'settings.fontMono' }
]

const GROUP_LABELS: Record<string, string> = {
  format: 'shortcut.group.format',
  paragraph: 'shortcut.group.paragraph',
  insert: 'shortcut.group.insert',
  view: 'shortcut.group.view',
  file: 'shortcut.group.file'
}

/** Shortcut editor: lists every command and captures a new key combination. */
function ShortcutSection(): JSX.Element {
  const t = useT()
  const map = useShortcuts((state) => state.map)
  const bind = useShortcuts((state) => state.bind)
  const resetOne = useShortcuts((state) => state.resetOne)
  const resetAll = useShortcuts((state) => state.resetAll)
  const toast = useUI((state) => state.toast)
  const [recording, setRecording] = useState<string | null>(null)
  const defaults = defaultShortcuts()

  // While recording, capture the next key combo instead of letting it act.
  useEffect(() => {
    if (!recording) return
    const onKeyDown = (event: KeyboardEvent): void => {
      event.preventDefault()
      event.stopPropagation()
      if (event.key === 'Escape') {
        setRecording(null)
        return
      }
      const combo = comboFromEvent(event)
      if (!combo) return
      const { displaced } = bind(recording, combo)
      setRecording(null)
      if (displaced) {
        toast(
          t('shortcut.displaced', {
            combo: formatCombo(combo),
            name: t(`shortcut.${displaced}`)
          })
        )
      }
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [recording, bind, toast, t])

  const groups = ['format', 'paragraph', 'insert', 'view', 'file'] as const

  return (
    <section className="settings-section">
      <h2>{t('settings.shortcutsSection')}</h2>
      <div className="setting-row">
        <div className="setting-text">
          <div className="setting-title">{t('shortcut.hintTitle')}</div>
          <div className="setting-desc">{t('shortcut.hintDesc')}</div>
        </div>
        <div className="setting-control">
          <button className="btn ghost" onClick={() => resetAll()}>
            {t('shortcut.resetAll')}
          </button>
        </div>
      </div>

      {groups.map((group) => (
        <div key={group} className="setting-block">
          <div className="setting-title">{t(GROUP_LABELS[group])}</div>
          <div className="shortcut-editor">
            {SHORTCUT_DEFINITIONS.filter((definition) => definition.group === group).map(
              (definition) => {
                const combo = map[definition.id] ?? ''
                const isDefault = combo === defaults[definition.id]
                return (
                  <div key={definition.id} className="shortcut-row">
                    <span className="shortcut-name">{t(`shortcut.${definition.id}`)}</span>
                    <button
                      className={`shortcut-key${recording === definition.id ? ' recording' : ''}${
                        combo ? '' : ' unbound'
                      }`}
                      onClick={() => setRecording(definition.id)}
                      title={t('shortcut.clickToChange')}
                    >
                      {recording === definition.id
                        ? t('shortcut.pressKeys')
                        : combo
                          ? formatCombo(combo)
                          : t('shortcut.unbound')}
                    </button>
                    <button
                      className="shortcut-reset"
                      disabled={isDefault}
                      title={t('shortcut.resetOne')}
                      onClick={() => resetOne(definition.id)}
                    >
                      ↺
                    </button>
                  </div>
                )
              }
            )}
          </div>
        </div>
      ))}
    </section>
  )
}

export function SettingsDialog({
  open,
  onClose,
  themes,
  appInfo
}: SettingsDialogProps): JSX.Element | null {
  const t = useT()
  const language = useI18n((state) => state.language)
  const languages = useI18n((state) => state.languages)
  const setLanguage = useI18n((state) => state.setLanguage)
  const settings = useSettings()
  const toast = useUI((state) => state.toast)
  const [section, setSection] = useState<Section>('appearance')

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  if (!open) return null

  const toggle = (
    checked: boolean,
    onChange: (value: boolean) => void,
    label: string
  ): JSX.Element => (
    <button
      className={`switch${checked ? ' on' : ''}`}
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
    />
  )

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="modal settings-modal">
        <div className="modal-header">
          <span>{t('settings.title')}</span>
          <button className="icon-btn" onClick={onClose} title={t('common.close')}>
            ×
          </button>
        </div>

        <div className="settings-layout">
          <nav className="settings-nav">
            {SECTIONS.map((item) => (
              <button
                key={item.id}
                className={`settings-nav-item${section === item.id ? ' active' : ''}`}
                onClick={() => setSection(item.id)}
              >
                {t(item.labelKey)}
              </button>
            ))}
          </nav>

          <div className="settings-content">
            {section === 'appearance' && (
              <section className="settings-section">
                <h2>{t('settings.appearance')}</h2>

                <div className="setting-row">
                  <div className="setting-text">
                    <div className="setting-title">{t('settings.language')}</div>
                    <div className="setting-desc">{t('settings.languageDesc')}</div>
                  </div>
                  <div className="setting-control">
                    <select
                      className="select"
                      value={language}
                      onChange={(event) => setLanguage(event.target.value)}
                    >
                      {languages.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="setting-row">
                  <div className="setting-text">
                    <div className="setting-title">{t('settings.theme')}</div>
                    <div className="setting-desc">{t('settings.themeDesc')}</div>
                  </div>
                  <div className="setting-control">
                    <select
                      className="select"
                      value={settings.theme}
                      onChange={(event) => settings.setTheme(event.target.value)}
                    >
                      {themes.map((theme) => {
                        const nameKey = themeNameKey(theme.id)
                        return (
                          <option key={theme.id} value={theme.id}>
                            {nameKey ? t(nameKey) : theme.name}
                          </option>
                        )
                      })}
                    </select>
                  </div>
                </div>

                <div className="setting-row">
                  <div className="setting-text">
                    <div className="setting-title">{t('settings.editorFont')}</div>
                    <div className="setting-desc">{t('settings.editorFontDesc')}</div>
                  </div>
                  <div className="setting-control">
                    <div className="segmented">
                      {FONT_OPTIONS.map((font) => (
                        <button
                          key={font.id}
                          className={settings.editorFont === font.id ? 'active' : ''}
                          onClick={() => settings.setEditorFont(font.id)}
                        >
                          {t(font.labelKey)}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="setting-row">
                  <div className="setting-text">
                    <div className="setting-title">{t('settings.fontSize')}</div>
                    <div className="setting-desc">{t('settings.fontSizeDesc')}</div>
                  </div>
                  <div className="setting-control range-control">
                    <input
                      className="range"
                      type="range"
                      min={11}
                      max={30}
                      step={1}
                      value={settings.fontSize}
                      onChange={(event) => settings.setFontSize(Number(event.target.value))}
                    />
                    <span className="range-value">{settings.fontSize}px</span>
                  </div>
                </div>

                <div className="setting-row">
                  <div className="setting-text">
                    <div className="setting-title">{t('settings.uiScale')}</div>
                    <div className="setting-desc">{t('settings.uiScaleDesc')}</div>
                  </div>
                  <div className="setting-control range-control">
                    <input
                      className="range"
                      type="range"
                      min={85}
                      max={140}
                      step={5}
                      value={settings.uiScale}
                      onChange={(event) => settings.setUiScale(Number(event.target.value))}
                    />
                    <span className="range-value">{settings.uiScale}%</span>
                    {settings.uiScale !== 100 && (
                      <button
                        className="btn ghost"
                        onClick={() => settings.setUiScale(100)}
                        title={t('settings.uiScaleReset')}
                      >
                        {t('settings.uiScaleReset')}
                      </button>
                    )}
                  </div>
                </div>
              </section>
            )}

            {section === 'editor' && (
              <section className="settings-section">
                <h2>{t('settings.editor')}</h2>

                <div className="setting-row">
                  <div className="setting-text">
                    <div className="setting-title">{t('settings.lineNumbers')}</div>
                    <div className="setting-desc">{t('settings.lineNumbersDesc')}</div>
                  </div>
                  <div className="setting-control">
                    {toggle(
                      settings.showLineNumbers,
                      settings.setShowLineNumbers,
                      t('settings.lineNumbers')
                    )}
                  </div>
                </div>

                <div className="setting-row">
                  <div className="setting-text">
                    <div className="setting-title">{t('settings.sourceMode')}</div>
                    <div className="setting-desc">{t('settings.sourceModeDesc')}</div>
                  </div>
                  <div className="setting-control">
                    {toggle(
                      settings.sourceMode,
                      settings.setSourceMode,
                      t('settings.sourceMode')
                    )}
                  </div>
                </div>

                <div className="setting-row">
                  <div className="setting-text">
                    <div className="setting-title">{t('settings.autoPair')}</div>
                    <div className="setting-desc">{t('settings.autoPairDesc')}</div>
                  </div>
                  <div className="setting-control">
                    {toggle(settings.autoPair, settings.setAutoPair, t('settings.autoPair'))}
                  </div>
                </div>

                <div className="setting-row">
                  <div className="setting-text">
                    <div className="setting-title">{t('settings.spellcheck')}</div>
                    <div className="setting-desc">{t('settings.spellcheckDesc')}</div>
                  </div>
                  <div className="setting-control">
                    {toggle(settings.spellcheck, settings.setSpellcheck, t('settings.spellcheck'))}
                  </div>
                </div>

                <div className="setting-row">
                  <div className="setting-text">
                    <div className="setting-title">{t('settings.wordWrap')}</div>
                    <div className="setting-desc">{t('settings.wordWrapDesc')}</div>
                  </div>
                  <div className="setting-control">
                    {toggle(settings.wordWrap, settings.setWordWrap, t('settings.wordWrap'))}
                  </div>
                </div>

                <div className="setting-row">
                  <div className="setting-text">
                    <div className="setting-title">{t('settings.typewriter')}</div>
                    <div className="setting-desc">{t('settings.typewriterDesc')}</div>
                  </div>
                  <div className="setting-control">
                    {toggle(settings.typewriter, settings.setTypewriter, t('settings.typewriter'))}
                  </div>
                </div>

                <div className="setting-row">
                  <div className="setting-text">
                    <div className="setting-title">{t('settings.focus')}</div>
                    <div className="setting-desc">{t('settings.focusDesc')}</div>
                  </div>
                  <div className="setting-control">
                    {toggle(settings.focusMode, settings.setFocusMode, t('settings.focus'))}
                  </div>
                </div>
              </section>
            )}

            {section === 'shortcuts' && <ShortcutSection />}

            {section === 'workspace' && (
              <section className="settings-section">
                <h2>{t('settings.workspace')}</h2>

                <div className="setting-row">
                  <div className="setting-text">
                    <div className="setting-title">{t('settings.restoreFolder')}</div>
                    <div className="setting-desc">{t('settings.restoreFolderDesc')}</div>
                  </div>
                  <div className="setting-control">
                    {toggle(
                      settings.restoreLastFolder,
                      settings.setRestoreLastFolder,
                      t('settings.restoreFolder')
                    )}
                  </div>
                </div>

                <div className="setting-row">
                  <div className="setting-text">
                    <div className="setting-title">{t('settings.autoSave')}</div>
                    <div className="setting-desc">{t('settings.autoSaveDesc')}</div>
                  </div>
                  <div className="setting-control">
                    {toggle(settings.autoSave, settings.setAutoSave, t('settings.autoSave'))}
                  </div>
                </div>
              </section>
            )}

            {section === 'about' && (
              <section className="settings-section">
                <h2>{t('settings.about')}</h2>

                <div className="about-head">
                  <img className="about-logo" src={aboutLogo} alt="" aria-hidden="true" draggable={false} />
                  <div className="setting-text">
                    <div className="setting-title">Scriba</div>
                    <div className="setting-desc">{t('settings.aboutDesc')}</div>
                  </div>
                  <div className="setting-control about-version">
                    {appInfo ? `v${appInfo.version} · ${appInfo.platform}` : t('common.loading')}
                  </div>
                </div>

                <div className="setting-block">
                  <div className="setting-title">{t('settings.dataFolders')}</div>
                  {appInfo && (
                    <div className="path-list">
                      <div className="path-item">
                        <span className="path-label">{t('settings.userData')}</span>
                        <code className="path-value">{appInfo.userDataDir}</code>
                      </div>
                      <div className="path-item">
                        <span className="path-label">{t('settings.pluginsDir')}</span>
                        <code className="path-value">{appInfo.pluginsDir}</code>
                      </div>
                      <div className="path-item">
                        <span className="path-label">{t('settings.themesDir')}</span>
                        <code className="path-value">{appInfo.themesDir}</code>
                      </div>
                    </div>
                  )}
                  <div className="about-actions">
                    <button className="btn ghost" onClick={() => void window.api.plugins.openDir()}>
                      {t('settings.openPluginsFolder')}
                    </button>
                    <button className="btn ghost" onClick={() => void window.api.themes.openDir()}>
                      {t('settings.openThemesFolder')}
                    </button>
                    <button
                      className="btn ghost"
                      onClick={() => void window.api.exportTemplates.openDir()}
                    >
                      {t('settings.openExportTemplates')}
                    </button>
                  </div>
                </div>

                <div className="setting-block">
                  <div className="setting-title">{t('settings.exportTemplate')}</div>
                  <div className="setting-desc">{t('settings.exportTemplateDesc')}</div>
                </div>
              </section>
            )}
          </div>
        </div>

        <div className="modal-footer settings-footer">
          <button
            className="btn ghost danger"
            onClick={() => {
              settings.resetSettings()
              toast(t('app.settingsReset'))
            }}
          >
            {t('settings.reset')}
          </button>
          <button className="btn primary" onClick={onClose}>
            {t('common.done')}
          </button>
        </div>
      </div>
    </div>
  )
}

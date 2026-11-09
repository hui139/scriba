import { useState } from 'react'
import { localizeManifest } from '@shared/pluginSpec'
import { useI18n, useT } from '../i18n'
import { useRegistry } from '../plugins/registry'
import {
  installPluginFromFolder,
  loadAllPlugins,
  reloadPlugins,
  togglePlugin,
  uninstallPlugin,
  usePluginList
} from '../plugins/runtime'
import { useUI } from '../store/ui'
import { MarketplacePanel } from './MarketplacePanel'
import { RefreshIcon } from './icons'

interface PluginManagerProps {
  open: boolean
  onClose: () => void
  /** Running app version, forwarded to the marketplace's compatibility check. */
  appVersion: string
}

export function PluginManager({
  open,
  onClose,
  appVersion
}: PluginManagerProps): JSX.Element | null {
  const t = useT()
  const language = useI18n((state) => state.language)
  const plugins = usePluginList((state) => state.plugins)
  const themes = useRegistry((state) => state.themes)
  const toast = useUI((state) => state.toast)
  const [tab, setTab] = useState<'installed' | 'marketplace'>('installed')

  if (!open) return null

  const guarded = async (task: () => Promise<void>): Promise<void> => {
    try {
      await task()
    } catch (error) {
      toast(error instanceof Error ? error.message : String(error), 'error')
    }
  }

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="modal">
        <div className="modal-header">
          <span>{t('plugins.title')}</span>
          <button className="icon-btn" onClick={onClose} title={t('common.close')}>
            ×
          </button>
        </div>

        <div className="sidebar-tabs" style={{ padding: '0 12px' }}>
          <button
            className={`sidebar-tab${tab === 'installed' ? ' active' : ''}`}
            onClick={() => setTab('installed')}
          >
            {t('marketplace.installed')}
          </button>
          <button
            className={`sidebar-tab${tab === 'marketplace' ? ' active' : ''}`}
            onClick={() => setTab('marketplace')}
          >
            {t('marketplace.browse')}
          </button>
        </div>

        <div className="modal-body">
          {tab === 'marketplace' && (
            <MarketplacePanel
              installed={plugins}
              appVersion={appVersion}
              onInstalled={async () => {
                await loadAllPlugins()
              }}
            />
          )}

          {tab === 'installed' && plugins.length === 0 && (
            <div className="palette-empty">{t('plugins.empty')}</div>
          )}
          {tab === 'installed' &&
            plugins.map((plugin) => {
              // Display strings follow the interface language; a manifest without an
              // `i18n` entry falls back to its own name/description.
              const shown = localizeManifest(plugin.manifest, language)
              return (
              <div className="plugin-row" key={plugin.manifest.id}>
              <div className="plugin-info">
                <div className="pname">
                  {shown.name}
                  {plugin.builtin && <span className="badge">{t('plugins.builtin')}</span>}
                  {!plugin.enabled && <span className="badge">{t('plugins.disabled')}</span>}
                  {plugin.compatible === false && (
                    <span className="badge badge-warn">
                      {t('plugins.incompatibleBadge', {
                        version: plugin.manifest.minAppVersion ?? '?'
                      })}
                    </span>
                  )}
                </div>
                {shown.description && <div className="pdesc">{shown.description}</div>}
                <div className="pmeta">
                  v{plugin.manifest.version}
                  {plugin.manifest.author ? ` · ${plugin.manifest.author}` : ''} ·{' '}
                  {plugin.manifest.id}
                  {plugin.manifest.license ? ` · ${plugin.manifest.license}` : ''}
                </div>
                {plugin.compatible === false && (
                  <div className="pwarn">
                    {t('plugins.incompatibleHint', {
                      required: plugin.manifest.minAppVersion ?? '?'
                    })}
                  </div>
                )}
                {plugin.error && <div className="pwarn">{plugin.error}</div>}
              </div>
              <button
                className={`switch${plugin.enabled ? ' on' : ''}`}
                title={plugin.enabled ? t('common.disable') : t('common.enable')}
                onClick={() =>
                  void guarded(() => togglePlugin(plugin.manifest.id, !plugin.enabled))
                }
              />
              {!plugin.builtin && (
                <button
                  className="btn ghost danger"
                  onClick={() => {
                    if (
                      window.confirm(t('plugins.removeConfirm', { name: shown.name }))
                    ) {
                      void guarded(() => uninstallPlugin(plugin.manifest.id))
                    }
                  }}
                >
                  {t('common.remove')}
                </button>
              )}
            </div>
              )
            })}

          {tab === 'installed' && themes.length > 0 && (
            <>
              <div className="modal-header" style={{ borderTop: '1px solid var(--border)' }}>
                {t('plugins.themes')}
              </div>
              <div
                style={{
                  padding: '8px 12px',
                  color: 'var(--text-muted)',
                  fontSize: 'calc(12px * var(--ui-scale))'
                }}
              >
                {themes.map((theme) => (
                  <div key={theme.id} style={{ padding: '4px 0' }}>
                    {theme.name} <span className="pmeta">({theme.id})</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
        <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn ghost" onClick={() => void window.api.plugins.openDir()}>
              {t('plugins.openPluginsFolder')}
            </button>
            <button className="btn ghost" onClick={() => void window.api.themes.openDir()}>
              {t('plugins.openThemesFolder')}
            </button>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn ghost" onClick={() => void guarded(reloadPlugins)}>
              <RefreshIcon size={13} /> {t('plugins.reload')}
            </button>
            <button
              className="btn primary"
              onClick={() => void guarded(installPluginFromFolder)}
            >
              {t('plugins.installFolder')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

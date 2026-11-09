import { useCallback, useEffect, useMemo, useState } from 'react'
import type { GithubPluginResult, InstalledPlugin } from '@shared/types'
import { localizeManifest } from '@shared/pluginSpec'
import { isCompatible } from '@shared/version'
import { useI18n, useT } from '../i18n'
import { useUI } from '../store/ui'

interface MarketplacePanelProps {
  installed: InstalledPlugin[]
  onInstalled: () => Promise<void>
  /** Running app version, used to check each plugin's `minAppVersion`. */
  appVersion: string
}

const TOKEN_STORAGE_KEY = 'scriba-github-token-hint'
const SEARCH_DEBOUNCE_MS = 500

/**
 * Marketplace backed by GitHub repository search.
 *
 * Discovery works through the `scriba-plugin` topic: any public repository carrying
 * that topic shows up here, and installing downloads the repository archive, so
 * authors need no release assets or index files.
 */
export function MarketplacePanel({
  installed,
  onInstalled,
  appVersion
}: MarketplacePanelProps): JSX.Element {
  const t = useT()
  const language = useI18n((state) => state.language)
  const toast = useUI((state) => state.toast)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<GithubPluginResult[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [installing, setInstalling] = useState<string | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [token, setToken] = useState('')
  const [hasToken, setHasToken] = useState(false)

  const installedById = useMemo(() => {
    const map = new Map<string, InstalledPlugin>()
    for (const plugin of installed) map.set(plugin.manifest.id, plugin)
    return map
  }, [installed])

  const search = useCallback(
    async (text: string) => {
      setLoading(true)
      setError(null)
      try {
        const response = await window.api.plugins.githubSearch(text, 30)
        setResults(response.items)
        setTotalCount(response.totalCount)
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
        setResults([])
        setTotalCount(0)
      } finally {
        setLoading(false)
      }
    },
    []
  )

  // Load the token once so the UI can show whether rate limits are raised.
  useEffect(() => {
    void (async () => {
      try {
        const saved = await window.api.plugins.getGithubToken()
        setToken(saved ?? '')
        setHasToken(Boolean(saved))
      } catch {
        // A missing token only means stricter rate limits.
      }
    })()
  }, [])

  // Search on mount and whenever the query settles, so browsing needs no click.
  useEffect(() => {
    const timer = setTimeout(() => {
      void search(query)
    }, SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [query, search])

  const saveToken = async (): Promise<void> => {
    try {
      await window.api.plugins.setGithubToken(token)
      setHasToken(Boolean(token.trim()))
      try {
        if (token.trim()) localStorage.setItem(TOKEN_STORAGE_KEY, '1')
        else localStorage.removeItem(TOKEN_STORAGE_KEY)
      } catch {
        // Ignore storage failures.
      }
      toast(t('marketplace.tokenSaved'), 'success')
      await search(query)
    } catch (err) {
      toast(err instanceof Error ? err.message : String(err), 'error')
    }
  }

  const install = async (result: GithubPluginResult): Promise<void> => {
    setInstalling(result.fullName)
    try {
      const installedResult = await window.api.plugins.githubInstall(result)
      toast(
        t('marketplace.installedToast', {
          name: result.manifest?.name ?? installedResult.id
        }),
        'success'
      )
      await onInstalled()
    } catch (err) {
      toast(err instanceof Error ? err.message : String(err), 'error')
    } finally {
      setInstalling(null)
    }
  }

  return (
    <div className="marketplace">
      <div className="marketplace-toolbar">
        <input
          className="tree-search-input"
          value={query}
          placeholder={t('marketplace.searchPlaceholder')}
          onChange={(event) => setQuery(event.target.value)}
        />
        <button className="btn ghost" onClick={() => void search(query)} disabled={loading}>
          {loading ? t('marketplace.searching') : t('marketplace.refresh')}
        </button>
        <button
          className={`btn ghost${showSettings ? ' active' : ''}`}
          title={t('marketplace.tokenHint')}
          onClick={() => setShowSettings((value) => !value)}
        >
          ⚙
        </button>
      </div>

      {showSettings && (
        <div className="marketplace-source">
          <input
            className="tree-search-input"
            value={token}
            type="password"
            placeholder={t('marketplace.tokenPlaceholder')}
            onChange={(event) => setToken(event.target.value)}
          />
          <div className="marketplace-hint">{t('marketplace.tokenHint')}</div>
          <button className="btn ghost" onClick={() => void saveToken()}>
            {t('marketplace.saveToken')}
          </button>
        </div>
      )}

      {!hasToken && !showSettings && (
        <div className="marketplace-hint">{t('marketplace.noTokenHint')}</div>
      )}

      {error && <div className="pwarn">{error}</div>}

      {!loading && !error && results.length === 0 && (
        <div className="palette-empty">{t('marketplace.noGithubResults')}</div>
      )}

      {results.length > 0 && (
        <div className="marketplace-hint">
          {t('marketplace.resultCount', { shown: results.length, total: totalCount })}
        </div>
      )}

      {results.map((result) => {
        const manifest = result.manifest
        const current = manifest ? installedById.get(manifest.id) : undefined
        const alreadyInstalled = current && manifest && current.manifest.version === manifest.version
        // Compare against the RUNNING app version. An earlier version compared
        // `minAppVersion` with the installed plugin's version, so any plugin that
        // declared a requirement looked incompatible — and with the plugin not installed
        // yet it fell back to '0.0.0', disabling the button for every such plugin.
        const incompatible = manifest ? !isCompatible(manifest, appVersion) : false
        // Prefer the manifest's translation for the active language; a manifest without
        // one keeps its own name/description.
        const shown = manifest ? localizeManifest(manifest, language) : null

        return (
          <div className="plugin-row" key={result.fullName}>
            <div className="plugin-info">
              <div className="pname">
                {shown?.name ?? result.repo}
                {alreadyInstalled && (
                  <span className="badge">{t('marketplace.installedBadge')}</span>
                )}
                {!result.followsNaming && (
                  <span className="badge badge-warn">{t('marketplace.badNaming')}</span>
                )}
                {result.problem && (
                  <span className="badge badge-warn">{t('marketplace.invalidPlugin')}</span>
                )}
              </div>
              <div className="pdesc">
                {shown?.description ?? result.description ?? t('marketplace.noDescription')}
              </div>
              <div className="pmeta">
                {result.fullName}
                {manifest ? ` · v${manifest.version}` : ''}
                {manifest?.author ? ` · ${t('marketplace.by', { author: manifest.author })}` : ''}
                {` · ★ ${result.stars}`}
              </div>
              {result.problem && <div className="pwarn">{result.problem}</div>}
              {incompatible && (
                <div className="pwarn">
                  {t('plugins.incompatibleHint', {
                    required: manifest?.minAppVersion ?? '?'
                  })}
                </div>
              )}
            </div>
            <button
              className="btn primary"
              disabled={
                installing === result.fullName ||
                Boolean(alreadyInstalled) ||
                Boolean(result.problem) ||
                Boolean(incompatible)
              }
              onClick={() => void install(result)}
            >
              {installing === result.fullName
                ? t('marketplace.installing')
                : alreadyInstalled
                  ? t('marketplace.installedBadge')
                  : t('marketplace.install')}
            </button>
          </div>
        )
      })}
    </div>
  )
}

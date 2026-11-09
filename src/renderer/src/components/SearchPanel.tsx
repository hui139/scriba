import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { FileNode, SearchFileResult, SearchMatch } from '@shared/types'
import { useT } from '../i18n'
import { getCurrentView } from '../editor/viewRef'
import { goToLine } from '../editor/navigate'

interface SearchPanelProps {
  rootPath: string | null
  onOpenFile: (node: FileNode) => void
  onOpenFolder: () => void
}

const DEBOUNCE_MS = 250

/**
 * Renders one matching line with the hit wrapped in `<mark>`.
 *
 * The main process reports `start` against the raw line, but `text` is trimmed for
 * display, so the offset has to be shifted by the amount trimmed off the front.
 * When the offset cannot be placed reliably the whole line is shown unhighlighted
 * rather than highlighting the wrong characters.
 */
function HighlightedLine({ match }: { match: SearchMatch }): JSX.Element {
  const { text, start, length } = match
  if (!length || start < 0 || start + length > text.length) {
    return <>{text}</>
  }

  const before = text.slice(0, start)
  const hit = text.slice(start, start + length)
  const after = text.slice(start + length)

  return (
    <>
      {before}
      <mark className="search-match-hit">{hit}</mark>
      {after}
    </>
  )
}

/**
 * Workspace-wide content search in the sidebar: type a query,
 * see matching files grouped with their matching lines, and click a line to jump
 * straight to it in the editor.
 */
export function SearchPanel({ rootPath, onOpenFile, onOpenFolder }: SearchPanelProps): JSX.Element {
  const t = useT()
  const [query, setQuery] = useState('')
  const [caseSensitive, setCaseSensitive] = useState(false)
  const [wholeWord, setWholeWord] = useState(false)
  const [regexp, setRegexp] = useState(false)
  const [results, setResults] = useState<SearchFileResult[]>([])
  const [searching, setSearching] = useState(false)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const requestId = useRef(0)

  const runSearch = useCallback(async () => {
    if (!rootPath || !query.trim()) {
      setResults([])
      setSearching(false)
      return
    }

    // Each keystroke bumps the id; a response from an older request is dropped so
    // results never flicker back to a stale query.
    const id = ++requestId.current
    setSearching(true)
    try {
      const found = await window.api.fs.searchWorkspace(rootPath, {
        query,
        caseSensitive,
        wholeWord,
        regexp
      })
      if (id !== requestId.current) return
      setResults(found)
      setExpanded(new Set(found.map((file) => file.path)))
    } catch {
      if (id === requestId.current) setResults([])
    } finally {
      if (id === requestId.current) setSearching(false)
    }
  }, [rootPath, query, caseSensitive, wholeWord, regexp])

  useEffect(() => {
    const timer = setTimeout(() => {
      void runSearch()
    }, DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [runSearch])

  const totalMatches = useMemo(
    () => results.reduce((sum, file) => sum + file.matches.length, 0),
    [results]
  )

  const jumpTo = (file: SearchFileResult, line: number): void => {
    onOpenFile({
      name: file.name,
      path: file.path,
      isDirectory: false
    })
    // The document loads asynchronously, so wait for the editor to hold the file
    // before moving the cursor; a short retry covers both fast and slow loads.
    let attempts = 0
    const tryJump = (): void => {
      const view = getCurrentView()
      if (view) {
        goToLine(view, line)
        return
      }
      if (++attempts < 20) setTimeout(tryJump, 50)
    }
    setTimeout(tryJump, 60)
  }

  const toggleFile = (path: string): void => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }

  if (!rootPath) {
    return (
      <div className="sidebar-empty">
        {t('sidebar.noFolder')}
        <br />
        <button className="btn primary" style={{ marginTop: 12 }} onClick={onOpenFolder}>
          {t('sidebar.openFolder')}
        </button>
      </div>
    )
  }

  return (
    <div className="search-panel">
      <div className="search-panel-input">
        <input
          className="tree-search-input"
          value={query}
          placeholder={t('search.placeholder')}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') setQuery('')
          }}
        />
      </div>

      <div className="search-panel-options">
        <button
          className={`find-toggle${caseSensitive ? ' active' : ''}`}
          title={t('find.caseSensitive')}
          onClick={() => setCaseSensitive((value) => !value)}
        >
          Aa
        </button>
        <button
          className={`find-toggle${wholeWord ? ' active' : ''}`}
          title={t('find.wholeWord')}
          onClick={() => setWholeWord((value) => !value)}
        >
          ab
        </button>
        <button
          className={`find-toggle${regexp ? ' active' : ''}`}
          title={t('find.regexp')}
          onClick={() => setRegexp((value) => !value)}
        >
          .*
        </button>
        <span className="search-panel-summary">
          {query.trim()
            ? searching
              ? t('search.searching')
              : t('search.summary', { files: results.length, matches: totalMatches })
            : ''}
        </span>
      </div>

      <div className="search-panel-results">
        {!query.trim() && <div className="sidebar-empty">{t('search.hint')}</div>}
        {query.trim() && !searching && results.length === 0 && (
          <div className="sidebar-empty">{t('search.noResults')}</div>
        )}
        {results.map((file) => (
          <div key={file.path} className="search-file">
            <button className="search-file-header" onClick={() => toggleFile(file.path)}>
              <span className="search-file-name">{file.name}</span>
              <span className="search-file-count">{file.matches.length}</span>
            </button>
            {expanded.has(file.path) && (
              <div className="search-file-matches">
                <div className="search-file-path">{file.relative}</div>
                {file.matches.map((match, index) => (
                  <button
                    key={`${match.line}-${index}`}
                    className="search-match"
                    onClick={() => jumpTo(file, match.line)}
                    title={`${file.relative}:${match.line}`}
                  >
                    <span className="search-match-line">{match.line}</span>
                    <span className="search-match-text">
                      <HighlightedLine match={match} />
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

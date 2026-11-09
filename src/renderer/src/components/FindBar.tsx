import { useEffect, useRef, useState } from 'react'
import { useT } from '../i18n'
import { getCurrentView } from '../editor/viewRef'
import {
  countMatches,
  runFindNext,
  runReplaceAll,
  runReplaceNext,
  type FindOptions
} from '../editor/find'

interface FindBarProps {
  open: boolean
  onClose: () => void
}

const EMPTY: FindOptions = {
  search: '',
  replace: '',
  caseSensitive: false,
  wholeWord: false,
  regexp: false
}

/**
 * Find & replace bar pinned to the top-right of the editor.
 * CodeMirror owns the actual matching, so the bar stays in sync with the doc.
 */
export function FindBar({ open, onClose }: FindBarProps): JSX.Element | null {
  const t = useT()
  const [options, setOptions] = useState<FindOptions>(EMPTY)
  const [showReplace, setShowReplace] = useState(false)
  const [matches, setMatches] = useState(0)
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    setShowReplace(false)
    setMatches(0)
    requestAnimationFrame(() => {
      searchRef.current?.focus()
      searchRef.current?.select()
    })
  }, [open])

  // Seed the search box with the current selection, like most editors do.
  useEffect(() => {
    if (!open) return
    const view = getCurrentView()
    if (!view) return
    const { from, to } = view.state.selection.main
    if (to > from) {
      const selected = view.state.sliceDoc(from, to)
      if (!selected.includes('\n')) setOptions((prev) => ({ ...prev, search: selected }))
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const view = getCurrentView()
    if (!view) return
    setMatches(countMatches(view, options))
  }, [open, options])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  if (!open) return null

  const step = (backwards: boolean): void => {
    const view = getCurrentView()
    if (!view) return
    runFindNext(view, options, backwards)
    setMatches(countMatches(view, options))
  }

  const replaceOne = (): void => {
    const view = getCurrentView()
    if (!view) return
    runReplaceNext(view, options)
    setMatches(countMatches(view, options))
  }

  const replaceEvery = (): void => {
    const view = getCurrentView()
    if (!view) return
    runReplaceAll(view, options)
    setMatches(countMatches(view, options))
  }

  return (
    <div className="find-bar">
      <div className="find-row">
        <input
          ref={searchRef}
          className="find-input"
          value={options.search}
          placeholder={t('find.placeholder')}
          onChange={(event) => setOptions((prev) => ({ ...prev, search: event.target.value }))}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              step(event.shiftKey)
            }
          }}
        />
        <span className="find-count">
          {options.search ? t('find.matchCount', { count: matches }) : ''}
        </span>

        <button
          className={`find-toggle${options.caseSensitive ? ' active' : ''}`}
          title={t('find.caseSensitive')}
          onClick={() => setOptions((prev) => ({ ...prev, caseSensitive: !prev.caseSensitive }))}
        >
          Aa
        </button>
        <button
          className={`find-toggle${options.wholeWord ? ' active' : ''}`}
          title={t('find.wholeWord')}
          onClick={() => setOptions((prev) => ({ ...prev, wholeWord: !prev.wholeWord }))}
        >
          ab
        </button>
        <button
          className={`find-toggle${options.regexp ? ' active' : ''}`}
          title={t('find.regexp')}
          onClick={() => setOptions((prev) => ({ ...prev, regexp: !prev.regexp }))}
        >
          .*
        </button>

        <button className="find-btn" title={t('find.previous')} onClick={() => step(true)}>
          ↑
        </button>
        <button className="find-btn" title={t('find.next')} onClick={() => step(false)}>
          ↓
        </button>
        <button
          className={`find-btn${showReplace ? ' active' : ''}`}
          title={t('find.toggleReplace')}
          onClick={() => setShowReplace((value) => !value)}
        >
          ⇄
        </button>
        <button className="find-btn" title={t('common.close')} onClick={onClose}>
          ×
        </button>
      </div>

      {showReplace && (
        <div className="find-row">
          <input
            className="find-input"
            value={options.replace}
            placeholder={t('find.replacePlaceholder')}
            onChange={(event) => setOptions((prev) => ({ ...prev, replace: event.target.value }))}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                replaceOne()
              }
            }}
          />
          <button className="find-btn wide" onClick={replaceOne}>
            {t('find.replace')}
          </button>
          <button className="find-btn wide" onClick={replaceEvery}>
            {t('find.replaceAll')}
          </button>
        </div>
      )}
    </div>
  )
}

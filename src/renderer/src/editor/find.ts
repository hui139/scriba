import {
  SearchQuery,
  findNext,
  findPrevious,
  getSearchQuery,
  replaceAll,
  replaceNext,
  setSearchQuery
} from '@codemirror/search'
import type { EditorView } from '@codemirror/view'

export interface FindOptions {
  search: string
  replace: string
  caseSensitive: boolean
  wholeWord: boolean
  regexp: boolean
}

export function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Translates the panel options into a CodeMirror query.
 *
 * CodeMirror's search commands always read the query from the editor state, so
 * every action installs the current query first (`setSearchQuery`) and then runs
 * the built-in command. That keeps matching, wrapping and selection behaviour
 * identical to the stock panel.
 */
export function buildQuery(options: FindOptions): SearchQuery {
  const useRegexp = options.regexp || options.wholeWord
  let search = options.search
  // Lookarounds instead of `\b`: a hyphen is a word boundary, so `\b` would still
  // match "alpha" inside "alpha-beta".
  if (options.wholeWord) {
    const body = options.regexp ? search : escapeRegExp(search)
    search = `(?<![\\w-])(?:${body})(?![\\w-])`
  } else if (!options.regexp) {
    search = escapeRegExp(search)
  }

  return new SearchQuery({
    search,
    replace: options.replace,
    caseSensitive: options.caseSensitive,
    regexp: useRegexp,
    literal: !useRegexp
  })
}

function withQuery(view: EditorView, options: FindOptions): boolean {
  if (!options.search) return false
  let query: SearchQuery
  try {
    query = buildQuery(options)
    // Validate the pattern eagerly so a bad regex shows zero matches instead of
    // throwing from inside a CodeMirror command.
    query.getCursor(view.state.doc, 0, view.state.doc.length)
  } catch {
    return false
  }
  view.dispatch({ effects: setSearchQuery.of(query) })
  return true
}

/** Number of matches for the current query, capped so huge documents stay fast. */
export function countMatches(view: EditorView, options: FindOptions): number {
  if (!options.search) return 0
  let query: SearchQuery
  try {
    query = buildQuery(options)
  } catch {
    return 0
  }
  try {
    const cursor = query.getCursor(view.state.doc, 0, view.state.doc.length)
    let count = 0
    for (let next = cursor.next(); !next.done; next = cursor.next()) {
      count += 1
      if (count >= 10000) break
    }
    return count
  } catch {
    return 0
  }
}

export function runFindNext(view: EditorView, options: FindOptions, backwards = false): boolean {
  if (!withQuery(view, options)) return false
  return (backwards ? findPrevious : findNext)(view)
}

export function runReplaceNext(view: EditorView, options: FindOptions): boolean {
  if (!withQuery(view, options)) return false
  return replaceNext(view)
}

export function runReplaceAll(view: EditorView, options: FindOptions): boolean {
  if (!withQuery(view, options)) return false
  return replaceAll(view)
}

/** Query currently installed in the editor state, for debugging and tests. */
export function currentQuery(view: EditorView): SearchQuery {
  return getSearchQuery(view.state)
}

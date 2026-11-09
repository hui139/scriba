import { useEffect, useRef } from 'react'
import type { CSSProperties } from 'react'
import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { countWords, createEditorState, updateEditorDisplay } from './setup'
import { forcePreviewRebuild } from './editState'
import { setPreviewDocPath } from './livePreview'
import { insertPastedImage, pastedImageFile } from './pasteImage'
import { setTypewriterEnabled } from './theme'
import { setCurrentView } from './viewRef'
import type { EditorFont } from '../store/settings'

export interface EditorProps {
  docId: string
  content: string
  docPath: string | null
  syncToken: number
  typewriter: boolean
  focusMode: boolean
  fontSize: number
  editorFont: EditorFont
  lineNumbers: boolean
  wordWrap: boolean
  sourceMode: boolean
  autoPair?: boolean
  onChange: (id: string, text: string) => void
  onCursor: (line: number, col: number, words: number, chars: number) => void
}

const FONT_FAMILIES: Record<EditorFont, string> = {
  serif: "'Noto Serif', Georgia, 'Times New Roman', serif",
  sans: "var(--font-ui)",
  mono: 'var(--font-mono)'
}

export function Editor(props: EditorProps): JSX.Element {
  const hostRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const statesRef = useRef<Map<string, EditorState>>(new Map())
  const currentIdRef = useRef<string>(props.docId)
  const callbacksRef = useRef({ onChange: props.onChange, onCursor: props.onCursor })
  const displayRef = useRef({
    lineNumbers: props.lineNumbers,
    wordWrap: props.wordWrap,
    sourceMode: props.sourceMode,
    autoPair: props.autoPair
  })
  const docPathRef = useRef<string | null>(props.docPath)

  callbacksRef.current = { onChange: props.onChange, onCursor: props.onCursor }
  displayRef.current = {
    lineNumbers: props.lineNumbers,
    wordWrap: props.wordWrap,
    sourceMode: props.sourceMode,
    autoPair: props.autoPair
  }
  docPathRef.current = props.docPath

  const createState = (id: string, text: string): EditorState =>
    createEditorState(
      text,
      {
        onChange: (value) => callbacksRef.current.onChange(id, value),
        onCursor: (...args) => callbacksRef.current.onCursor(...args)
      },
      displayRef.current
    )

  const emitCursor = (state: EditorState): void => {
    const head = state.selection.main.head
    const line = state.doc.lineAt(head)
    const text = state.doc.toString()
    callbacksRef.current.onCursor(line.number, head - line.from + 1, countWords(text), text.length)
  }

  useEffect(() => {
    if (!hostRef.current) return
    const initial = createState(props.docId, props.content)
    statesRef.current.set(props.docId, initial)
    const view = new EditorView({ state: initial, parent: hostRef.current })
    viewRef.current = view
    currentIdRef.current = props.docId
    setCurrentView(view)
    setPreviewDocPath(props.docPath)
    view.dispatch({ effects: forcePreviewRebuild.of(null) })
    emitCursor(initial)
    view.focus()
    return () => {
      setCurrentView(null)
      view.destroy()
      viewRef.current = null
    }
  }, [])

  // Paste images straight from the clipboard (screenshots, copied pictures) instead
  // of asking for a file path: the main process saves them next to the document and
  // the markdown link is inserted at the cursor.
  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const onPaste = (event: ClipboardEvent): void => {
      const view = viewRef.current
      if (!view) return
      if ((event.target as HTMLElement | null)?.closest('.cm-md-table-widget')) return
      const file = pastedImageFile(event.clipboardData)
      if (!file) return
      event.preventDefault()
      event.stopPropagation()
      void insertPastedImage(view, file, docPathRef.current)
    }
    host.addEventListener('paste', onPaste, true)
    return () => host.removeEventListener('paste', onPaste, true)
  }, [])

  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    if (currentIdRef.current === props.docId) {
      setPreviewDocPath(props.docPath)
      return
    }
    statesRef.current.set(currentIdRef.current, view.state)
    const next = statesRef.current.get(props.docId) ?? createState(props.docId, props.content)
    statesRef.current.set(props.docId, next)
    view.setState(next)
    updateEditorDisplay(view, displayRef.current)
    currentIdRef.current = props.docId
    if (next.doc.toString() !== props.content) {
      view.dispatch({ changes: { from: 0, to: next.doc.length, insert: props.content } })
    }
    setPreviewDocPath(props.docPath)
    view.dispatch({ effects: forcePreviewRebuild.of(null) })
    emitCursor(next)
    view.focus()
  }, [props.docId])

  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    setPreviewDocPath(props.docPath)
    view.dispatch({ effects: forcePreviewRebuild.of(null) })
  }, [props.docPath])

  useEffect(() => {
    const view = viewRef.current
    if (!view || currentIdRef.current !== props.docId) return
    const current = view.state.doc.toString()
    if (current !== props.content) {
      view.dispatch({
        changes: { from: 0, to: current.length, insert: props.content },
        effects: forcePreviewRebuild.of(null)
      })
    }
  }, [props.syncToken])

  useEffect(() => {
    setTypewriterEnabled(props.typewriter)
  }, [props.typewriter])

  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    updateEditorDisplay(view, {
      lineNumbers: props.lineNumbers,
      wordWrap: props.wordWrap,
      sourceMode: props.sourceMode,
      autoPair: props.autoPair
    })
  }, [props.lineNumbers, props.wordWrap, props.sourceMode, props.autoPair])

  return (
    <div
      ref={hostRef}
      className={`editor-host${props.focusMode ? ' focus-mode' : ''}${
        props.typewriter ? ' typewriter-mode' : ''
      }${props.lineNumbers ? ' show-line-numbers' : ''}`}
      style={
        {
          height: '100%',
          '--editor-font-size': `${props.fontSize}px`,
          '--editor-font': FONT_FAMILIES[props.editorFont]
        } as CSSProperties
      }
    />
  )
}

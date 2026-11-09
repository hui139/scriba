import { Compartment, EditorState, type Extension } from '@codemirror/state'
import {
  EditorView,
  crosshairCursor,
  drawSelection,
  dropCursor,
  highlightActiveLine,
  highlightSpecialChars,
  keymap,
  lineNumbers,
  placeholder,
  rectangularSelection
} from '@codemirror/view'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { highlightSelectionMatches, searchKeymap } from '@codemirror/search'
import {
  autocompletion,
  closeBrackets,
  closeBracketsKeymap,
  completionKeymap
} from '@codemirror/autocomplete'
import { bracketMatching, indentOnInput, syntaxHighlighting } from '@codemirror/language'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { languages } from '@codemirror/language-data'
import { livePreviewField } from './livePreview'
import { scribaHighlight, scribaTheme, typewriterListener } from './theme'

export interface EditorCallbacks {
  onChange?: (text: string) => void
  onCursor?: (line: number, col: number, words: number, chars: number) => void
}

export interface EditorDisplayOptions {
  lineNumbers: boolean
  wordWrap: boolean
  sourceMode: boolean
  autoPair?: boolean
}

const lineNumberCompartment = new Compartment()
const wordWrapCompartment = new Compartment()
const autoPairCompartment = new Compartment()
// Live preview lives in its own compartment so the whole editor can switch to raw
// Markdown ("Source Code Mode") without recreating the document state.
const sourceModeCompartment = new Compartment()

function previewExtension(sourceMode: boolean): Extension {
  return sourceModeCompartment.of(sourceMode ? [] : livePreviewField)
}

function displayExtensions(options: EditorDisplayOptions): Extension[] {
  return [
    lineNumberCompartment.of(options.lineNumbers ? lineNumbers() : []),
    wordWrapCompartment.of(options.wordWrap ? EditorView.lineWrapping : []),
    autoPairCompartment.of(options.autoPair === false ? [] : closeBrackets()),
    previewExtension(options.sourceMode)
  ]
}

export function updateEditorDisplay(view: EditorView, options: EditorDisplayOptions): void {
  view.dispatch({
    effects: [
      lineNumberCompartment.reconfigure(options.lineNumbers ? lineNumbers() : []),
      wordWrapCompartment.reconfigure(
        options.wordWrap ? EditorView.lineWrapping : []
      ),
      autoPairCompartment.reconfigure(options.autoPair === false ? [] : closeBrackets()),
      sourceModeCompartment.reconfigure(options.sourceMode ? [] : livePreviewField)
    ]
  })
}

export function countWords(text: string): number {
  const cjk = (text.match(/[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/g) ?? []).length
  const latinText = text
    .replace(/[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/g, ' ')
    .replace(/[`*_~#>|[\]()!-]/g, ' ')
    .trim()
  const latin = latinText ? latinText.split(/\s+/).filter(Boolean).length : 0
  return cjk + latin
}

export function createEditorState(
  doc: string,
  callbacks: EditorCallbacks = {},
  display: EditorDisplayOptions = { lineNumbers: false, wordWrap: true, sourceMode: false }
): EditorState {
  return EditorState.create({
    doc,
    extensions: [
      ...displayExtensions(display),
      history(),
      drawSelection(),
      dropCursor(),
      EditorState.allowMultipleSelections.of(true),
      indentOnInput(),
      bracketMatching(),
      autocompletion(),
      highlightSelectionMatches(),
      highlightSpecialChars(),
      highlightActiveLine(),
      rectangularSelection(),
      crosshairCursor(),
      // `addKeymap` brings list continuation (Enter keeps the bullet) and backspace
      // that removes markup; `pasteURLAsLink` turns a pasted URL into a link when
      // text is selected; `completeHTMLTags` closes inline HTML tags as you type.
      markdown({
        base: markdownLanguage,
        codeLanguages: languages,
        addKeymap: true,
        pasteURLAsLink: true,
        completeHTMLTags: true
      }),
      scribaTheme,
      syntaxHighlighting(scribaHighlight),
      typewriterListener,
      placeholder('Start writing…'),
      keymap.of([
        ...closeBracketsKeymap,
        ...defaultKeymap.filter((binding) => binding.key !== 'Mod-/'),
        ...searchKeymap,
        ...historyKeymap,
        ...completionKeymap,
        indentWithTab
      ]),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          callbacks.onChange?.(update.state.doc.toString())
        }
        if (update.selectionSet || update.docChanged) {
          const head = update.state.selection.main.head
          const line = update.state.doc.lineAt(head)
          const text = update.state.doc.toString()
          callbacks.onCursor?.(line.number, head - line.from + 1, countWords(text), text.length)
        }
      })
    ]
  })
}

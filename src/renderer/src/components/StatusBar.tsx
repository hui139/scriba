import { useT } from '../i18n'
import { useRegistry } from '../plugins/registry'
import { usePluginList } from '../plugins/runtime'
import { useUI } from '../store/ui'
import { MountElement } from './MountElement'
import { PlugIcon } from './icons'

interface StatusBarProps {
  sourceMode: boolean
  onToggleSource: () => void
}

/**
 * The status bar carries editing state only.
 *
 * The theme name, the interface language and the plugin count all used to live here as
 * well. None of them is something you read while writing, each was already visible (or
 * settable) in Settings, and the built-in language-switcher plugin contributed a second
 * copy of the language readout. Everything that is purely "what is configured" belongs
 * in Settings; this row is for "where am I in the document".
 */
export function StatusBar({ sourceMode, onToggleSource }: StatusBarProps): JSX.Element {
  const t = useT()
  const cursorLine = useUI((state) => state.cursorLine)
  const cursorCol = useUI((state) => state.cursorCol)
  const wordCount = useUI((state) => state.wordCount)
  const charCount = useUI((state) => state.charCount)
  const statusItems = useRegistry((state) => state.statusItems)

  return (
    <div className="statusbar">
      <span className="sb-spacer" />
      {statusItems.map((item) => (
        <MountElement key={item.id} element={item.element} className="sb-item" />
      ))}
      <span className="sb-item">
        {t('status.cursor', { line: cursorLine, col: cursorCol })}
      </span>
      <span className="sb-item" title={t('status.wordCountHint')}>
        {t('status.stats', { words: wordCount, chars: charCount })}
      </span>
      <button
        className={`sb-item sb-click${sourceMode ? ' active' : ''}`}
        onClick={onToggleSource}
        title={t('status.toggleSource')}
      >
        {t(sourceMode ? 'status.sourceMode' : 'status.previewMode')}
      </button>
    </div>
  )
}

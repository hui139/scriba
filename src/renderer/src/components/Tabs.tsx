import { useT } from '../i18n'
import type { Doc } from '../store/workspace'
import { PlusIcon } from './icons'

interface TabsProps {
  docs: Doc[]
  activeId: string | null
  onSelect: (id: string) => void
  onClose: (id: string) => void
  onNew: () => void
}

export function Tabs({ docs, activeId, onSelect, onClose, onNew }: TabsProps): JSX.Element {
  const t = useT()
  return (
    <div className="tabs">
      {docs.map((doc) => {
        const dirty = doc.content !== doc.savedContent
        return (
          <div
            key={doc.id}
            className={`tab${doc.id === activeId ? ' active' : ''}`}
            onMouseDown={(event) => {
              if (event.button === 1) {
                event.preventDefault()
                onClose(doc.id)
              } else {
                onSelect(doc.id)
              }
            }}
            title={doc.path ?? doc.name}
          >
            {dirty && <span className="dirty-dot" />}
            <span className="tab-name">{doc.name}</span>
            <button
              className="tab-close"
              title={t('tabs.close')}
              onMouseDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation()
                onClose(doc.id)
              }}
            >
              ×
            </button>
          </div>
        )
      })}
      <button
        className="tab"
        style={{ minWidth: 36, justifyContent: 'center' }}
        onClick={onNew}
        title={t('tabs.newFile')}
      >
        <PlusIcon size={14} />
      </button>
    </div>
  )
}

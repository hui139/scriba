import { useEffect, useMemo, useState } from 'react'
import type { MouseEvent } from 'react'
import type { FileNode } from '@shared/types'
import type { SidebarView } from '../store/settings'
import { useT } from '../i18n'
import { useRegistry } from '../plugins/registry'
import { useUI } from '../store/ui'
import { getCurrentView } from '../editor/viewRef'
import { extractOutline } from '../editor/outline'
import { goToLine } from '../editor/navigate'
import { FileTree } from './FileTree'
import { SearchPanel } from './SearchPanel'
import { InputDialog } from './InputDialog'
import { MountElement } from './MountElement'
import { FolderOpenIcon, PlusIcon, RefreshIcon } from './icons'

interface SidebarProps {
  rootPath: string | null
  tree: FileNode[]
  activeDocPath: string | null
  activeDocContent: string
  view: SidebarView
  visible: boolean
  onSetView: (view: SidebarView) => void
  onOpenFolder: () => void
  onRefresh: () => void
  onOpenFile: (node: FileNode) => void
  onCreate: (parentDir: string, name: string, isDirectory: boolean) => Promise<string | null>
  onRename: (path: string, newName: string) => Promise<void>
  onDelete: (path: string) => Promise<void>
}

interface DialogState {
  mode: 'new-file' | 'new-folder' | 'rename'
  parentDir: string
  oldPath?: string
  initialValue?: string
}

interface ContextMenuState {
  x: number
  y: number
  node: FileNode
}

export function Sidebar(props: SidebarProps): JSX.Element {
  const t = useT()
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [dialog, setDialog] = useState<DialogState | null>(null)
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)
  const [query, setQuery] = useState('')
  const panels = useRegistry((state) => state.panels)
  const cursorLine = useUI((state) => state.cursorLine)

  const outline = useMemo(() => extractOutline(props.activeDocContent), [props.activeDocContent])
  const panelElements = useMemo(
    () => panels.map((panel) => ({ panel, element: panel.render() })),
    [panels]
  )

  // Filtering by name keeps matching directories (so their children can match)
  // and prunes everything else. A directory whose own name matches keeps its whole
  // subtree, because the user is looking for that folder's contents.
  const filteredTree = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return props.tree

    const filterNodes = (nodes: FileNode[]): FileNode[] => {
      const result: FileNode[] = []
      for (const node of nodes) {
        const selfMatches = node.name.toLowerCase().includes(needle)
        if (node.isDirectory) {
          const children = filterNodes(node.children ?? [])
          if (selfMatches) {
            result.push(node)
          } else if (children.length > 0) {
            result.push({ ...node, children })
          }
        } else if (selfMatches) {
          result.push(node)
        }
      }
      return result
    }

    return filterNodes(props.tree)
  }, [props.tree, query])

  // While searching, every directory in the result has to be open for the matched
  // files to be visible; the user's own expansion state is restored afterwards.
  const searchExpanded = useMemo(() => {
    if (!query.trim()) return expanded
    const open = new Set(expanded)
    const walk = (nodes: FileNode[]): void => {
      for (const node of nodes) {
        if (!node.isDirectory) continue
        open.add(node.path)
        walk(node.children ?? [])
      }
    }
    walk(filteredTree)
    return open
  }, [filteredTree, expanded, query])

  useEffect(() => {
    if (!contextMenu) return
    const close = (): void => setContextMenu(null)
    window.addEventListener('mousedown', close)
    window.addEventListener('blur', close)
    return () => {
      window.removeEventListener('mousedown', close)
      window.removeEventListener('blur', close)
    }
  }, [contextMenu])

  const toggle = (path: string): void => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }

  const folderName = props.rootPath
    ? props.rootPath.split(/[\\/]/).filter(Boolean).pop() ?? props.rootPath
    : 'Scriba'

  const openContextMenu = (event: MouseEvent, node: FileNode): void => {
    setContextMenu({ x: event.clientX, y: event.clientY, node })
  }

  const startCreate = (parentDir: string, isDirectory: boolean): void => {
    setDialog({ mode: isDirectory ? 'new-folder' : 'new-file', parentDir })
    setExpanded((prev) => new Set(prev).add(parentDir))
  }

  const submitDialog = async (value: string): Promise<void> => {
    if (!dialog) return
    if (dialog.mode === 'rename' && dialog.oldPath) {
      await props.onRename(dialog.oldPath, value)
    } else {
      const created = await props.onCreate(dialog.parentDir, value, dialog.mode === 'new-folder')
      if (created) {
        setExpanded((prev) => new Set(prev).add(dialog.parentDir))
      }
    }
    setDialog(null)
  }

  return (
    <aside className={`sidebar${props.visible ? '' : ' collapsed'}`}>
      <div className="sidebar-header">
        <span className="folder-name" title={props.rootPath ?? undefined}>
          {folderName}
        </span>
        {props.rootPath && (
          <>
            <button
              className="icon-btn"
              title={t('sidebar.newFile')}
              onClick={() => startCreate(props.rootPath!, false)}
            >
              <PlusIcon size={15} />
            </button>
            <button className="icon-btn" title={t('sidebar.refresh')} onClick={props.onRefresh}>
              <RefreshIcon size={15} />
            </button>
          </>
        )}
        {!props.rootPath && (
          <button className="icon-btn" title={t('sidebar.openFolder')} onClick={props.onOpenFolder}>
            <FolderOpenIcon size={15} />
          </button>
        )}
      </div>

      <div className="sidebar-tabs">
        <button
          className={`sidebar-tab${props.view === 'files' ? ' active' : ''}`}
          onClick={() => props.onSetView('files')}
        >
          {t('sidebar.files')}
        </button>
        <button
          className={`sidebar-tab${props.view === 'search' ? ' active' : ''}`}
          onClick={() => props.onSetView('search')}
        >
          {t('sidebar.search')}
        </button>
        <button
          className={`sidebar-tab${props.view === 'outline' ? ' active' : ''}`}
          onClick={() => props.onSetView('outline')}
        >
          {t('sidebar.outline')}
        </button>
        {/* Only present when a plugin actually contributes a panel. The tab used to be
            always visible, and since no built-in plugin registers one it showed nothing
            but a button that opened the Plugin Manager — a second route to a dialog the
            title bar already opens. */}
        {panels.length > 0 && (
          <button
            className={`sidebar-tab${props.view === 'plugins' ? ' active' : ''}`}
            onClick={() => props.onSetView('plugins')}
          >
            {t('sidebar.plugins')}
          </button>
        )}
      </div>

      <div className="sidebar-content">
        {props.view === 'files' && (
          <>
            {!props.rootPath && (
              <div className="sidebar-empty">
                {t('sidebar.noFolder')}
                <br />
                <button
                  className="btn primary"
                  style={{ marginTop: 12 }}
                  onClick={props.onOpenFolder}
                >
                  {t('sidebar.openFolder')}
                </button>
              </div>
            )}
            {props.rootPath && props.tree.length === 0 && (
              <div className="sidebar-empty">{t('sidebar.emptyFolder')}</div>
            )}
            {props.rootPath && props.tree.length > 0 && (
              <>
                <div className="tree-search">
                  <input
                    className="tree-search-input"
                    value={query}
                    placeholder={t('sidebar.searchPlaceholder')}
                    onChange={(event) => setQuery(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Escape') setQuery('')
                    }}
                  />
                  {query && (
                    <button
                      className="tree-search-clear"
                      title={t('common.close')}
                      onClick={() => setQuery('')}
                    >
                      ×
                    </button>
                  )}
                </div>
                {filteredTree.length === 0 ? (
                  <div className="sidebar-empty">{t('sidebar.noMatches')}</div>
                ) : (
                  <FileTree
                    nodes={filteredTree}
                    activePath={props.activeDocPath}
                    expanded={searchExpanded}
                    onToggle={toggle}
                    onOpen={props.onOpenFile}
                    onContextMenu={openContextMenu}
                  />
                )}
              </>
            )}
          </>
        )}

        {props.view === 'search' && (
          <SearchPanel
            rootPath={props.rootPath}
            onOpenFile={props.onOpenFile}
            onOpenFolder={props.onOpenFolder}
          />
        )}

        {props.view === 'outline' && (
          <>
            {outline.length === 0 ? (
              <div className="sidebar-empty">{t('sidebar.noHeadings')}</div>
            ) : (
              <div className="outline">
                {outline.map((item, index) => {
                  // The heading whose line is the closest one above the cursor is
                  // the section the user is currently editing.
                  const active =
                    cursorLine >= item.line &&
                    (index === outline.length - 1 || cursorLine < outline[index + 1].line)
                  return (
                    <button
                      key={`${item.line}-${index}`}
                      className={`outline-item${active ? ' active' : ''}`}
                      style={{ paddingLeft: 8 + (item.level - 1) * 12 }}
                      onClick={() => {
                        const view = getCurrentView()
                        if (view) goToLine(view, item.line)
                      }}
                    >
                      {item.text}
                    </button>
                  )
                })}
              </div>
            )}
          </>
        )}

        {props.view === 'plugins' && (
          <div className="sidebar-panel">
            {panelElements.map(({ panel, element }) => (
              <div key={panel.id} style={{ marginBottom: 14 }}>
                <div
                  style={{
                    fontSize: 'calc(11px * var(--ui-scale))',
                    textTransform: 'uppercase',
                    letterSpacing: 0.6,
                    color: 'var(--text-muted)',
                    padding: '4px 6px'
                  }}
                >
                  {panel.title}
                </div>
                <MountElement element={element} />
              </div>
            ))}
          </div>
        )}
      </div>

      {contextMenu && (
        <div
          className="ctx-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onMouseDown={(event) => event.stopPropagation()}
        >
          {!contextMenu.node.isDirectory && (
            <button
              className="ctx-item"
              onClick={() => {
                props.onOpenFile(contextMenu.node)
                setContextMenu(null)
              }}
            >
              {t('common.open')}
            </button>
          )}
          {contextMenu.node.isDirectory && (
            <>
              <button
                className="ctx-item"
                onClick={() => {
                  startCreate(contextMenu.node.path, false)
                  setContextMenu(null)
                }}
              >
                {t('sidebar.newFile')}
              </button>
              <button
                className="ctx-item"
                onClick={() => {
                  startCreate(contextMenu.node.path, true)
                  setContextMenu(null)
                }}
              >
                {t('sidebar.newFolder')}
              </button>
            </>
          )}
          <button
            className="ctx-item"
            onClick={() => {
              setDialog({
                mode: 'rename',
                parentDir: contextMenu.node.path,
                oldPath: contextMenu.node.path,
                initialValue: contextMenu.node.name
              })
              setContextMenu(null)
            }}
          >
            {t('common.rename')}
          </button>
          <button
            className="ctx-item"
            onClick={() => {
              window.api.fs.showItemInFolder(contextMenu.node.path)
              setContextMenu(null)
            }}
          >
            {t('sidebar.reveal')}
          </button>
          <button
            className="ctx-item danger"
            onClick={() => {
              const node = contextMenu.node
              setContextMenu(null)
              if (window.confirm(t('sidebar.confirmDelete', { name: node.name }))) {
                void props.onDelete(node.path)
              }
            }}
          >
            {t('common.delete')}
          </button>
        </div>
      )}

      {dialog && (
        <InputDialog
          title={
            dialog.mode === 'rename'
              ? t('common.rename')
              : dialog.mode === 'new-folder'
                ? t('sidebar.newFolder')
                : t('sidebar.newFile')
          }
          initialValue={dialog.initialValue}
          placeholder={
            dialog.mode === 'new-folder' ? t('sidebar.folderName') : t('sidebar.fileName')
          }
          confirmLabel={dialog.mode === 'rename' ? t('common.rename') : t('common.create')}
          onSubmit={(value) => void submitDialog(value)}
          onCancel={() => setDialog(null)}
        />
      )}
    </aside>
  )
}

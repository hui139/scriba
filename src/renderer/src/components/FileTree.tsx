import type { MouseEvent } from 'react'
import type { FileNode } from '@shared/types'
import { ChevronRightIcon, FileTextIcon, FolderIcon, FolderOpenIcon } from './icons'

interface FileTreeProps {
  nodes: FileNode[]
  activePath: string | null
  expanded: Set<string>
  onToggle: (path: string) => void
  onOpen: (node: FileNode) => void
  onContextMenu: (event: MouseEvent, node: FileNode) => void
  depth?: number
}

export function FileTree({
  nodes,
  activePath,
  expanded,
  onToggle,
  onOpen,
  onContextMenu,
  depth = 0
}: FileTreeProps): JSX.Element {
  return (
    <div className="tree">
      {nodes.map((node) => {
        const isOpen = expanded.has(node.path)
        return (
          <div key={node.path}>
            <div
              className={`tree-row${node.path === activePath ? ' active' : ''}`}
              style={{ paddingLeft: 6 + depth * 14 }}
              onClick={() => {
                if (node.isDirectory) onToggle(node.path)
                else onOpen(node)
              }}
              onContextMenu={(event) => {
                event.preventDefault()
                onContextMenu(event, node)
              }}
              title={node.path}
            >
              {node.isDirectory ? (
                <span className={`twisty${isOpen ? ' open' : ''}`}>
                  <ChevronRightIcon size={10} />
                </span>
              ) : (
                <span className="twisty" />
              )}
              <span className="tree-icon">
                {node.isDirectory ? (
                  isOpen ? (
                    <FolderOpenIcon size={14} />
                  ) : (
                    <FolderIcon size={14} />
                  )
                ) : (
                  <FileTextIcon size={14} />
                )}
              </span>
              <span className="tree-name">{node.name}</span>
            </div>
            {node.isDirectory && isOpen && node.children && node.children.length > 0 && (
              <FileTree
                nodes={node.children}
                activePath={activePath}
                expanded={expanded}
                onToggle={onToggle}
                onOpen={onOpen}
                onContextMenu={onContextMenu}
                depth={depth + 1}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

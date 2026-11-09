import { useEffect, useMemo, useRef, useState } from 'react'
import { useT } from '../i18n'
import { commandName, executeCommand, useRegistry } from '../plugins/registry'

interface CommandPaletteProps {
  open: boolean
  onClose: () => void
}

export function CommandPalette({ open, onClose }: CommandPaletteProps): JSX.Element | null {
  const commands = useRegistry((state) => state.commands)
  const t = useT()
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setQuery('')
      setSelected(0)
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [open])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const sorted = [...commands].sort((a, b) => commandName(a).localeCompare(commandName(b)))
    if (!q) return sorted
    return sorted.filter(
      (command) =>
        commandName(command).toLowerCase().includes(q) || command.id.toLowerCase().includes(q)
    )
    // `t` changes whenever the language or plugin messages change, so
    // translated command names are re-resolved on switch.
  }, [commands, query, t])

  useEffect(() => {
    setSelected((value) => Math.min(value, Math.max(filtered.length - 1, 0)))
  }, [filtered.length])

  if (!open) return null

  const run = (index: number): void => {
    const command = filtered[index]
    if (!command) return
    onClose()
    void executeCommand(command.id)
  }

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="palette">
        <input
          ref={inputRef}
          value={query}
          placeholder={t('palette.placeholder')}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              onClose()
            } else if (event.key === 'ArrowDown') {
              event.preventDefault()
              setSelected((value) => Math.min(value + 1, filtered.length - 1))
            } else if (event.key === 'ArrowUp') {
              event.preventDefault()
              setSelected((value) => Math.max(value - 1, 0))
            } else if (event.key === 'Enter') {
              event.preventDefault()
              run(selected)
            }
          }}
        />
        <div className="palette-list">
          {filtered.length === 0 && (
            <div className="palette-empty">{t('palette.empty')}</div>
          )}
          {filtered.map((command, index) => (
            <div
              key={command.id}
              className={`palette-item${index === selected ? ' selected' : ''}`}
              onMouseEnter={() => setSelected(index)}
              onMouseDown={(event) => {
                event.preventDefault()
                run(index)
              }}
            >
              <span>{commandName(command)}</span>
              {command.hint && <span className="hint">{command.hint}</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

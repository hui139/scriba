import { useEffect, useRef, useState } from 'react'
import { useT } from '../i18n'

interface InputDialogProps {
  title: string
  placeholder?: string
  initialValue?: string
  confirmLabel?: string
  onSubmit: (value: string) => void
  onCancel: () => void
}

export function InputDialog({
  title,
  placeholder,
  initialValue = '',
  confirmLabel,
  onSubmit,
  onCancel
}: InputDialogProps): JSX.Element {
  const t = useT()
  const [value, setValue] = useState(initialValue)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [])

  const submit = (): void => {
    const trimmed = value.trim()
    if (trimmed) onSubmit(trimmed)
  }

  return (
    <div
      className="modal-backdrop"
      style={{ alignItems: 'center' }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel()
      }}
    >
      <div
        className="modal"
        style={{ marginTop: 0, width: 'min(420px, 86vw)' }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') onCancel()
          if (event.key === 'Enter') submit()
        }}
      >
        <div className="modal-header">{title}</div>
        <div className="modal-body" style={{ padding: '14px 16px' }}>
          <input
            ref={inputRef}
            value={value}
            placeholder={placeholder}
            onChange={(event) => setValue(event.target.value)}
            style={{
              width: '100%',
              height: 34,
              padding: '0 10px',
              borderRadius: 6,
              border: '1px solid var(--border)',
              background: 'var(--bg)',
              outline: 'none'
            }}
          />
        </div>
        <div className="modal-footer">
          <button className="btn ghost" onClick={onCancel}>
            {t('common.cancel')}
          </button>
          <button className="btn primary" onClick={submit}>
            {confirmLabel ?? t('common.ok')}
          </button>
        </div>
      </div>
    </div>
  )
}

import { useEffect, useRef } from 'react'
import { Button } from './Button'
import { Input } from './Field'

export interface DialogProps {
  readonly open: boolean
  readonly title: string
  readonly description?: string
  readonly confirmLabel?: string
  readonly cancelLabel?: string
  readonly danger?: boolean
  readonly inputDefault?: string
  readonly inputPlaceholder?: string
  readonly onConfirm: (value?: string) => void
  readonly onCancel: () => void
}

export function Dialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger,
  inputDefault,
  inputPlaceholder,
  onConfirm,
  onCancel
}: DialogProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const useInput = inputDefault !== undefined

  useEffect(() => {
    if (open && useInput) {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [open, useInput])

  if (!open) {
    return null
  }

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={onCancel}>
      <div
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <h2 id="dialog-title" className="dialog__title">
          {title}
        </h2>
        {description ? <p className="dialog__body">{description}</p> : null}
        {useInput ? (
          <Input
            ref={inputRef}
            defaultValue={inputDefault}
            placeholder={inputPlaceholder}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                onConfirm(inputRef.current?.value)
              }
              if (event.key === 'Escape') {
                onCancel()
              }
            }}
          />
        ) : null}
        <div className="dialog__actions">
          <Button variant="ghost" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button
            variant={danger ? 'danger' : 'primary'}
            onClick={() => onConfirm(useInput ? inputRef.current?.value : undefined)}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}

import { Button } from '../ui/Button'
import { Dialog } from '../ui/Dialog'

export function ConflictDialog({
  open,
  shortcut,
  ownerName,
  onCancel,
  onReplace,
  onJump
}: {
  readonly open: boolean
  readonly shortcut: string
  readonly ownerName: string
  readonly onCancel: () => void
  readonly onReplace: () => void
  readonly onJump: () => void
}) {
  if (!open) {
    return null
  }

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={onCancel}>
      <div
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="conflict-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <h2 id="conflict-title" className="dialog__title">
          Shortcut already assigned
        </h2>
        <p className="dialog__body">
          <strong>{shortcut.replace(/\+/g, ' + ')}</strong> is used by{' '}
          <strong>{ownerName}</strong>.
        </p>
        <div className="dialog__actions">
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="secondary" onClick={onJump}>
            Jump to phrase
          </Button>
          <Button variant="primary" onClick={onReplace}>
            Replace
          </Button>
        </div>
      </div>
    </div>
  )
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  danger,
  onCancel,
  onConfirm
}: {
  readonly open: boolean
  readonly title: string
  readonly description: string
  readonly confirmLabel: string
  readonly danger?: boolean
  readonly onCancel: () => void
  readonly onConfirm: () => void
}) {
  return (
    <Dialog
      open={open}
      title={title}
      description={description}
      confirmLabel={confirmLabel}
      {...(danger ? { danger: true } : {})}
      onCancel={onCancel}
      onConfirm={() => onConfirm()}
    />
  )
}

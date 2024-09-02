import type { ToastItem } from '../../hooks/useToasts'
import { IconClose } from './Icon'

export function ToastHost({
  toasts,
  onDismiss
}: {
  readonly toasts: readonly ToastItem[]
  readonly onDismiss: (id: string) => void
}) {
  return (
    <div className="toast-host" aria-live="polite" aria-relevant="additions">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`toast${toast.tone === 'error' ? ' toast--error' : ''}${toast.tone === 'success' ? ' toast--success' : ''}`}
          role={toast.tone === 'error' ? 'alert' : 'status'}
        >
          <span className="toast__message">{toast.message}</span>
          <button
            type="button"
            className="toast__close"
            aria-label="Dismiss notification"
            onClick={() => onDismiss(toast.id)}
          >
            <IconClose width={14} height={14} />
          </button>
        </div>
      ))}
    </div>
  )
}

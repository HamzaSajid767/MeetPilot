import { useCallback, useState } from 'react'

export type ToastTone = 'info' | 'success' | 'error'

export interface ToastItem {
  readonly id: string
  readonly message: string
  readonly tone: ToastTone
}

let toastSeq = 0

export function useToasts() {
  const [toasts, setToasts] = useState<readonly ToastItem[]>([])

  const dismiss = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }, [])

  const push = useCallback(
    (message: string, tone: ToastTone = 'info') => {
      const id = `toast-${++toastSeq}`
      setToasts((current) => [...current, { id, message, tone }])
      window.setTimeout(() => dismiss(id), 4500)
    },
    [dismiss]
  )

  return { toasts, push, dismiss }
}

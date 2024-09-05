export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}

export function levelPercent(value: number): number {
  return Math.min(100, Math.max(0, Math.round(value * 100)))
}

export function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms} ms`
  }
  return `${(ms / 1000).toFixed(1)} s`
}

export function formatTimestamp(ms: number | null): string {
  if (ms == null) {
    return '—'
  }
  return new Date(ms).toLocaleString()
}

export function virtualRoutingLabel(status: string): string {
  switch (status) {
    case 'no_virtual_device':
      return 'No virtual cable detected'
    case 'virtual_available':
      return 'Virtual cable available (not selected)'
    case 'virtual_selected':
      return 'Virtual cable selected — ready for Zoom'
    case 'physical_selected':
      return 'Physical speaker selected (Zoom will not hear this)'
    default:
      return status
  }
}

export function playbackModeLabel(mode: string): string {
  switch (mode) {
    case 'interrupt':
      return 'Interrupt'
    case 'queue':
      return 'Queue'
    case 'ignore':
      return 'Ignore while busy'
    default:
      return mode
  }
}

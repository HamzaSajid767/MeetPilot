import { Badge } from '../ui/Meter'

export function ShortcutBadge({
  shortcut,
  tone = 'accent'
}: {
  readonly shortcut: string | null
  readonly tone?: 'default' | 'accent' | 'success' | 'warning' | 'danger'
}) {
  if (!shortcut) {
    return <Badge>Unassigned</Badge>
  }
  return <Badge tone={tone}>{shortcut.replace(/\+/g, ' + ')}</Badge>
}

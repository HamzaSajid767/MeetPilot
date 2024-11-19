import { cn } from '../../lib/format'
import type { KeyboardKeyDef } from './keyboardLayout'

export type KeyVisualState = {
  readonly pressed?: boolean
  readonly selected?: boolean
  readonly assigned?: boolean
  readonly conflict?: boolean
  readonly disabled?: boolean
}

export function Key({
  def,
  state,
  onActivate
}: {
  readonly def: KeyboardKeyDef
  readonly state: KeyVisualState
  readonly onActivate?: () => void
}) {
  if (def.kind === 'spacer') {
    return <span className="kb-spacer" aria-hidden />
  }

  const disabled = state.disabled === true
  return (
    <button
      type="button"
      className={cn(
        'kb-key',
        def.wide && `kb-key--${def.wide}`,
        def.kind === 'modifier' && 'kb-key--modifier',
        state.pressed && 'kb-key--pressed',
        state.selected && 'kb-key--selected',
        state.assigned && 'kb-key--assigned',
        state.conflict && 'kb-key--conflict'
      )}
      disabled={disabled}
      aria-pressed={state.selected || state.pressed ? true : false}
      aria-label={def.label}
      title={def.token ?? def.label}
      onClick={() => {
        if (!disabled) {
          onActivate?.()
        }
      }}
    >
      <span className="kb-key__label">{def.label}</span>
    </button>
  )
}

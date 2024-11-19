import type { ChordState, ModifierToken } from '../../../../shared/shortcut'
import { isModifierToken, isPrimaryKey, canonicalizeToken } from '../../../../shared/shortcut'
import { Key, type KeyVisualState } from './Key'
import {
  KEYBOARD_LAYOUT,
  NAV_CLUSTER,
  NUMPAD_LAYOUT,
  type KeyboardKeyDef,
  type KeyboardRowDef
} from './keyboardLayout'

function keyState(
  def: KeyboardKeyDef,
  chord: ChordState,
  assignedTokens: ReadonlySet<string>,
  conflictTokens: ReadonlySet<string>
): KeyVisualState {
  if (def.kind === 'spacer' || !def.token) {
    return { disabled: true }
  }
  const token = canonicalizeToken(def.token) ?? def.token
  const usable =
    def.kind === 'modifier'
      ? isModifierToken(token)
      : isPrimaryKey(token) && !isModifierToken(token)

  if (!usable) {
    return { disabled: true }
  }

  const selected =
    def.kind === 'modifier'
      ? chord.modifiers.includes(token as ModifierToken)
      : chord.key === token

  return {
    selected,
    pressed: selected,
    assigned: assignedTokens.has(token),
    conflict: conflictTokens.has(token),
    disabled: false
  }
}

function KeyboardRow({
  row,
  chord,
  assignedTokens,
  conflictTokens,
  onKeyActivate
}: {
  readonly row: KeyboardRowDef
  readonly chord: ChordState
  readonly assignedTokens: ReadonlySet<string>
  readonly conflictTokens: ReadonlySet<string>
  readonly onKeyActivate: (def: KeyboardKeyDef) => void
}) {
  return (
    <div className="kb-row">
      {row.map((def) => (
        <Key
          key={def.id}
          def={def}
          state={keyState(def, chord, assignedTokens, conflictTokens)}
          onActivate={() => onKeyActivate(def)}
        />
      ))}
    </div>
  )
}

export function Keyboard({
  chord,
  assignedTokens,
  conflictTokens,
  onKeyActivate,
  showNumpad = true
}: {
  readonly chord: ChordState
  readonly assignedTokens: ReadonlySet<string>
  readonly conflictTokens: ReadonlySet<string>
  readonly onKeyActivate: (def: KeyboardKeyDef) => void
  readonly showNumpad?: boolean
}) {
  return (
    <div className="kb-board" role="group" aria-label="Shortcut keyboard">
      <div className="kb-main">
        {KEYBOARD_LAYOUT.map((row, index) => (
          <KeyboardRow
            key={`main-${index}`}
            row={row}
            chord={chord}
            assignedTokens={assignedTokens}
            conflictTokens={conflictTokens}
            onKeyActivate={onKeyActivate}
          />
        ))}
      </div>
      <div className="kb-nav">
        {NAV_CLUSTER.map((row, index) => (
          <KeyboardRow
            key={`nav-${index}`}
            row={row}
            chord={chord}
            assignedTokens={assignedTokens}
            conflictTokens={conflictTokens}
            onKeyActivate={onKeyActivate}
          />
        ))}
      </div>
      {showNumpad ? (
        <div className="kb-numpad" aria-label="Number pad">
          {NUMPAD_LAYOUT.map((row, index) => (
            <KeyboardRow
              key={`num-${index}`}
              row={row}
              chord={chord}
              assignedTokens={assignedTokens}
              conflictTokens={conflictTokens}
              onKeyActivate={onKeyActivate}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}

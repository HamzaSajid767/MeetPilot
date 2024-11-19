export type KeyKind = 'modifier' | 'primary' | 'spacer'

export interface KeyboardKeyDef {
  readonly id: string
  readonly label: string
  readonly wide?: 'sm' | 'md' | 'lg' | 'xl' | 'space'
  readonly kind: KeyKind
  /** Accelerator token for this key (modifiers use Control/Alt/Shift/Super). */
  readonly token?: string
}

export type KeyboardRowDef = readonly KeyboardKeyDef[]

export const KEYBOARD_LAYOUT: readonly KeyboardRowDef[] = [
  [
    { id: 'Escape', label: 'Esc', kind: 'primary', token: 'Escape' },
    { id: 'spacer-f', label: '', kind: 'spacer' },
    { id: 'F1', label: 'F1', kind: 'primary', token: 'F1' },
    { id: 'F2', label: 'F2', kind: 'primary', token: 'F2' },
    { id: 'F3', label: 'F3', kind: 'primary', token: 'F3' },
    { id: 'F4', label: 'F4', kind: 'primary', token: 'F4' },
    { id: 'spacer-f2', label: '', kind: 'spacer' },
    { id: 'F5', label: 'F5', kind: 'primary', token: 'F5' },
    { id: 'F6', label: 'F6', kind: 'primary', token: 'F6' },
    { id: 'F7', label: 'F7', kind: 'primary', token: 'F7' },
    { id: 'F8', label: 'F8', kind: 'primary', token: 'F8' },
    { id: 'spacer-f3', label: '', kind: 'spacer' },
    { id: 'F9', label: 'F9', kind: 'primary', token: 'F9' },
    { id: 'F10', label: 'F10', kind: 'primary', token: 'F10' },
    { id: 'F11', label: 'F11', kind: 'primary', token: 'F11' },
    { id: 'F12', label: 'F12', kind: 'primary', token: 'F12' }
  ],
  [
    { id: '`', label: '`', kind: 'primary', token: '`' },
    { id: '1', label: '1', kind: 'primary', token: '1' },
    { id: '2', label: '2', kind: 'primary', token: '2' },
    { id: '3', label: '3', kind: 'primary', token: '3' },
    { id: '4', label: '4', kind: 'primary', token: '4' },
    { id: '5', label: '5', kind: 'primary', token: '5' },
    { id: '6', label: '6', kind: 'primary', token: '6' },
    { id: '7', label: '7', kind: 'primary', token: '7' },
    { id: '8', label: '8', kind: 'primary', token: '8' },
    { id: '9', label: '9', kind: 'primary', token: '9' },
    { id: '0', label: '0', kind: 'primary', token: '0' },
    { id: '-', label: '-', kind: 'primary', token: '-' },
    { id: '=', label: '=', kind: 'primary', token: 'Plus' },
    { id: 'Backspace', label: 'Backspace', kind: 'primary', token: 'Backspace', wide: 'md' }
  ],
  [
    { id: 'Tab', label: 'Tab', kind: 'primary', token: 'Tab', wide: 'sm' },
    { id: 'Q', label: 'Q', kind: 'primary', token: 'Q' },
    { id: 'W', label: 'W', kind: 'primary', token: 'W' },
    { id: 'E', label: 'E', kind: 'primary', token: 'E' },
    { id: 'R', label: 'R', kind: 'primary', token: 'R' },
    { id: 'T', label: 'T', kind: 'primary', token: 'T' },
    { id: 'Y', label: 'Y', kind: 'primary', token: 'Y' },
    { id: 'U', label: 'U', kind: 'primary', token: 'U' },
    { id: 'I', label: 'I', kind: 'primary', token: 'I' },
    { id: 'O', label: 'O', kind: 'primary', token: 'O' },
    { id: 'P', label: 'P', kind: 'primary', token: 'P' },
    { id: '[', label: '[', kind: 'primary', token: '[' },
    { id: ']', label: ']', kind: 'primary', token: ']' },
    { id: '\\', label: '\\', kind: 'primary', token: '\\', wide: 'sm' }
  ],
  [
    { id: 'CapsLock', label: 'Caps', kind: 'primary', token: 'Capslock', wide: 'md' },
    { id: 'A', label: 'A', kind: 'primary', token: 'A' },
    { id: 'S', label: 'S', kind: 'primary', token: 'S' },
    { id: 'D', label: 'D', kind: 'primary', token: 'D' },
    { id: 'F', label: 'F', kind: 'primary', token: 'F' },
    { id: 'G', label: 'G', kind: 'primary', token: 'G' },
    { id: 'H', label: 'H', kind: 'primary', token: 'H' },
    { id: 'J', label: 'J', kind: 'primary', token: 'J' },
    { id: 'K', label: 'K', kind: 'primary', token: 'K' },
    { id: 'L', label: 'L', kind: 'primary', token: 'L' },
    { id: ';', label: ';', kind: 'primary', token: ';' },
    { id: "'", label: "'", kind: 'primary', token: "'" },
    { id: 'Enter', label: 'Enter', kind: 'primary', token: 'Enter', wide: 'md' }
  ],
  [
    { id: 'ShiftLeft', label: 'Shift', kind: 'modifier', token: 'Shift', wide: 'lg' },
    { id: 'Z', label: 'Z', kind: 'primary', token: 'Z' },
    { id: 'X', label: 'X', kind: 'primary', token: 'X' },
    { id: 'C', label: 'C', kind: 'primary', token: 'C' },
    { id: 'V', label: 'V', kind: 'primary', token: 'V' },
    { id: 'B', label: 'B', kind: 'primary', token: 'B' },
    { id: 'N', label: 'N', kind: 'primary', token: 'N' },
    { id: 'M', label: 'M', kind: 'primary', token: 'M' },
    { id: ',', label: ',', kind: 'primary', token: ',' },
    { id: '.', label: '.', kind: 'primary', token: '.' },
    { id: '/', label: '/', kind: 'primary', token: '/' },
    { id: 'ShiftRight', label: 'Shift', kind: 'modifier', token: 'Shift', wide: 'lg' }
  ],
  [
    { id: 'ControlLeft', label: 'Ctrl', kind: 'modifier', token: 'Control', wide: 'sm' },
    { id: 'SuperLeft', label: 'Win', kind: 'modifier', token: 'Super', wide: 'sm' },
    { id: 'AltLeft', label: 'Alt', kind: 'modifier', token: 'Alt', wide: 'sm' },
    { id: 'Space', label: 'Space', kind: 'primary', token: 'Space', wide: 'space' },
    { id: 'AltRight', label: 'Alt', kind: 'modifier', token: 'Alt', wide: 'sm' },
    { id: 'SuperRight', label: 'Win', kind: 'modifier', token: 'Super', wide: 'sm' },
    { id: 'ControlRight', label: 'Ctrl', kind: 'modifier', token: 'Control', wide: 'sm' }
  ]
]

export const NAV_CLUSTER: readonly KeyboardRowDef[] = [
  [
    { id: 'Insert', label: 'Ins', kind: 'primary', token: 'Insert' },
    { id: 'Home', label: 'Home', kind: 'primary', token: 'Home' },
    { id: 'PageUp', label: 'PgUp', kind: 'primary', token: 'PageUp' }
  ],
  [
    { id: 'Delete', label: 'Del', kind: 'primary', token: 'Delete' },
    { id: 'End', label: 'End', kind: 'primary', token: 'End' },
    { id: 'PageDown', label: 'PgDn', kind: 'primary', token: 'PageDown' }
  ],
  [
    { id: 'spacer-nav', label: '', kind: 'spacer' },
    { id: 'Up', label: '↑', kind: 'primary', token: 'Up' },
    { id: 'spacer-nav2', label: '', kind: 'spacer' }
  ],
  [
    { id: 'Left', label: '←', kind: 'primary', token: 'Left' },
    { id: 'Down', label: '↓', kind: 'primary', token: 'Down' },
    { id: 'Right', label: '→', kind: 'primary', token: 'Right' }
  ]
]

export const NUMPAD_LAYOUT: readonly KeyboardRowDef[] = [
  [
    { id: 'numdiv', label: '/', kind: 'primary', token: 'numdiv' },
    { id: 'nummult', label: '*', kind: 'primary', token: 'nummult' },
    { id: 'numsub', label: '-', kind: 'primary', token: 'numsub' }
  ],
  [
    { id: 'num7', label: '7', kind: 'primary', token: 'num7' },
    { id: 'num8', label: '8', kind: 'primary', token: 'num8' },
    { id: 'num9', label: '9', kind: 'primary', token: 'num9' }
  ],
  [
    { id: 'num4', label: '4', kind: 'primary', token: 'num4' },
    { id: 'num5', label: '5', kind: 'primary', token: 'num5' },
    { id: 'num6', label: '6', kind: 'primary', token: 'num6' }
  ],
  [
    { id: 'num1', label: '1', kind: 'primary', token: 'num1' },
    { id: 'num2', label: '2', kind: 'primary', token: 'num2' },
    { id: 'num3', label: '3', kind: 'primary', token: 'num3' }
  ],
  [
    { id: 'num0', label: '0', kind: 'primary', token: 'num0', wide: 'md' },
    { id: 'numdec', label: '.', kind: 'primary', token: 'numdec' }
  ],
  [{ id: 'numadd', label: '+', kind: 'primary', token: 'numadd', wide: 'md' }]
]

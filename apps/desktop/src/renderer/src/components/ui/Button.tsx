import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from '../../lib/format'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg' | 'icon'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly variant?: Variant
  readonly size?: Size
  readonly children?: ReactNode
}

export function Button({
  variant = 'secondary',
  size = 'md',
  className,
  type = 'button',
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn('btn', `btn--${variant}`, size !== 'md' && `btn--${size}`, className)}
      {...rest}
    >
      {children}
    </button>
  )
}

import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '../../lib/format'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  readonly interactive?: boolean
  readonly playing?: boolean
  readonly children?: ReactNode
}

export function Card({ interactive, playing, className, children, ...rest }: CardProps) {
  return (
    <div
      className={cn(
        'card',
        interactive && 'card--interactive',
        playing && 'card--playing',
        className
      )}
      {...rest}
    >
      {children}
    </div>
  )
}

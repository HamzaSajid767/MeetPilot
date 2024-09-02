import type { ReactNode } from 'react'
import { cn } from '../../lib/format'

export function Badge({
  children,
  tone = 'default'
}: {
  readonly children: ReactNode
  readonly tone?: 'default' | 'accent' | 'success' | 'warning' | 'danger'
}) {
  return <span className={cn('badge', tone !== 'default' && `badge--${tone}`)}>{children}</span>
}

export function ProgressBar({
  value,
  label
}: {
  readonly value: number
  readonly label: string
}) {
  return (
    <div className="progress" role="progressbar" aria-label={label} aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}>
      <span className="progress__fill" style={{ width: `${value}%` }} />
    </div>
  )
}

export function Meter({
  value,
  hold,
  clipped,
  showHold
}: {
  readonly value: number
  readonly hold?: number
  readonly clipped?: boolean
  readonly showHold?: boolean
}) {
  return (
    <span className={cn('meter', clipped && 'meter--clip')}>
      <span className="meter__fill" style={{ width: `${value}%` }} />
      {showHold && hold != null ? (
        <span className="meter__hold" style={{ left: `${hold}%` }} />
      ) : null}
    </span>
  )
}

export function Sparkline({ values }: { values: readonly number[] }) {
  const width = 160
  const height = 28
  if (values.length < 2) {
    return (
      <svg className="sparkline" width={width} height={height} aria-hidden>
        <rect width={width} height={height} fill="transparent" />
      </svg>
    )
  }

  const max = Math.max(0.001, ...values)
  const points = values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * (width - 2) + 1
      const y = height - 1 - (value / max) * (height - 2)
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')

  return (
    <svg className="sparkline" width={width} height={height} aria-hidden>
      <polyline fill="none" stroke="currentColor" strokeWidth="1.5" points={points} />
    </svg>
  )
}

export function Waveform({ level, active }: { readonly level: number; readonly active: boolean }) {
  const bars = Array.from({ length: 24 }, (_, index) => {
    const wave = Math.abs(Math.sin(index * 0.55)) * 0.45 + 0.2
    const height = Math.max(8, Math.round((0.15 + level * wave) * 64))
    return height
  })

  return (
    <div className="waveform" data-active={active ? 'true' : 'false'} aria-hidden>
      {bars.map((height, index) => (
        <span
          key={index}
          className="waveform__bar"
          style={{
            height: `${height}px`,
            animationDelay: `${(index % 8) * 60}ms`,
            opacity: active ? 0.55 + level * 0.45 : 0.25
          }}
        />
      ))}
    </div>
  )
}

export function Skeleton({ variant = 'text' }: { readonly variant?: 'text' | 'card' }) {
  return <div className={cn('skeleton', `skeleton--${variant}`)} aria-hidden />
}

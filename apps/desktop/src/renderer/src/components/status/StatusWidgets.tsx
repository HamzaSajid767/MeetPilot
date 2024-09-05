import { cn } from '../../lib/format'

export function HealthDot({
  state
}: {
  readonly state: 'ok' | 'warn' | 'error' | 'idle'
}) {
  return (
    <span
      className={cn(
        'health-dot',
        state === 'ok' && 'health-dot--ok',
        state === 'warn' && 'health-dot--warn',
        state === 'error' && 'health-dot--error'
      )}
      aria-hidden
    />
  )
}

export function ConnectionPill({
  label,
  state
}: {
  readonly label: string
  readonly state: 'ok' | 'warn' | 'error' | 'idle'
}) {
  return (
    <span className="connection-pill">
      <HealthDot state={state} />
      {label}
    </span>
  )
}

export function StatTile({
  label,
  value,
  hint
}: {
  readonly label: string
  readonly value: string
  readonly hint?: string
}) {
  return (
    <div className="card stat-tile">
      <span className="stat-tile__label">{label}</span>
      <span className="stat-tile__value">{value}</span>
      {hint ? <span className="stat-tile__hint">{hint}</span> : null}
    </div>
  )
}

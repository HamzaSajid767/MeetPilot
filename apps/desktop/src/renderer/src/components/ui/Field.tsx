import { forwardRef, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { cn } from '../../lib/format'
import { IconSearch } from './Icon'

interface FieldProps {
  readonly label: string
  readonly htmlFor: string
  readonly children: ReactNode
  readonly hint?: string
}

export function Field({ label, htmlFor, children, hint }: FieldProps) {
  return (
    <div className="field">
      <label className="field__label" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {hint ? <span className="muted">{hint}</span> : null}
    </div>
  )
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...rest }, ref) {
    return <input ref={ref} className={cn('input', className)} {...rest} />
  }
)

export function TextArea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn('textarea', className)} {...rest} />
}

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn('select', className)} {...rest}>
      {children}
    </select>
  )
}

export function SearchField({
  id,
  value,
  onChange,
  placeholder = 'Search'
}: {
  readonly id: string
  readonly value: string
  readonly onChange: (value: string) => void
  readonly placeholder?: string
}) {
  return (
    <div className="search-field">
      <IconSearch className="search-field__icon" width={16} height={16} />
      <input
        id={id}
        className="search-field__input"
        type="search"
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  )
}

export function Slider({
  id,
  label,
  value,
  min,
  max,
  step,
  disabled,
  format = String,
  onChange
}: {
  readonly id: string
  readonly label: string
  readonly value: number
  readonly min: number
  readonly max: number
  readonly step: number
  readonly disabled?: boolean
  readonly format?: (value: number) => string
  readonly onChange: (value: number) => void
}) {
  return (
    <Field label={`${label} · ${format(value)}`} htmlFor={id}>
      <input
        id={id}
        className="slider"
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </Field>
  )
}

export function Switch({
  checked,
  onChange,
  label,
  id
}: {
  readonly id: string
  readonly checked: boolean
  readonly onChange: (checked: boolean) => void
  readonly label: string
}) {
  return (
    <label className="switch" htmlFor={id}>
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="switch__track" />
      <span>{label}</span>
    </label>
  )
}

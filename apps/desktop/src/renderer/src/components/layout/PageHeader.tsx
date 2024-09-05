import type { ReactNode } from 'react'

export function PageHeader({
  title,
  description,
  actions
}: {
  readonly title: string
  readonly description: string
  readonly actions?: ReactNode
}) {
  return (
    <header className="page-header">
      <div className="page-header__text">
        <h1 className="page-header__title">{title}</h1>
        <p className="page-header__desc">{description}</p>
      </div>
      {actions ? <div className="page-header__actions">{actions}</div> : null}
    </header>
  )
}

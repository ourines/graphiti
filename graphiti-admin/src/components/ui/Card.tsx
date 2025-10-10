import type { HTMLAttributes, ReactNode } from 'react'
import clsx from 'clsx'

type CardProps = HTMLAttributes<HTMLDivElement> & {
  title?: ReactNode
  description?: ReactNode
  actions?: ReactNode
}

const Card = ({ title, description, actions, className, children, ...props }: CardProps) => {
  return (
    <section
      className={clsx('rounded-xl border border-slate-800 bg-surface/80 p-6 shadow-lg', className)}
      {...props}
    >
      {(title || description || actions) && (
        <header className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-1">
            {title && <h2 className="text-lg font-semibold text-slate-100">{title}</h2>}
            {description && <p className="text-sm text-muted-foreground">{description}</p>}
          </div>
          {actions && (
            <div className="flex flex-wrap items-center gap-2 sm:justify-end">
              {actions}
            </div>
          )}
        </header>
      )}
      <div className="space-y-4 text-sm text-slate-200">{children}</div>
    </section>
  )
}

export default Card

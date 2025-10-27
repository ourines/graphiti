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
      className={clsx('rounded-xl border border-slate-800 bg-surface/80 p-4 sm:p-6 shadow-lg transition-shadow duration-200 hover:shadow-xl', className)}
      {...props}
    >
      {(title || description || actions) && (
        <header className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1 space-y-1">
            {title && <h2 className="text-base sm:text-lg font-semibold text-slate-100 truncate">{title}</h2>}
            {description && <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>}
          </div>
          {actions && (
            <div className="flex flex-wrap items-center gap-2 sm:justify-end flex-shrink-0">
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

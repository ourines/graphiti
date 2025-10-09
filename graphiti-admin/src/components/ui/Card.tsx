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
        <header className="mb-4 flex items-start justify-between gap-3">
          <div>
            {title && <h2 className="text-lg font-semibold text-slate-100">{title}</h2>}
            {description && <p className="text-sm text-muted-foreground">{description}</p>}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className="space-y-4 text-sm text-slate-200">{children}</div>
    </section>
  )
}

export default Card

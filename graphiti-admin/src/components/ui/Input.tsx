import type { InputHTMLAttributes } from 'react'
import { forwardRef } from 'react'
import clsx from 'clsx'

type InputProps = InputHTMLAttributes<HTMLInputElement>

const Input = forwardRef<HTMLInputElement, InputProps>(({ className, ...props }, ref) => {
  return (
    <input
      ref={ref}
      className={clsx(
        'h-10 w-full rounded-lg border border-slate-800 bg-surface px-3 text-sm text-slate-100 placeholder:text-muted-foreground focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/50 disabled:cursor-not-allowed disabled:opacity-60',
        className,
      )}
      {...props}
    />
  )
})

Input.displayName = 'Input'

export default Input

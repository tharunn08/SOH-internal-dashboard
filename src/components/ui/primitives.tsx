import { type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import clsx from 'clsx'

export function Card({ children, className, onClick }: { children: ReactNode; className?: string; onClick?: () => void }) {
  return <div className={clsx('rounded-2xl border border-ink-100 bg-white shadow-sm', className)} onClick={onClick}>{children}</div>
}

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; size?: 'sm' | 'md' | 'lg' }) {
  const base = 'inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
  const sizes = { sm: 'px-3 py-1.5 text-sm', md: 'px-4 py-2.5 text-sm', lg: 'px-5 py-3 text-base' }
  const variants = {
    primary: 'bg-brand-600 text-white hover:bg-brand-700 shadow-sm',
    secondary: 'bg-ink-100 text-ink-800 hover:bg-ink-200',
    ghost: 'text-ink-600 hover:bg-ink-100',
    danger: 'bg-red-600 text-white hover:bg-red-700',
  }
  return (
    <button className={clsx(base, sizes[size], variants[variant], className)} {...props}>
      {children}
    </button>
  )
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={clsx(
        'w-full rounded-xl border border-ink-200 bg-white px-3.5 py-2.5 text-sm text-ink-800 placeholder:text-ink-300',
        'focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-brand-400',
        className
      )}
      {...props}
    />
  )
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={clsx(
        'w-full rounded-xl border border-ink-200 bg-white px-3.5 py-2.5 text-sm text-ink-800 placeholder:text-ink-300',
        'focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-brand-400',
        className
      )}
      {...props}
    />
  )
}

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement> & { children: ReactNode }) {
  return (
    <select
      className={clsx(
        'w-full rounded-xl border border-ink-200 bg-white px-3.5 py-2.5 text-sm text-ink-800',
        'focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-brand-400',
        className
      )}
      {...props}
    >
      {children}
    </select>
  )
}

export function Label({ children }: { children: ReactNode }) {
  return <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-400">{children}</label>
}

const badgeColors: Record<string, string> = {
  new: 'bg-sky-100 text-sky-700',
  active: 'bg-emerald-100 text-emerald-700',
  repeat: 'bg-violet-100 text-violet-700',
  vip: 'bg-amber-100 text-amber-800',
  inactive: 'bg-ink-100 text-ink-500',
  paid: 'bg-emerald-100 text-emerald-700',
  partial: 'bg-amber-100 text-amber-800',
  pending: 'bg-sky-100 text-sky-700',
  refunded: 'bg-red-100 text-red-700',
  upcoming: 'bg-sky-100 text-sky-700',
  completed: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-red-100 text-red-700',
  archived: 'bg-ink-100 text-ink-500',
  low: 'bg-red-100 text-red-700',
  reviewed: 'bg-sky-100 text-sky-700',
  follow_up_required: 'bg-amber-100 text-amber-800',
  resolved: 'bg-emerald-100 text-emerald-700',
  contacted: 'bg-sky-100 text-sky-700',
  not_interested: 'bg-ink-100 text-ink-500',
}

export function Badge({ status, children }: { status: string; children?: ReactNode }) {
  const cls = badgeColors[status] ?? 'bg-ink-100 text-ink-600'
  return (
    <span className={clsx('inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold capitalize', cls)}>
      {children ?? status.replace(/_/g, ' ')}
    </span>
  )
}

export function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-ink-200 bg-ink-50/50 px-6 py-16 text-center">
      <p className="font-display text-lg text-ink-700">{title}</p>
      <p className="mt-1.5 max-w-sm text-sm text-ink-400">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function Spinner({ className }: { className?: string }) {
  return (
    <div className={clsx('h-5 w-5 animate-spin rounded-full border-2 border-ink-200 border-t-brand-600', className)} />
  )
}

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
      <div>
        <h1 className="font-display text-2xl font-semibold text-ink-900">{title}</h1>
        {description && <p className="mt-1 text-sm text-ink-400">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}

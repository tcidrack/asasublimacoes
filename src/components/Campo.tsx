import type { ReactNode } from 'react'

/** Classes compartilhadas por todos os inputs, pra tudo ficar igual. */
export const classeInput =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 ' +
  'shadow-sm outline-none transition placeholder:text-slate-400 ' +
  'focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 ' +
  'disabled:cursor-not-allowed disabled:bg-slate-100'

export const classeInputComErro =
  'border-red-400 focus:border-red-500 focus:ring-red-500/10'

interface CampoProps {
  label: string
  htmlFor?: string
  erro?: string
  dica?: string
  obrigatorio?: boolean
  className?: string
  children: ReactNode
}

export function Campo({
  label,
  htmlFor,
  erro,
  dica,
  obrigatorio,
  className,
  children,
}: CampoProps) {
  return (
    <div className={className}>
      <label
        htmlFor={htmlFor}
        className="mb-1.5 block text-sm font-medium text-slate-700"
      >
        {label}
        {obrigatorio && <span className="ml-0.5 text-red-500">*</span>}
      </label>

      {children}

      {erro ? (
        <p role="alert" className="mt-1 text-sm text-red-600">
          {erro}
        </p>
      ) : (
        dica && <p className="mt-1 text-xs text-slate-500">{dica}</p>
      )}
    </div>
  )
}

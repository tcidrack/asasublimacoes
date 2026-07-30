import { formatBRL } from '../lib/format'
import type { TotaisPedido } from '../lib/pricing'

interface ResumoValoresProps {
  totais: TotaisPedido
  /** Exibido no rodapé fixo do celular, sem o detalhamento completo. */
  compacto?: boolean
}

export function ResumoValores({ totais, compacto }: ResumoValoresProps) {
  const { totalCentavos, entradaCentavos, saldoCentavos, totalPecas, linhasIncompletas } = totais

  if (compacto) {
    return (
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs text-slate-500">
            {totalPecas} {totalPecas === 1 ? 'peça' : 'peças'}
          </p>
          <p className="text-lg font-bold text-slate-900">{formatBRL(totalCentavos)}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-500">Entrada de 50%</p>
          <p className="text-lg font-bold text-emerald-700">{formatBRL(entradaCentavos)}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-base font-semibold text-slate-900">Resumo do pedido</h2>

      <dl className="mt-4 space-y-3 text-sm">
        <div className="flex items-baseline justify-between gap-4">
          <dt className="text-slate-600">Total de peças</dt>
          <dd className="font-medium text-slate-900">{totalPecas}</dd>
        </div>

        <div className="flex items-baseline justify-between gap-4 border-t border-slate-100 pt-3">
          <dt className="text-slate-600">Valor total</dt>
          <dd className="text-xl font-bold text-slate-900">{formatBRL(totalCentavos)}</dd>
        </div>

        <div className="rounded-lg bg-emerald-50 p-3">
          <div className="flex items-baseline justify-between gap-4">
            <dt className="font-medium text-emerald-900">Entrada (50%)</dt>
            <dd className="text-xl font-bold text-emerald-700">
              {formatBRL(entradaCentavos)}
            </dd>
          </div>
          <p className="mt-1 text-xs text-emerald-800">
            Pago antes de começar a produção.
          </p>
        </div>

        <div className="flex items-baseline justify-between gap-4">
          <dt className="text-slate-600">Saldo na entrega</dt>
          <dd className="font-medium text-slate-900">{formatBRL(saldoCentavos)}</dd>
        </div>
      </dl>

      {linhasIncompletas > 0 && (
        <p className="mt-4 rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
          {linhasIncompletas}{' '}
          {linhasIncompletas === 1
            ? 'linha ainda não entrou na conta porque falta preencher.'
            : 'linhas ainda não entraram na conta porque falta preencher.'}
        </p>
      )}

      <p className="mt-4 text-xs text-slate-500">
        Os valores são confirmados pela loja ao receber o pedido.
      </p>
    </div>
  )
}

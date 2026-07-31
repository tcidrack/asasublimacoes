import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Campo, classeInput, classeInputComErro } from '../components/Campo'
import { consultarPedidos } from '../lib/api'
import { formatBRL, formatarNumeroPedido, formatarTelefone } from '../lib/format'
import { formatarDataBR } from '../lib/prazo'
import {
  lerTelefoneConsulta,
  limparTelefoneConsulta,
  salvarTelefoneConsulta,
} from '../lib/rascunho'
import type { PedidoConsultado } from '../types'

/** Cada etapa com sua cor, para dar pra ler o andamento de relance. */
const CORES_STATUS: Record<string, string> = {
  'Aguardando pagamento': 'bg-red-100 text-red-900',
  'Pago 50%': 'bg-amber-100 text-amber-900',
  'Em produção': 'bg-blue-100 text-blue-900',
  Pronto: 'bg-emerald-100 text-emerald-900',
  Entregue: 'bg-slate-200 text-slate-700',
  Cancelado: 'bg-slate-200 text-slate-500',
}

const ETAPAS = ['Aguardando pagamento', 'Pago 50%', 'Em produção', 'Pronto', 'Entregue']

export function Consulta() {
  const [telefone, setTelefone] = useState('')
  const [filtro, setFiltro] = useState('')
  const [pedidos, setPedidos] = useState<PedidoConsultado[] | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [buscando, setBuscando] = useState(false)

  const visiveis = useMemo(() => {
    if (!pedidos) return []
    const alvo = filtro.replace(/\D/g, '')
    if (!alvo) return pedidos
    return pedidos.filter((p) => String(p.numero) === String(Number(alvo)))
  }, [pedidos, filtro])

  const executarBusca = useCallback(async (numero: string) => {
    setErro(null)
    setBuscando(true)

    try {
      const encontrados = await consultarPedidos(numero)
      setPedidos(encontrados)
      salvarTelefoneConsulta(numero)
    } catch (causa) {
      setPedidos(null)
      setErro(causa instanceof Error ? causa.message : String(causa))
    } finally {
      setBuscando(false)
    }
  }, [])

  // Recarregar a página voltava pro campo vazio, e o cliente tinha que digitar
  // tudo de novo -- parecia que tinha sido deslogado. Agora a busca refaz
  // sozinha com o telefone da última consulta.
  const jaBuscouAoAbrir = useRef(false)
  useEffect(() => {
    if (jaBuscouAoAbrir.current) return
    jaBuscouAoAbrir.current = true

    const salvo = lerTelefoneConsulta()
    if (!salvo) return

    setTelefone(salvo)
    void executarBusca(salvo)
  }, [executarBusca])

  function trocarTelefone() {
    limparTelefoneConsulta()
    setTelefone('')
    setFiltro('')
    setPedidos(null)
    setErro(null)
  }

  function buscar(evento: React.FormEvent) {
    evento.preventDefault()
    void executarBusca(telefone)
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4 px-4 py-8">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <h1 className="text-xl font-bold text-slate-900">Acompanhar pedido</h1>
        <p className="mt-1 text-sm text-slate-500">
          Digite o telefone que você usou ao fazer o pedido.
        </p>

        <form onSubmit={buscar} className="mt-5 space-y-4">
          <Campo
            label="Seu telefone"
            htmlFor="consulta-telefone"
            erro={erro ?? undefined}
            obrigatorio
          >
            <input
              id="consulta-telefone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="(11) 91234-5678"
              value={telefone}
              onChange={(e) => setTelefone(formatarTelefone(e.target.value))}
              className={erro ? `${classeInput} ${classeInputComErro}` : classeInput}
            />
          </Campo>

          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="submit"
              disabled={buscando}
              className="flex-1 rounded-xl bg-slate-900 px-4 py-3 font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {buscando ? 'Buscando…' : 'Buscar meus pedidos'}
            </button>

            {/*
              Em celular emprestado ou computador compartilhado, o telefone
              guardado faria o próximo ver pedido alheio.
            */}
            {pedidos !== null && (
              <button
                type="button"
                onClick={trocarTelefone}
                className="rounded-xl border border-slate-300 bg-white px-4 py-3 font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
              >
                Trocar telefone
              </button>
            )}
          </div>
        </form>
      </div>

      {pedidos !== null && pedidos.length === 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <p className="font-medium text-slate-900">Nenhum pedido encontrado</p>
          <p className="mt-2 text-sm text-slate-600">
            Confira se o telefone é o mesmo que você informou ao fazer o pedido.
            Pedidos já entregues há bastante tempo podem ter saído do sistema.
          </p>
        </div>
      )}

      {pedidos !== null && pedidos.length > 1 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <Campo label="Filtrar por número do pedido" htmlFor="consulta-numero">
            <input
              id="consulta-numero"
              type="text"
              inputMode="numeric"
              placeholder="Ex: 0007 — deixe vazio para ver todos"
              value={filtro}
              onChange={(e) => setFiltro(e.target.value)}
              className={classeInput}
            />
          </Campo>
        </div>
      )}

      {visiveis.map((pedido) => (
        <CartaoPedido key={pedido.numero} pedido={pedido} />
      ))}

      {pedidos !== null && pedidos.length > 0 && visiveis.length === 0 && (
        <p className="text-center text-sm text-slate-500">
          Nenhum pedido com esse número. Limpe o filtro para ver todos.
        </p>
      )}
    </div>
  )
}

function CartaoPedido({ pedido }: { pedido: PedidoConsultado }) {
  const etapaAtual = ETAPAS.indexOf(pedido.status)
  const totalPecas = pedido.itens.reduce((soma, i) => soma + i.quantidade, 0)

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500">Pedido</p>
          <p className="text-2xl font-bold text-slate-900">
            {formatarNumeroPedido(pedido.numero)}
          </p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-sm font-semibold ${
            CORES_STATUS[pedido.status] ?? 'bg-slate-100 text-slate-700'
          }`}
        >
          {pedido.status}
        </span>
      </div>

      {/* Barra de etapas: mostra onde o pedido está sem precisar ler texto. */}
      {etapaAtual >= 0 && (
        <div className="mt-5">
          <div className="flex gap-1" aria-hidden="true">
            {ETAPAS.map((etapa, i) => (
              <div
                key={etapa}
                className={`h-1.5 flex-1 rounded-full ${
                  i <= etapaAtual ? 'bg-emerald-500' : 'bg-slate-200'
                }`}
              />
            ))}
          </div>
          <div className="mt-2 flex justify-between text-[11px] text-slate-500">
            <span>Pedido feito</span>
            <span>Entregue</span>
          </div>
        </div>
      )}

      <dl className="mt-6 space-y-2 text-sm">
        {pedido.prazo && (
          <div className="flex justify-between gap-4">
            <dt className="text-slate-600">Entrega prevista</dt>
            <dd className="font-medium text-slate-900">
              {formatarDataBR(pedido.prazo)}
            </dd>
          </div>
        )}
        <div className="flex justify-between gap-4">
          <dt className="text-slate-600">Total de peças</dt>
          <dd className="font-medium text-slate-900">{totalPecas}</dd>
        </div>
        {pedido.artes && (
          <div className="flex justify-between gap-4">
            <dt className="text-slate-600">Artes</dt>
            <dd className="text-right font-medium text-slate-900">{pedido.artes}</dd>
          </div>
        )}
        <div className="flex justify-between gap-4 border-t border-slate-100 pt-2">
          <dt className="text-slate-600">Valor total</dt>
          <dd className="font-bold text-slate-900">
            {formatBRL(pedido.totalCentavos)}
          </dd>
        </div>
      </dl>

      {pedido.faltaPagarCentavos > 0 ? (
        <div className="mt-4 rounded-xl bg-amber-50 p-4">
          <div className="flex items-baseline justify-between gap-4">
            <span className="font-medium text-amber-900">
              {pedido.entradaPaga ? 'Saldo na entrega' : 'Entrada para começar'}
            </span>
            <span className="text-xl font-bold text-amber-800">
              {formatBRL(
                pedido.entradaPaga ? pedido.faltaPagarCentavos : pedido.entradaCentavos,
              )}
            </span>
          </div>
        </div>
      ) : (
        <p className="mt-4 rounded-xl bg-emerald-50 p-4 text-center font-medium text-emerald-900">
          Pagamento concluído
        </p>
      )}

      {pedido.itens.length > 0 && (
        <details className="mt-4">
          <summary className="cursor-pointer text-sm font-medium text-slate-700">
            Ver as peças deste pedido
          </summary>
          <ul className="mt-3 space-y-2 text-sm text-slate-600">
            {pedido.itens.map((item, i) => (
              <li key={i} className="flex justify-between gap-4 border-b border-slate-100 pb-2">
                <span>
                  {item.peca} · {item.tecido} · {item.cor}
                  <span className="block text-xs text-slate-500">
                    {item.genero} · tamanho {item.tamanho}
                  </span>
                </span>
                <span className="shrink-0 font-medium text-slate-900">
                  {item.quantidade}x
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}

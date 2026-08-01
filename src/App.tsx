import { useState } from 'react'
import { MODO_DEMO } from './lib/demo'
import { useCatalog } from './hooks/useCatalog'
import { Consulta } from './pages/Consulta'
import { NovoPedido } from './pages/NovoPedido'
import { PedidoEnviado } from './pages/PedidoEnviado'
import type { RespostaPedido } from './types'

const NOME_LOJA = 'Cidrack Company'
const LOGO = '/logo-c.jpg'
export const ROTA_CONSULTA = '/acompanhar'

/**
 * Roteamento sem biblioteca: são duas telas, e trazer um router de volta só
 * para isso custaria mais bytes que o recurso inteiro. O `vercel.json` cuida
 * de servir o index.html em qualquer caminho.
 */
function ehConsulta() {
  return window.location.pathname.replace(/\/+$/, '') === ROTA_CONSULTA
}

export default function App() {
  const consultando = ehConsulta()

  return (
    <div className="min-h-screen">
      {MODO_DEMO && <FaixaDemo />}
      <Cabecalho consultando={consultando} />
      <main>{consultando ? <Consulta /> : <FluxoDePedido />}</main>
    </div>
  )
}

function FluxoDePedido() {
  const { catalogo, carregando, erro, recarregar } = useCatalog()
  const [enviado, setEnviado] = useState<RespostaPedido | null>(null)

  function fazerOutroPedido() {
    setEnviado(null)
    // O nonce é de uso único: só um catálogo novo traz um válido.
    recarregar()
  }

  if (enviado) {
    return <PedidoEnviado resposta={enviado} onNovoPedido={fazerOutroPedido} />
  }
  if (carregando) return <EstadoCarregando />
  if (erro) return <EstadoErro mensagem={erro} onTentarNovamente={recarregar} />
  if (catalogo) return <NovoPedido catalogo={catalogo} onEnviado={setEnviado} />
  return null
}

function Cabecalho({ consultando }: { consultando: boolean }) {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-4 lg:px-6">
        <a href="/" className="flex min-w-0 flex-1 items-center gap-3">
          <img
            src={LOGO}
            alt={`Logo da ${NOME_LOJA}`}
            width={48}
            height={48}
            className="h-12 w-12 shrink-0 rounded-full object-cover"
          />
          <div className="min-w-0">
            <h1 className="truncate text-lg font-bold text-slate-900">{NOME_LOJA}</h1>
            <p className="truncate text-sm text-slate-500">
              {consultando ? 'Acompanhe seu pedido' : 'Monte seu pedido e veja o valor'}
            </p>
          </div>
        </a>

        <a
          href={consultando ? '/' : ROTA_CONSULTA}
          className="shrink-0 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
        >
          {consultando ? 'Fazer pedido' : 'Acompanhar'}
        </a>
      </div>
    </header>
  )
}

/** Precisa ser impossível de confundir com o site de verdade. */
function FaixaDemo() {
  return (
    <div className="bg-amber-400 px-4 py-2.5 text-center text-sm text-amber-950">
      <strong>Modo demonstração</strong> — dados de exemplo, nenhum pedido está
      sendo salvo. Configure <code className="font-mono">VITE_APPS_SCRIPT_URL</code>{' '}
      no <code className="font-mono">.env.local</code> para conectar à planilha.
    </div>
  )
}

function EstadoCarregando() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-16 text-center lg:px-6">
      <div
        className="mx-auto h-8 w-8 animate-spin rounded-full border-3 border-slate-200 border-t-slate-900"
        role="status"
        aria-label="Carregando"
      />
      <p className="mt-4 text-sm text-slate-500">Carregando o catálogo da loja…</p>
    </div>
  )
}

function EstadoErro({
  mensagem,
  onTentarNovamente,
}: {
  mensagem: string
  onTentarNovamente: () => void
}) {
  return (
    <div className="mx-auto max-w-xl px-4 py-16 lg:px-6">
      <div className="rounded-xl border border-red-200 bg-red-50 p-6">
        <h2 className="font-semibold text-red-900">Não foi possível carregar o catálogo</h2>
        <p className="mt-2 text-sm text-red-800">{mensagem}</p>
        <button
          type="button"
          onClick={onTentarNovamente}
          className="mt-4 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
        >
          Tentar novamente
        </button>
      </div>
    </div>
  )
}

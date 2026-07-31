import { useEffect, useState } from 'react'
import { BotaoCopiar } from '../components/BotaoCopiar'
import { formatBRL, formatarNumeroPedido } from '../lib/format'
import { montarPixCopiaECola } from '../lib/pix'
import type { RespostaPedido } from '../types'

interface PedidoEnviadoProps {
  resposta: RespostaPedido
  onNovoPedido: () => void
}

const TELEFONE_LOJA = (import.meta.env.VITE_WHATSAPP_LOJA ?? '').replace(/\D/g, '')
const PIX_CHAVE = (import.meta.env.VITE_PIX_CHAVE ?? '').trim()
const PIX_NOME = (import.meta.env.VITE_PIX_NOME ?? '').trim()
const PIX_CIDADE = (import.meta.env.VITE_PIX_CIDADE ?? '').trim()

export function PedidoEnviado({ resposta, onNovoPedido }: PedidoEnviadoProps) {
  const numeroFormatado = formatarNumeroPedido(resposta.numero)
  const saldo = resposta.totalCentavos - resposta.entradaCentavos

  // Só libera o passo do comprovante depois que o cliente demonstrou que foi
  // pagar — copiando o código, ou saindo e voltando pra aba.
  const [jaFoiPagar, setJaFoiPagar] = useState(false)

  useEffect(() => {
    let esteveEscondida = false

    function aoMudarVisibilidade() {
      if (document.hidden) {
        esteveEscondida = true
      } else if (esteveEscondida) {
        // Voltou pro site depois de sair (provavelmente do app do banco).
        setJaFoiPagar(true)
      }
    }

    document.addEventListener('visibilitychange', aoMudarVisibilidade)
    return () => document.removeEventListener('visibilitychange', aoMudarVisibilidade)
  }, [])

  const temPix = PIX_CHAVE !== ''
  const codigoPix = temPix
    ? montarPixCopiaECola({
        chave: PIX_CHAVE,
        nome: PIX_NOME,
        cidade: PIX_CIDADE,
        valorCentavos: resposta.entradaCentavos,
        txid: `PEDIDO${numeroFormatado}`,
      })
    : ''

  const mensagem = encodeURIComponent(
    `Olá! Segue o comprovante da entrada do pedido ${numeroFormatado} ` +
      `(${formatBRL(resposta.entradaCentavos)}).`,
  )
  const linkWhatsApp = TELEFONE_LOJA
    ? `https://wa.me/${TELEFONE_LOJA}?text=${mensagem}`
    : null

  return (
    <div className="mx-auto max-w-2xl space-y-4 px-4 py-8">
      {/* ---------------------------------------------------- confirmação */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-2xl">
            ✓
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Pedido enviado!</h1>
            <p className="text-sm text-slate-500">
              A loja já recebeu e vai entrar em contato.
            </p>
          </div>
        </div>

        <div className="mt-6 rounded-xl bg-slate-50 p-4 text-center">
          <p className="text-sm text-slate-600">Número do seu pedido</p>
          <p className="mt-1 text-3xl font-bold tracking-tight text-slate-900">
            {numeroFormatado}
          </p>
          <p className="mt-2 text-xs text-slate-500">
            Guarde este número para falar com a loja.
          </p>
        </div>

        {/*
          Valores vindos do servidor, não da conta que o navegador fez
          enquanto o cliente preenchia. É o preço oficial.
        */}
        <dl className="mt-6 space-y-3 text-sm">
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-slate-600">Valor total</dt>
            <dd className="text-lg font-bold text-slate-900">
              {formatBRL(resposta.totalCentavos)}
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-slate-600">Saldo na entrega</dt>
            <dd className="font-medium text-slate-900">{formatBRL(saldo)}</dd>
          </div>
        </dl>
      </div>

      {/* ------------------------------------------------------ pagamento */}
      {temPix && (
        <div className="rounded-2xl border-2 border-emerald-500 bg-white p-6 shadow-sm sm:p-8">
          <h2 className="text-lg font-bold text-slate-900">
            Pague a entrada para começar a produção
          </h2>

          <div className="mt-4 rounded-xl bg-emerald-50 p-4 text-center">
            <p className="text-sm text-emerald-900">Valor da entrada (50%)</p>
            <p className="mt-1 text-3xl font-bold text-emerald-700">
              {formatBRL(resposta.entradaCentavos)}
            </p>
          </div>

          <p className="mt-5 text-sm text-slate-600">
            Copie o código abaixo e cole no seu aplicativo do banco, na opção
            <strong> PIX Copia e Cola</strong>. O valor já vai preenchido.
          </p>

          <p className="mt-3 max-h-24 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-3 font-mono text-[11px] leading-relaxed break-all text-slate-600">
            {codigoPix}
          </p>

          <BotaoCopiar
            texto={codigoPix}
            rotulo="Copiar código PIX"
            rotuloCopiado="Código copiado!"
            onCopiado={() => setJaFoiPagar(true)}
            className="mt-3 w-full rounded-xl bg-emerald-600 px-4 py-3 font-semibold text-white shadow-sm transition hover:bg-emerald-700"
          />

          <div className="mt-5 border-t border-slate-100 pt-4">
            <p className="text-xs text-slate-500">
              Se o código não funcionar, use a chave PIX:
            </p>
            <div className="mt-2 flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-800">
                {PIX_CHAVE}
              </code>
              <BotaoCopiar
                texto={PIX_CHAVE}
                rotulo="Copiar"
                onCopiado={() => setJaFoiPagar(true)}
                className="shrink-0 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              />
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Nesse caso, digite o valor de {formatBRL(resposta.entradaCentavos)}{' '}
              manualmente.
            </p>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- comprovante */}
      {jaFoiPagar && linkWhatsApp && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <h2 className="text-lg font-bold text-slate-900">Já pagou?</h2>
          <p className="mt-2 text-sm text-slate-600">
            Envie o comprovante para a loja confirmar e iniciar a produção.
          </p>

          <a
            href={linkWhatsApp}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 block w-full rounded-xl bg-emerald-600 px-4 py-3 text-center font-semibold text-white shadow-sm transition hover:bg-emerald-700"
          >
            Enviar comprovante pelo WhatsApp
          </a>

          {/*
            O link wa.me abre a conversa com o texto pronto, mas NÃO anexa
            arquivo -- isso o WhatsApp não permite por link. Sem este aviso,
            muita gente clica, vê a mensagem enviada e acha que mandou o
            comprovante junto.
          */}
          <p className="mt-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-900">
            A conversa abre com a mensagem pronta. <strong>Anexe a foto ou o
            print do comprovante</strong> antes de enviar.
          </p>
        </div>
      )}

      {/* --------------------------------------------------------- rodapé */}
      <div className="flex flex-col gap-3 sm:flex-row">
        {!jaFoiPagar && linkWhatsApp && (
          <a
            href={linkWhatsApp}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 rounded-xl border border-slate-300 bg-white px-4 py-3 text-center font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            Falar no WhatsApp
          </a>
        )}
        <a
          href="/acompanhar"
          className="flex-1 rounded-xl border border-slate-300 bg-white px-4 py-3 text-center font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
        >
          Acompanhar meu pedido
        </a>
        <button
          type="button"
          onClick={onNovoPedido}
          className="flex-1 rounded-xl border border-slate-300 bg-white px-4 py-3 font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
        >
          Fazer outro pedido
        </button>
      </div>
    </div>
  )
}

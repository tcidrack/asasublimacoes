import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  erro: Error | null
}

/**
 * Transforma um erro de render em mensagem legível.
 *
 * Sem isto, qualquer exceção durante o render some com a página inteira — a
 * "tela branca", que não diz nada nem para quem está usando nem para quem vai
 * consertar. Já aconteceu duas vezes aqui pelo mesmo motivo: o site esperando
 * um campo que a versão publicada da planilha ainda não devolve.
 */
export class LimiteDeErro extends Component<Props, State> {
  state: State = { erro: null }

  static getDerivedStateFromError(erro: Error): State {
    return { erro }
  }

  componentDidCatch(erro: Error, info: ErrorInfo) {
    // Vai pro console do navegador, que é onde se procura depois.
    console.error('Erro na interface:', erro, info.componentStack)
  }

  render() {
    if (!this.state.erro) return this.props.children

    return (
      <div className="mx-auto max-w-xl px-4 py-16">
        <div className="rounded-xl border border-red-200 bg-red-50 p-6">
          <h1 className="font-semibold text-red-900">Algo quebrou nesta tela</h1>
          <p className="mt-2 text-sm text-red-800">
            Recarregue a página. Se continuar, mande um print desta mensagem
            para a loja.
          </p>

          <pre className="mt-4 overflow-x-auto rounded-lg bg-white/70 p-3 text-xs text-red-900">
            {this.state.erro.message}
          </pre>

          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-4 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
          >
            Recarregar
          </button>
        </div>
      </div>
    )
  }
}

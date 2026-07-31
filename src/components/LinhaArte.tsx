import { useEffect, useState } from 'react'
import { Campo, classeInput, classeInputComErro } from './Campo'
import { MIMES_LOGO } from '../lib/api'
import type { ArteLocal } from '../lib/schema'
import type { Posicao } from '../types'

interface LinhaArteProps {
  indice: number
  arte: ArteLocal
  posicoes: Posicao[]
  /** Posições já usadas nas outras artes, para não repetir. */
  posicoesOcupadas: string[]
  erro?: string
  podeRemover: boolean
  onMudar: (mudancas: Partial<ArteLocal>) => void
  onRemover: () => void
}

export function LinhaArte({
  indice,
  arte,
  posicoes,
  posicoesOcupadas,
  erro,
  podeRemover,
  onMudar,
  onRemover,
}: LinhaArteProps) {
  const [preview, setPreview] = useState<string | null>(null)
  const idBase = `arte-${indice}`

  // Sem o revoke, cada troca de arquivo vaza um blob na memória.
  useEffect(() => {
    if (!arte.arquivo || !arte.arquivo.type.startsWith('image/')) {
      setPreview(null)
      return
    }
    const url = URL.createObjectURL(arte.arquivo)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [arte.arquivo])

  const disponiveis = posicoes.filter(
    (p) => p.nome === arte.posicao || !posicoesOcupadas.includes(p.nome),
  )

  return (
    <li className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-slate-900 px-2 text-xs font-semibold text-white">
          {indice + 1}
        </span>
        {podeRemover && (
          <button
            type="button"
            onClick={onRemover}
            className="rounded-lg px-2 py-1 text-sm font-medium text-red-600 transition hover:bg-red-50"
          >
            Remover
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Campo label="Posição na peça" htmlFor={`${idBase}-posicao`} obrigatorio>
          <select
            id={`${idBase}-posicao`}
            value={arte.posicao}
            onChange={(evento) => onMudar({ posicao: evento.target.value })}
            className={erro && !arte.posicao ? `${classeInput} ${classeInputComErro}` : classeInput}
          >
            <option value="">Selecione…</option>
            {disponiveis.map((p) => (
              <option key={p.nome} value={p.nome}>
                {p.nome}
              </option>
            ))}
          </select>
        </Campo>

        <Campo
          label="Arquivo da arte"
          htmlFor={`${idBase}-arquivo`}
          dica="PNG, JPG, WEBP ou PDF, até 5 MB"
          obrigatorio
        >
          <input
            id={`${idBase}-arquivo`}
            type="file"
            accept={MIMES_LOGO.join(',')}
            onChange={(evento) => onMudar({ arquivo: evento.target.files?.[0] ?? null })}
            className="w-full cursor-pointer rounded-lg border border-slate-300 bg-white text-sm text-slate-600 shadow-sm file:mr-3 file:cursor-pointer file:border-0 file:bg-slate-100 file:px-4 file:py-2 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-200"
          />
        </Campo>

        <Campo
          label="Observação da arte"
          htmlFor={`${idBase}-obs`}
          dica="Opcional — tamanho, cor da estampa…"
          className="sm:col-span-2"
        >
          <input
            id={`${idBase}-obs`}
            type="text"
            maxLength={200}
            value={arte.observacao}
            onChange={(evento) => onMudar({ observacao: evento.target.value })}
            className={classeInput}
          />
        </Campo>
      </div>

      {arte.arquivo && (
        <div className="mt-3 flex items-center gap-3 rounded-lg bg-slate-50 p-3">
          {preview && (
            <img
              src={preview}
              alt={`Prévia da arte ${indice + 1}`}
              className="h-12 w-12 shrink-0 rounded border border-slate-200 bg-white object-contain"
            />
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-slate-700">
              {arte.arquivo.name}
            </p>
            <p className="text-xs text-slate-500">
              {(arte.arquivo.size / 1024).toFixed(0)} KB
            </p>
          </div>
        </div>
      )}

      {erro && (
        <p role="alert" className="mt-3 text-sm text-red-600">
          {erro}
        </p>
      )}
    </li>
  )
}

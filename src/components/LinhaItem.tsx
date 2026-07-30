import type { FieldError, UseFormRegister } from 'react-hook-form'
import { Campo, classeInput, classeInputComErro } from './Campo'
import { subtotalDaLinha, tecidosDaPeca } from '../lib/pricing'
import { formatBRL } from '../lib/format'
import type { FormularioLinha, FormularioPedido } from '../lib/schema'
import type { Catalogo } from '../types'
import { GENEROS } from '../types'

export type ErrosLinha = Partial<Record<keyof FormularioLinha, FieldError>>

interface LinhaItemProps {
  indice: number
  catalogo: Catalogo
  register: UseFormRegister<FormularioPedido>
  erros?: ErrosLinha
  linha: FormularioLinha | undefined
  podeRemover: boolean
  onRemover: () => void
  onPecaMudou: () => void
}

export function LinhaItem({
  indice,
  catalogo,
  register,
  erros,
  linha,
  podeRemover,
  onRemover,
  onPecaMudou,
}: LinhaItemProps) {
  const pecaEscolhida = linha?.peca ?? ''
  const tecidos = pecaEscolhida ? tecidosDaPeca(catalogo, pecaEscolhida) : []
  const subtotal = subtotalDaLinha(catalogo, linha)

  const registroPeca = register(`itens.${indice}.peca`)
  const idBase = `item-${indice}`

  function classe(erro?: FieldError) {
    return erro ? `${classeInput} ${classeInputComErro}` : classeInput
  }

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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-12">
        <Campo
          label="Peça"
          htmlFor={`${idBase}-peca`}
          erro={erros?.peca?.message}
          obrigatorio
          className="lg:col-span-4"
        >
          <select
            id={`${idBase}-peca`}
            className={classe(erros?.peca)}
            {...registroPeca}
            onChange={(evento) => {
              void registroPeca.onChange(evento)
              // O tecido escolhido pode não existir para a nova peça.
              onPecaMudou()
            }}
          >
            <option value="">Selecione…</option>
            {catalogo.pecas.map((p) => (
              <option key={p.nome} value={p.nome}>
                {p.nome}
              </option>
            ))}
          </select>
        </Campo>

        <Campo
          label="Tecido"
          htmlFor={`${idBase}-tecido`}
          erro={erros?.tecido?.message}
          dica={pecaEscolhida ? undefined : 'Escolha a peça primeiro'}
          obrigatorio
          className="lg:col-span-4"
        >
          <select
            id={`${idBase}-tecido`}
            className={classe(erros?.tecido)}
            disabled={!pecaEscolhida}
            {...register(`itens.${indice}.tecido`)}
          >
            <option value="">Selecione…</option>
            {tecidos.map((t) => (
              <option key={t.nome} value={t.nome}>
                {t.nome}
              </option>
            ))}
          </select>
        </Campo>

        <Campo
          label="Cor"
          htmlFor={`${idBase}-cor`}
          erro={erros?.cor?.message}
          obrigatorio
          className="lg:col-span-4"
        >
          <select
            id={`${idBase}-cor`}
            className={classe(erros?.cor)}
            {...register(`itens.${indice}.cor`)}
          >
            <option value="">Selecione…</option>
            {catalogo.cores.map((c) => (
              <option key={c.nome} value={c.nome}>
                {c.nome}
              </option>
            ))}
          </select>
        </Campo>

        <Campo
          label="Gênero"
          htmlFor={`${idBase}-genero`}
          erro={erros?.genero?.message}
          obrigatorio
          className="lg:col-span-4"
        >
          <select
            id={`${idBase}-genero`}
            className={classe(erros?.genero)}
            {...register(`itens.${indice}.genero`)}
          >
            <option value="">Selecione…</option>
            {GENEROS.map((g) => (
              <option key={g.valor} value={g.valor}>
                {g.rotulo}
              </option>
            ))}
          </select>
        </Campo>

        <Campo
          label="Tamanho"
          htmlFor={`${idBase}-tamanho`}
          erro={erros?.tamanho?.message}
          obrigatorio
          className="lg:col-span-4"
        >
          <select
            id={`${idBase}-tamanho`}
            className={classe(erros?.tamanho)}
            {...register(`itens.${indice}.tamanho`)}
          >
            <option value="">Selecione…</option>
            {catalogo.tamanhos.map((t) => (
              <option key={t.rotulo} value={t.rotulo}>
                {t.rotulo}
                {t.acrescimoCentavos > 0 && ` (+${formatBRL(t.acrescimoCentavos)})`}
              </option>
            ))}
          </select>
        </Campo>

        <Campo
          label="Quantidade"
          htmlFor={`${idBase}-qtd`}
          erro={erros?.quantidade?.message}
          obrigatorio
          className="lg:col-span-4"
        >
          <input
            id={`${idBase}-qtd`}
            type="number"
            inputMode="numeric"
            min={1}
            max={5000}
            className={classe(erros?.quantidade)}
            {...register(`itens.${indice}.quantidade`)}
          />
        </Campo>

        <Campo
          label="Nome bordado"
          htmlFor={`${idBase}-nome`}
          erro={erros?.nomeBordado?.message}
          dica="Opcional — ex: Dra. Ana"
          className="sm:col-span-2 lg:col-span-4"
        >
          <input
            id={`${idBase}-nome`}
            type="text"
            maxLength={60}
            placeholder="Deixe vazio se não for bordar nome"
            className={classe(erros?.nomeBordado)}
            {...register(`itens.${indice}.nomeBordado`)}
          />
        </Campo>
      </div>

      <div className="mt-3 border-t border-slate-100 pt-3 text-right text-sm">
        {subtotal === null ? (
          <span className="text-slate-400">Preencha a linha para ver o valor</span>
        ) : (
          <span className="text-slate-600">
            Subtotal desta linha:{' '}
            <strong className="text-slate-900">{formatBRL(subtotal)}</strong>
          </span>
        )}
      </div>
    </li>
  )
}

import { useEffect, useMemo, useState } from 'react'
import { useFieldArray, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'

import { Campo, classeInput, classeInputComErro } from '../components/Campo'
import { LinhaItem } from '../components/LinhaItem'
import type { ErrosLinha } from '../components/LinhaItem'
import { ResumoValores } from '../components/ResumoValores'
import { enviarPedido, lerArquivoComoBase64 } from '../lib/api'
import { calcularTotais } from '../lib/pricing'
import { formatarTelefone } from '../lib/format'
import { LINHA_VAZIA, VALORES_INICIAIS, pedidoSchema } from '../lib/schema'
import type { FormularioPedido } from '../lib/schema'
import type { Catalogo, Genero, LogoEnviado, RespostaPedido } from '../types'

const POSICOES_ESTAMPA = [
  'Peito esquerdo',
  'Peito direito',
  'Centro do peito',
  'Costas',
  'Manga esquerda',
  'Manga direita',
  'Peito + costas',
]

interface NovoPedidoProps {
  catalogo: Catalogo
  onEnviado: (resposta: RespostaPedido) => void
}

export function NovoPedido({ catalogo, onEnviado }: NovoPedidoProps) {
  const [arquivoLogo, setArquivoLogo] = useState<File | null>(null)
  const [erroLogo, setErroLogo] = useState<string | null>(null)
  const [previewLogo, setPreviewLogo] = useState<string | null>(null)
  const [erroEnvio, setErroEnvio] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  const {
    register,
    control,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<FormularioPedido>({
    resolver: zodResolver(pedidoSchema),
    defaultValues: VALORES_INICIAIS,
    mode: 'onBlur',
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'itens' })

  const itens = useWatch({ control, name: 'itens' })
  const totais = useMemo(
    () => calcularTotais(catalogo, itens ?? []),
    [catalogo, itens],
  )

  // Preview da imagem. Sem o revoke, cada troca de arquivo vaza um blob.
  useEffect(() => {
    if (!arquivoLogo || !arquivoLogo.type.startsWith('image/')) {
      setPreviewLogo(null)
      return
    }
    const url = URL.createObjectURL(arquivoLogo)
    setPreviewLogo(url)
    return () => URL.revokeObjectURL(url)
  }, [arquivoLogo])

  const hoje = new Date().toISOString().slice(0, 10)

  function aoEscolherLogo(arquivo: File | null) {
    setErroLogo(null)
    setArquivoLogo(arquivo)
  }

  const aoEnviar = handleSubmit(async (valores) => {
    setErroEnvio(null)
    setEnviando(true)

    try {
      let logo: LogoEnviado | undefined
      if (arquivoLogo) {
        try {
          logo = await lerArquivoComoBase64(arquivoLogo)
        } catch (causa) {
          setErroLogo(causa instanceof Error ? causa.message : String(causa))
          setEnviando(false)
          return
        }
      }

      const resposta = await enviarPedido({
        cliente: valores.cliente.trim(),
        telefone: valores.telefone.trim(),
        empresa: valores.empresa.trim() || undefined,
        prazo: valores.prazo || undefined,
        posicaoEstampa: valores.posicaoEstampa.trim() || undefined,
        observacoes: valores.observacoes.trim() || undefined,
        logo,
        nonce: catalogo.nonce,
        website: valores.website,
        itens: valores.itens.map((linha) => ({
          peca: linha.peca,
          tecido: linha.tecido,
          cor: linha.cor,
          genero: linha.genero as Genero,
          tamanho: linha.tamanho,
          quantidade: Number(linha.quantidade),
          nomeBordado: linha.nomeBordado.trim() || undefined,
        })),
      })

      onEnviado(resposta)
    } catch (causa) {
      setErroEnvio(causa instanceof Error ? causa.message : String(causa))
      setEnviando(false)
    }
  })

  return (
    <form onSubmit={aoEnviar} noValidate className="pb-32 lg:pb-12">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-8 lg:grid-cols-[1fr_340px] lg:px-6">
        <div className="min-w-0 space-y-8">
          {/* ---------------------------------------------------------- */}
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Seus dados</h2>
            <p className="mt-1 text-sm text-slate-500">
              Para a loja entrar em contato sobre o pedido.
            </p>

            <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Campo
                label="Nome completo"
                htmlFor="cliente"
                erro={errors.cliente?.message}
                obrigatorio
              >
                <input
                  id="cliente"
                  type="text"
                  autoComplete="name"
                  className={
                    errors.cliente ? `${classeInput} ${classeInputComErro}` : classeInput
                  }
                  {...register('cliente')}
                />
              </Campo>

              <Campo
                label="WhatsApp / Telefone"
                htmlFor="telefone"
                erro={errors.telefone?.message}
                obrigatorio
              >
                <input
                  id="telefone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="(11) 91234-5678"
                  className={
                    errors.telefone ? `${classeInput} ${classeInputComErro}` : classeInput
                  }
                  {...register('telefone', {
                    onChange: (evento) => {
                      setValue('telefone', formatarTelefone(evento.target.value))
                    },
                  })}
                />
              </Campo>

              <Campo
                label="Empresa / Instituição"
                htmlFor="empresa"
                erro={errors.empresa?.message}
                dica="Opcional"
                className="sm:col-span-2"
              >
                <input
                  id="empresa"
                  type="text"
                  autoComplete="organization"
                  className={
                    errors.empresa ? `${classeInput} ${classeInputComErro}` : classeInput
                  }
                  {...register('empresa')}
                />
              </Campo>
            </div>
          </section>

          {/* ---------------------------------------------------------- */}
          <section>
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Peças do pedido</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Uma linha para cada combinação de tamanho e gênero. Ex: 10 camisas M
                  masculino e 5 P feminino são duas linhas.
                </p>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-600">
                {totais.totalPecas} {totais.totalPecas === 1 ? 'peça' : 'peças'}
              </span>
            </div>

            <ul className="space-y-4">
              {fields.map((field, indice) => (
                <LinhaItem
                  key={field.id}
                  indice={indice}
                  catalogo={catalogo}
                  register={register}
                  erros={errors.itens?.[indice] as ErrosLinha | undefined}
                  linha={itens?.[indice]}
                  podeRemover={fields.length > 1}
                  onRemover={() => remove(indice)}
                  onPecaMudou={() => setValue(`itens.${indice}.tecido`, '')}
                />
              ))}
            </ul>

            {errors.itens?.root?.message && (
              <p role="alert" className="mt-3 text-sm text-red-600">
                {errors.itens.root.message}
              </p>
            )}

            <button
              type="button"
              onClick={() => append({ ...LINHA_VAZIA })}
              className="mt-4 w-full rounded-xl border-2 border-dashed border-slate-300 px-4 py-3 text-sm font-medium text-slate-600 transition hover:border-slate-900 hover:text-slate-900"
            >
              + Adicionar outra linha
            </button>
          </section>

          {/* ---------------------------------------------------------- */}
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Personalização</h2>
            <p className="mt-1 text-sm text-slate-500">
              Envie a arte e diga onde ela deve ficar.
            </p>

            <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Campo
                label="Logo ou arte"
                htmlFor="logo"
                erro={erroLogo ?? undefined}
                dica="PNG, JPG, WEBP ou PDF, até 5 MB"
              >
                <input
                  id="logo"
                  type="file"
                  accept="image/png,image/jpeg,image/webp,application/pdf"
                  onChange={(evento) => aoEscolherLogo(evento.target.files?.[0] ?? null)}
                  className="w-full cursor-pointer rounded-lg border border-slate-300 bg-white text-sm text-slate-600 shadow-sm file:mr-3 file:cursor-pointer file:border-0 file:bg-slate-100 file:px-4 file:py-2 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-200"
                />

                {arquivoLogo && (
                  <div className="mt-3 flex items-center gap-3 rounded-lg bg-slate-50 p-3">
                    {previewLogo && (
                      <img
                        src={previewLogo}
                        alt="Prévia do logo enviado"
                        className="h-12 w-12 shrink-0 rounded border border-slate-200 bg-white object-contain"
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-700">
                        {arquivoLogo.name}
                      </p>
                      <p className="text-xs text-slate-500">
                        {(arquivoLogo.size / 1024).toFixed(0)} KB
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => aoEscolherLogo(null)}
                      className="shrink-0 rounded-lg px-2 py-1 text-sm font-medium text-red-600 transition hover:bg-red-50"
                    >
                      Remover
                    </button>
                  </div>
                )}
              </Campo>

              <Campo
                label="Posição da estampa"
                htmlFor="posicaoEstampa"
                erro={errors.posicaoEstampa?.message}
                dica="Opcional"
              >
                <input
                  id="posicaoEstampa"
                  type="text"
                  list="posicoes-estampa"
                  placeholder="Ex: Peito esquerdo"
                  className={
                    errors.posicaoEstampa
                      ? `${classeInput} ${classeInputComErro}`
                      : classeInput
                  }
                  {...register('posicaoEstampa')}
                />
                <datalist id="posicoes-estampa">
                  {POSICOES_ESTAMPA.map((posicao) => (
                    <option key={posicao} value={posicao} />
                  ))}
                </datalist>
              </Campo>

              <Campo
                label="Prazo desejado de entrega"
                htmlFor="prazo"
                erro={errors.prazo?.message}
                dica="Opcional — a loja confirma se consegue atender"
              >
                <input
                  id="prazo"
                  type="date"
                  min={hoje}
                  className={
                    errors.prazo ? `${classeInput} ${classeInputComErro}` : classeInput
                  }
                  {...register('prazo')}
                />
              </Campo>

              <Campo
                label="Observações"
                htmlFor="observacoes"
                erro={errors.observacoes?.message}
                dica="Opcional — cores, detalhes, qualquer coisa importante"
                className="sm:col-span-2"
              >
                <textarea
                  id="observacoes"
                  rows={3}
                  maxLength={2000}
                  className={
                    errors.observacoes
                      ? `${classeInput} ${classeInputComErro}`
                      : classeInput
                  }
                  {...register('observacoes')}
                />
              </Campo>
            </div>
          </section>

          {/* Honeypot: escondido de gente, visível pra bot que preenche tudo. */}
          <div aria-hidden="true" className="absolute h-0 w-0 overflow-hidden opacity-0">
            <label htmlFor="website">Não preencha este campo</label>
            <input id="website" type="text" tabIndex={-1} autoComplete="off" {...register('website')} />
          </div>

          {erroEnvio && (
            <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4">
              <p className="font-medium text-red-900">Não foi possível enviar o pedido</p>
              <p className="mt-1 text-sm text-red-800">{erroEnvio}</p>
            </div>
          )}
        </div>

        {/* ------------------------------------------------------------ */}
        <aside className="hidden lg:block">
          <div className="sticky top-6 space-y-4">
            <ResumoValores totais={totais} />

            <button
              type="submit"
              disabled={enviando}
              className="w-full rounded-xl bg-slate-900 px-4 py-3 font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {enviando ? 'Enviando…' : 'Enviar pedido'}
            </button>
          </div>
        </aside>
      </div>

      {/* Rodapé fixo do celular: o valor e o botão sempre à vista. */}
      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-slate-200 bg-white/95 p-4 shadow-[0_-4px_12px_rgba(0,0,0,0.06)] backdrop-blur lg:hidden">
        <ResumoValores totais={totais} compacto />
        <button
          type="submit"
          disabled={enviando}
          className="mt-3 w-full rounded-xl bg-slate-900 px-4 py-3 font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          {enviando ? 'Enviando…' : 'Enviar pedido'}
        </button>
      </div>
    </form>
  )
}

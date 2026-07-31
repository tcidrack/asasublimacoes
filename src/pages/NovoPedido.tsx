import { useEffect, useMemo, useRef, useState } from 'react'
import { useFieldArray, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'

import { Campo, classeInput, classeInputComErro } from '../components/Campo'
import { LinhaItem } from '../components/LinhaItem'
import type { ErrosLinha } from '../components/LinhaItem'
import { LinhaArte } from '../components/LinhaArte'
import { ResumoValores } from '../components/ResumoValores'
import { enviarPedido, lerArquivoComoBase64 } from '../lib/api'
import { calcularTotais } from '../lib/pricing'
import { formatarTelefone } from '../lib/format'
import { primeiraDataPossivel } from '../lib/prazo'
import {
  LINHA_VAZIA,
  VALORES_INICIAIS,
  criarArteVazia,
  criarPedidoSchema,
} from '../lib/schema'
import {
  lerRascunho,
  limparRascunho,
  rascunhoTemConteudo,
  salvarRascunho,
} from '../lib/rascunho'
import type { ArteLocal, FormularioPedido } from '../lib/schema'
import type { ArteEnviada, Catalogo, Genero, RespostaPedido } from '../types'

const ESPERA_PARA_SALVAR_MS = 500

interface NovoPedidoProps {
  catalogo: Catalogo
  onEnviado: (resposta: RespostaPedido) => void
}

export function NovoPedido({ catalogo, onEnviado }: NovoPedidoProps) {
  const [artes, setArtes] = useState<ArteLocal[]>([])
  const [errosArtes, setErrosArtes] = useState<Record<string, string>>({})
  const [erroEnvio, setErroEnvio] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [rascunhoRestaurado, setRascunhoRestaurado] = useState(false)

  /** Enquanto o rascunho não foi lido, não se salva por cima dele. */
  const prontoParaSalvar = useRef(false)

  // O schema depende da agenda da loja, então é recriado quando o catálogo
  // muda. Sem o useMemo, um schema novo a cada render remontaria o resolver.
  const schema = useMemo(
    () => criarPedidoSchema(catalogo.prazoMinimoDias, catalogo.datasBloqueadas),
    [catalogo.prazoMinimoDias, catalogo.datasBloqueadas],
  )

  const {
    register,
    control,
    handleSubmit,
    setValue,
    reset,
    formState: { errors },
  } = useForm<FormularioPedido>({
    resolver: zodResolver(schema),
    defaultValues: VALORES_INICIAIS,
    mode: 'onBlur',
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'itens' })

  // Dois observadores de propósito: `itens` tipado alimenta a interface, e
  // `valores` (parcial, do formulário inteiro) serve só para salvar o
  // rascunho — onde campo faltando não é problema.
  const itens = useWatch({ control, name: 'itens' })
  const valores = useWatch({ control })
  const totais = useMemo(
    () => calcularTotais(catalogo, itens ?? []),
    [catalogo, itens],
  )

  const dataMinima = primeiraDataPossivel(catalogo.prazoMinimoDias)

  // Restaura o pedido em andamento. Roda uma vez, antes de qualquer salvamento.
  useEffect(() => {
    const rascunho = lerRascunho()

    if (rascunho && rascunhoTemConteudo(rascunho)) {
      reset(rascunho.valores)
      // Os arquivos não sobrevivem ao localStorage; só posição e observação.
      setArtes(
        rascunho.artes.map((a) => ({
          ...criarArteVazia(),
          posicao: a.posicao,
          observacao: a.observacao,
        })),
      )
      setRascunhoRestaurado(true)
    }

    prontoParaSalvar.current = true
  }, [reset])

  // Salva com atraso: sem isso seria uma escrita no disco por tecla digitada.
  useEffect(() => {
    if (!prontoParaSalvar.current || !valores) return

    const timer = setTimeout(() => {
      salvarRascunho(
        valores as FormularioPedido,
        artes.map((a) => ({ posicao: a.posicao, observacao: a.observacao })),
      )
    }, ESPERA_PARA_SALVAR_MS)

    return () => clearTimeout(timer)
  }, [valores, artes])

  function descartarRascunho() {
    limparRascunho()
    reset(VALORES_INICIAIS)
    setArtes([])
    setErrosArtes({})
    setRascunhoRestaurado(false)
  }

  /** Artes que voltaram do rascunho e ainda estão sem arquivo. */
  const artesSemArquivo = rascunhoRestaurado
    ? artes.filter((a) => a.posicao && !a.arquivo).length
    : 0

  function mudarArte(id: string, mudancas: Partial<ArteLocal>) {
    setArtes((atuais) =>
      atuais.map((a) => (a.id === id ? { ...a, ...mudancas } : a)),
    )
    setErrosArtes((atuais) => {
      const { [id]: _removido, ...resto } = atuais
      return resto
    })
  }

  /** As artes ficam fora do zod (guardam File), então a checagem é aqui. */
  function validarArtes(): boolean {
    const encontrados: Record<string, string> = {}

    for (const arte of artes) {
      if (!arte.posicao) encontrados[arte.id] = 'Escolha a posição da arte.'
      else if (!arte.arquivo) encontrados[arte.id] = 'Envie o arquivo da arte.'
    }

    setErrosArtes(encontrados)
    return Object.keys(encontrados).length === 0
  }

  const aoEnviar = handleSubmit(async (valores) => {
    if (!validarArtes()) return

    setErroEnvio(null)
    setEnviando(true)

    try {
      const artesEnviadas: ArteEnviada[] = []
      for (const arte of artes) {
        if (!arte.arquivo) continue
        try {
          artesEnviadas.push({
            posicao: arte.posicao,
            arquivo: await lerArquivoComoBase64(arte.arquivo),
            observacao: arte.observacao.trim() || undefined,
          })
        } catch (causa) {
          setErrosArtes({
            [arte.id]: causa instanceof Error ? causa.message : String(causa),
          })
          setEnviando(false)
          return
        }
      }

      const resposta = await enviarPedido({
        cliente: valores.cliente.trim(),
        telefone: valores.telefone.trim(),
        empresa: valores.empresa.trim() || undefined,
        prazo: valores.prazo || undefined,
        observacoes: valores.observacoes.trim() || undefined,
        artes: artesEnviadas,
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

      // Só depois de dar certo. Se limpasse antes e o envio falhasse, o
      // cliente perderia tudo justamente no pior momento.
      limparRascunho()
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
          {rascunhoRestaurado && (
            <div className="rounded-xl border border-sky-200 bg-sky-50 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-sky-900">
                    Recuperamos seu pedido em andamento
                  </p>
                  <p className="mt-1 text-sm text-sky-800">
                    Continue de onde parou, ou comece do zero.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={descartarRascunho}
                  className="shrink-0 rounded-lg border border-sky-300 bg-white px-3 py-2 text-sm font-medium text-sky-900 transition hover:bg-sky-100"
                >
                  Começar do zero
                </button>
              </div>

              {/*
                O arquivo não sobrevive ao recarregar — File não vira JSON.
                Sem este aviso o cliente enviaria achando que a arte foi junto,
                e o dono receberia pedido sem arte.
              */}
              {artesSemArquivo > 0 && (
                <p className="mt-3 rounded-lg bg-amber-100 p-3 text-sm text-amber-900">
                  <strong>
                    {artesSemArquivo === 1
                      ? 'Reenvie o arquivo de 1 arte'
                      : `Reenvie os arquivos de ${artesSemArquivo} artes`}
                    .
                  </strong>{' '}
                  As posições foram guardadas, mas os arquivos não ficam salvos
                  no navegador.
                </p>
              )}
            </div>
          )}

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
          <section>
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-slate-900">
                Artes a estampar
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Uma arte para cada lugar da peça. Se a camisa leva estampa no
                peito e nas costas, adicione duas.
              </p>
            </div>

            {artes.length > 0 && (
              <ul className="space-y-4">
                {artes.map((arte, indice) => (
                  <LinhaArte
                    key={arte.id}
                    indice={indice}
                    arte={arte}
                    posicoes={catalogo.posicoes}
                    posicoesOcupadas={artes.map((a) => a.posicao).filter(Boolean)}
                    erro={errosArtes[arte.id]}
                    podeRemover
                    onMudar={(mudancas) => mudarArte(arte.id, mudancas)}
                    onRemover={() =>
                      setArtes((atuais) => atuais.filter((a) => a.id !== arte.id))
                    }
                  />
                ))}
              </ul>
            )}

            {artes.length < catalogo.posicoes.length && (
              <button
                type="button"
                onClick={() => setArtes((atuais) => [...atuais, criarArteVazia()])}
                className="mt-4 w-full rounded-xl border-2 border-dashed border-slate-300 px-4 py-3 text-sm font-medium text-slate-600 transition hover:border-slate-900 hover:text-slate-900"
              >
                {artes.length === 0 ? '+ Adicionar arte' : '+ Adicionar outra arte'}
              </button>
            )}
          </section>

          {/* ---------------------------------------------------------- */}
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">
              Prazo e observações
            </h2>

            <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Campo
                label="Prazo desejado de entrega"
                htmlFor="prazo"
                erro={errors.prazo?.message}
                dica={
                  catalogo.prazoMinimoDias > 0
                    ? `Opcional — a loja precisa de ${catalogo.prazoMinimoDias} dias para produzir`
                    : 'Opcional'
                }
              >
                {/*
                  O `min` já impede escolher data cedo demais no calendário. A
                  regra também é conferida pelo zod e, de novo, pelo servidor —
                  aqui é só conveniência.
                */}
                <input
                  id="prazo"
                  type="date"
                  min={dataMinima}
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
                dica="Opcional — detalhes, referências, qualquer coisa importante"
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

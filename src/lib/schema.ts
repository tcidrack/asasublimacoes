import { z } from 'zod'
import { erroDoPrazo } from './prazo'
import { GENEROS } from '../types'
import type { DataBloqueada } from '../types'

const generosValidos = GENEROS.map((g) => g.valor) as string[]

/**
 * A quantidade fica como string no formulário e vira número só no envio.
 * Um <input> devolve string; converter cedo faz um campo vazio virar NaN e a
 * mensagem de erro que aparece pro cliente ficar incompreensível.
 */
export const linhaSchema = z.object({
  peca: z.string().min(1, 'Escolha a peça'),
  tecido: z.string().min(1, 'Escolha o tecido'),
  cor: z.string().min(1, 'Escolha a cor'),
  genero: z.string().refine((v) => generosValidos.includes(v), 'Escolha o gênero'),
  tamanho: z.string().min(1, 'Escolha o tamanho'),
  quantidade: z
    .string()
    .min(1, 'Informe a quantidade')
    .refine((v) => /^\d+$/.test(v.trim()), 'Use apenas números')
    .refine((v) => {
      const n = Number(v)
      return n >= 1 && n <= 5000
    }, 'Entre 1 e 5000 peças'),
  nomeBordado: z.string().max(60, 'No máximo 60 caracteres'),
})

/**
 * O schema é uma função porque a validação do prazo depende da agenda da loja,
 * que só chega junto com o catálogo. Um schema fixo no módulo não teria acesso
 * ao prazo mínimo nem aos períodos bloqueados.
 */
export function criarPedidoSchema(
  prazoMinimoDias: number,
  datasBloqueadas: DataBloqueada[],
) {
  return z.object({
    cliente: z.string().min(2, 'Informe seu nome').max(120, 'Nome muito longo'),
    telefone: z
      .string()
      .refine((v) => v.replace(/\D/g, '').length >= 10, 'Informe o telefone com DDD'),
    empresa: z.string().max(120, 'Nome muito longo'),
    prazo: z.string().superRefine((valor, ctx) => {
      const erro = erroDoPrazo(valor, prazoMinimoDias, datasBloqueadas)
      if (erro) ctx.addIssue({ code: 'custom', message: erro })
    }),
    observacoes: z.string().max(2000, 'No máximo 2000 caracteres'),
    /** Honeypot: humano nunca vê, então nunca preenche. Quem preenche é bot. */
    website: z.string(),
    itens: z
      .array(linhaSchema)
      .min(1, 'Adicione pelo menos uma peça')
      .max(200, 'No máximo 200 linhas por pedido'),
  })
}

export type FormularioPedido = z.infer<ReturnType<typeof criarPedidoSchema>>
export type FormularioLinha = z.infer<typeof linhaSchema>

export const LINHA_VAZIA: FormularioLinha = {
  peca: '',
  tecido: '',
  cor: '',
  genero: '',
  tamanho: '',
  quantidade: '1',
  nomeBordado: '',
}

export const VALORES_INICIAIS: FormularioPedido = {
  cliente: '',
  telefone: '',
  empresa: '',
  prazo: '',
  observacoes: '',
  website: '',
  itens: [{ ...LINHA_VAZIA }],
}

/**
 * Uma arte enquanto está sendo montada na tela.
 *
 * Fica fora do react-hook-form de propósito: o zod trabalha com valores
 * serializáveis, e `File` não é. Guardar o arquivo aqui evita ter que
 * contorná-lo com transformações a cada render.
 */
export interface ArteLocal {
  id: string
  posicao: string
  arquivo: File | null
  observacao: string
}

export function criarArteVazia(): ArteLocal {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    posicao: '',
    arquivo: null,
    observacao: '',
  }
}

import { z } from 'zod'
import { GENEROS } from '../types'

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

export const pedidoSchema = z.object({
  cliente: z.string().min(2, 'Informe seu nome').max(120, 'Nome muito longo'),
  telefone: z
    .string()
    .refine((v) => v.replace(/\D/g, '').length >= 10, 'Informe o telefone com DDD'),
  empresa: z.string().max(120, 'Nome muito longo'),
  prazo: z.string(),
  posicaoEstampa: z.string().max(80, 'Texto muito longo'),
  observacoes: z.string().max(2000, 'No máximo 2000 caracteres'),
  /** Honeypot: humano nunca vê, então nunca preenche. Quem preenche é bot. */
  website: z.string(),
  itens: z
    .array(linhaSchema)
    .min(1, 'Adicione pelo menos uma peça')
    .max(200, 'No máximo 200 linhas por pedido'),
})

export type FormularioPedido = z.infer<typeof pedidoSchema>
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
  posicaoEstampa: '',
  observacoes: '',
  website: '',
  itens: [{ ...LINHA_VAZIA }],
}

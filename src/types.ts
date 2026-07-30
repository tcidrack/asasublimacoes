export type Genero = 'masculino' | 'feminino' | 'unissex'

export const GENEROS: { valor: Genero; rotulo: string }[] = [
  { valor: 'masculino', rotulo: 'Masculino' },
  { valor: 'feminino', rotulo: 'Feminino' },
  { valor: 'unissex', rotulo: 'Unissex' },
]

export interface Peca {
  nome: string
  ordem: number
}

export interface Tecido {
  nome: string
  descricao: string
  ordem: number
}

export interface Tamanho {
  rotulo: string
  /** Acréscimo em centavos cobrado por tamanhos maiores (XG, XXG...). */
  acrescimoCentavos: number
  ordem: number
}

export interface Cor {
  nome: string
  ordem: number
}

/** precos['Camiseta']['Dry-fit'] = 4500 (centavos). Ausente = não oferecemos. */
export type MatrizPrecos = Record<string, Record<string, number>>

export interface Catalogo {
  pecas: Peca[]
  tecidos: Tecido[]
  tamanhos: Tamanho[]
  cores: Cor[]
  precos: MatrizPrecos
  /** Uso único, exigido no envio. Vem junto do catálogo. */
  nonce: string
}

export interface LinhaPedido {
  peca: string
  tecido: string
  cor: string
  genero: Genero
  tamanho: string
  quantidade: number
  nomeBordado?: string
}

export interface LogoEnviado {
  nomeArquivo: string
  mimeType: string
  dadosBase64: string
}

export interface PayloadPedido {
  cliente: string
  telefone: string
  empresa?: string
  prazo?: string
  posicaoEstampa?: string
  observacoes?: string
  logo?: LogoEnviado
  itens: LinhaPedido[]
  nonce: string
  /** Honeypot: fica escondido no formulário e precisa chegar vazio. */
  website?: string
}

export interface RespostaPedido {
  numero: number
  totalCentavos: number
  entradaCentavos: number
}

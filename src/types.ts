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

export interface Posicao {
  nome: string
  ordem: number
}

/** Período em que a loja não entrega. Datas em "aaaa-mm-dd". */
export interface DataBloqueada {
  inicio: string
  fim: string
  motivo: string
}

/** precos['Camiseta']['Dry-fit'] = 4500 (centavos). Ausente = não oferecemos. */
export type MatrizPrecos = Record<string, Record<string, number>>

export interface Catalogo {
  pecas: Peca[]
  tecidos: Tecido[]
  tamanhos: Tamanho[]
  cores: Cor[]
  posicoes: Posicao[]
  precos: MatrizPrecos
  /** Dias que a loja precisa para produzir. Entrega antes disso é recusada. */
  prazoMinimoDias: number
  datasBloqueadas: DataBloqueada[]
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

export interface ArteEnviada {
  posicao: string
  arquivo: LogoEnviado
  observacao?: string
}

export interface PayloadPedido {
  cliente: string
  telefone: string
  empresa?: string
  prazo?: string
  observacoes?: string
  artes: ArteEnviada[]
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

/** Um pedido como o próprio cliente vê na página de acompanhamento. */
export interface PedidoConsultado {
  numero: number
  data: string
  prazo: string
  status: string
  artes: string
  totalCentavos: number
  entradaCentavos: number
  entradaPaga: boolean
  saldoPago: boolean
  faltaPagarCentavos: number
  itens: Array<{
    peca: string
    tecido: string
    cor: string
    genero: string
    tamanho: string
    quantidade: number
  }>
}

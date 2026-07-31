import { calcularTotais } from './pricing'
import type {
  Catalogo,
  PayloadPedido,
  PedidoConsultado,
  RespostaPedido,
} from '../types'

/**
 * Modo demonstração: deixa a interface rodar sem a planilha do Google.
 *
 * Serve pra ver e mexer no visual antes de montar a planilha, e pra qualquer
 * pessoa que clone o projeto conseguir rodar `npm run dev` de cara.
 *
 * ⚠️ SÓ EM DESENVOLVIMENTO. Se um catálogo falso aparecesse em produção, o
 * cliente preencheria um formulário perfeito, enviaria o pedido, veria a tela
 * de confirmação — e o pedido não teria ido pra lugar nenhum. Uma tela de erro
 * é muito melhor que isso.
 *
 * Em build de produção o Vite troca `import.meta.env.DEV` por `false`, então a
 * condição vira constante e este arquivo inteiro sai do bundle.
 */
export const MODO_DEMO =
  import.meta.env.DEV && !import.meta.env.VITE_APPS_SCRIPT_URL

/**
 * Espelho do seed de `apps-script/Setup.gs` (funções configurarAbaPecas,
 * configurarAbaTecidos, configurarAbaTamanhos e configurarAbaPrecos).
 *
 * Mexeu nos valores de exemplo de lá? Mexa aqui também — a graça é o que você
 * vê local ser igual ao que a planilha vai gerar, inclusive quais combinações
 * de peça e tecido existem.
 *
 * Valores em centavos; na planilha eles ficam em reais.
 */
export const catalogoDemo: Catalogo = {
  pecas: [
    { nome: 'Camiseta', ordem: 1 },
    { nome: 'Camisa Polo', ordem: 2 },
    { nome: 'Camisa Social', ordem: 3 },
    { nome: 'Jaleco', ordem: 4 },
    { nome: 'Avental', ordem: 5 },
    { nome: 'Calça', ordem: 6 },
    { nome: 'Colete', ordem: 7 },
  ],

  tecidos: [
    {
      nome: 'Malha PV',
      descricao: 'Poliéster com viscose. Bom custo-benefício, pouco amassa.',
      ordem: 1,
    },
    {
      nome: 'Dry-fit',
      descricao: 'Tecido esportivo, seca rápido e não retém suor.',
      ordem: 2,
    },
    {
      nome: 'Algodão 30.1',
      descricao: 'Algodão penteado, toque macio e bem confortável.',
      ordem: 3,
    },
    {
      nome: 'Oxford',
      descricao: 'Encorpado e resistente, ideal para camisa social.',
      ordem: 4,
    },
    {
      nome: 'Gabardine',
      descricao: 'Firme e durável, muito usado em jaleco e calça.',
      ordem: 5,
    },
    { nome: 'Brim', descricao: 'Bem resistente, indicado para uso pesado.', ordem: 6 },
    { nome: 'Microfibra', descricao: 'Leve e de secagem rápida.', ordem: 7 },
  ],

  // A ordem aqui é a ordem da grade de corte: PP, P, M, G... e não alfabética.
  tamanhos: [
    { rotulo: 'PP', acrescimoCentavos: 0, ordem: 1 },
    { rotulo: 'P', acrescimoCentavos: 0, ordem: 2 },
    { rotulo: 'M', acrescimoCentavos: 0, ordem: 3 },
    { rotulo: 'G', acrescimoCentavos: 0, ordem: 4 },
    { rotulo: 'GG', acrescimoCentavos: 0, ordem: 5 },
    { rotulo: 'XG', acrescimoCentavos: 300, ordem: 6 },
    { rotulo: 'XXG', acrescimoCentavos: 500, ordem: 7 },
  ],

  cores: [
    { nome: 'Branco', ordem: 1 },
    { nome: 'Preto', ordem: 2 },
    { nome: 'Azul Marinho', ordem: 3 },
    { nome: 'Azul Royal', ordem: 4 },
    { nome: 'Vermelho', ordem: 5 },
    { nome: 'Verde Bandeira', ordem: 6 },
    { nome: 'Cinza', ordem: 7 },
    { nome: 'Amarelo', ordem: 8 },
    { nome: 'Laranja', ordem: 9 },
    { nome: 'Rosa', ordem: 10 },
  ],

  posicoes: [
    { nome: 'Peito esquerdo', ordem: 1 },
    { nome: 'Peito direito', ordem: 2 },
    { nome: 'Centro do peito', ordem: 3 },
    { nome: 'Costas', ordem: 4 },
    { nome: 'Manga esquerda', ordem: 5 },
    { nome: 'Manga direita', ordem: 6 },
    { nome: 'Gola', ordem: 7 },
    { nome: 'Barra', ordem: 8 },
  ],

  prazoMinimoDias: 15,

  // Um bloqueio de exemplo, para dar pra testar a recusa por data sem precisar
  // cadastrar nada na planilha.
  datasBloqueadas: [
    { inicio: '2026-12-24', fim: '2027-01-02', motivo: 'Recesso de fim de ano' },
  ],

  // Matriz parcial de propósito: combinação ausente = a loja não faz.
  // É o que faz o select de tecido filtrar conforme a peça escolhida.
  precos: {
    Camiseta: {
      'Malha PV': 3200,
      'Dry-fit': 4500,
      'Algodão 30.1': 3800,
      Microfibra: 4200,
    },
    'Camisa Polo': {
      'Malha PV': 4800,
      'Dry-fit': 5800,
      'Algodão 30.1': 5200,
      Microfibra: 5500,
    },
    'Camisa Social': { Oxford: 6800 },
    Jaleco: { Oxford: 7500, Gabardine: 8200 },
    Avental: { Oxford: 4500, Gabardine: 5200, Brim: 5800 },
    Calça: { Gabardine: 7200, Brim: 6500 },
    Colete: { Oxford: 5800, Gabardine: 6500 },
  },

  nonce: 'demo',
}

/** Pedidos criados nesta sessão, para a consulta ter o que mostrar no demo. */
const pedidosDemo: PedidoConsultado[] = []

let ultimoNumero = 0

/**
 * Finge o envio do pedido.
 *
 * O total sai de `calcularTotais` — o mesmo cálculo do formulário — em vez de
 * um número fixo. Assim a tela de confirmação mostra valores de verdade e dá
 * pra conferir o arredondamento da entrada de 50%.
 */
export async function enviarPedidoDemo(
  payload: PayloadPedido,
): Promise<RespostaPedido> {
  // Atraso curto só pra dar pra ver o botão em "Enviando…".
  await new Promise((resolver) => setTimeout(resolver, 600))

  const totais = calcularTotais(catalogoDemo, payload.itens)
  ultimoNumero += 1

  // Guarda em memória para a página de acompanhamento ter o que mostrar sem
  // planilha. Some ao recarregar, e no demo isso é esperado.
  pedidosDemo.push({
    numero: ultimoNumero,
    data: new Date().toISOString().slice(0, 10),
    prazo: payload.prazo ?? '',
    status: 'Aguardando pagamento',
    artes: payload.artes.map((a) => a.posicao).join(', '),
    totalCentavos: totais.totalCentavos,
    entradaCentavos: totais.entradaCentavos,
    entradaPaga: false,
    saldoPago: false,
    faltaPagarCentavos: totais.totalCentavos,
    itens: payload.itens.map((i) => ({
      peca: i.peca,
      tecido: i.tecido,
      cor: i.cor,
      genero: i.genero,
      tamanho: i.tamanho,
      quantidade: i.quantidade,
    })),
    telefone: payload.telefone.replace(/\D/g, ''),
  } as PedidoConsultado & { telefone: string })

  return {
    numero: ultimoNumero,
    totalCentavos: totais.totalCentavos,
    entradaCentavos: totais.entradaCentavos,
  }
}

export async function consultarPedidosDemo(
  digitos: string,
): Promise<PedidoConsultado[]> {
  await new Promise((resolver) => setTimeout(resolver, 400))

  return pedidosDemo
    .filter((p) => (p as PedidoConsultado & { telefone?: string }).telefone === digitos)
    .slice()
    .sort((a, b) => b.numero - a.numero)
}

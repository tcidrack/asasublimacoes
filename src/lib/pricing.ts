import type { Catalogo, Tecido } from '../types'

/**
 * Aceita a linha como ela vive no formulário (quantidade em string) e também
 * já convertida, pra mesma função servir ao preview e ao envio.
 */
export interface LinhaCalculavel {
  peca?: string
  tecido?: string
  tamanho?: string
  quantidade?: number | string
}

/**
 * ATENÇÃO: este arquivo é só para MOSTRAR o valor na tela enquanto o cliente
 * preenche o formulário. O valor que vale é o que o Apps Script calcula ao
 * receber o pedido (ver validarEPrecificarItem em apps-script/WebApp.gs).
 *
 * As duas fórmulas precisam ser idênticas. Se mexer numa, mexa na outra.
 */

export interface TotaisPedido {
  totalCentavos: number
  entradaCentavos: number
  saldoCentavos: number
  totalPecas: number
  /** Linhas preenchidas pela metade, que ainda não entram na conta. */
  linhasIncompletas: number
}

export function precoUnitarioCentavos(
  catalogo: Catalogo,
  peca: string,
  tecido: string,
  tamanho: string,
): number | null {
  const base = catalogo.precos[peca]?.[tecido]
  if (!base || base <= 0) return null

  const dadosTamanho = catalogo.tamanhos.find((t) => t.rotulo === tamanho)
  if (!dadosTamanho) return null

  return base + dadosTamanho.acrescimoCentavos
}

export function subtotalDaLinha(
  catalogo: Catalogo,
  linha: LinhaCalculavel | undefined,
): number | null {
  if (!linha?.peca || !linha.tecido || !linha.tamanho) return null

  const quantidade = Number(linha.quantidade)
  if (!Number.isFinite(quantidade) || quantidade <= 0) return null

  const unitario = precoUnitarioCentavos(catalogo, linha.peca, linha.tecido, linha.tamanho)
  if (unitario === null) return null

  return unitario * Math.floor(quantidade)
}

export function calcularTotais(
  catalogo: Catalogo,
  linhas: Array<LinhaCalculavel | undefined>,
): TotaisPedido {
  let totalCentavos = 0
  let totalPecas = 0
  let linhasIncompletas = 0

  for (const linha of linhas) {
    const subtotal = subtotalDaLinha(catalogo, linha)
    if (subtotal === null) {
      linhasIncompletas++
      continue
    }
    totalCentavos += subtotal
    totalPecas += Math.floor(Number(linha?.quantidade))
  }

  // Arredonda a entrada pra cima: nunca fica 1 centavo abaixo da metade.
  const entradaCentavos = Math.ceil(totalCentavos / 2)

  return {
    totalCentavos,
    entradaCentavos,
    saldoCentavos: totalCentavos - entradaCentavos,
    totalPecas,
    linhasIncompletas,
  }
}

/**
 * Só os tecidos que têm preço cadastrado para a peça escolhida.
 * É o que impede o cliente de montar uma combinação que a loja não faz.
 */
export function tecidosDaPeca(catalogo: Catalogo, peca: string): Tecido[] {
  const precos = catalogo.precos[peca]
  if (!precos) return []
  return catalogo.tecidos.filter((t) => (precos[t.nome] ?? 0) > 0)
}

/**
 * Gera o "PIX Copia e Cola" (BR Code, padrão EMV MPM do Banco Central).
 *
 * O formato é TLV: cada campo é `ID(2 dígitos) + tamanho(2 dígitos) + valor`,
 * emendados sem separador. O último campo é sempre o CRC16.
 *
 * Embutir o valor aqui é o ponto principal: o cliente cola no banco e o valor
 * já vem preenchido, então não tem como pagar diferente do combinado — e o
 * controle de entrada de 50% do dono depende disso.
 */

const ID_PAYLOAD_FORMAT = '00'
const ID_INICIACAO = '01'
const ID_CONTA_PIX = '26'
const ID_CATEGORIA = '52'
const ID_MOEDA = '53'
const ID_VALOR = '54'
const ID_PAIS = '58'
const ID_NOME = '59'
const ID_CIDADE = '60'
const ID_DADOS_ADICIONAIS = '62'
const ID_CRC = '63'

const GUI_PIX = 'br.gov.bcb.pix'

export interface DadosPix {
  /** Chave já no formato final. Celular vai com +55, ex: +5585984058583. */
  chave: string
  nome: string
  cidade: string
  valorCentavos: number
  /** Aparece no extrato do cliente e ajuda o dono a conciliar. */
  txid: string
}

/** `ID + tamanho + valor`, com o tamanho sempre em 2 dígitos. */
function campo(id: string, valor: string): string {
  return id + String(valor.length).padStart(2, '0') + valor
}

/**
 * Tira acento, deixa maiúsculo e corta no limite.
 *
 * Acento no payload faz app de banco recusar o código, então um nome como
 * "Confecções Silva" precisa virar "CONFECCOES SILVA".
 */
function textoLimpo(valor: string, tamanhoMaximo: number): string {
  return valor
    // NFD separa a letra do acento ("ç" vira "c" + cedilha solta), e o filtro
    // seguinte descarta a marca junto com o resto do que não é alfanumérico.
    .normalize('NFD')
    .replace(/[^A-Za-z0-9 ]/g, '')
    .trim()
    .toUpperCase()
    .slice(0, tamanhoMaximo)
}

/** Só alfanumérico — é o que os bancos aceitam sem reclamar. */
function txidLimpo(valor: string): string {
  const limpo = valor
    .normalize('NFD')
    .replace(/[^A-Za-z0-9]/g, '')
    .toUpperCase()
    .slice(0, 25)
  // '***' é o valor que o padrão define para "sem identificador".
  return limpo || '***'
}

/**
 * CRC16-CCITT (variante XModem / CCITT-FALSE): polinômio 0x1021, valor
 * inicial 0xFFFF, sem XOR final.
 *
 * Calculado sobre o payload inteiro INCLUINDO o "6304" do próprio campo de
 * CRC — é a parte que mais se erra numa implementação dessas.
 */
export function crc16(payload: string): string {
  let crc = 0xffff

  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8

    for (let bit = 0; bit < 8; bit++) {
      crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1
      crc &= 0xffff
    }
  }

  return crc.toString(16).toUpperCase().padStart(4, '0')
}

/** Valor em reais com ponto decimal e 2 casas, sem separador de milhar. */
function valorFormatado(centavos: number): string {
  return (Math.round(centavos) / 100).toFixed(2)
}

export function montarPixCopiaECola(dados: DadosPix): string {
  const chave = dados.chave.trim()

  const contaPix = campo('00', GUI_PIX) + campo('01', chave)
  const dadosAdicionais = campo('05', txidLimpo(dados.txid))

  const payload =
    campo(ID_PAYLOAD_FORMAT, '01') +
    campo(ID_INICIACAO, '11') +
    campo(ID_CONTA_PIX, contaPix) +
    campo(ID_CATEGORIA, '0000') +
    campo(ID_MOEDA, '986') +
    campo(ID_VALOR, valorFormatado(dados.valorCentavos)) +
    campo(ID_PAIS, 'BR') +
    campo(ID_NOME, textoLimpo(dados.nome, 25)) +
    campo(ID_CIDADE, textoLimpo(dados.cidade, 15)) +
    campo(ID_DADOS_ADICIONAIS, dadosAdicionais)

  // O "6304" entra no cálculo, por isso é concatenado antes.
  const comMarcadorCrc = payload + ID_CRC + '04'
  return comMarcadorCrc + crc16(comMarcadorCrc)
}

/**
 * Decompõe um payload TLV. Existe para a verificação: permite conferir que
 * cada campo declara o tamanho certo e que o CRC bate.
 */
export function lerCamposPix(payload: string): Array<{ id: string; valor: string }> {
  const campos: Array<{ id: string; valor: string }> = []
  let posicao = 0

  while (posicao < payload.length) {
    const id = payload.slice(posicao, posicao + 2)
    const tamanho = Number(payload.slice(posicao + 2, posicao + 4))
    if (!id || !Number.isFinite(tamanho)) break

    campos.push({ id, valor: payload.slice(posicao + 4, posicao + 4 + tamanho) })
    posicao += 4 + tamanho
  }

  return campos
}

import type { FormularioPedido } from './schema'

/**
 * Guarda o pedido em andamento no navegador.
 *
 * No celular a aba é descartada com facilidade: o cliente sai para conferir um
 * tamanho no WhatsApp, volta, e o formulário está zerado. Como montar um
 * pedido dá trabalho — várias linhas, cada uma com peça, tecido, cor, tamanho
 * — perder isso costuma significar perder o pedido.
 *
 * ⚠️ Os ARQUIVOS das artes não cabem aqui. `File` não vira JSON, e guardá-los
 * exigiria IndexedDB. O que se preserva é a posição e a observação de cada
 * arte; o cliente reenvia só os arquivos, e a tela avisa isso explicitamente.
 */

const CHAVE = 'asa-pedido-rascunho'
const CHAVE_TELEFONE = 'asa-telefone-consulta'

/** Sobe quando o formato do formulário muda, para descartar rascunho velho. */
const VERSAO = 1

/** Rascunho parado há mais de uma semana é ruído, não trabalho em andamento. */
const VALIDADE_MS = 7 * 24 * 60 * 60 * 1000

export interface ArteSalva {
  posicao: string
  observacao: string
}

interface Rascunho {
  versao: number
  salvoEm: number
  valores: FormularioPedido
  artes: ArteSalva[]
}

/**
 * localStorage pode lançar: aba anônima do Safari, cota cheia, ou política do
 * navegador. Nada disso pode derrubar o formulário — na pior hipótese, o
 * cliente só fica sem o rascunho.
 */
function comSeguranca<T>(operacao: () => T, padrao: T): T {
  try {
    return operacao()
  } catch {
    return padrao
  }
}

export function salvarRascunho(valores: FormularioPedido, artes: ArteSalva[]): void {
  comSeguranca(() => {
    const rascunho: Rascunho = {
      versao: VERSAO,
      salvoEm: Date.now(),
      valores,
      artes,
    }
    localStorage.setItem(CHAVE, JSON.stringify(rascunho))
  }, undefined)
}

export function lerRascunho(): Rascunho | null {
  return comSeguranca(() => {
    const bruto = localStorage.getItem(CHAVE)
    if (!bruto) return null

    const dados = JSON.parse(bruto) as Rascunho

    // Versão diferente significa formulário com outro formato: restaurar
    // produziria campos faltando ou sobrando.
    if (dados?.versao !== VERSAO) return null
    if (!dados.salvoEm || Date.now() - dados.salvoEm > VALIDADE_MS) return null

    // Conferência de forma: um JSON corrompido não pode virar crash na volta.
    if (!dados.valores || !Array.isArray(dados.valores.itens)) return null
    if (dados.valores.itens.length === 0) return null

    return { ...dados, artes: Array.isArray(dados.artes) ? dados.artes : [] }
  }, null)
}

export function limparRascunho(): void {
  comSeguranca(() => localStorage.removeItem(CHAVE), undefined)
}

/** True se o rascunho tem algo digitado além do estado inicial. */
export function rascunhoTemConteudo(rascunho: Rascunho): boolean {
  const { valores } = rascunho
  if (valores.cliente.trim() || valores.telefone.trim()) return true
  if (rascunho.artes.length > 0) return true
  return valores.itens.some((i) => i.peca || i.tecido || i.cor || i.tamanho)
}

// ---------------------------------------------------------------------------
//  Telefone da consulta
// ---------------------------------------------------------------------------

/**
 * Lembra o telefone usado no acompanhamento.
 *
 * Recarregar a página voltava para o campo vazio, e o cliente tinha que
 * digitar tudo de novo — parecia que tinha sido deslogado.
 */
export function salvarTelefoneConsulta(telefone: string): void {
  comSeguranca(() => localStorage.setItem(CHAVE_TELEFONE, telefone), undefined)
}

export function lerTelefoneConsulta(): string {
  return comSeguranca(() => localStorage.getItem(CHAVE_TELEFONE) ?? '', '')
}

export function limparTelefoneConsulta(): void {
  comSeguranca(() => localStorage.removeItem(CHAVE_TELEFONE), undefined)
}

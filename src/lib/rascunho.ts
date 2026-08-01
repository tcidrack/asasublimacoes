import type { FormularioPedido } from './schema'
import type { Catalogo } from '../types'

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
const CHAVE_CATALOGO = 'asa-catalogo'

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

// ---------------------------------------------------------------------------
//  Catálogo
// ---------------------------------------------------------------------------

/**
 * Guarda o catálogo da última visita para o formulário aparecer na hora.
 *
 * Buscar o catálogo do Apps Script leva alguns segundos, e nesse tempo a tela
 * fica só carregando. Com esta cópia o formulário abre imediatamente e o
 * catálogo novo substitui quando chega.
 *
 * ⚠️ O NONCE é removido antes de guardar. Ele é de uso único e vale 15 min;
 * restaurar um nonce velho faria o envio falhar com "sessão expirada". Quem
 * usa esta cópia precisa esperar o catálogo novo antes de enviar.
 */
const VALIDADE_CATALOGO_MS = 24 * 60 * 60 * 1000

interface CatalogoGuardado {
  versao: number
  salvoEm: number
  catalogo: Catalogo
}

export function salvarCatalogo(catalogo: Catalogo): void {
  comSeguranca(() => {
    const semNonce: Catalogo = { ...catalogo, nonce: '' }
    const pacote: CatalogoGuardado = {
      versao: VERSAO,
      salvoEm: Date.now(),
      catalogo: semNonce,
    }
    localStorage.setItem(CHAVE_CATALOGO, JSON.stringify(pacote))
  }, undefined)
}

/** Devolve o catálogo guardado, sempre com `nonce` vazio. */
export function lerCatalogoGuardado(): Catalogo | null {
  return comSeguranca(() => {
    const bruto = localStorage.getItem(CHAVE_CATALOGO)
    if (!bruto) return null

    const pacote = JSON.parse(bruto) as CatalogoGuardado
    if (pacote?.versao !== VERSAO) return null
    if (!pacote.salvoEm || Date.now() - pacote.salvoEm > VALIDADE_CATALOGO_MS) return null

    const { catalogo } = pacote
    // Conferência de forma: catálogo incompleto viraria crash lá na frente.
    if (!Array.isArray(catalogo?.pecas) || catalogo.pecas.length === 0) return null
    if (!Array.isArray(catalogo.posicoes)) return null
    if (!Array.isArray(catalogo.datasBloqueadas)) return null

    return { ...catalogo, nonce: '' }
  }, null)
}

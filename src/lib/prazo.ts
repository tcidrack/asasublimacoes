import type { DataBloqueada } from '../types'

/**
 * Regras de prazo de entrega.
 *
 * Espelha `validarPrazo` de `apps-script/WebApp.gs`. Aqui serve para o
 * calendário já não oferecer data impossível e para explicar o motivo na tela;
 * lá é o que realmente decide. Mexeu numa, mexa na outra.
 *
 * As datas circulam como "aaaa-mm-dd" e são comparadas como texto: no mesmo
 * formato, a ordem alfabética é a ordem cronológica, e isso evita a classe de
 * bug de fuso horário que aparece ao converter para Date e voltar.
 */

/** Hoje em "aaaa-mm-dd", no fuso de quem está usando. */
export function hojeISO(): string {
  const agora = new Date()
  const local = new Date(agora.getTime() - agora.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 10)
}

/** Primeira data que a loja consegue entregar. */
export function primeiraDataPossivel(prazoMinimoDias: number): string {
  const agora = new Date()
  agora.setHours(0, 0, 0, 0)
  agora.setDate(agora.getDate() + Math.max(0, Math.floor(prazoMinimoDias || 0)))

  const local = new Date(agora.getTime() - agora.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 10)
}

export function formatarDataBR(iso: string): string {
  const partes = String(iso).split('-')
  return partes.length === 3 ? `${partes[2]}/${partes[1]}/${partes[0]}` : String(iso)
}

/**
 * Devolve a mensagem de erro, ou `null` se a data serve.
 *
 * Prazo em branco é válido — informar a data desejada é opcional.
 */
export function erroDoPrazo(
  iso: string,
  prazoMinimoDias: number,
  datasBloqueadas: DataBloqueada[],
): string | null {
  if (!iso) return null

  const minimo = primeiraDataPossivel(prazoMinimoDias)
  if (iso < minimo) {
    return (
      `A loja precisa de ${prazoMinimoDias} dias para produzir. ` +
      `A entrega mais próxima é ${formatarDataBR(minimo)}.`
    )
  }

  const bloqueio = (datasBloqueadas ?? []).find(
    (b) => iso >= b.inicio && iso <= b.fim,
  )
  if (bloqueio) {
    // Dizer o motivo evita o cliente achar que o site quebrou.
    return bloqueio.motivo
      ? `A loja não entrega nesta data (${bloqueio.motivo}). Escolha outra.`
      : 'A loja não entrega nesta data. Escolha outra.'
  }

  return null
}

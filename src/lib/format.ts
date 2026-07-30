const moeda = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

export function formatBRL(centavos: number): string {
  const valor = Number.isFinite(centavos) ? centavos : 0
  return moeda.format(valor / 100)
}

export function formatarNumeroPedido(numero: number): string {
  return '#' + String(numero).padStart(4, '0')
}

/** (11) 91234-5678 — só pra exibição; o valor digitado é preservado. */
export function formatarTelefone(valor: string): string {
  const digitos = valor.replace(/\D/g, '').slice(0, 11)
  if (digitos.length <= 2) return digitos
  if (digitos.length <= 6) return `(${digitos.slice(0, 2)}) ${digitos.slice(2)}`
  if (digitos.length <= 10) {
    return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 6)}-${digitos.slice(6)}`
  }
  return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 7)}-${digitos.slice(7)}`
}

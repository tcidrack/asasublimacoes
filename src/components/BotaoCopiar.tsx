import { useEffect, useRef, useState } from 'react'

interface BotaoCopiarProps {
  texto: string
  rotulo: string
  rotuloCopiado?: string
  onCopiado?: () => void
  className?: string
}

/**
 * Copia um texto e dá retorno visual.
 *
 * O fallback com <textarea> não é exagero: navigator.clipboard só existe em
 * contexto seguro (HTTPS ou localhost). Testando pelo celular na rede local,
 * via http://192.168.x.x, ele é undefined — e sem o fallback o botão
 * simplesmente não faria nada, justamente no cenário de teste mais comum.
 */
export function BotaoCopiar({
  texto,
  rotulo,
  rotuloCopiado = 'Copiado!',
  onCopiado,
  className,
}: BotaoCopiarProps) {
  const [copiado, setCopiado] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => () => clearTimeout(timer.current), [])

  async function copiar() {
    let deuCerto = false

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(texto)
        deuCerto = true
      }
    } catch {
      // Permissão negada ou contexto inseguro: cai no fallback abaixo.
    }

    if (!deuCerto) {
      const area = document.createElement('textarea')
      area.value = texto
      area.setAttribute('readonly', '')
      area.style.position = 'fixed'
      area.style.opacity = '0'
      document.body.appendChild(area)
      area.select()
      try {
        deuCerto = document.execCommand('copy')
      } catch {
        deuCerto = false
      }
      document.body.removeChild(area)
    }

    if (deuCerto) {
      setCopiado(true)
      clearTimeout(timer.current)
      timer.current = setTimeout(() => setCopiado(false), 2500)
    }

    // Avisa mesmo se a cópia falhou: o cliente pode ter selecionado à mão, e
    // o que importa é liberar o próximo passo do fluxo.
    onCopiado?.()
  }

  return (
    <button type="button" onClick={copiar} className={className}>
      {copiado ? rotuloCopiado : rotulo}
    </button>
  )
}

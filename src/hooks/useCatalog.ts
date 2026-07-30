import { useCallback, useEffect, useState } from 'react'
import { buscarCatalogo } from '../lib/api'
import type { Catalogo } from '../types'

interface EstadoCatalogo {
  catalogo: Catalogo | null
  carregando: boolean
  erro: string | null
  recarregar: () => void
}

/**
 * Carrega o catálogo uma vez ao abrir a página. Como ele traz também o nonce
 * de envio, recarregar é o que devolve um nonce novo depois de um pedido.
 */
export function useCatalog(): EstadoCatalogo {
  const [catalogo, setCatalogo] = useState<Catalogo | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [tentativa, setTentativa] = useState(0)

  const recarregar = useCallback(() => setTentativa((n) => n + 1), [])

  useEffect(() => {
    let cancelado = false

    setCarregando(true)
    setErro(null)

    buscarCatalogo()
      .then((dados) => {
        if (cancelado) return
        setCatalogo(dados)
      })
      .catch((causa: unknown) => {
        if (cancelado) return
        setErro(causa instanceof Error ? causa.message : String(causa))
      })
      .finally(() => {
        if (!cancelado) setCarregando(false)
      })

    return () => {
      cancelado = true
    }
  }, [tentativa])

  return { catalogo, carregando, erro, recarregar }
}

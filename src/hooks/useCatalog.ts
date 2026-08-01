import { useCallback, useEffect, useState } from 'react'
import { buscarCatalogo } from '../lib/api'
import { lerCatalogoGuardado, salvarCatalogo } from '../lib/rascunho'
import type { Catalogo } from '../types'

interface EstadoCatalogo {
  catalogo: Catalogo | null
  carregando: boolean
  erro: string | null
  /**
   * True enquanto o que está na tela vem da visita anterior. Nesse estado o
   * `nonce` está vazio e o pedido ainda não pode ser enviado.
   */
  desatualizado: boolean
  recarregar: () => void
}

/**
 * Carrega o catálogo mostrando primeiro a cópia local.
 *
 * Buscar do Apps Script leva alguns segundos. Em vez de segurar a tela nesse
 * tempo, o formulário aparece com o catálogo da visita anterior e o atual
 * substitui quando chega.
 *
 * O catálogo também traz o nonce de envio, que é de uso único — por isso a
 * cópia local nunca o guarda, e `desatualizado` avisa quem for enviar.
 */
export function useCatalog(): EstadoCatalogo {
  const [catalogo, setCatalogo] = useState<Catalogo | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [desatualizado, setDesatualizado] = useState(false)
  const [tentativa, setTentativa] = useState(0)

  const recarregar = useCallback(() => setTentativa((n) => n + 1), [])

  useEffect(() => {
    let cancelado = false

    const guardado = lerCatalogoGuardado()
    if (guardado) {
      setCatalogo(guardado)
      setDesatualizado(true)
      setCarregando(false)
    } else {
      setCarregando(true)
    }
    setErro(null)

    buscarCatalogo()
      .then((dados) => {
        if (cancelado) return
        setCatalogo(dados)
        setDesatualizado(false)
        salvarCatalogo(dados)
      })
      .catch((causa: unknown) => {
        if (cancelado) return
        // Com cópia local na tela, o erro não pode apagar o que já está
        // visível — o cliente segue preenchendo, e o envio é que vai barrar.
        if (!guardado) {
          setErro(causa instanceof Error ? causa.message : String(causa))
        }
      })
      .finally(() => {
        if (!cancelado) setCarregando(false)
      })

    return () => {
      cancelado = true
    }
  }, [tentativa])

  return { catalogo, carregando, erro, desatualizado, recarregar }
}

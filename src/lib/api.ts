import {
  MODO_DEMO,
  catalogoDemo,
  consultarPedidosDemo,
  enviarPedidoDemo,
} from './demo'
import type {
  Catalogo,
  LogoEnviado,
  PayloadPedido,
  PedidoConsultado,
  RespostaPedido,
} from '../types'

const URL_WEBAPP = import.meta.env.VITE_APPS_SCRIPT_URL

function exigirUrl(): string {
  if (!URL_WEBAPP) {
    throw new Error(
      'A variável VITE_APPS_SCRIPT_URL não está definida. ' +
        'Copie .env.example para .env.local e cole a URL do seu Web App.',
    )
  }
  return URL_WEBAPP
}

/**
 * Lê a resposta do Apps Script.
 *
 * Quando a implantação está com o acesso errado ("Qualquer pessoa com conta
 * Google" em vez de "Qualquer pessoa"), o Google devolve uma página HTML de
 * login em vez de JSON. Sem este tratamento o erro que aparece é um
 * "Unexpected token '<'", que não ajuda ninguém.
 *
 * A mensagem inclui um trecho da resposta de propósito: sem ele, três causas
 * bem diferentes viram o mesmo texto genérico na tela.
 */
async function lerJson<T>(resposta: Response): Promise<T> {
  const texto = await resposta.text()

  let dados: unknown
  try {
    dados = JSON.parse(texto)
  } catch {
    // Não afirmar uma causa só. Já vi este erro sair de três motivos
    // diferentes, e apontar o dedo pro errado custa tempo de diagnóstico:
    //   - implantação apagada ou URL antiga  -> página 404 do Google
    //   - acesso "Qualquer pessoa com conta Google" -> página de login
    //   - erro do script antes do doPost      -> página de erro
    // O trecho da resposta e o status distinguem os três na hora.
    const inicio = texto.trim().slice(0, 120).replace(/\s+/g, ' ')
    const ehLogin = /accounts\.google\.com|fazer login|sign in/i.test(texto)
    const ehNaoEncontrado = resposta.status === 404 || /não encontrad|not found/i.test(texto)

    let pista: string
    if (ehNaoEncontrado) {
      pista =
        'Parece que a implantação não existe mais. Se você apagou ou recriou, ' +
        'atualize VITE_APPS_SCRIPT_URL no .env.local e recarregue a página.'
    } else if (ehLogin) {
      pista =
        'O Google devolveu uma tela de login. Republique com ' +
        '"Quem pode acessar: Qualquer pessoa" (e não "com conta Google").'
    } else {
      pista =
        'Se a página estava aberta antes de trocar a URL, recarregue com ' +
        'Ctrl+Shift+R — a URL antiga fica presa no que já foi carregado.'
    }

    throw new Error(
      `O servidor respondeu algo que não é JSON (HTTP ${resposta.status}). ` +
        `${pista}\n\nResposta recebida: ${inicio || '(vazia)'}`,
    )
  }

  const corpo = dados as { ok?: boolean; erro?: string }
  if (!corpo?.ok) {
    throw new Error(corpo?.erro || 'O servidor recusou a requisição.')
  }
  return dados as T
}

function erroDeRede(causa: unknown): Error {
  if (causa instanceof TypeError) {
    return new Error(
      'Não foi possível falar com o servidor. Verifique sua conexão e se a ' +
        'URL do Web App está correta.',
    )
  }
  return causa instanceof Error ? causa : new Error(String(causa))
}

export async function buscarCatalogo(): Promise<Catalogo> {
  if (MODO_DEMO) return catalogoDemo

  try {
    const resposta = await fetch(`${exigirUrl()}?action=catalogo`, {
      method: 'GET',
      redirect: 'follow',
    })
    return exigirCatalogoCompleto(await lerJson<Catalogo>(resposta))
  } catch (causa) {
    throw erroDeRede(causa)
  }
}

/**
 * Confere se o catálogo veio completo.
 *
 * Quando o site ganha um campo novo (foi o caso das cores) e a planilha ainda
 * está com os `.gs` antigos, a resposta chega sem aquela lista. Sem esta
 * checagem o app quebraria com tela branca lá na frente, num `.map` de
 * `undefined` — um erro que não diz nada a quem está usando.
 */
function exigirCatalogoCompleto(dados: Catalogo): Catalogo {
  const listas: Array<[string, unknown]> = [
    ['peças', dados.pecas],
    ['tecidos', dados.tecidos],
    ['tamanhos', dados.tamanhos],
    ['cores', dados.cores],
    ['posições de estampa', dados.posicoes],
  ]

  const faltando = listas
    .filter(([, valor]) => !Array.isArray(valor) || valor.length === 0)
    .map(([nome]) => nome)

  if (faltando.length > 0) {
    throw new Error(
      `O catálogo veio sem: ${faltando.join(', ')}. ` +
        'A planilha está com uma versão antiga do código: atualize os ' +
        'arquivos .gs, rode configurarPlanilha e publique uma NOVA VERSÃO ' +
        'da implantação (pelo lápis, trocando o campo "Versão").',
    )
  }

  // Sem isto, `datasBloqueadas` indefinido só quebraria mais tarde, dentro da
  // validação do prazo -- longe da causa.
  if (!Array.isArray(dados.datasBloqueadas)) {
    dados.datasBloqueadas = []
  }

  return dados
}

/**
 * Busca os pedidos de um telefone.
 *
 * Telefone, e não número do pedido: a numeração recomeça quando o dono limpa
 * os pedidos já entregues da planilha, então ela não identifica ninguém ao
 * longo do tempo.
 */
export async function consultarPedidos(telefone: string): Promise<PedidoConsultado[]> {
  const digitos = telefone.replace(/\D/g, '')

  if (digitos.length < 10) {
    throw new Error('Informe o telefone completo, com DDD.')
  }

  if (MODO_DEMO) return consultarPedidosDemo(digitos)

  try {
    const resposta = await fetch(
      `${exigirUrl()}?action=consulta&telefone=${encodeURIComponent(digitos)}`,
      { method: 'GET', redirect: 'follow' },
    )
    const dados = await lerJson<{ pedidos: PedidoConsultado[] }>(resposta)
    return dados.pedidos ?? []
  } catch (causa) {
    throw erroDeRede(causa)
  }
}

export async function enviarPedido(payload: PayloadPedido): Promise<RespostaPedido> {
  if (MODO_DEMO) return enviarPedidoDemo(payload)

  try {
    const resposta = await fetch(exigirUrl(), {
      method: 'POST',
      // NÃO troque para application/json.
      //
      // O Apps Script não responde a requisições OPTIONS. Com um content-type
      // "não simples" o navegador dispara um preflight, o Google não responde,
      // e o envio morre com "Failed to fetch" sem nenhuma pista no console.
      // Com text/plain a chamada vira uma "simple request": sem preflight.
      // O corpo continua sendo JSON — o Apps Script faz JSON.parse nele.
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
      // O Apps Script responde 302 apontando pro googleusercontent.com.
      redirect: 'follow',
    })
    return await lerJson<RespostaPedido>(resposta)
  } catch (causa) {
    throw erroDeRede(causa)
  }
}

export const MAX_BYTES_LOGO = 5 * 1024 * 1024

export const MIMES_LOGO = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'application/pdf',
] as const

/** Converte o arquivo escolhido para base64, que é como o Apps Script recebe. */
export function lerArquivoComoBase64(arquivo: File): Promise<LogoEnviado> {
  if (arquivo.size > MAX_BYTES_LOGO) {
    return Promise.reject(new Error('O arquivo passa de 5 MB. Envie um menor.'))
  }
  if (!MIMES_LOGO.includes(arquivo.type as (typeof MIMES_LOGO)[number])) {
    return Promise.reject(new Error('Formato não aceito. Use PNG, JPG, WEBP ou PDF.'))
  }

  return new Promise((resolver, rejeitar) => {
    const leitor = new FileReader()
    leitor.onerror = () => rejeitar(new Error('Não foi possível ler o arquivo.'))
    leitor.onload = () => {
      const resultado = String(leitor.result)
      // data:image/png;base64,AAAA...  -> queremos só o que vem depois da vírgula
      const separador = resultado.indexOf(',')
      resolver({
        nomeArquivo: arquivo.name,
        mimeType: arquivo.type,
        dadosBase64: separador >= 0 ? resultado.slice(separador + 1) : resultado,
      })
    }
    leitor.readAsDataURL(arquivo)
  })
}

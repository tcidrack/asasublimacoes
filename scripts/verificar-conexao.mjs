#!/usr/bin/env node
/**
 * Diagnóstico da conexão com o Apps Script.
 *
 *   npm run verificar
 *
 * Em vez de você caçar o problema no console do navegador, isto chama o
 * endpoint e diz exatamente o que está errado e como resolver.
 *
 * ⚠️ LIMITE: roda no Node, então NÃO testa CORS — só o navegador dispara
 * preflight. O que ele pega é a causa mais comum por trás do "Failed to fetch":
 * a implantação publicada como "Qualquer pessoa com conta Google", que devolve
 * uma página HTML de login em vez de JSON. Passar aqui não substitui enviar um
 * pedido de verdade pelo navegador.
 */

import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..')

const VERDE = '\x1b[32m'
const VERMELHO = '\x1b[31m'
const AMARELO = '\x1b[33m'
const CINZA = '\x1b[90m'
const NEGRITO = '\x1b[1m'
const RESET = '\x1b[0m'

function ok(mensagem, detalhe) {
  console.log(`${VERDE}✓${RESET} ${mensagem}${detalhe ? ` ${CINZA}${detalhe}${RESET}` : ''}`)
}

function aviso(mensagem) {
  console.log(`${AMARELO}!${RESET} ${mensagem}`)
}

function falhar(titulo, ...comoResolver) {
  console.log(`${VERMELHO}✗ ${titulo}${RESET}`)
  if (comoResolver.length > 0) {
    console.log()
    for (const linha of comoResolver) console.log(`  ${linha}`)
  }
  console.log()
  process.exit(1)
}

/** Parser mínimo de .env — evita depender do dotenv só pra isso. */
function lerVariavel(texto, nome) {
  for (const linha of texto.split('\n')) {
    const limpa = linha.trim()
    if (!limpa || limpa.startsWith('#')) continue

    const igual = limpa.indexOf('=')
    if (igual < 0) continue
    if (limpa.slice(0, igual).trim() !== nome) continue

    return limpa
      .slice(igual + 1)
      .trim()
      .replace(/^["']|["']$/g, '')
  }
  return ''
}

console.log(`\n${NEGRITO}Verificando a conexão com o Apps Script${RESET}\n`)

// ---------------------------------------------------------------------------
// 1. O arquivo .env.local existe?
// ---------------------------------------------------------------------------
let envLocal
try {
  envLocal = await readFile(join(RAIZ, '.env.local'), 'utf8')
} catch {
  falhar(
    'Não existe .env.local',
    'Crie a partir do exemplo:',
    `${CINZA}cp .env.example .env.local${RESET}`,
    '',
    'Depois cole a URL do Web App em VITE_APPS_SCRIPT_URL.',
  )
}
ok('.env.local encontrado')

// ---------------------------------------------------------------------------
// 2. A variável está preenchida e com cara de URL de implantação?
// ---------------------------------------------------------------------------
const url = lerVariavel(envLocal, 'VITE_APPS_SCRIPT_URL')

if (!url || url.includes('SEU_ID_DE_IMPLANTACAO')) {
  falhar(
    'VITE_APPS_SCRIPT_URL não está preenchida',
    'No editor do Apps Script: Implantar > Gerenciar implantações',
    'e copie a "URL do app da Web" (termina em /exec).',
  )
}

if (url.endsWith('/dev')) {
  falhar(
    'A URL termina em /dev, e precisa terminar em /exec',
    'A URL /dev só funciona pra quem está logado na conta dona do script —',
    'seus clientes veriam uma tela de login.',
    '',
    'Pegue a URL de implantação em: Implantar > Gerenciar implantações.',
  )
}

if (!/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(url)) {
  aviso('A URL não tem o formato esperado (https://script.google.com/macros/s/.../exec)')
  console.log(`  ${CINZA}${url}${RESET}`)
  console.log(`  ${CINZA}Vou tentar mesmo assim.${RESET}`)
} else {
  ok('URL com formato válido')
}

// ---------------------------------------------------------------------------
// 3. O endpoint responde?
// ---------------------------------------------------------------------------
const inicio = Date.now()
let resposta
try {
  resposta = await fetch(`${url}?action=catalogo`, { redirect: 'follow' })
} catch (causa) {
  falhar(
    'Não foi possível alcançar a URL',
    String(causa?.message ?? causa),
    '',
    'Confira sua conexão e se a URL foi copiada por inteiro.',
  )
}
const duracao = Date.now() - inicio

if (!resposta.ok) {
  falhar(
    `O servidor respondeu HTTP ${resposta.status}`,
    resposta.status === 403 || resposta.status === 401
      ? 'Parece falta de permissão: republique com "Quem pode acessar: Qualquer pessoa".'
      : 'Confira se a implantação ainda existe em Gerenciar implantações.',
  )
}
ok('Endpoint respondeu', `HTTP ${resposta.status} em ${duracao}ms`)

// ---------------------------------------------------------------------------
// 4. Veio JSON ou a página de login? (a falha mais comum)
// ---------------------------------------------------------------------------
const corpo = await resposta.text()

if (corpo.trimStart().startsWith('<')) {
  falhar(
    'O servidor devolveu HTML em vez de JSON',
    `${NEGRITO}Quase certamente a implantação está com o acesso errado.${RESET}`,
    '',
    'No editor: Implantar > Gerenciar implantações > ícone de lápis, e deixe:',
    `  ${NEGRITO}Executar como.......: Eu${RESET}`,
    `  ${NEGRITO}Quem pode acessar...: Qualquer pessoa${RESET}`,
    '',
    'Tem que ser "Qualquer pessoa" — e NÃO "Qualquer pessoa com conta Google".',
    'Com a segunda opção o Google devolve esta página de login, e no navegador',
    'o sintoma vira um "Failed to fetch" sem explicação.',
  )
}

let dados
try {
  dados = JSON.parse(corpo)
} catch {
  falhar(
    'A resposta não é JSON válido',
    `${CINZA}${corpo.slice(0, 200)}${RESET}`,
  )
}
ok('Resposta é JSON')

if (!dados.ok) {
  falhar(
    'O Apps Script recusou a requisição',
    String(dados.erro ?? 'sem detalhe'),
    '',
    'Se a mensagem fala de aba inexistente, rode configurarPlanilha() no editor.',
  )
}
ok('Apps Script respondeu ok')

// ---------------------------------------------------------------------------
// 5. O catálogo veio com conteúdo?
// ---------------------------------------------------------------------------
const pecas = dados.pecas ?? []
const tecidos = dados.tecidos ?? []
const tamanhos = dados.tamanhos ?? []
const cores = dados.cores ?? []
const precos = dados.precos ?? {}

const combinacoes = Object.values(precos).reduce(
  (total, porTecido) => total + Object.keys(porTecido ?? {}).length,
  0,
)

if (pecas.length === 0 || tecidos.length === 0 || tamanhos.length === 0) {
  falhar(
    'O catálogo voltou vazio',
    'A planilha existe mas está sem dados. No editor do Apps Script,',
    `selecione a função ${NEGRITO}configurarPlanilha${RESET} e clique em Executar.`,
    '',
    'Se já rodou: confira se a coluna "Ativo" está marcada nas abas',
    'Peças, Tecidos e Tamanhos.',
  )
}

ok(`${pecas.length} peças`, pecas.map((p) => p.nome).join(', '))
ok(`${tecidos.length} tecidos`, tecidos.map((t) => t.nome).join(', '))
ok(`${tamanhos.length} tamanhos`, tamanhos.map((t) => t.rotulo).join(', '))

// A aba Cores é mais nova que as outras: se a planilha ainda está com os .gs
// antigos, tudo acima passa e só isto denuncia que falta atualizar.
if (cores.length === 0) {
  falhar(
    'O catálogo veio sem as cores',
    'A planilha ainda está com a versão antiga do código.',
    '',
    `1. Recole os 4 arquivos ${CINZA}.gs${RESET} no editor do Apps Script`,
    `2. Rode ${NEGRITO}configurarPlanilha${RESET} (cria a aba Cores)`,
    '3. Implantar > Gerenciar implantações > lápis > Versão: Nova versão',
  )
}
ok(`${cores.length} cores`, cores.map((c) => c.nome).join(', '))

if (combinacoes === 0) {
  falhar(
    'Nenhum preço cadastrado',
    'A aba Preços está vazia. Sem preço, o cliente não consegue montar pedido.',
  )
}
ok(`${combinacoes} combinações de peça × tecido com preço`)

if (!dados.nonce) {
  falhar(
    'A resposta não trouxe o nonce',
    'O envio de pedido vai falhar. Confira se o WebApp.gs subiu por inteiro',
    `${CINZA}(npm run gs:push)${RESET}.`,
  )
}
ok('Nonce de envio recebido')

// ---------------------------------------------------------------------------
console.log(`\n${VERDE}${NEGRITO}Conexão funcionando.${RESET}`)
console.log(
  `${CINZA}Lembrando: isto não testa CORS. O teste definitivo é enviar um` +
    ` pedido de verdade pelo navegador.${RESET}\n`,
)

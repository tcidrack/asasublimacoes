/**
 * Constantes e funcoes compartilhadas pelos outros arquivos.
 *
 * Se voce renomear uma aba na planilha, mude aqui tambem -- e o unico lugar
 * onde os nomes aparecem.
 */

const ABAS = {
  PECAS: 'Peças',
  TECIDOS: 'Tecidos',
  TAMANHOS: 'Tamanhos',
  CORES: 'Cores',
  POSICOES: 'Posições',
  PRECOS: 'Preços',
  AGENDA: 'Agenda',
  PEDIDOS: 'Pedidos',
  ITENS: 'Itens',
  ARTES: 'Artes',
  GRADE: 'Grade',
  ORDEM: 'Ordem de Produção',
};

/**
 * Colunas da aba Pedidos (1 = coluna A).
 *
 * As antigas LOGO e POSICAO sairam: um pedido pode ter varias artes, cada uma
 * com sua posicao, entao elas viraram a aba Artes. Aqui ficou so um resumo
 * legivel, tipo "Peito esquerdo, Costas".
 */
const COL_PEDIDO = {
  NUMERO: 1,
  DATA: 2,
  CLIENTE: 3,
  TELEFONE: 4,
  EMPRESA: 5,
  PRAZO: 6,
  ARTES: 7,
  OBSERVACOES: 8,
  TOTAL: 9,
  ENTRADA: 10,
  SALDO: 11,
  STATUS: 12,
  ENTRADA_PAGA_EM: 13,
  SALDO_PAGO_EM: 14,
};

const CABECALHO_PEDIDOS = [
  'Nº', 'Data', 'Cliente', 'Telefone', 'Empresa', 'Prazo desejado',
  'Artes', 'Observações',
  'Total', 'Entrada (50%)', 'Saldo a receber',
  'Status', 'Entrada paga em', 'Saldo pago em',
];

/** Colunas da aba Artes (1 = coluna A). Uma linha por arte do pedido. */
const COL_ARTE = {
  NUMERO_PEDIDO: 1,
  POSICAO: 2,
  ARQUIVO: 3,
  OBSERVACAO: 4,
};

const CABECALHO_ARTES = [
  'Nº do pedido', 'Posição', 'Arquivo', 'Observação',
];

/** Colunas da aba Itens (1 = coluna A). */
const COL_ITEM = {
  NUMERO_PEDIDO: 1,
  PECA: 2,
  TECIDO: 3,
  COR: 4,
  GENERO: 5,
  TAMANHO: 6,
  QUANTIDADE: 7,
  NOME_BORDADO: 8,
  UNITARIO: 9,
  SUBTOTAL: 10,
};

const CABECALHO_ITENS = [
  'Nº do pedido', 'Peça', 'Tecido', 'Cor', 'Gênero', 'Tamanho',
  'Qtd', 'Nome bordado', 'Valor unitário', 'Subtotal',
];

const STATUS = {
  AGUARDANDO: 'Aguardando pagamento',
  PAGO_50: 'Pago 50%',
  EM_PRODUCAO: 'Em produção',
  PRONTO: 'Pronto',
  ENTREGUE: 'Entregue',
  CANCELADO: 'Cancelado',
};

const LISTA_STATUS = [
  STATUS.AGUARDANDO, STATUS.PAGO_50, STATUS.EM_PRODUCAO,
  STATUS.PRONTO, STATUS.ENTREGUE, STATUS.CANCELADO,
];

const GENEROS = ['masculino', 'feminino', 'unissex'];

const FORMATO_MOEDA = 'R$ #,##0.00';
const FORMATO_DATA = 'dd/mm/yyyy';
const FORMATO_DATA_HORA = 'dd/mm/yyyy hh:mm';

/**
 * Mostra o numero do pedido com 4 digitos (1 vira 0001), igual o cliente ve
 * no site.
 *
 * Repare que isto e FORMATO DE EXIBICAO, nao o valor. A celula continua
 * guardando o numero 1. Se fosse gravado como texto "0001", quebraria tudo
 * que compara numero: a busca do pedido no menu, os SUMIFS da aba Grade e o
 * calculo do proximo numero sequencial.
 */
const FORMATO_NUMERO_PEDIDO = '0000';

/** Mesma coisa, para quando o numero entra no meio de um texto. */
function formatarNumeroPedido(numero) {
  return String(Number(numero) || 0).padStart(4, '0');
}

/** Pastas do Drive criadas automaticamente na primeira vez que sao usadas. */
const PASTA_LOGOS = 'Logos de Pedidos';
const PASTA_ORDENS = 'Ordens de Produção';

// ---------------------------------------------------------------------------
//  Dinheiro
//
//  Toda a conta acontece em CENTAVOS (inteiro). Float com dinheiro erra:
//  0.1 + 0.2 === 0.30000000000000004. Na planilha grava-se em reais, porque
//  e o que o dono precisa ler.
// ---------------------------------------------------------------------------

function reaisParaCentavos(reais) {
  const n = Number(reais);
  if (!isFinite(n) || n < 0) return 0;
  return Math.round(n * 100);
}

function centavosParaReais(centavos) {
  return Math.round(centavos) / 100;
}

/** Metade arredondada pra cima: a entrada nunca fica 1 centavo menor. */
function metadeArredondadaPraCima(centavos) {
  return Math.ceil(centavos / 2);
}

/**
 * 1 -> "A", 27 -> "AA".
 *
 * Serve pra montar formula a partir das constantes COL_*, em vez de escrever
 * a letra na mao. Assim, mover uma coluna nao deixa uma formula apontando
 * silenciosamente pro lugar errado.
 */
function letraDaColuna(indice) {
  let letra = '';
  let n = Number(indice);
  while (n > 0) {
    const resto = (n - 1) % 26;
    letra = String.fromCharCode(65 + resto) + letra;
    n = Math.floor((n - 1) / 26);
  }
  return letra;
}

/**
 * Descobre se esta planilha separa argumentos de funcao por virgula ou por
 * ponto-e-virgula.
 *
 * Formula no Sheets segue o idioma da planilha: em pt-BR e =SOMA(1;2), em
 * en-US e =SUM(1,2). O setFormula() do Apps Script NAO traduz -- mandar
 * virgula pra uma planilha em portugues resulta em #ERROR! (erro de parse).
 *
 * Em vez de manter uma tabela de idiomas (que envelhece mal), a deteccao e
 * empirica: escreve =SUM(1,2) numa aba temporaria e ve se deu 3. O resultado
 * fica guardado, entao isso roda uma vez so.
 *
 * Nao chame isto de dentro do doPost: criar e apagar aba durante um envio
 * concorrente e pedir problema. As formulas gravadas por pedido foram escritas
 * sem separador nenhum justamente por isso.
 */
function separadorDeArgumentos() {
  const props = PropertiesService.getScriptProperties();
  const salvo = props.getProperty('SEPARADOR_FORMULA');
  if (salvo) return salvo;

  const ss = planilha();
  const nomeTemp = '~detectando separador';
  let temp = ss.getSheetByName(nomeTemp);
  if (temp) ss.deleteSheet(temp);
  temp = ss.insertSheet(nomeTemp);

  let separador = ',';
  try {
    temp.getRange('A1').setFormula('=SUM(1,2)');
    SpreadsheetApp.flush();
    if (temp.getRange('A1').getValue() !== 3) separador = ';';
  } catch (erro) {
    separador = ';';
  } finally {
    ss.deleteSheet(temp);
  }

  props.setProperty('SEPARADOR_FORMULA', separador);
  return separador;
}

// ---------------------------------------------------------------------------
//  Acesso as abas
// ---------------------------------------------------------------------------

function planilha() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

function aba(nome) {
  const sheet = planilha().getSheetByName(nome);
  if (!sheet) {
    throw new Error(
      'A aba "' + nome + '" não existe. Rode a função configurarPlanilha() ' +
      'uma vez pelo editor do Apps Script.'
    );
  }
  return sheet;
}

/**
 * Le uma aba inteira sem o cabecalho. Devolve [] se so houver cabecalho.
 *
 * getDataRange() faz UMA ida ao Sheets. A versao anterior fazia tres --
 * getLastRow, getLastColumn e getValues -- e como o catalogo percorre sete
 * abas, isso sozinho passava de vinte chamadas com latencia cada.
 */
function lerLinhas(sheet) {
  const dados = sheet.getDataRange().getValues();
  return dados.length < 2 ? [] : dados.slice(1);
}

/**
 * Formula da coluna "Saldo a receber" de uma linha da aba Pedidos.
 *
 * Repare que nao ha NENHUMA chamada de funcao aqui -- so aritmetica. Foi de
 * proposito: sem argumento, nao existe separador, e a formula funciona igual
 * em planilha portuguesa ou americana.
 *
 * O truque e que (N2<>"") vale TRUE ou FALSE, e multiplicar converte pra 1
 * ou 0. Entao:
 *   nada pago .............: total - 0 - 0            = total
 *   entrada paga ..........: total - entrada - 0      = saldo final
 *   entrada e saldo pagos .: total - entrada - resto  = 0
 */
function formulaDoSaldo(linha) {
  const total = letraDaColuna(COL_PEDIDO.TOTAL) + linha;
  const entrada = letraDaColuna(COL_PEDIDO.ENTRADA) + linha;
  const entradaPagaEm = letraDaColuna(COL_PEDIDO.ENTRADA_PAGA_EM) + linha;
  const saldoPagoEm = letraDaColuna(COL_PEDIDO.SALDO_PAGO_EM) + linha;

  return '=' + total +
    '-(' + entradaPagaEm + '<>"")*' + entrada +
    '-(' + saldoPagoEm + '<>"")*(' + total + '-' + entrada + ')';
}

// ---------------------------------------------------------------------------
//  Catalogo
// ---------------------------------------------------------------------------

/**
 * Le pecas, tecidos, tamanhos e a matriz de precos.
 *
 * E a UNICA fonte de preco do sistema. O WebApp usa isso pra recalcular todo
 * pedido que chega, ignorando qualquer valor que o navegador tenha mandado.
 */
const CHAVE_CACHE_CATALOGO = 'catalogo_v1';
const CACHE_CATALOGO_SEGUNDOS = 300; // 5 minutos

/** Limite por chave do CacheService. Acima disso o put() e ignorado. */
const LIMITE_CACHE_BYTES = 100 * 1024;

/**
 * Catalogo com cache de 5 minutos.
 *
 * Ler as sete abas leva ~8 segundos, e isso era pago DUAS vezes por pedido:
 * ao abrir a pagina e de novo no envio, para recalcular o preco. Com o cache,
 * as duas coisas caem pro piso do Apps Script.
 *
 * O mesmo cache alimenta a exibicao e o calculo do que sera cobrado, entao o
 * que o cliente ve e o que e gravado continuam vindo da mesma fonte.
 *
 * ATENCAO: o nonce NAO passa por aqui. Ele e de uso unico -- se entrasse no
 * cache, todo cliente receberia o mesmo e o segundo envio falharia. Quem o
 * adiciona e o doGet, depois desta funcao retornar.
 */
function lerCatalogo() {
  const cache = CacheService.getScriptCache();

  const guardado = cache.get(CHAVE_CACHE_CATALOGO);
  if (guardado) {
    try {
      return JSON.parse(guardado);
    } catch (erro) {
      // Cache corrompido nao pode derrubar o pedido: segue pra planilha.
    }
  }

  const catalogo = lerCatalogoDaPlanilha();

  try {
    const serializado = JSON.stringify(catalogo);
    if (serializado.length < LIMITE_CACHE_BYTES) {
      cache.put(CHAVE_CACHE_CATALOGO, serializado, CACHE_CATALOGO_SEGUNDOS);
    }
  } catch (erro) {
    // Sem cache o sistema so fica mais lento, nunca quebrado.
  }

  return catalogo;
}

/**
 * Apaga o cache para que uma alteracao de preco valha na hora.
 * Chamado pelo menu e por tudo que mexe no catalogo.
 */
function limparCacheDoCatalogo() {
  try {
    CacheService.getScriptCache().remove(CHAVE_CACHE_CATALOGO);
  } catch (erro) {
    // Nada a fazer: o cache expira sozinho em 5 minutos.
  }
}

function lerCatalogoDaPlanilha() {
  const pecas = lerLinhas(aba(ABAS.PECAS))
    .filter(function (l) { return String(l[0]).trim() !== '' && l[1] === true; })
    .map(function (l) { return { nome: String(l[0]).trim(), ordem: Number(l[2]) || 0 }; })
    .sort(function (a, b) { return a.ordem - b.ordem; });

  const tecidos = lerLinhas(aba(ABAS.TECIDOS))
    .filter(function (l) { return String(l[0]).trim() !== '' && l[2] === true; })
    .map(function (l) {
      return {
        nome: String(l[0]).trim(),
        descricao: String(l[1] || '').trim(),
        ordem: Number(l[3]) || 0,
      };
    })
    .sort(function (a, b) { return a.ordem - b.ordem; });

  const tamanhos = lerLinhas(aba(ABAS.TAMANHOS))
    .filter(function (l) { return String(l[0]).trim() !== '' && l[2] === true; })
    .map(function (l) {
      return {
        rotulo: String(l[0]).trim(),
        acrescimoCentavos: reaisParaCentavos(l[1]),
        ordem: Number(l[3]) || 0,
      };
    })
    .sort(function (a, b) { return a.ordem - b.ordem; });

  const cores = lerLinhas(aba(ABAS.CORES))
    .filter(function (l) { return String(l[0]).trim() !== '' && l[1] === true; })
    .map(function (l) { return { nome: String(l[0]).trim(), ordem: Number(l[2]) || 0 }; })
    .sort(function (a, b) { return a.ordem - b.ordem; });

  const posicoes = lerLinhas(aba(ABAS.POSICOES))
    .filter(function (l) { return String(l[0]).trim() !== '' && l[1] === true; })
    .map(function (l) { return { nome: String(l[0]).trim(), ordem: Number(l[2]) || 0 }; })
    .sort(function (a, b) { return a.ordem - b.ordem; });

  const agenda = lerAgenda();

  return {
    pecas: pecas,
    tecidos: tecidos,
    tamanhos: tamanhos,
    cores: cores,
    posicoes: posicoes,
    precos: lerMatrizPrecos(),
    prazoMinimoDias: agenda.prazoMinimoDias,
    datasBloqueadas: agenda.datasBloqueadas,
  };
}

/**
 * Le a aba Agenda: quanto tempo a loja precisa para produzir e quais periodos
 * ela nao consegue atender.
 *
 * B1 guarda o prazo minimo em dias. Da linha 4 pra baixo ficam os bloqueios,
 * em (de, ate, motivo).
 */
function lerAgenda() {
  const sheet = aba(ABAS.AGENDA);

  const prazo = Number(sheet.getRange('B1').getValue());
  const prazoMinimoDias = isFinite(prazo) && prazo >= 0 ? Math.floor(prazo) : 0;

  const ultimaLinha = sheet.getLastRow();
  const datasBloqueadas = [];

  if (ultimaLinha >= 4) {
    const linhas = sheet.getRange(4, 1, ultimaLinha - 3, 3).getValues();
    for (let i = 0; i < linhas.length; i++) {
      const inicio = paraDataISO(linhas[i][0]);
      if (!inicio) continue;
      // Sem data final, o bloqueio vale so pelo dia de inicio.
      const fim = paraDataISO(linhas[i][1]) || inicio;
      datasBloqueadas.push({
        inicio: inicio,
        fim: fim,
        motivo: String(linhas[i][2] || '').trim(),
      });
    }
  }

  return { prazoMinimoDias: prazoMinimoDias, datasBloqueadas: datasBloqueadas };
}

/** Data da planilha -> "aaaa-mm-dd". Devolve '' se a celula nao for data. */
function paraDataISO(valor) {
  if (!valor) return '';
  if (Object.prototype.toString.call(valor) !== '[object Date]') return '';
  if (isNaN(valor.getTime())) return '';
  return Utilities.formatDate(valor, 'America/Sao_Paulo', 'yyyy-MM-dd');
}

/**
 * Reduz o telefone aos digitos, para comparar.
 *
 * A planilha guarda "(85) 98405-8583" e o cliente pode consultar digitando
 * "85984058583" ou "85 9 8405-8583". Sem normalizar, a consulta nunca acha.
 */
function somenteDigitos(valor) {
  return String(valor === null || valor === undefined ? '' : valor).replace(/\D/g, '');
}

/**
 * Le a aba Preços e devolve { "Camiseta": { "Dry-fit": 4500, ... }, ... }
 * em centavos. Celula vazia significa "essa combinacao nao e oferecida".
 */
function lerMatrizPrecos() {
  const valores = aba(ABAS.PRECOS).getDataRange().getValues();
  if (valores.length < 2 || valores[0].length < 2) return {};

  const nomesTecidos = valores[0].slice(1).map(function (v) { return String(v).trim(); });

  const matriz = {};
  for (let i = 1; i < valores.length; i++) {
    const nomePeca = String(valores[i][0]).trim();
    if (!nomePeca) continue;

    const linha = {};
    for (let j = 0; j < nomesTecidos.length; j++) {
      const nomeTecido = nomesTecidos[j];
      const celula = valores[i][j + 1];
      if (!nomeTecido || celula === '' || celula === null) continue;

      const centavos = reaisParaCentavos(celula);
      if (centavos > 0) linha[nomeTecido] = centavos;
    }
    matriz[nomePeca] = linha;
  }
  return matriz;
}

/**
 * O backend do formulario publico.
 *
 *   GET  ?action=catalogo  -> pecas, tecidos, tamanhos, matriz de precos e um nonce
 *   POST (corpo JSON)      -> grava o pedido e devolve numero, total e entrada
 *
 * REGRA QUE NAO SE QUEBRA: o preco NUNCA vem do navegador. O que o cliente
 * manda de valor e ignorado; tudo e recalculado aqui a partir da aba Preços.
 * O calculo que o site faz serve so pra mostrar o valor na tela enquanto a
 * pessoa preenche.
 */

const MAX_LINHAS_POR_PEDIDO = 200;
const MAX_QTD_POR_LINHA = 5000;
const MAX_BYTES_LOGO = 5 * 1024 * 1024; // 5 MB
const MIMES_LOGO_PERMITIDOS = [
  'image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'application/pdf',
];
const VALIDADE_NONCE_SEGUNDOS = 900; // 15 min pra preencher o formulario

// ---------------------------------------------------------------------------
//  Entradas HTTP
// ---------------------------------------------------------------------------

function doGet(e) {
  try {
    const acao = (e && e.parameter && e.parameter.action) || '';

    if (acao === 'catalogo') {
      const catalogo = lerCatalogo();
      catalogo.nonce = gerarNonce();
      catalogo.ok = true;
      return respostaJson(catalogo);
    }

    if (acao === 'consulta') {
      const telefone = (e.parameter && e.parameter.telefone) || '';
      return respostaJson({ ok: true, pedidos: consultarPedidosPorTelefone(telefone) });
    }

    return respostaJson({
      ok: true,
      mensagem: 'Web app do sistema de pedidos está no ar. Use ?action=catalogo.',
    });
  } catch (erro) {
    return respostaJson({ ok: false, erro: String(erro && erro.message || erro) });
  }
}

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      throw new Error('Requisição sem corpo.');
    }

    const payload = JSON.parse(e.postData.contents);
    const resultado = registrarPedido(payload);
    return respostaJson(Object.assign({ ok: true }, resultado));
  } catch (erro) {
    return respostaJson({ ok: false, erro: String(erro && erro.message || erro) });
  }
}

/**
 * Apps Script nao deixa definir cabecalhos de CORS. Funciona mesmo assim
 * porque o site faz uma "simple request" (Content-Type: text/plain), que nao
 * dispara preflight -- ver src/lib/api.ts.
 */
function respostaJson(objeto) {
  return ContentService
    .createTextOutput(JSON.stringify(objeto))
    .setMimeType(ContentService.MimeType.JSON);
}

// ---------------------------------------------------------------------------
//  Nonce: corta o bot que simplesmente repete o mesmo POST
// ---------------------------------------------------------------------------

function gerarNonce() {
  const nonce = Utilities.getUuid();
  CacheService.getScriptCache().put('nonce_' + nonce, '1', VALIDADE_NONCE_SEGUNDOS);
  return nonce;
}

/** Consome o nonce. Um nonce so vale uma vez. */
function validarNonce(nonce) {
  if (!nonce) throw new Error('Sessão inválida. Recarregue a página e tente de novo.');

  const cache = CacheService.getScriptCache();
  const chave = 'nonce_' + nonce;
  if (!cache.get(chave)) {
    throw new Error('Sua sessão expirou. Recarregue a página e envie novamente.');
  }
  cache.remove(chave);
}

// ---------------------------------------------------------------------------
//  Sanitizacao
// ---------------------------------------------------------------------------

/**
 * Texto vindo do cliente, pronto pra ir pra celula.
 *
 * O detalhe que importa: uma celula que comeca com = + - @ vira FORMULA no
 * Sheets. Alguem poderia mandar um nome tipo =IMPORTXML(...) e transformar a
 * planilha do dono num vazamento de dados. O apostrofo na frente resolve:
 * o Sheets passa a tratar como texto puro.
 */
function textoSeguro(valor, tamanhoMaximo) {
  let texto = String(valor === null || valor === undefined ? '' : valor).trim();
  if (tamanhoMaximo && texto.length > tamanhoMaximo) {
    texto = texto.substring(0, tamanhoMaximo);
  }
  if (/^[=+\-@]/.test(texto)) texto = "'" + texto;
  return texto;
}

function inteiroSeguro(valor, minimo, maximo) {
  const n = Math.floor(Number(valor));
  if (!isFinite(n) || n < minimo || n > maximo) return null;
  return n;
}

// ---------------------------------------------------------------------------
//  Gravacao do pedido
// ---------------------------------------------------------------------------

function registrarPedido(payload) {
  if (!payload || typeof payload !== 'object') throw new Error('Dados inválidos.');

  // Campo escondido no formulario. Humano nunca preenche; bot preenche tudo.
  if (textoSeguro(payload.website)) throw new Error('Envio bloqueado.');

  validarNonce(payload.nonce);

  const nome = textoSeguro(payload.cliente, 120);
  if (nome.length < 2) throw new Error('Informe o nome do cliente.');

  const telefone = textoSeguro(payload.telefone, 20);
  if (telefone.replace(/\D/g, '').length < 10) {
    throw new Error('Informe um telefone válido com DDD.');
  }

  const itensRecebidos = payload.itens;
  if (!Array.isArray(itensRecebidos) || itensRecebidos.length === 0) {
    throw new Error('Adicione pelo menos uma peça ao pedido.');
  }
  if (itensRecebidos.length > MAX_LINHAS_POR_PEDIDO) {
    throw new Error('O pedido pode ter no máximo ' + MAX_LINHAS_POR_PEDIDO + ' linhas.');
  }

  const catalogo = lerCatalogo();
  const itens = itensRecebidos.map(function (item, indice) {
    return validarEPrecificarItem(item, indice, catalogo);
  });

  const totalCentavos = itens.reduce(function (soma, item) {
    return soma + item.subtotalCentavos;
  }, 0);
  const entradaCentavos = metadeArredondadaPraCima(totalCentavos);

  // O prazo e conferido AQUI, e nao so no calendario do site. O `min` do
  // campo de data e conveniencia pro cliente; sem esta checagem, quem mexer
  // na requisicao registra pedido pra uma data que a loja nao atende -- que e
  // exatamente o problema que este recurso existe pra evitar.
  const prazo = validarPrazo(payload.prazo, catalogo);

  const artes = validarArtes(payload.artes, catalogo, nome);

  const pedido = {
    cliente: nome,
    telefone: telefone,
    empresa: textoSeguro(payload.empresa, 120),
    prazo: prazo,
    observacoes: textoSeguro(payload.observacoes, 2000),
    totalCentavos: totalCentavos,
    entradaCentavos: entradaCentavos,
  };

  const numero = gravarComLock(pedido, itens, artes);

  return {
    numero: numero,
    totalCentavos: totalCentavos,
    entradaCentavos: entradaCentavos,
  };
}

// ---------------------------------------------------------------------------
//  Consulta do cliente
// ---------------------------------------------------------------------------

/**
 * Devolve os pedidos de UM telefone.
 *
 * A busca e por telefone, e nao por numero do pedido, por dois motivos:
 *
 * 1. O numero nao e estavel no tempo. Quando o dono limpa da planilha os
 *    pedidos ja entregues, a numeracao volta a comecar do 0001.
 * 2. Privacidade. Numero sequencial pode ser varrido de 1 a 9999 por qualquer
 *    um, expondo nome, telefone e valor de toda a carteira da loja. Telefone
 *    exige que quem consulta ja conheca o cliente.
 *
 * So vao daqui os campos que o proprio cliente ja sabe. Nada de outro cliente
 * sai nesta resposta.
 */
function consultarPedidosPorTelefone(telefone) {
  const procurado = somenteDigitos(telefone);

  // Menos que isso e busca ampla demais, e passaria a valer a pena varrer.
  if (procurado.length < 10) {
    throw new Error('Informe o telefone completo, com DDD.');
  }

  const linhas = lerLinhas(aba(ABAS.PEDIDOS));
  const meus = linhas.filter(function (l) {
    return somenteDigitos(l[COL_PEDIDO.TELEFONE - 1]) === procurado;
  });

  if (meus.length === 0) return [];

  const numeros = {};
  meus.forEach(function (l) { numeros[Number(l[COL_PEDIDO.NUMERO - 1])] = true; });

  const itensPorPedido = {};
  lerLinhas(aba(ABAS.ITENS)).forEach(function (l) {
    const n = Number(l[COL_ITEM.NUMERO_PEDIDO - 1]);
    if (!numeros[n]) return;
    if (!itensPorPedido[n]) itensPorPedido[n] = [];
    itensPorPedido[n].push({
      peca: String(l[COL_ITEM.PECA - 1] || ''),
      tecido: String(l[COL_ITEM.TECIDO - 1] || ''),
      cor: String(l[COL_ITEM.COR - 1] || ''),
      genero: String(l[COL_ITEM.GENERO - 1] || ''),
      tamanho: String(l[COL_ITEM.TAMANHO - 1] || ''),
      quantidade: Number(l[COL_ITEM.QUANTIDADE - 1]) || 0,
    });
  });

  return meus
    .map(function (l) {
      const total = reaisParaCentavos(l[COL_PEDIDO.TOTAL - 1]);
      const entrada = reaisParaCentavos(l[COL_PEDIDO.ENTRADA - 1]);
      const entradaPaga = !!l[COL_PEDIDO.ENTRADA_PAGA_EM - 1];
      const saldoPago = !!l[COL_PEDIDO.SALDO_PAGO_EM - 1];

      const numero = Number(l[COL_PEDIDO.NUMERO - 1]);
      return {
        numero: numero,
        data: paraDataISO(l[COL_PEDIDO.DATA - 1]),
        prazo: paraDataISO(l[COL_PEDIDO.PRAZO - 1]),
        status: String(l[COL_PEDIDO.STATUS - 1] || ''),
        artes: String(l[COL_PEDIDO.ARTES - 1] || ''),
        totalCentavos: total,
        entradaCentavos: entrada,
        entradaPaga: entradaPaga,
        saldoPago: saldoPago,
        // Recalculado aqui: a coluna Saldo e formula, e formula chega como
        // valor calculado, mas se a planilha ainda nao recalculou viria zero.
        faltaPagarCentavos: saldoPago ? 0 : (entradaPaga ? total - entrada : total),
        itens: itensPorPedido[numero] || [],
      };
    })
    .sort(function (a, b) { return b.numero - a.numero; });
}

const MAX_ARTES_POR_PEDIDO = 10;

/**
 * Confere se a data de entrega cabe na agenda da loja.
 *
 * Devolve a data pronta pra gravar, ou '' se o cliente nao pediu prazo --
 * prazo continua opcional.
 */
function validarPrazo(valor, catalogo) {
  const data = dataSegura(valor);
  if (!data) return '';

  const iso = Utilities.formatDate(data, 'America/Sao_Paulo', 'yyyy-MM-dd');

  const minimo = new Date();
  minimo.setHours(0, 0, 0, 0);
  minimo.setDate(minimo.getDate() + (catalogo.prazoMinimoDias || 0));
  const minimoIso = Utilities.formatDate(minimo, 'America/Sao_Paulo', 'yyyy-MM-dd');

  // Comparar as strings ISO evita erro de fuso: as duas ja estao no mesmo
  // formato e no mesmo fuso.
  if (iso < minimoIso) {
    throw new Error(
      'A loja precisa de ' + catalogo.prazoMinimoDias +
      ' dias para produzir. A entrega mais próxima é ' + formatarDataBR(minimoIso) + '.'
    );
  }

  const bloqueios = catalogo.datasBloqueadas || [];
  for (let i = 0; i < bloqueios.length; i++) {
    const b = bloqueios[i];
    if (iso >= b.inicio && iso <= b.fim) {
      throw new Error(
        'A loja não entrega em ' + formatarDataBR(iso) +
        (b.motivo ? ' (' + b.motivo + ')' : '') + '. Escolha outra data.'
      );
    }
  }

  return data;
}

/** "aaaa-mm-dd" -> "dd/mm/aaaa", so pra mensagem de erro ficar legivel. */
function formatarDataBR(iso) {
  const p = String(iso).split('-');
  return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : String(iso);
}

/**
 * Valida as artes e sobe os arquivos pro Drive.
 *
 * Uma camisa pode ter estampa no peito, nas costas e na manga -- por isso e
 * uma lista, e nao um arquivo so.
 */
function validarArtes(artesRecebidas, catalogo, nomeCliente) {
  if (!artesRecebidas) return [];
  if (!Array.isArray(artesRecebidas)) throw new Error('Artes em formato inválido.');

  if (artesRecebidas.length > MAX_ARTES_POR_PEDIDO) {
    throw new Error('No máximo ' + MAX_ARTES_POR_PEDIDO + ' artes por pedido.');
  }

  return artesRecebidas.map(function (arte, indice) {
    const onde = 'Arte ' + (indice + 1) + ': ';
    if (!arte || typeof arte !== 'object') throw new Error(onde + 'dados inválidos.');

    const posicao = String(arte.posicao || '').trim();
    const posicaoValida = catalogo.posicoes.some(function (p) { return p.nome === posicao; });
    if (!posicaoValida) {
      throw new Error(onde + 'posição "' + posicao + '" não está disponível.');
    }

    if (!arte.arquivo || !arte.arquivo.dadosBase64) {
      throw new Error(onde + 'envie o arquivo da arte.');
    }

    return {
      posicao: posicao,
      arquivo: salvarLogoNoDrive(arte.arquivo, nomeCliente + ' - ' + posicao),
      observacao: textoSeguro(arte.observacao, 200),
    };
  });
}

/**
 * Valida uma linha do pedido e define o preco dela pelo catalogo.
 * Repare que nada de `item.preco` ou `item.subtotal` e lido: mesmo que venham
 * no payload, sao descartados.
 */
function validarEPrecificarItem(item, indice, catalogo) {
  const posicao = 'Linha ' + (indice + 1) + ': ';
  if (!item || typeof item !== 'object') throw new Error(posicao + 'dados inválidos.');

  const peca = String(item.peca || '').trim();
  const tecido = String(item.tecido || '').trim();
  const tamanho = String(item.tamanho || '').trim();
  const cor = String(item.cor || '').trim();
  const genero = String(item.genero || '').trim().toLowerCase();

  if (GENEROS.indexOf(genero) === -1) {
    throw new Error(posicao + 'escolha masculino, feminino ou unissex.');
  }

  const quantidade = inteiroSeguro(item.quantidade, 1, MAX_QTD_POR_LINHA);
  if (quantidade === null) {
    throw new Error(posicao + 'quantidade deve ser de 1 a ' + MAX_QTD_POR_LINHA + '.');
  }

  const dadosTamanho = catalogo.tamanhos.filter(function (t) {
    return t.rotulo === tamanho;
  })[0];
  if (!dadosTamanho) throw new Error(posicao + 'tamanho "' + tamanho + '" não existe.');

  const corValida = catalogo.cores.some(function (c) { return c.nome === cor; });
  if (!corValida) throw new Error(posicao + 'cor "' + cor + '" não está disponível.');

  const precosDaPeca = catalogo.precos[peca];
  if (!precosDaPeca) throw new Error(posicao + 'peça "' + peca + '" não existe.');

  const precoBase = precosDaPeca[tecido];
  if (!precoBase) {
    throw new Error(posicao + 'não há preço cadastrado para ' + peca + ' em ' + tecido + '.');
  }

  const unitarioCentavos = precoBase + dadosTamanho.acrescimoCentavos;

  return {
    peca: peca,
    tecido: tecido,
    cor: cor,
    genero: genero,
    tamanho: tamanho,
    quantidade: quantidade,
    nomeBordado: textoSeguro(item.nomeBordado, 60),
    unitarioCentavos: unitarioCentavos,
    subtotalCentavos: unitarioCentavos * quantidade,
  };
}

function dataSegura(valor) {
  if (!valor) return '';
  // Espera ISO (yyyy-mm-dd), que e o que <input type="date"> manda.
  const partes = String(valor).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!partes) return '';
  const data = new Date(Number(partes[1]), Number(partes[2]) - 1, Number(partes[3]));
  return isNaN(data.getTime()) ? '' : data;
}

/**
 * Numero sequencial + gravacao das linhas, tudo dentro de um lock.
 *
 * Sem o lock, dois clientes enviando no mesmo segundo leriam o mesmo "ultimo
 * numero" e o segundo sobrescreveria o primeiro.
 */
function gravarComLock(pedido, itens, artes) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) {
    throw new Error('Sistema ocupado, tente novamente em alguns segundos.');
  }

  try {
    const abaPedidos = aba(ABAS.PEDIDOS);
    const abaItens = aba(ABAS.ITENS);
    const abaArtes = aba(ABAS.ARTES);

    const numero = proximoNumeroDePedido(abaPedidos);
    const linha = abaPedidos.getLastRow() + 1;

    const valores = [];
    valores[COL_PEDIDO.NUMERO - 1] = numero;
    valores[COL_PEDIDO.DATA - 1] = new Date();
    valores[COL_PEDIDO.CLIENTE - 1] = pedido.cliente;
    valores[COL_PEDIDO.TELEFONE - 1] = pedido.telefone;
    valores[COL_PEDIDO.EMPRESA - 1] = pedido.empresa;
    valores[COL_PEDIDO.PRAZO - 1] = pedido.prazo;
    // Resumo legivel na linha do pedido; o detalhe de cada arte, com link do
    // arquivo, fica na aba Artes.
    valores[COL_PEDIDO.ARTES - 1] = artes.map(function (a) {
      return a.posicao;
    }).join(', ');
    valores[COL_PEDIDO.OBSERVACOES - 1] = pedido.observacoes;
    valores[COL_PEDIDO.TOTAL - 1] = centavosParaReais(pedido.totalCentavos);
    valores[COL_PEDIDO.ENTRADA - 1] = centavosParaReais(pedido.entradaCentavos);
    valores[COL_PEDIDO.SALDO - 1] = ''; // formula, logo abaixo
    valores[COL_PEDIDO.STATUS - 1] = STATUS.AGUARDANDO;
    valores[COL_PEDIDO.ENTRADA_PAGA_EM - 1] = '';
    valores[COL_PEDIDO.SALDO_PAGO_EM - 1] = '';

    abaPedidos.getRange(linha, 1, 1, CABECALHO_PEDIDOS.length).setValues([valores]);

    abaPedidos.getRange(linha, COL_PEDIDO.SALDO)
      .setFormula(formulaDoSaldo(linha));

    const linhasItens = itens.map(function (item) {
      const l = [];
      l[COL_ITEM.NUMERO_PEDIDO - 1] = numero;
      l[COL_ITEM.PECA - 1] = item.peca;
      l[COL_ITEM.TECIDO - 1] = item.tecido;
      l[COL_ITEM.COR - 1] = item.cor;
      l[COL_ITEM.GENERO - 1] = item.genero;
      l[COL_ITEM.TAMANHO - 1] = item.tamanho;
      l[COL_ITEM.QUANTIDADE - 1] = item.quantidade;
      l[COL_ITEM.NOME_BORDADO - 1] = item.nomeBordado;
      l[COL_ITEM.UNITARIO - 1] = centavosParaReais(item.unitarioCentavos);
      l[COL_ITEM.SUBTOTAL - 1] = centavosParaReais(item.subtotalCentavos);
      return l;
    });

    // Uma chamada so, em vez de appendRow por item: bem mais rapido e nao
    // arrisca estourar o tempo maximo de execucao num pedido grande.
    abaItens
      .getRange(abaItens.getLastRow() + 1, 1, linhasItens.length, CABECALHO_ITENS.length)
      .setValues(linhasItens);

    if (artes.length > 0) {
      const linhasArtes = artes.map(function (arte) {
        const l = [];
        l[COL_ARTE.NUMERO_PEDIDO - 1] = numero;
        l[COL_ARTE.POSICAO - 1] = arte.posicao;
        l[COL_ARTE.ARQUIVO - 1] = arte.arquivo;
        l[COL_ARTE.OBSERVACAO - 1] = arte.observacao;
        return l;
      });

      abaArtes
        .getRange(abaArtes.getLastRow() + 1, 1, linhasArtes.length, CABECALHO_ARTES.length)
        .setValues(linhasArtes);
    }

    SpreadsheetApp.flush();
    return numero;
  } finally {
    lock.releaseLock();
  }
}

function proximoNumeroDePedido(abaPedidos) {
  const ultimaLinha = abaPedidos.getLastRow();
  if (ultimaLinha < 2) return 1;

  const numeros = abaPedidos.getRange(2, COL_PEDIDO.NUMERO, ultimaLinha - 1, 1).getValues();
  let maior = 0;
  for (let i = 0; i < numeros.length; i++) {
    const n = Number(numeros[i][0]);
    if (isFinite(n) && n > maior) maior = n;
  }
  return maior + 1;
}

// ---------------------------------------------------------------------------
//  Logo
// ---------------------------------------------------------------------------

/** Guarda o arquivo no Drive do dono e devolve o link pra celula. */
function salvarLogoNoDrive(logo, nomeCliente) {
  if (!logo || !logo.dadosBase64) return '';

  const mime = String(logo.mimeType || '').toLowerCase();
  if (MIMES_LOGO_PERMITIDOS.indexOf(mime) === -1) {
    throw new Error('O logo precisa ser PNG, JPG, WEBP ou PDF.');
  }

  const bytes = Utilities.base64Decode(logo.dadosBase64);
  if (bytes.length > MAX_BYTES_LOGO) {
    throw new Error('O logo passa de 5 MB. Envie um arquivo menor.');
  }

  const nomeArquivo = Utilities.formatDate(new Date(), 'America/Sao_Paulo', 'yyyy-MM-dd_HHmmss') +
    ' - ' + String(nomeCliente).replace(/[^\w\sÀ-ÿ.-]/g, '').substring(0, 60) +
    extensaoDoMime(mime);

  const blob = Utilities.newBlob(bytes, mime, nomeArquivo);
  const arquivo = obterPastaDeLogos().createFile(blob);

  return arquivo.getUrl();
}

function extensaoDoMime(mime) {
  const mapa = {
    'image/png': '.png',
    'image/jpeg': '.jpg',
    'image/jpg': '.jpg',
    'image/webp': '.webp',
    'application/pdf': '.pdf',
  };
  return mapa[mime] || '';
}

function obterPastaDeLogos() {
  return obterPasta(PASTA_LOGOS, 'ID_PASTA_LOGOS');
}

/** Cria a pasta na primeira vez e guarda o id pra nao procurar sempre. */
function obterPasta(nome, chaveProp) {
  const props = PropertiesService.getScriptProperties();
  const idSalvo = props.getProperty(chaveProp);

  if (idSalvo) {
    try {
      const pasta = DriveApp.getFolderById(idSalvo);
      if (!pasta.isTrashed()) return pasta;
    } catch (erro) {
      // Pasta apagada de vez: cai fora e cria outra.
    }
  }

  const existentes = DriveApp.getFoldersByName(nome);
  const pasta = existentes.hasNext() ? existentes.next() : DriveApp.createFolder(nome);
  props.setProperty(chaveProp, pasta.getId());
  return pasta;
}

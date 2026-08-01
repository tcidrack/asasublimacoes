/**
 * O painel do dono: um menu "Pedidos" na barra do Google Sheets.
 *
 * Tudo que ele precisa fazer no dia a dia sai daqui -- gerar a ordem pra
 * oficina, baixar em Excel e marcar pagamento -- sem digitar nada a mao.
 */

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('📋 Pedidos')
    .addItem('Ver grade do pedido selecionado', 'verGradeDoPedidoSelecionado')
    .addSeparator()
    .addItem('Gerar ordem de produção', 'gerarOrdemDeProducao')
    .addItem('Baixar ordem em Excel (.xlsx)', 'baixarOrdemEmExcel')
    .addSeparator()
    .addItem('Marcar entrada de 50% como paga', 'marcarEntradaPaga')
    .addItem('Marcar saldo como pago', 'marcarSaldoPago')
    .addSeparator()
    .addItem('Atualizar matriz de preços', 'atualizarMatrizDePrecos')
    .addItem('Aplicar alterações do catálogo agora', 'aplicarAlteracoesDoCatalogo')
    .addToUi();
}

// ---------------------------------------------------------------------------
//  Helpers do menu
// ---------------------------------------------------------------------------

function ui() {
  return SpreadsheetApp.getUi();
}

/**
 * Descobre com qual pedido trabalhar: se o cursor esta numa linha da aba
 * Pedidos, usa aquele; senao, pergunta o numero.
 */
function pedidoEscolhido(titulo) {
  const ss = planilha();
  const ativa = ss.getActiveSheet();

  if (ativa.getName() === ABAS.PEDIDOS) {
    const linha = ativa.getActiveRange().getRow();
    if (linha >= 2) {
      const numero = Number(ativa.getRange(linha, COL_PEDIDO.NUMERO).getValue());
      if (numero > 0) return numero;
    }
  }

  if (ativa.getName() === ABAS.GRADE) {
    const numero = Number(ativa.getRange('B1').getValue());
    if (numero > 0) return numero;
  }

  const resposta = ui().prompt(
    titulo,
    'Digite o número do pedido:',
    ui().ButtonSet.OK_CANCEL
  );
  if (resposta.getSelectedButton() !== ui().Button.OK) return null;

  const numero = Number(String(resposta.getResponseText()).trim());
  if (!numero || numero < 1) {
    ui().alert('Número de pedido inválido.');
    return null;
  }
  return numero;
}

/** Localiza a linha de um pedido na aba Pedidos. Devolve 0 se nao achar. */
function linhaDoPedido(numero) {
  const sheet = aba(ABAS.PEDIDOS);
  const ultimaLinha = sheet.getLastRow();
  if (ultimaLinha < 2) return 0;

  const numeros = sheet.getRange(2, COL_PEDIDO.NUMERO, ultimaLinha - 1, 1).getValues();
  for (let i = 0; i < numeros.length; i++) {
    if (Number(numeros[i][0]) === numero) return i + 2;
  }
  return 0;
}

/** Todos os dados de um pedido, ja montados pra usar. */
function carregarPedido(numero) {
  const linha = linhaDoPedido(numero);
  if (!linha) {
    ui().alert('Pedido nº ' + formatarNumeroPedido(numero) + ' não encontrado.');
    return null;
  }

  const sheet = aba(ABAS.PEDIDOS);
  const v = sheet.getRange(linha, 1, 1, CABECALHO_PEDIDOS.length).getValues()[0];

  const itens = lerLinhas(aba(ABAS.ITENS))
    .filter(function (l) { return Number(l[COL_ITEM.NUMERO_PEDIDO - 1]) === numero; })
    .map(function (l) {
      return {
        peca: l[COL_ITEM.PECA - 1],
        tecido: l[COL_ITEM.TECIDO - 1],
        cor: l[COL_ITEM.COR - 1],
        genero: String(l[COL_ITEM.GENERO - 1]).toLowerCase(),
        tamanho: String(l[COL_ITEM.TAMANHO - 1]),
        quantidade: Number(l[COL_ITEM.QUANTIDADE - 1]) || 0,
        nomeBordado: l[COL_ITEM.NOME_BORDADO - 1],
        unitario: Number(l[COL_ITEM.UNITARIO - 1]) || 0,
        subtotal: Number(l[COL_ITEM.SUBTOTAL - 1]) || 0,
      };
    });

  return {
    linha: linha,
    numero: numero,
    data: v[COL_PEDIDO.DATA - 1],
    cliente: v[COL_PEDIDO.CLIENTE - 1],
    telefone: v[COL_PEDIDO.TELEFONE - 1],
    empresa: v[COL_PEDIDO.EMPRESA - 1],
    prazo: v[COL_PEDIDO.PRAZO - 1],
    artes: lerLinhas(aba(ABAS.ARTES))
      .filter(function (l) { return Number(l[COL_ARTE.NUMERO_PEDIDO - 1]) === numero; })
      .map(function (l) {
        return {
          posicao: String(l[COL_ARTE.POSICAO - 1] || ''),
          arquivo: String(l[COL_ARTE.ARQUIVO - 1] || ''),
          observacao: String(l[COL_ARTE.OBSERVACAO - 1] || ''),
        };
      }),
    observacoes: v[COL_PEDIDO.OBSERVACOES - 1],
    total: Number(v[COL_PEDIDO.TOTAL - 1]) || 0,
    entrada: Number(v[COL_PEDIDO.ENTRADA - 1]) || 0,
    status: v[COL_PEDIDO.STATUS - 1],
    entradaPagaEm: v[COL_PEDIDO.ENTRADA_PAGA_EM - 1],
    saldoPagoEm: v[COL_PEDIDO.SALDO_PAGO_EM - 1],
    itens: itens,
  };
}

// ---------------------------------------------------------------------------
//  Grade
// ---------------------------------------------------------------------------

function verGradeDoPedidoSelecionado() {
  const numero = pedidoEscolhido('Ver grade');
  if (!numero) return;

  const sheetGrade = aba(ABAS.GRADE);
  sheetGrade.getRange('B1').setValue(numero);
  planilha().setActiveSheet(sheetGrade);
}

/**
 * Soma as pecas por tamanho e genero, na ordem cadastrada na aba Tamanhos.
 * E o numero que a oficina usa pra cortar -- por isso ele e calculado a
 * partir dos itens, e nao digitado por ninguem.
 */
function montarGrade(itens) {
  const tamanhos = lerLinhas(aba(ABAS.TAMANHOS))
    .filter(function (l) { return String(l[0]).trim() !== ''; })
    .map(function (l) { return { rotulo: String(l[0]).trim(), ordem: Number(l[3]) || 0 }; })
    .sort(function (a, b) { return a.ordem - b.ordem; });

  const porTamanho = {};
  itens.forEach(function (item) {
    if (!porTamanho[item.tamanho]) {
      porTamanho[item.tamanho] = { masculino: 0, feminino: 0, unissex: 0 };
    }
    if (porTamanho[item.tamanho][item.genero] !== undefined) {
      porTamanho[item.tamanho][item.genero] += item.quantidade;
    }
  });

  const linhas = [];
  tamanhos.forEach(function (t) {
    const contagem = porTamanho[t.rotulo];
    if (!contagem) return;
    const total = contagem.masculino + contagem.feminino + contagem.unissex;
    if (total === 0) return;
    linhas.push([t.rotulo, contagem.masculino, contagem.feminino, contagem.unissex, total]);
  });

  return linhas;
}

// ---------------------------------------------------------------------------
//  Ordem de producao
// ---------------------------------------------------------------------------

function gerarOrdemDeProducao() {
  const numero = pedidoEscolhido('Gerar ordem de produção');
  if (!numero) return;

  const pedido = carregarPedido(numero);
  if (!pedido) return;

  const sheet = aba(ABAS.ORDEM);
  sheet.clear();
  sheet.clearConditionalFormatRules();
  // clear() nao desfaz mesclagens. Sem isto, a segunda geracao tenta mesclar
  // por cima das celulas da anterior e o Sheets recusa.
  sheet.getRange(1, 1, sheet.getMaxRows(), sheet.getMaxColumns()).breakApart();
  if (sheet.getMaxColumns() < 5) sheet.insertColumns(sheet.getMaxColumns(), 5);

  let linha = 1;

  function titulo(texto, tamanhoFonte) {
    sheet.getRange(linha, 1, 1, 5).merge()
      .setValue(texto)
      .setFontWeight('bold')
      .setFontSize(tamanhoFonte || 11)
      .setBackground('#1e293b')
      .setFontColor('#ffffff')
      .setHorizontalAlignment('left')
      .setVerticalAlignment('middle');
    sheet.setRowHeight(linha, tamanhoFonte && tamanhoFonte > 12 ? 34 : 26);
    linha++;
  }

  function campo(rotulo, valor) {
    sheet.getRange(linha, 1).setValue(rotulo).setFontWeight('bold');
    sheet.getRange(linha, 2, 1, 4).merge().setValue(valor === '' || valor === null ? '—' : valor);
    linha++;
  }

  titulo('ORDEM DE PRODUÇÃO — PEDIDO Nº ' + formatarNumeroPedido(pedido.numero), 14);
  linha++;

  campo('Cliente', pedido.cliente);
  campo('Empresa', pedido.empresa);
  campo('Telefone', pedido.telefone);
  campo('Data do pedido', formatarData(pedido.data, FORMATO_DATA_HORA));
  campo('Prazo de entrega', formatarData(pedido.prazo, FORMATO_DATA));
  campo('Status', pedido.status);
  linha++;

  titulo('ARTES A APLICAR');
  if (pedido.artes.length > 0) {
    sheet.getRange(linha, 1, 1, 5)
      .setValues([['Posição', 'Arquivo', '', '', 'Observação']])
      .setFontWeight('bold').setBackground('#e2e8f0');
    linha++;

    pedido.artes.forEach(function (arte) {
      sheet.getRange(linha, 1).setValue(arte.posicao).setFontWeight('bold');
      sheet.getRange(linha, 2, 1, 3).merge().setValue(arte.arquivo || '—');
      sheet.getRange(linha, 5).setValue(arte.observacao || '—');
      linha++;
    });
  } else {
    sheet.getRange(linha, 1, 1, 5).merge().setValue('Sem arte enviada.');
    linha++;
  }
  campo('Observações', pedido.observacoes);
  linha++;

  titulo('GRADE DE TAMANHOS (conferir antes de cortar)');
  const cabecalhoGrade = ['Tamanho', 'Masculino', 'Feminino', 'Unissex', 'Total'];
  sheet.getRange(linha, 1, 1, 5).setValues([cabecalhoGrade])
    .setFontWeight('bold').setBackground('#e2e8f0');
  linha++;

  const grade = montarGrade(pedido.itens);
  if (grade.length > 0) {
    sheet.getRange(linha, 1, grade.length, 5).setValues(grade);
    const primeiraLinhaGrade = linha;
    linha += grade.length;

    const totais = [0, 0, 0, 0];
    grade.forEach(function (l) {
      for (let i = 1; i <= 4; i++) totais[i - 1] += Number(l[i]) || 0;
    });
    sheet.getRange(linha, 1, 1, 5).setValues([['TOTAL'].concat(totais)])
      .setFontWeight('bold').setBackground('#dcfce7');
    linha++;

    sheet.getRange(primeiraLinhaGrade, 2, grade.length + 1, 4)
      .setHorizontalAlignment('center');
  } else {
    sheet.getRange(linha, 1, 1, 5).merge().setValue('Sem itens registrados.');
    linha++;
  }
  linha++;

  titulo('ITENS DETALHADOS');
  sheet.getRange(linha, 1, 1, 5)
    .setValues([['Peça', 'Tecido / Cor', 'Gênero', 'Tamanho / Qtd', 'Nome bordado']])
    .setFontWeight('bold').setBackground('#e2e8f0');
  linha++;

  if (pedido.itens.length > 0) {
    const linhasItens = pedido.itens.map(function (i) {
      return [
        i.peca,
        // Tecido e cor juntos: a oficina precisa dos dois pra separar o rolo.
        i.tecido + (i.cor ? ' — ' + i.cor : ''),
        i.genero,
        i.tamanho + ' × ' + i.quantidade,
        i.nomeBordado || '—',
      ];
    });
    sheet.getRange(linha, 1, linhasItens.length, 5).setValues(linhasItens);
    linha += linhasItens.length;
  }
  linha++;

  titulo('VALORES');
  campo('Total do pedido', formatarMoeda(pedido.total));
  campo('Entrada (50%)', formatarMoeda(pedido.entrada) +
    (pedido.entradaPagaEm ? '  ✔ paga em ' + formatarData(pedido.entradaPagaEm, FORMATO_DATA) : '  ✖ em aberto'));
  campo('Saldo restante', formatarMoeda(pedido.total - pedido.entrada) +
    (pedido.saldoPagoEm ? '  ✔ pago em ' + formatarData(pedido.saldoPagoEm, FORMATO_DATA) : '  ✖ em aberto'));

  sheet.setColumnWidth(1, 170);
  sheet.setColumnWidths(2, 4, 130);
  sheet.getRange(1, 1, linha, 5).setVerticalAlignment('middle');

  planilha().setActiveSheet(sheet);
  ui().alert('Ordem de produção do pedido nº ' + formatarNumeroPedido(numero) + ' gerada.');
}

function formatarData(valor, formato) {
  if (!valor) return '';
  if (Object.prototype.toString.call(valor) !== '[object Date]') return String(valor);
  const padrao = formato === FORMATO_DATA_HORA ? 'dd/MM/yyyy HH:mm' : 'dd/MM/yyyy';
  return Utilities.formatDate(valor, 'America/Sao_Paulo', padrao);
}

function formatarMoeda(valor) {
  const n = Number(valor) || 0;
  return 'R$ ' + n.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

// ---------------------------------------------------------------------------
//  Exportar em Excel
// ---------------------------------------------------------------------------

/**
 * Exporta SO a aba Ordem de Produção como .xlsx.
 *
 * O truque: a URL de export do Google ignora o parametro gid quando o formato
 * e xlsx -- ela sempre traria a planilha inteira, com pedidos de todo mundo.
 * Por isso a aba e copiada pra uma planilha temporaria, que e exportada e
 * jogada fora em seguida.
 */
function baixarOrdemEmExcel() {
  const sheetOrdem = aba(ABAS.ORDEM);
  if (sheetOrdem.getLastRow() < 2) {
    ui().alert('Gere a ordem de produção primeiro.');
    return;
  }

  const titulo = String(sheetOrdem.getRange('A1').getValue() || 'Ordem de Produção');
  const nomeArquivo = titulo.replace(/[\\/:*?"<>|]/g, '-').substring(0, 90) + '.xlsx';

  let temporaria = null;
  try {
    temporaria = SpreadsheetApp.create('~temp export ' + Utilities.getUuid());
    const copia = sheetOrdem.copyTo(temporaria);
    copia.setName('Ordem de Produção');

    // Toda planilha nova vem com uma aba padrao que nao queremos no arquivo.
    temporaria.getSheets().forEach(function (s) {
      if (s.getSheetId() !== copia.getSheetId()) temporaria.deleteSheet(s);
    });
    SpreadsheetApp.flush();

    const url = 'https://docs.google.com/spreadsheets/d/' + temporaria.getId() + '/export?format=xlsx';
    const resposta = UrlFetchApp.fetch(url, {
      headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
      muteHttpExceptions: true,
    });

    if (resposta.getResponseCode() !== 200) {
      throw new Error('O Google recusou a exportação (código ' + resposta.getResponseCode() + ').');
    }

    const blob = resposta.getBlob().setName(nomeArquivo);
    const arquivo = obterPasta(PASTA_ORDENS, 'ID_PASTA_ORDENS').createFile(blob);
    mostrarLinkDeDownload(arquivo.getUrl(), nomeArquivo);
  } catch (erro) {
    ui().alert('Não foi possível gerar o Excel:\n\n' + erro.message);
  } finally {
    if (temporaria) {
      try {
        DriveApp.getFileById(temporaria.getId()).setTrashed(true);
      } catch (erro) {
        // Se nao der pra apagar, fica um arquivo temporario na lixeira. Sem drama.
      }
    }
  }
}

function mostrarLinkDeDownload(url, nomeArquivo) {
  const html = HtmlService.createHtmlOutput(
    '<div style="font-family:system-ui,sans-serif;padding:16px;line-height:1.5">' +
    '<p style="margin:0 0 12px">Arquivo gerado e salvo no seu Google Drive:</p>' +
    '<p style="margin:0 0 16px"><b>' + escaparHtml(nomeArquivo) + '</b></p>' +
    '<a href="' + escaparHtml(url) + '" target="_blank" rel="noopener" ' +
    'style="display:inline-block;background:#1e293b;color:#fff;padding:10px 16px;' +
    'border-radius:6px;text-decoration:none">Abrir no Drive</a>' +
    '</div>'
  ).setWidth(420).setHeight(190);
  ui().showModalDialog(html, 'Download pronto');
}

function escaparHtml(texto) {
  return String(texto)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ---------------------------------------------------------------------------
//  Pagamentos
// ---------------------------------------------------------------------------

function marcarEntradaPaga() {
  registrarPagamento('entrada');
}

function marcarSaldoPago() {
  registrarPagamento('saldo');
}

function registrarPagamento(tipo) {
  const numero = pedidoEscolhido(tipo === 'entrada' ? 'Marcar entrada paga' : 'Marcar saldo pago');
  if (!numero) return;

  const pedido = carregarPedido(numero);
  if (!pedido) return;

  const sheet = aba(ABAS.PEDIDOS);
  const ehEntrada = tipo === 'entrada';
  const jaPago = ehEntrada ? pedido.entradaPagaEm : pedido.saldoPagoEm;

  if (jaPago) {
    ui().alert('Esse pagamento já estava marcado em ' + formatarData(jaPago, FORMATO_DATA) + '.');
    return;
  }

  if (!ehEntrada && !pedido.entradaPagaEm) {
    const confirma = ui().alert(
      'Atenção',
      'A entrada de 50% ainda não foi marcada como paga. Registrar o saldo mesmo assim?',
      ui().ButtonSet.YES_NO
    );
    if (confirma !== ui().Button.YES) return;
  }

  const valor = ehEntrada ? pedido.entrada : pedido.total - pedido.entrada;
  const confirma = ui().alert(
    'Confirmar pagamento',
    'Pedido nº ' + formatarNumeroPedido(numero) + ' — ' + pedido.cliente + '\n\n' +
    (ehEntrada ? 'Entrada de 50%' : 'Saldo final') + ': ' + formatarMoeda(valor) + '\n\n' +
    'Confirma o recebimento?',
    ui().ButtonSet.YES_NO
  );
  if (confirma !== ui().Button.YES) return;

  const coluna = ehEntrada ? COL_PEDIDO.ENTRADA_PAGA_EM : COL_PEDIDO.SALDO_PAGO_EM;
  sheet.getRange(pedido.linha, coluna).setValue(new Date());

  // O status so avança sozinho quando isso nao atropela nada: um pedido que
  // ja esta "Em produção" nao deve voltar pra "Pago 50%".
  if (ehEntrada && pedido.status === STATUS.AGUARDANDO) {
    sheet.getRange(pedido.linha, COL_PEDIDO.STATUS).setValue(STATUS.PAGO_50);
  } else if (!ehEntrada && pedido.status === STATUS.PRONTO) {
    sheet.getRange(pedido.linha, COL_PEDIDO.STATUS).setValue(STATUS.ENTREGUE);
  }

  SpreadsheetApp.flush();
  ui().alert('Pagamento registrado. O saldo a receber já foi atualizado na coluna L.');
}

// ---------------------------------------------------------------------------
//  Manutencao
// ---------------------------------------------------------------------------

/**
 * O catalogo fica guardado por 5 minutos para o site carregar rapido. Este
 * item existe para quando o dono reajusta preco e quer efeito imediato, em
 * vez de esperar a janela passar.
 */
function aplicarAlteracoesDoCatalogo() {
  limparCacheDoCatalogo();
  ui().alert(
    'Pronto. As alterações de peças, tecidos, cores, tamanhos, posições, ' +
    'preços e prazos já valem para os próximos pedidos.'
  );
}

function atualizarMatrizDePrecos() {
  const adicionados = sincronizarMatrizPrecos();
  planilha().setActiveSheet(aba(ABAS.PRECOS));

  ui().alert(
    adicionados > 0
      ? adicionados + ' linha(s)/coluna(s) adicionada(s) à matriz. Preencha os valores novos.'
      : 'A matriz já está em dia com as peças e tecidos cadastrados.'
  );
}

/**
 * Monta a planilha inteira: abas, cabecalhos, formatos, dropdowns, formulas
 * e dados de exemplo.
 *
 * COMO USAR: no editor do Apps Script, selecione a funcao configurarPlanilha
 * na lista e clique em Executar. Rode UMA vez.
 *
 * E seguro rodar de novo depois: pedidos ja gravados nunca sao apagados, e o
 * catalogo so recebe dados de exemplo se estiver vazio. Rodar de novo serve
 * pra consertar formato ou formula que alguem tenha bagunçado.
 */
function configurarPlanilha() {
  const ss = planilha();

  configurarAbaPecas();
  configurarAbaTecidos();
  configurarAbaTamanhos();
  configurarAbaCores();
  configurarAbaPrecos();
  configurarAbaPedidos();
  configurarAbaItens();
  configurarAbaGrade();
  configurarAbaOrdemProducao();

  // Deixa as abas na ordem em que o dono usa: primeiro o dia a dia, depois
  // o catalogo que quase nunca muda.
  const ordem = [
    ABAS.PEDIDOS, ABAS.ITENS, ABAS.GRADE, ABAS.ORDEM,
    ABAS.PRECOS, ABAS.PECAS, ABAS.TECIDOS, ABAS.TAMANHOS, ABAS.CORES,
  ];
  ordem.forEach(function (nome, i) {
    const sheet = ss.getSheetByName(nome);
    if (sheet) {
      ss.setActiveSheet(sheet);
      ss.moveActiveSheet(i + 1);
    }
  });

  // A aba "Página1"/"Sheet1" que vem por padrao na planilha nova so atrapalha.
  ['Página1', 'Pagina1', 'Sheet1', 'Folha1'].forEach(function (nome) {
    const sobra = ss.getSheetByName(nome);
    if (sobra && sobra.getLastRow() === 0) ss.deleteSheet(sobra);
  });

  ss.setActiveSheet(ss.getSheetByName(ABAS.PEDIDOS));

  // Toast, e nao ui().alert().
  //
  // Rodando pelo editor do Apps Script, um alert() abre o modal na ABA DA
  // PLANILHA, nao no editor -- e a execucao fica parada esperando um clique
  // num botao que ninguem esta vendo. O toast e um aviso de canto que some
  // sozinho e nao prende nada.
  try {
    ss.toast(
      'Abas criadas. Agora: Implantar > Nova implantação > App da Web.',
      'Planilha configurada',
      15
    );
  } catch (erro) {
    // Sem planilha aberta (execucao por gatilho, por exemplo) nao ha onde
    // mostrar o toast. Nao e motivo pra derrubar um setup que ja terminou.
  }
}

// ---------------------------------------------------------------------------
//  Helpers de construcao
// ---------------------------------------------------------------------------

function obterOuCriarAba(nome) {
  const ss = planilha();
  return ss.getSheetByName(nome) || ss.insertSheet(nome);
}

/** Escreve o cabecalho, congela a primeira linha e aplica o estilo padrao. */
function aplicarCabecalho(sheet, cabecalho) {
  sheet.getRange(1, 1, 1, cabecalho.length)
    .setValues([cabecalho])
    .setFontWeight('bold')
    .setBackground('#1e293b')
    .setFontColor('#ffffff')
    .setVerticalAlignment('middle');
  sheet.setFrozenRows(1);
  sheet.setRowHeight(1, 32);
}

/** True se a aba so tem cabecalho (ou nem isso). */
function abaVazia(sheet) {
  return sheet.getLastRow() < 2;
}

/**
 * Coloca checkboxes numa coluna PRESERVANDO o que ja estava marcado.
 *
 * Cuidado com insertCheckboxes(): a API do Google zera o valor de todas as
 * celulas do intervalo. Chamar direto faria a segunda execucao de
 * configurarPlanilha() desmarcar "Ativo" do catalogo inteiro -- e o formulario
 * apareceria vazio pro cliente sem ninguem entender por que.
 */
function aplicarCheckboxes(sheet, coluna) {
  // Uma folga de 50 linhas pra cadastrar item novo sem precisar rodar de novo.
  const totalLinhas = Math.min(
    Math.max(sheet.getLastRow(), 1) + 50,
    Math.max(sheet.getMaxRows() - 1, 1)
  );
  const intervalo = sheet.getRange(2, coluna, totalLinhas, 1);

  const anteriores = intervalo.getValues();
  intervalo.insertCheckboxes();
  intervalo.setValues(anteriores.map(function (linha) {
    const valor = linha[0];
    return [valor === true || String(valor).toUpperCase() === 'TRUE'];
  }));
}

/**
 * Protege um intervalo em modo aviso: o dono ainda consegue editar, mas o
 * Sheets pergunta antes. E o suficiente pra evitar o clique errado sem
 * transformar a planilha numa prisao.
 */
function protegerComAviso(sheet, intervalo, descricao) {
  sheet.getProtections(SpreadsheetApp.ProtectionType.RANGE)
    .forEach(function (p) {
      if (p.getDescription() === descricao) p.remove();
    });
  intervalo.protect().setDescription(descricao).setWarningOnly(true);
}

// ---------------------------------------------------------------------------
//  Catalogo
// ---------------------------------------------------------------------------

function configurarAbaPecas() {
  const sheet = obterOuCriarAba(ABAS.PECAS);
  aplicarCabecalho(sheet, ['Peça', 'Ativo', 'Ordem']);

  if (abaVazia(sheet)) {
    sheet.getRange(2, 1, 7, 3).setValues([
      ['Camiseta', true, 1],
      ['Camisa Polo', true, 2],
      ['Camisa Social', true, 3],
      ['Jaleco', true, 4],
      ['Avental', true, 5],
      ['Calça', true, 6],
      ['Colete', true, 7],
    ]);
  }

  aplicarCheckboxes(sheet, 2);
  sheet.setColumnWidth(1, 200);
  sheet.setColumnWidth(2, 70);
  sheet.setColumnWidth(3, 70);
}

function configurarAbaTecidos() {
  const sheet = obterOuCriarAba(ABAS.TECIDOS);
  aplicarCabecalho(sheet, ['Tecido', 'Descrição', 'Ativo', 'Ordem']);

  if (abaVazia(sheet)) {
    sheet.getRange(2, 1, 7, 4).setValues([
      ['Malha PV', 'Poliéster com viscose. Bom custo-benefício, pouco amassa.', true, 1],
      ['Dry-fit', 'Tecido esportivo, seca rápido e não retém suor.', true, 2],
      ['Algodão 30.1', 'Algodão penteado, toque macio e bem confortável.', true, 3],
      ['Oxford', 'Encorpado e resistente, ideal para camisa social.', true, 4],
      ['Gabardine', 'Firme e durável, muito usado em jaleco e calça.', true, 5],
      ['Brim', 'Bem resistente, indicado para uso pesado.', true, 6],
      ['Microfibra', 'Leve e de secagem rápida.', true, 7],
    ]);
  }

  aplicarCheckboxes(sheet, 3);
  sheet.setColumnWidth(1, 160);
  sheet.setColumnWidth(2, 380);
  sheet.setColumnWidth(3, 70);
  sheet.setColumnWidth(4, 70);
}

function configurarAbaTamanhos() {
  const sheet = obterOuCriarAba(ABAS.TAMANHOS);
  aplicarCabecalho(sheet, ['Tamanho', 'Acréscimo (R$)', 'Ativo', 'Ordem']);

  if (abaVazia(sheet)) {
    sheet.getRange(2, 1, 7, 4).setValues([
      ['PP', 0, true, 1],
      ['P', 0, true, 2],
      ['M', 0, true, 3],
      ['G', 0, true, 4],
      ['GG', 0, true, 5],
      ['XG', 3, true, 6],
      ['XXG', 5, true, 7],
    ]);
  }

  // A ORDEM desta aba manda na ordem da grade de tamanhos. Nao e alfabetica
  // de proposito: PP, P, M, G... e a sequencia que faz sentido no corte.
  sheet.getRange(2, 2, Math.max(sheet.getMaxRows() - 1, 1), 1).setNumberFormat(FORMATO_MOEDA);
  aplicarCheckboxes(sheet, 3);
  sheet.setColumnWidth(1, 110);
  sheet.setColumnWidth(2, 130);
  sheet.setColumnWidth(3, 70);
  sheet.setColumnWidth(4, 70);
}

function configurarAbaCores() {
  const sheet = obterOuCriarAba(ABAS.CORES);
  aplicarCabecalho(sheet, ['Cor', 'Ativo', 'Ordem']);

  if (abaVazia(sheet)) {
    sheet.getRange(2, 1, 10, 3).setValues([
      ['Branco', true, 1],
      ['Preto', true, 2],
      ['Azul Marinho', true, 3],
      ['Azul Royal', true, 4],
      ['Vermelho', true, 5],
      ['Verde Bandeira', true, 6],
      ['Cinza', true, 7],
      ['Amarelo', true, 8],
      ['Laranja', true, 9],
      ['Rosa', true, 10],
    ]);
  }

  aplicarCheckboxes(sheet, 2);
  sheet.setColumnWidth(1, 200);
  sheet.setColumnWidth(2, 70);
  sheet.setColumnWidth(3, 70);
}

/**
 * A matriz de precos: linhas = pecas, colunas = tecidos.
 * Celula vazia significa "nao oferecemos essa combinacao" -- e ela nem
 * aparece pro cliente no formulario.
 */
function configurarAbaPrecos() {
  const sheet = obterOuCriarAba(ABAS.PRECOS);

  if (abaVazia(sheet)) {
    const tecidos = ['Malha PV', 'Dry-fit', 'Algodão 30.1', 'Oxford', 'Gabardine', 'Brim', 'Microfibra'];
    const linhas = [
      ['Camiseta', 32, 45, 38, '', '', '', 42],
      ['Camisa Polo', 48, 58, 52, '', '', '', 55],
      ['Camisa Social', '', '', '', 68, '', '', ''],
      ['Jaleco', '', '', '', 75, 82, '', ''],
      ['Avental', '', '', '', 45, 52, 58, ''],
      ['Calça', '', '', '', '', 72, 65, ''],
      ['Colete', '', '', '', 58, 65, '', ''],
    ];
    sheet.getRange(1, 1, 1, tecidos.length + 1)
      .setValues([['Peça \\ Tecido'].concat(tecidos)]);
    sheet.getRange(2, 1, linhas.length, tecidos.length + 1).setValues(linhas);
  }

  const totalColunas = Math.max(sheet.getLastColumn(), 2);
  sheet.getRange(1, 1, 1, totalColunas)
    .setFontWeight('bold')
    .setBackground('#1e293b')
    .setFontColor('#ffffff')
    .setVerticalAlignment('middle')
    .setWrap(true);
  sheet.getRange(2, 1, Math.max(sheet.getMaxRows() - 1, 1), 1).setFontWeight('bold');
  sheet.getRange(2, 2, Math.max(sheet.getMaxRows() - 1, 1), totalColunas - 1)
    .setNumberFormat(FORMATO_MOEDA);

  sheet.setFrozenRows(1);
  sheet.setFrozenColumns(1);
  sheet.setRowHeight(1, 40);
  sheet.setColumnWidth(1, 170);

  // Deixa visualmente obvio onde ha preco e onde nao ha.
  const area = sheet.getRange(2, 2, Math.max(sheet.getMaxRows() - 1, 1), totalColunas - 1);
  const regra = SpreadsheetApp.newConditionalFormatRule()
    .whenCellEmpty()
    .setBackground('#f1f5f9')
    .setRanges([area])
    .build();
  sheet.setConditionalFormatRules([regra]);
}

/**
 * Acrescenta na matriz de precos as pecas e tecidos que foram cadastrados
 * depois da configuracao inicial, sem mexer nos valores ja preenchidos.
 * Exposta no menu "Pedidos > Atualizar matriz de preços".
 */
function sincronizarMatrizPrecos() {
  const sheet = aba(ABAS.PRECOS);

  const pecasAtivas = lerLinhas(aba(ABAS.PECAS))
    .filter(function (l) { return String(l[0]).trim() !== ''; })
    .map(function (l) { return String(l[0]).trim(); });

  const tecidosAtivos = lerLinhas(aba(ABAS.TECIDOS))
    .filter(function (l) { return String(l[0]).trim() !== ''; })
    .map(function (l) { return String(l[0]).trim(); });

  const ultimaColuna = Math.max(sheet.getLastColumn(), 1);
  const tecidosNaMatriz = ultimaColuna > 1
    ? sheet.getRange(1, 2, 1, ultimaColuna - 1).getValues()[0]
        .map(function (v) { return String(v).trim(); })
        .filter(function (v) { return v !== ''; })
    : [];

  const ultimaLinha = Math.max(sheet.getLastRow(), 1);
  const pecasNaMatriz = ultimaLinha > 1
    ? sheet.getRange(2, 1, ultimaLinha - 1, 1).getValues()
        .map(function (l) { return String(l[0]).trim(); })
        .filter(function (v) { return v !== ''; })
    : [];

  let adicionados = 0;

  tecidosAtivos.forEach(function (nome) {
    if (tecidosNaMatriz.indexOf(nome) === -1) {
      sheet.getRange(1, sheet.getLastColumn() + 1).setValue(nome);
      adicionados++;
    }
  });

  pecasAtivas.forEach(function (nome) {
    if (pecasNaMatriz.indexOf(nome) === -1) {
      sheet.getRange(sheet.getLastRow() + 1, 1).setValue(nome);
      adicionados++;
    }
  });

  configurarAbaPrecos();
  return adicionados;
}

// ---------------------------------------------------------------------------
//  Pedidos e itens
// ---------------------------------------------------------------------------

function configurarAbaPedidos() {
  const sheet = obterOuCriarAba(ABAS.PEDIDOS);
  aplicarCabecalho(sheet, CABECALHO_PEDIDOS);

  const linhas = Math.max(sheet.getMaxRows() - 1, 1);

  sheet.getRange(2, COL_PEDIDO.NUMERO, linhas, 1).setNumberFormat(FORMATO_NUMERO_PEDIDO);
  sheet.getRange(2, COL_PEDIDO.DATA, linhas, 1).setNumberFormat(FORMATO_DATA_HORA);
  // Telefone como TEXTO. Sem isso o Excel come o zero a esquerda e ainda
  // transforma o numero em notacao cientifica.
  sheet.getRange(2, COL_PEDIDO.TELEFONE, linhas, 1).setNumberFormat('@');
  sheet.getRange(2, COL_PEDIDO.PRAZO, linhas, 1).setNumberFormat(FORMATO_DATA);
  sheet.getRange(2, COL_PEDIDO.TOTAL, linhas, 3).setNumberFormat(FORMATO_MOEDA);
  sheet.getRange(2, COL_PEDIDO.ENTRADA_PAGA_EM, linhas, 2).setNumberFormat(FORMATO_DATA_HORA);

  // Dropdown de status: o dono escolhe da lista em vez de digitar, o que
  // evita "em producao" vs "Em produção" quebrando filtro depois.
  const validacao = SpreadsheetApp.newDataValidation()
    .requireValueInList(LISTA_STATUS, true)
    .setAllowInvalid(false)
    .setHelpText('Escolha uma das etapas da lista.')
    .build();
  sheet.getRange(2, COL_PEDIDO.STATUS, linhas, 1).setDataValidation(validacao);

  aplicarCoresDeStatus(sheet, linhas);

  const largura = {
    1: 55, 2: 130, 3: 200, 4: 130, 5: 170, 6: 110, 7: 90, 8: 150,
    9: 260, 10: 100, 11: 110, 12: 120, 13: 160, 14: 130, 15: 130,
  };
  Object.keys(largura).forEach(function (col) {
    sheet.setColumnWidth(Number(col), largura[col]);
  });

  sheet.setFrozenColumns(1);
  sheet.getRange(2, COL_PEDIDO.OBSERVACOES, linhas, 1).setWrap(true);

  // Reescreve o saldo dos pedidos ja gravados. Serve pra consertar linhas que
  // ficaram com #ERROR! por causa da formula antiga, que usava IF() com
  // virgula e nao era entendida em planilha pt-BR.
  const ultimaLinha = sheet.getLastRow();
  if (ultimaLinha >= 2) {
    const total = ultimaLinha - 1;
    const numeros = sheet.getRange(2, COL_PEDIDO.NUMERO, total, 1).getValues();

    // Uma leitura e uma escrita, em vez de duas chamadas por linha.
    const formulas = numeros.map(function (valor, indice) {
      if (valor[0] === '' || valor[0] === null) return [''];
      return [formulaDoSaldo(indice + 2)];
    });

    sheet.getRange(2, COL_PEDIDO.SALDO, total, 1).setFormulas(formulas);
  }

  protegerComAviso(
    sheet,
    sheet.getRange(2, COL_PEDIDO.NUMERO, linhas, 1),
    'Nº do pedido — gerado automaticamente'
  );
  protegerComAviso(
    sheet,
    sheet.getRange(2, COL_PEDIDO.TOTAL, linhas, 3),
    'Valores — calculados pelo sistema'
  );
}

/** Uma cor por etapa: da pra ler o andamento da oficina de relance. */
function aplicarCoresDeStatus(sheet, linhas) {
  const alvo = sheet.getRange(2, 1, linhas, CABECALHO_PEDIDOS.length);
  const cores = [
    [STATUS.AGUARDANDO, '#fee2e2'],
    [STATUS.PAGO_50, '#fef3c7'],
    [STATUS.EM_PRODUCAO, '#dbeafe'],
    [STATUS.PRONTO, '#dcfce7'],
    [STATUS.ENTREGUE, '#e2e8f0'],
    [STATUS.CANCELADO, '#e5e5e5'],
  ];

  const colunaStatus = letraDaColuna(COL_PEDIDO.STATUS);
  const regras = cores.map(function (par) {
    return SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied('=$' + colunaStatus + '2="' + par[0] + '"')
      .setBackground(par[1])
      .setRanges([alvo])
      .build();
  });
  sheet.setConditionalFormatRules(regras);
}

function configurarAbaItens() {
  const sheet = obterOuCriarAba(ABAS.ITENS);
  aplicarCabecalho(sheet, CABECALHO_ITENS);

  const linhas = Math.max(sheet.getMaxRows() - 1, 1);
  sheet.getRange(2, COL_ITEM.NUMERO_PEDIDO, linhas, 1).setNumberFormat(FORMATO_NUMERO_PEDIDO);
  sheet.getRange(2, COL_ITEM.QUANTIDADE, linhas, 1).setNumberFormat('0');
  sheet.getRange(2, COL_ITEM.UNITARIO, linhas, 2).setNumberFormat(FORMATO_MOEDA);

  const largura = {
    1: 110, 2: 150, 3: 150, 4: 130, 5: 110,
    6: 90, 7: 60, 8: 180, 9: 120, 10: 120,
  };
  Object.keys(largura).forEach(function (col) {
    sheet.setColumnWidth(Number(col), largura[col]);
  });

  protegerComAviso(
    sheet,
    sheet.getRange(2, 1, linhas, CABECALHO_ITENS.length),
    'Itens — gravados pelo formulário'
  );
}

// ---------------------------------------------------------------------------
//  Grade de tamanhos
//
//  E a tela que evita o erro de corte: escolha o numero do pedido e veja
//  quantas pecas de cada tamanho, separadas por genero.
// ---------------------------------------------------------------------------

function configurarAbaGrade() {
  const sheet = obterOuCriarAba(ABAS.GRADE);
  sheet.clear();
  sheet.clearConditionalFormatRules();

  sheet.getRange('A1').setValue('Pedido nº').setFontWeight('bold');
  sheet.getRange('A2').setValue('Cliente').setFontWeight('bold');
  sheet.getRange('A3').setValue('Status').setFontWeight('bold');

  sheet.getRange('B1')
    .setBackground('#fef9c3')
    .setBorder(true, true, true, true, false, false)
    .setFontWeight('bold')
    .setNumberFormat(FORMATO_NUMERO_PEDIDO);

  // O separador de argumentos depende do idioma da planilha: virgula em
  // en-US, ponto-e-virgula em pt-BR. O setFormula() NAO traduz -- passar o
  // separador errado gera #ERROR! (erro de parse) em toda formula abaixo.
  const s = separadorDeArgumentos();

  // As letras das colunas saem das constantes, nunca escritas a mao.
  //
  // Ja escrevi 'Itens!$D:$D' fixo aqui e foi um erro esperando pra acontecer:
  // ao inserir a coluna Cor, genero/tamanho/quantidade andaram uma casa e a
  // grade passaria a somar a coluna errada SEM DAR ERRO NENHUM -- justamente
  // num sistema que existe pra nao errar o corte.
  const colPedido = letraDaColuna(COL_ITEM.NUMERO_PEDIDO);
  const colGenero = letraDaColuna(COL_ITEM.GENERO);
  const colTamanho = letraDaColuna(COL_ITEM.TAMANHO);
  const colQtd = letraDaColuna(COL_ITEM.QUANTIDADE);

  const faixa = function (letra) { return 'Itens!$' + letra + ':$' + letra; };

  sheet.getRange('B2').setFormula(
    '=IFERROR(VLOOKUP($B$1' + s + 'Pedidos!$A:$O' + s +
    COL_PEDIDO.CLIENTE + s + 'FALSE)' + s + '"")'
  );
  sheet.getRange('B3').setFormula(
    '=IFERROR(VLOOKUP($B$1' + s + 'Pedidos!$A:$O' + s +
    COL_PEDIDO.STATUS + s + 'FALSE)' + s + '"")'
  );

  sheet.getRange('A5').setValue('GRADE DE TAMANHOS').setFontWeight('bold').setFontSize(12);

  sheet.getRange('A6:E6')
    .setValues([['Tamanho', 'Masculino', 'Feminino', 'Unissex', 'Total']])
    .setFontWeight('bold')
    .setBackground('#1e293b')
    .setFontColor('#ffffff');

  // Linha de total por genero. Fica ACIMA da lista de tamanhos de proposito:
  // a lista abaixo cresce sozinha conforme a aba Tamanhos, entao qualquer
  // coisa fixa embaixo dela seria atropelada.
  sheet.getRange('A7').setValue('TOTAL').setFontWeight('bold');
  sheet.getRange('B7:E7').setFormulas([
    ['B', 'C', 'D'].map(function (col) {
      return '=SUMIFS(' + faixa(colQtd) + s + faixa(colPedido) + s + '$B$1' + s +
        faixa(colGenero) + s + col + '$6)';
    }).concat(['=SUM(B7:D7)']),
  ]);
  sheet.getRange('A7:E7').setFontWeight('bold').setBackground('#e2e8f0');

  // Os tamanhos vem da aba Tamanhos, na ordem cadastrada la (PP, P, M, G...),
  // e nao em ordem alfabetica -- que colocaria G antes de P.
  sheet.getRange('A8').setFormula(
    '=IFERROR(FILTER(Tamanhos!A2:A100' + s + 'Tamanhos!C2:C100=TRUE' + s +
    'Tamanhos!A2:A100<>"")' + s + '"")'
  );

  // Monta tudo num array e grava numa chamada so.
  //
  // Antes era um setFormula por celula: 33 linhas x 4 colunas = 132 idas e
  // voltas ao servidor do Google, o que sozinho levava mais de um minuto.
  const ULTIMA = 40;
  const formulasGrade = [];
  for (let linha = 8; linha <= ULTIMA; linha++) {
    const celulas = ['B', 'C', 'D'].map(function (col) {
      return '=IF($A' + linha + '=""' + s + '""' + s +
        'SUMIFS(' + faixa(colQtd) + s + faixa(colPedido) + s + '$B$1' + s +
        faixa(colTamanho) + s + '$A' + linha + s + faixa(colGenero) + s +
        col + '$6))';
    });
    celulas.push(
      '=IF($A' + linha + '=""' + s + '""' + s +
      'SUM(B' + linha + ':D' + linha + '))'
    );
    formulasGrade.push(celulas);
  }
  sheet.getRange(8, 2, formulasGrade.length, 4).setFormulas(formulasGrade);

  sheet.getRange('A6:E' + ULTIMA).setHorizontalAlignment('center');
  sheet.getRange('A6:A' + ULTIMA).setHorizontalAlignment('left');
  sheet.setColumnWidth(1, 130);
  [2, 3, 4, 5].forEach(function (c) { sheet.setColumnWidth(c, 110); });

  // Destaca so os tamanhos que realmente tem peca no pedido.
  // Multiplicacao no lugar de AND(a,b): sem argumento, sem separador, sem
  // depender do idioma da planilha. TRUE*TRUE = 1, que conta como verdadeiro.
  const regra = SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied('=($A8<>"")*($E8>0)')
    .setBackground('#dcfce7')
    .setRanges([sheet.getRange('A8:E' + ULTIMA)])
    .build();
  sheet.setConditionalFormatRules([regra]);

  const validacao = SpreadsheetApp.newDataValidation()
    .requireValueInRange(aba(ABAS.PEDIDOS).getRange('A2:A'), true)
    .setAllowInvalid(true)
    .setHelpText('Escolha o número de um pedido já registrado.')
    .build();
  sheet.getRange('B1').setDataValidation(validacao);
}

function configurarAbaOrdemProducao() {
  const sheet = obterOuCriarAba(ABAS.ORDEM);
  if (abaVazia(sheet)) {
    sheet.getRange('A1')
      .setValue('Use o menu "Pedidos > Gerar ordem de produção" para preencher esta aba.')
      .setFontStyle('italic')
      .setFontColor('#64748b');
    sheet.setColumnWidth(1, 720);
  }
}

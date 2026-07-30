# Sistema de Pedidos — Fardamentos Personalizados

O cliente preenche um formulário no celular e vê na hora o **valor total** e a
**entrada de 50%**. O dono recebe tudo numa planilha do Google, com a grade de
tamanhos já somada, controle de pagamento e ordem de produção pra imprimir.

- **Front:** React + Vite + TypeScript + Tailwind (site estático)
- **Backend e banco:** Google Apps Script + Google Sheets (sem servidor, sem custo)

---

## Como funciona

```
Cliente (celular)                 Google Apps Script            Planilha
─────────────────                 ──────────────────            ────────
formulário React    ── POST ──▶   recalcula o preço    ──▶      aba Pedidos
mostra o total                    gera o nº do pedido           aba Itens
                    ◀── nº ──     salva o logo no Drive         aba Grade
```

**O preço nunca vem do navegador.** O que o site calcula serve só pra mostrar na
tela; ao receber o pedido, o Apps Script joga fora qualquer valor enviado e
recalcula tudo lendo a aba `Preços`. Quem adulterar a requisição não muda o
valor gravado.

---

## Ver a interface sem configurar o Google

Pra só olhar o formulário e mexer no visual, não precisa de planilha nenhuma:

```bash
npm install
npm run dev
```

Sem `.env.local`, o app entra em **modo demonstração**: usa um catálogo de
exemplo embutido (`src/lib/demo.ts`), com as mesmas peças, tecidos e preços que
o `configurarPlanilha()` vai criar na planilha de verdade. Dá pra montar um
pedido, ver o total e a entrada de 50% sendo calculados, e chegar na tela de
confirmação. **Nada é salvo.**

Uma faixa âmbar fica no topo o tempo todo avisando disso.

O modo demo **só existe em desenvolvimento** e desaparece assim que
`VITE_APPS_SCRIPT_URL` existir. Em build de produção ele é removido do bundle —
se o site for publicado sem a variável, o cliente vê uma tela de erro, e não um
formulário que aceita pedidos e os joga fora.

> Mexeu nos preços de exemplo do `Setup.gs`? Atualize `src/lib/demo.ts` também,
> senão o que você vê local deixa de bater com a planilha.

---

## Instalação

### 1. Criar a planilha e subir o código (clasp)

O [clasp](https://github.com/google/clasp) é a CLI oficial do Apps Script. Já
vem como dependência de desenvolvimento do projeto.

**Antes de tudo:** ative a API em
<https://script.google.com/home/usersettings> (*"API Google Apps Script"*).
Esquecer disso é a falha nº 1, e o erro que aparece não menciona a causa.

```bash
npx clasp login          # abre o navegador

npx clasp create-script --type sheets \
  --title "Pedidos — Fardamentos" \
  --rootDir apps-script

npm run gs:push          # sobe os 4 .gs + o manifesto
```

> **`gs:push` usa `clasp push -f`** de propósito. Sem o `-f` o clasp não
> substitui o `appsscript.json` remoto, e aí a implantação não herda
> `access: ANYONE_ANONYMOUS` — o formulário quebraria para o cliente anônimo.

O comando `create-script` cria uma planilha nova no seu Drive já com o script
vinculado. O link dela aparece na saída.

> **clasp 3.x renomeou comandos:** é `create-script` (não `create`),
> `create-deployment` (não `deploy`) e `list-deployments` (não `deployments`).
> Tutoriais antigos falham.

<details>
<summary>Alternativa: copiar e colar pelo navegador (sem clasp)</summary>

1. Abra <https://sheets.new> e dê um nome (ex: *Pedidos — Fardamentos*).
2. Menu **Extensões → Apps Script**.
3. Apague o `Código.gs` que vem por padrão.
4. Crie um arquivo para cada `.gs` da pasta `apps-script/` (botão **+** ao lado
   de "Arquivos") e cole o conteúdo: `Comum.gs`, `Setup.gs`, `WebApp.gs`,
   `Menu.gs`.
5. Na engrenagem (**Configurações do projeto**), marque *"Mostrar arquivo de
   manifesto appsscript.json"*. Abra o arquivo que apareceu e substitua pelo
   conteúdo de `apps-script/appsscript.json`.
6. Salve (Ctrl+S).

São ~1.580 linhas em 5 arquivos, e toda alteração futura num `.gs` exige
recolar. Por isso o clasp é o caminho recomendado.

</details>

### 2. Montar as abas

No editor do Apps Script, selecione a função **`configurarPlanilha`** na lista
suspensa e clique em **Executar**.

O Google vai pedir autorização na primeira vez — é normal, é o seu próprio
script acessando a sua própria planilha. Em *"O Google não verificou este app"*,
clique em **Avançado → Acessar (nome do projeto)**.

Isso cria as 8 abas já formatadas, com dropdowns, fórmulas e **preços de
exemplo**. Ajuste os valores na aba `Preços` antes de usar pra valer.

### 3. Publicar o Web App

```bash
npm run gs:deploy        # clasp create-deployment
npx clasp list-deployments
```

A URL é `https://script.google.com/macros/s/{deploymentId}/exec`. As permissões
(*Executar como: Eu* / *Quem pode acessar: Qualquer pessoa*) vêm do bloco
`webapp` do `apps-script/appsscript.json`, então já saem certas.

> **Cada `create-deployment` gera uma URL nova.** Depois que o site estiver
> publicado, atualize a implantação existente em vez de criar outra:
> `npx clasp create-deployment --deploymentId <id>`. Assim a URL não muda.

<details>
<summary>Alternativa: publicar pelo navegador</summary>

1. **Implantar → Nova implantação**, tipo **App da Web**
2. **Executar como: Eu**
3. **Quem pode acessar: Qualquer pessoa**

   ⚠️ Tem que ser *"Qualquer pessoa"*, **não** *"Qualquer pessoa com conta
   Google"*. Com a segunda opção o cliente cai numa tela de login.
4. Copie a **URL do app da Web** (termina em `/exec`).

Editou um `.gs`? Faça **Implantar → Gerenciar implantações → lápis → Versão:
Nova versão**, senão a URL continua servindo o código antigo.

</details>

### 4. Configurar o site

```bash
cp .env.example .env.local
```

Edite o `.env.local`:

```
VITE_APPS_SCRIPT_URL=https://script.google.com/macros/s/SEU_ID/exec
VITE_WHATSAPP_LOJA=5511999999999
```

Confira se ficou tudo certo antes de abrir o navegador:

```bash
npm run verificar
```

Ele diz exatamente o que está errado — variável em branco, URL `/dev` no lugar
de `/exec`, página de login em vez de JSON, catálogo vazio. **Não testa CORS**
(isso só o navegador exerce), mas pega a causa mais comum por trás do
`Failed to fetch`.

```bash
npm run dev
```

### 5. Publicar o site

```bash
npm run build
```

Suba a pasta `dist/` na Vercel, Netlify ou GitHub Pages e cadastre as duas
variáveis de ambiente no painel do serviço escolhido. O link resultante é o que
vai pros clientes.

---

## Uso no dia a dia (o dono)

Tudo acontece no menu **📋 Pedidos**, dentro da planilha:

| Ação | O que faz |
|---|---|
| **Ver grade do pedido selecionado** | Abre a aba `Grade` com a soma por tamanho e gênero |
| **Gerar ordem de produção** | Monta a aba `Ordem de Produção`, pronta pra imprimir |
| **Baixar ordem em Excel (.xlsx)** | Exporta só essa ordem e salva no Drive |
| **Marcar entrada de 50% como paga** | Carimba a data e avança o status |
| **Marcar saldo como pago** | Carimba a data e fecha o pedido |
| **Atualizar matriz de preços** | Adiciona à aba `Preços` as peças/tecidos novos |

O menu usa o pedido da linha onde o cursor está. Se estiver em outra aba, ele
pergunta o número.

### Mudar preços

Só editar a aba **`Preços`** — é uma matriz de peça × tecido. Célula vazia
significa "não oferecemos essa combinação", e ela nem aparece pro cliente.
Cadastrou peça ou tecido novo? Rode *Atualizar matriz de preços* pra criar a
linha/coluna correspondente.

Acréscimo por tamanho grande (XG, XXG) fica na aba **`Tamanhos`**.

> A **ordem** das linhas na aba `Tamanhos` define a ordem da grade. Ela é
> proposital: PP, P, M, G, GG… Em ordem alfabética o G viria antes do P.

---

## Verificação

Depois de instalar, vale rodar estes testes:

1. **Preço** — monte um pedido no site e confira o total contra a aba `Preços`.
2. **Segurança do preço** *(o mais importante)* — envie um pedido e confira que
   a coluna `Valor unitário` da aba `Itens` bate com a aba `Preços`. Pra testar
   a fundo, altere o payload pelas ferramentas de desenvolvedor: o valor
   gravado tem que sair correto de qualquer jeito.
3. **Concorrência** — envie 5 pedidos quase juntos e confira que saíram 5
   números sequenciais distintos, sem linha sobrescrita.
4. **Grade** — compare a aba `Grade` com os itens digitados, um por um.
5. **Excel** — baixe o `.xlsx` e abra no Excel: acentuação correta e telefone
   preservado como texto (sem virar número).
6. **Celular** — `npm run dev -- --host` e envie um pedido de verdade pelo
   telefone.

A lógica de preço do front tem cobertura de teste (arredondamento da entrada,
linha incompleta, combinação sem preço cadastrado). Ela precisa continuar
idêntica à do `apps-script/WebApp.gs` — **mexeu numa, mexa na outra.**

---

## Limites conhecidos

Escolhas conscientes de uma arquitetura simples:

- **Quem tem o link da planilha edita tudo.** Não há permissão por usuário —
  compartilhe só com quem precisa.
- **O dono pode quebrar uma fórmula sem querer.** As colunas críticas avisam
  antes de aceitar edição, mas ele consegue remover a proteção.
- **O endpoint é público.** O nonce de uso único e o honeypot cortam bot
  simples; um ataque dirigido conseguiria inflar a planilha. Se acontecer, o
  caminho é adicionar reCAPTCHA ou trocar o backend.
- **Escala.** Confortável até alguns milhares de pedidos. Acima disso o Sheets
  fica lento e vale reconsiderar um banco de verdade.

---

## Estrutura

```
apps-script/       Backend — cole no editor do Apps Script
  Comum.gs         Constantes das abas/colunas e leitura do catálogo
  Setup.gs         configurarPlanilha() — monta tudo. Rode uma vez.
  WebApp.gs        doGet/doPost. É aqui que o preço é recalculado.
  Menu.gs          O menu 📋 Pedidos dentro da planilha
src/
  lib/api.ts       Conversa com o Apps Script (atenção ao CORS — veja o arquivo)
  lib/pricing.ts   Cálculo do preview — espelho do WebApp.gs
  lib/schema.ts    Validação do formulário (zod)
  pages/           Formulário e confirmação
  components/      Linha do pedido, resumo de valores, campo
```

## Solução de problemas

| Sintoma | Causa provável |
|---|---|
| `Failed to fetch` no console | A implantação está como *"Qualquer pessoa com conta Google"*. Troque pra *"Qualquer pessoa"*. |
| "O servidor respondeu algo que não é JSON" | Mesma causa acima — o Google devolveu HTML de login. |
| "Sua sessão expirou" ao enviar | O nonce vale 15 min. Recarregue a página. |
| Alteração no `.gs` não surtiu efeito | Faltou publicar **Nova versão** da implantação. |
| Preço não aparece pro cliente | A combinação peça × tecido está vazia na aba `Preços`. |

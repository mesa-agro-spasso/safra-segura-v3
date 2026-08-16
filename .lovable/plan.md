# Mercado Físico (modelo de cotações) + multi-unidade + Pendências no menu

## O que muda para o usuário

- A aba **Físico** em /mercado deixa de ser placeholder e ganha três visões: **Painel**, **Por praça** e **Calendário**, com cadastro de cotações e "repetir cotação de ontem".
- O preço físico exibido no app passa a ser o **preço canônico do dia** (valor presente calculado pela API), não mais uma cotação nominal qualquer.
- No cadastro (signup) e na aba Usuários, a **Unidade** vira **multi-seleção** (ou "Sede", que dá acesso a tudo).
- **Pendências** sai de /cadastros e vira item de menu lateral, visível a todos os usuários ativos, agora também listando usuários aguardando aprovação.

## Tarefa 1 — Allowlist do api-proxy

`supabase/functions/api-proxy/index.ts`: adicionar `/physical-prices/normalize` a `ALLOWED_POST_ENDPOINTS`.

## Tarefa 2 — Repontar `useLatestPhysicalPrices` (crítico)

`src/hooks/usePhysicalPrices.ts`:
- Passa a ler `physical_prices_daily` (última linha por `location_id` × commodity) e a resolver praça → armazéns via `warehouses.location_id`, devolvendo uma linha por (warehouse_id, commodity).
- **Assinatura e shape de retorno preservados** (`warehouse_id`, `commodity`, `reference_date`, `price_brl_per_sack`, `updated_at` ← `computed_at`), para que MTM (OperacoesD24), ArmazensD24/BlockTradeExecutionModal e o card do Cockpit continuem funcionando sem alteração.
- Novos hooks separados para a tela Físico (painel por praça, cotações por praça/período, contagem por dia, repetir de ontem).

## Tarefa 3 — Aba Físico em /mercado

`src/pages/market/MarketFisico.tsx` reescrita com três sub-visões e um modal de cadastro.

**A) Painel** (padrão, todos os usuários, todas as praças): último preço canônico por praça × commodity de `physical_prices_daily`. Colunas: praça, commodity, preço (R$/sc), data de referência, selo de defasagem (amarelo > 36h, vermelho > 72h) e selo discreto "calculando VP" quando existirem cotações mais novas ainda sem `present_value_brl`. Ao montar, dispara `POST /physical-prices/normalize` em fire-and-forget (sem spinner, sem bloquear).

**B) Por praça**: seletor de praça (restrito às praças do usuário; Sede vê todas), lista dos vencedores diários (data desc), filtro de período (início/fim) e chave "todas as cotações" que mostra a lista completa de cotações (comprador, preço nominal, data de pagamento, VP quando houver, origem).

**C) Calendário**: grade mensal por praça × commodity com a contagem de cotações por dia; dias sem cotação visualmente distintos; clique no dia abre o modal já com a data preenchida.

**Modal de cadastro**: praça (restrita), commodity, data de referência (hoje por padrão, passado permitido), comprador, preço, data de pagamento (com botões rápidos +3d e +30d relativos à data de referência; validação `>= data de referência`), incoterm fixo com única opção "FOB", notas. Aviso fixo: "Preços PF ou de cooperativa não devem ser lançados." Salvamento: INSERT direto em `physical_prices` com `source='manual'`, `created_by`, `warehouse_id` intocado, `present_value_brl` nulo; depois normalize em fire-and-forget. Erro de duplicidade traduzido via `pgErrorMessage`.

**Repetir cotação de ontem** (por praça × commodity, botão na linha do Painel e no cabeçalho de "Por praça"): lê o diário de ontem → `winning_quote_id` → copia comprador, preço, incoterm, flags e notas para hoje, preservando o prazo (`nova data de pagamento = hoje + (pagamento − referência) original`), `source='repeat_previous'`. Desabilitado se não houver diário de ontem; restrito às praças do usuário; diálogo de confirmação mostrando o que será copiado.

O frontend não calcula valor presente nem desconto — apenas exibe o que a API publicou.

## Tarefa 4 — Multi-unidade

- `src/pages/Login.tsx`: Unidade vira multi-select com "Sede (acesso a todas as unidades)" + itens da RPC `list_signup_units`; Sede é mutuamente exclusiva. A etapa de confirmação destaca as unidades escolhidas. Metadata passa a enviar `warehouse_ids` como array JSON; quando Sede, a chave é omitida. `warehouse_id` sai da metadata.
- `src/components/cadastros/UsersTab.tsx`: mesmo multi-select na edição (grava `users.warehouse_ids`); coluna Unidade mostra os nomes das unidades ou "Sede". Leitura/escrita de `users.warehouse_id` removida (inclusive no diálogo de aprovação e no tipo `UserProfile`/AuthContext).
- Componente compartilhado de seleção de unidades reaproveitado nos dois lugares.

## Tarefa 5 — Pendências no menu lateral

- Nova rota `/pendencias` (`src/pages/Pendencias.tsx`) e item na sidebar visível a todo usuário ativo.
- Seção 1: pendências de cadastro (`v_registry_pending`) exatamente como hoje (conteúdo do `PendingTab` reaproveitado).
- Seção 2: "Cadastros de usuários aguardando aprovação" — nome, cargo e unidades dos usuários com `status='pending'`; atalho "Aprovar" apenas para admins (não-admins veem só a lista); a aprovação em si continua em /cadastros > Usuários.
- Aba "Pendências" removida de `Cadastros.tsx`; links profundos existentes para `?tab=pending` passam a apontar para a nova rota.

## Notas técnicas

- Praças do usuário: derivadas de `users.warehouse_ids` → `warehouses.location_id` (distintos); vazio/nulo = Sede (todas). Hook novo `useMyLocations`.
- Chamadas à API sempre via `callApi` (edge function `api-proxy`); normalize é disparado com `void`/catch silencioso.
- Sem alterações de banco e sem novas edge functions.
- Textos em português do Brasil.

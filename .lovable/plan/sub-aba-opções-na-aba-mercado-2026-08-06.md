# Sub-aba Opções na aba Mercado

Nova sub-aba **Opções** (Físico · Futuros · Dólar · Opções), falando só com o Supabase. Nenhum cálculo, nenhuma conversão de unidade, nenhuma chamada ao backend.

## Seção 1 — Opções cadastradas

Tabela das opções com `active = true`: label, commodity, benchmark, ticker do futuro, tipo (call/put), strike na unidade do par e vencimento. Strike aparece com a unidade escrita ao lado do número (`US$ 12,20 /bushel` ou `R$ 68,00 /saca`), não só no cabeçalho.

Vencimentos passados aparecem marcados como vencidos (aviso visual, sem sumir da lista).

**Cadastrar opção** — diálogo com: label, commodity, benchmark, ticker do futuro, tipo, strike, vencimento. O formulário obedece as regras do banco antes de enviar:
- Benchmark restringe a commodity: `cbot` aceita soja e milho; `b3` aceita só milho. Combinações fora de `soybean+cbot`, `corn+cbot`, `corn+b3` não são oferecidas.
- Um campo de strike só, cuja unidade muda com o benchmark: CBOT grava `strike_usd_bushel` e manda `strike_brl_sack` nulo; B3 o contrário. A unidade fica escrita dentro do campo e no rótulo.
- Strike maior que zero.
- `created_by` = usuário logado; `active` = true.

**Aposentar opção** — confirma e faz `active = false`. Nunca deleta; o texto do diálogo diz por quê (há cotações históricas apontando para ela).

## Seção 2 — Cotação do dia

Uma linha por opção ativa com: label, prêmio mais recente na unidade do par, **a data do pregão daquela cotação** e um campo para registrar nova.

- Quando não existe cotação com `trade_date` = hoje, a linha ganha um marcador visível ("Sem cotação hoje", em cor de aviso) — é o sinal de que falta fazer.
- Sem cotação nenhuma: "Nunca cotada".
- Registrar sempre **insere** uma linha nova em `insurance_option_quotes` (`option_id`, `benchmark` copiado da opção, prêmio no campo da unidade certa, `trade_date` editável com padrão hoje, `created_by`). Nada de update, nada de upsert.
- Cada linha expande e mostra o histórico completo daquela opção, mais recente primeiro, com data e horário do registro.

## Estrutura de abas

Entrada nova no array de abas de `src/pages/Market.tsx`, atrás de um feature flag `MARKET_OPTIONS` em `src/config/features.ts` (ligado por `.env`), no mesmo padrão de Físico e Histórico.

## Fora de escopo

- Nenhum cálculo e nenhuma conversão de unidade.
- Nada em `insurance_snapshots`, nada na tela de precificação, nada nas outras sub-abas.
- Nenhuma chamada ao backend Python.
- Nenhuma alteração de schema — as duas tabelas e a RLS já existem.

## Detalhe técnico

- `src/hooks/useInsuranceOptions.ts`: `useInsuranceOptions()` (ativas), `useCreateInsuranceOption()`, `useRetireInsuranceOption()`, `useLatestOptionQuotes()` (busca ordenada por `trade_date`/`created_at` e deduplica por `option_id` no cliente, mesmo padrão de `useLatestPhysicalPrices`), `useOptionQuoteHistory(optionId)`, `useCreateOptionQuote()`. Todas com `logActivity`, como os outros hooks de escrita.
- `src/pages/market/MarketOpcoes.tsx`: a tela, com as duas seções.
- `src/components/market/InsuranceOptionFormDialog.tsx`: cadastro, com a lógica de unidade por benchmark e validação por zod (como os outros formulários do projeto).
- `src/components/market/OptionQuoteHistoryRow.tsx` (ou expansão inline na tabela): histórico por opção.
- Datas de vencimento e de pregão usam o `DateInput` já existente.

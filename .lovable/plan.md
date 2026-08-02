# Card de Mercado editável no cockpit

O card de Mercado deixa de ser somente leitura. A operadora edita a cotação sem sair do cockpit, com a mesma mecânica da aba Mercado → Bolsa, e o Publicar trava até recalcular.

## O que muda na tela

Dentro do card de Mercado:

- **Dólar (USD/BRL)** — edição manual do valor no card do topo (é o `ndf_override`/preço manual, mesma escrita da aba Mercado).
- **Preço de qualquer ticker CBOT** (Soja e Milho) — lápis por linha, campo inline, confirma com Enter ou no botão.
- **Preço do milho B3** — entrada manual por linha, como já é na aba Mercado.
- **Botão "Atualizar cotações"** — dispara o mesmo fetch automático (yfinance) da aba Mercado. Dois itens num menu, iguais aos de lá: "Atualizar tudo" (inclui câmbio) e "Atualizar mercados" (preserva o câmbio manual).

Faixa fixa no topo do card, sempre visível:

> Editar cotação grava na hora em `market_data` — vale para todo mundo, inclusive na aba Mercado. Recarregar a página não desfaz.

Cada linha editada nesta sessão fica com marca âmbar no valor até o próximo recálculo — mesma linguagem visual do card de parâmetros —, mas a marca aqui significa "já gravado, falta recalcular", não "pendente de gravação". O texto da faixa deixa isso explícito.

## Trava do Publicar

Hoje a trava (`dirty`) vem só de `pendingMap` (custos e datas). Passa a ter uma segunda origem: **cotação mexida desde o último recálculo**.

- Qualquer gravação de cotação feita pelo card (manual ou pelo botão de atualizar) marca o cockpit como sujo.
- Recalcular limpa essa marca, junto com as pendências de parâmetro.
- Publicar continua bloqueado enquanto houver qualquer uma das duas.
- O aviso âmbar do topo da página passa a citar o motivo: linhas editadas, cotação alterada, ou ambos.
- O card da tabela de preços marca **todas** as linhas como desatualizadas quando a cotação mudou (não só as com parâmetro editado), com a mesma marca de "não recalculado" que já existe.

Como o recálculo lê `spot_usd_brl` e os tickers de `marketData` (React Query), mudar o dólar e recalcular produz preços diferentes automaticamente — a invalidação de `market_data` que a escrita já faz atualiza a fonte antes do próximo cálculo.

## Escopo

Não são tocados: `src/pages/market/**`, o card de parâmetros, `cockpitPayload.ts`, o layout salvo, os hooks de mercado e a mecânica de recalcular/publicar (só ganha uma condição a mais na trava).

## Detalhes técnicos

- `src/components/cockpit/cards/MarketCard.tsx` reescrito: reutiliza `useMarketData`, `useUpsertMarketData`, `usePricingParameters`, `useConvertedPrices` e `callApi('/market/quotes' | '/market/b3-corn-quotes')` — nenhum hook é modificado.
- A lógica de fetch/persistência da aba Mercado (`fetchQuotes`, `persistFX`, `persistSoybean`, `persistCornCBOT`, `persistCornB3`, `syncCommodityBatch`) é extraída para `src/components/cockpit/marketWrites.ts`, funções puras que recebem os hooks/mutação como argumento. `MarketBolsa.tsx` fica como está — sem duplicar regra no cockpit e sem alterar a aba.
- Novas props do `MarketCard`: `onQuoteChanged: (tickers: string[]) => void`.
- `src/pages/Cockpit.tsx`: novo estado `quotesDirty: boolean` (+ conjunto de tickers alterados para a mensagem). `dirty = pendingIds.size > 0 || quotesDirty`. `handleRecalculate` zera `quotesDirty` no sucesso.
- `PriceTableCard` ganha a prop `staleAll?: boolean`; quando `true`, todas as linhas recebem o mesmo esmaecido e o selo "não recalculado".
- Zero aritmética financeira nova: preço em R$/sc continua vindo de `POST /utils/convert-prices`; nenhuma conversão local.

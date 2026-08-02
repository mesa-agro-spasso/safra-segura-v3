# Cockpit de Precificação — refazer como painel de cards

Mantidos: rota `/cockpit`, item de menu, `src/lib/cockpitPayload.ts` (payload em camadas, snapshots, recalcular/publicar). Substituídos: `src/pages/Cockpit.tsx` e `src/components/cockpit/CockpitRow.tsx` (este some).

## Estrutura

Nova pasta `src/components/cockpit/`:

- `CockpitShell.tsx` — grade de cards, arrastar para reordenar, remover, adicionar (menu "Adicionar card"), botão "Salvar layout".
- `cards/PriceTableCard.tsx` (card 1, fixo)
- `cards/MarketCard.tsx` (card 2)
- `cards/PhysicalPricesCard.tsx` (card 3, desabilitado por padrão)
- `cards/ParametersCard.tsx` (card 4)

`src/pages/Cockpit.tsx` fica só com o estado compartilhado: overrides por combinação, resultado do recálculo, flag de "sujo", publicar.

## Card 1 — Tabela de preços (fixo)

- Largura total, 10 linhas visíveis com rolagem interna.
- Colunas iguais às da aba Tabela de Preços: praça, commodity, ticker, recepção, pagamento, venda, basis alvo, futuros (BRL), câmbio, preço de originação — todas lidas do topo do snapshot / do topo da resposta do recálculo, nunca de `engine_result`.
- Filtros: pills de commodity e select de praça (só filtro de exibição).
- Abre com o último lote publicado (mesma regra de `created_at` máximo já usada). Combinação ativa fora do lote: linha com "sem preço no lote vigente".
- Botões RECALCULAR e PUBLICAR ficam aqui. Publicar travado enquanto houver edição não recalculada.
- Linha cujo parâmetro foi editado e ainda não recalculado aparece esmaecida com a marca "não recalculado".

## Card 2 — Mercado (bolsa)

Somente leitura. Três listas colapsáveis (Soja CBOT, Milho CBOT, Milho B3) alimentadas por `useMarketData` e pelos `ticker_count` por mercado de `usePricingParameters`, com o mesmo corte de vencidos e as mesmas colunas da aba Mercado (preço, unidade, vencimento, NDF estimado/spread, atualização). Card de USD/BRL no topo. A conversão R$/sc reaproveita `useConvertedPrices`.

## Card 3 — Preços físicos

Somente leitura, via `useLatestPhysicalPrices`: praça, commodity, data de referência, preço. Não entra no layout padrão; a operadora adiciona pelo menu.

## Card 4 — Parâmetros das combinações

- Tabela: uma linha por combinação ativa, sem expandir. Colunas: praça, commodity, ticker, juros, período dos juros (leitura), armazenagem, tipo de armazenagem, recepção, corretagem, mesa (%), quebra, desconto adicional, basis alvo.
- Todo campo mostra número: valor da combinação; se nulo, o valor do armazém já preenchido no input. Nada de rótulo "herdado" no lugar do número.
- Campo editado nesta sessão fica visivelmente marcado no próprio input: fundo âmbar e borda âmbar espessa, mantidos até o recálculo. Depois de recalcular, a marca passa a um estado "aplicado" (borda em cor primária, sem fundo) até publicar, para a operadora saber quais linhas causaram a mudança de preço.
- Basis alvo e desconto adicional só editáveis em `LONG_BASIS`; em `TARGET_PRICE` ficam desabilitados.
- Botão RECALCULAR neste card também (sem publicar).
- Entrada aceita vírgula decimal, como hoje.

## Layout salvo

`public.cockpit_layouts` (já existe, com RLS). Novo hook `src/hooks/useCockpitLayout.ts`: leitura por `user_id` e upsert no botão salvar.

Formato do JSON:

```json
{ "version": 1, "cards": [{ "id": "price_table" }, { "id": "parameters" }, { "id": "market" }] }
```

Cards ausentes da lista estão removidos; `price_table` é reinserido no topo se faltar. Padrão sem `physical_prices`.

## Recalcular e publicar

Sem mudança de mecânica: `buildCockpitPayload` monta as camadas `combination`/`warehouse` com os overrides na camada da combinação; `POST /pricing/table` não grava nada; publicar grava `pricing_snapshots` (spread do objeto inteiro) e depois `pricing_combinations`, com o diálogo nominal de falha parcial já existente. Valores iniciais sempre do cadastro vivo, nunca do snapshot.

## Detalhes técnicos

- Arrastar: `@dnd-kit/core` + `@dnd-kit/sortable`, com alça de arraste no cabeçalho de cada card. Sem setas.
- Nada de aritmética financeira nova: todos os números vêm de `pricing_snapshots`, da resposta de `/pricing/table` ou das tabelas de mercado.
- Escopo negativo respeitado: nenhum arquivo de PricingTable, GeneratePricingModal, Market, Settings, hooks existentes, Edge Functions ou schema é alterado.

## Sugestões de cards (não implementar agora)

- **Frescor dos dados** — idade de cada fonte (market_data, físico, último lote) em horas; evita publicar preço sobre cotação velha.
- **Diferença vs. lote vigente** — preço recalculado menos preço publicado por linha (número vindo da API em duas leituras); mostra o tamanho da mudança antes de publicar.
- **Basis publicado vs. breakeven** — campos `purchased_basis_brl` / `breakeven_basis_brl` já gravados no snapshot; mostra a margem de cada linha.
- **Histórico de basis da praça** — `historical_basis` por praça/commodity/ano; contexto para escolher o basis alvo.
- **Preço físico vs. preço de originação** — comparação lado a lado das duas colunas já existentes; mostra se a mesa está competitiva na praça.
- **Combinações descartadas / puladas** — o que ficou fora do último recálculo e por quê; hoje aparece solto na página.
- **Últimos lotes publicados** — data/hora, quem publicou e quantas linhas, de `pricing_snapshots`; rastreia o que está valendo.
- **Registro de atividade do cockpit** — filtro do `activity_log` nas ações de precificação; auditoria sem sair da tela.
- **Parâmetros globais em leitura** — arredondamento, spread de execução, câmbio (`fx_parameters`); explica números que a operadora não controla na linha.
- **Curva de vencimentos por commodity** — tickers e vencimentos em ordem, de `market_data`; ajuda a ver rolagem. *(depende só de dado existente)*
- **Alerta de contrato vencendo** — linhas cujo ticker vence em menos de N dias; precisa apenas de uma regra de N, sem dado novo.


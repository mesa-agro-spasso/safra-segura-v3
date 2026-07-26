## Por que CCMN26 aparece

Confirmado no banco: a linha `market_data` de `CCMN26` (commodity `MILHO`, B3) tem `exp_date = 2026-07-14` (já vencida) e `updated_at = 23/07` — por isso entra no alerta "Milho B3 desatualizado" e nos chips de frescor.

Duas causas somadas:

1. **Nada apaga tickers B3 vencidos.** O `syncCommodityBatch` em `src/pages/market/MarketBolsa.tsx` (que remove tickers fora do lote da API) só roda para `SOJA` e `MILHO_CBOT`. O `persistCornB3` (linhas 216-248) apenas **insere** tickers novos que a API traz e recarrega tudo que existe em `market_data` — nunca remove os que a API deixou de retornar. A linha de CCMN26 continua lá desde antes do vencimento.
2. **A Tabela de Preços não filtra vencidos.** Em `src/pages/PricingTable.tsx` o `visibleMarket` (linhas 53-62) ordena por `exp_date` e corta pelos limites configurados, mas não descarta `exp_date < hoje`. A aba Mercado já filtra (`isNotExpired`, linha 409 de `MarketBolsa.tsx`), por isso o ticker some lá e permanece aqui.

## Correção proposta

**1. Filtrar vencidos na Tabela de Preços (efeito imediato na tela)**
- Em `PricingTable.tsx`, dentro de `visibleMarket`, aplicar o mesmo critério da aba Mercado: manter apenas linhas com `exp_date >= hoje` (FX segue sempre incluído, pois não tem `exp_date`). O corte por `cbotQty`/`b3Qty` passa a ser feito depois do filtro, garantindo que a contagem configurada mostre contratos válidos.
- Consequência: CCMN26 sai dos chips e do alerta de "Milho B3 desatualizado".

**2. Espelhar o lote da B3 no banco (corrige a origem)**
- Em `persistCornB3`, após os inserts, remover de `market_data` as linhas com `commodity = 'MILHO'` cujo ticker não está no lote retornado por `/market/b3-corn-quotes` — mesma regra e mesma ordem já usadas por `syncCommodityBatch` (nunca apagar com lote vazio; inserir primeiro, deletar depois; log via `logActivity('market_data.sync', ..., 'MILHO')`; toast específico se a limpeza falhar).
- Reaproveitar `syncCommodityBatch` passando `'MILHO'` em vez de duplicar lógica.

**3. Limpeza pontual do registro atual**
- Após o ajuste, uma execução de "Atualizar Mercado" já remove CCMN26 automaticamente. Não é necessária migration nem alteração de schema.

## Notas técnicas
- Nenhum cálculo financeiro no frontend; apenas filtro de exibição e sincronização de linhas.
- Sem mudanças em `persistSoybean`, `persistCornCBOT`, `persistFX` ou no fluxo de geração de preços.
- Snapshots de preço já gerados com tickers vencidos não são alterados — o filtro atua só na faixa de monitoramento de mercado.

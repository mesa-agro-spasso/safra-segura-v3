## Objetivo

Fazer `market_data` espelhar o lote da API para SOJA e MILHO_CBOT: após cada refresh, tickers que não vieram no lote são removidos. Escopo restrito às funções `persistSoybean` e `persistCornCBOT` em `src/pages/market/MarketBolsa.tsx`.

## Mudanças

### Setup do componente
- Adicionar `useQueryClient` ao import existente de `@tanstack/react-query`.
- Instanciar `const queryClient = useQueryClient()` no topo do componente `MarketBolsa`.

### `persistSoybean(result)`
1. Se `result.soybean_cbot` for ausente ou `length === 0`: retornar imediatamente. Sem upsert, sem delete.
2. Executar os upserts atuais (loop inalterado, mesmos campos).
3. Após todos os upserts com sucesso, coletar `batchTickers = result.soybean_cbot.map(s => s.ticker)` e executar:
   ```ts
   const { data: removed, error } = await supabase
     .from('market_data')
     .delete()
     .eq('commodity', 'SOJA')
     .not('ticker', 'in', `(${batchTickers.map(t => `"${t}"`).join(',')})`)
     .select('ticker');
   ```
4. Se `error`: `toast.error('Sync parcial: dados novos salvos, limpeza de tickers antigos falhou')`. Não relançar — upserts permanecem.
5. Se `removed?.length > 0`: `logActivity('market_data.sync', 'market_data', 'SOJA', { removed_tickers: removed.map(r => r.ticker), batch_tickers: batchTickers })`.
6. Sempre (com ou sem linhas removidas, com ou sem erro): `queryClient.invalidateQueries({ queryKey: ['market_data'] })`. Necessário porque a invalidação disparada pelo hook de upsert acontece antes do delete e não reflete as remoções.

### `persistCornCBOT(result)`
Idêntico, trocando:
- `result.soybean_cbot` → `result.corn_cbot`
- `commodity` filtro/log → `'MILHO_CBOT'`

### Invariantes
- Delete SEMPRE com `.eq('commodity', 'SOJA' | 'MILHO_CBOT')` — nunca toca `MILHO` (B3) nem `FX`.
- Ordem: upsert → delete → invalidate. Nunca inverter.
- Erro no delete não reverte upserts; apenas mostra toast específico.
- Sem cálculo financeiro, sem mudança de schema, sem tocar `persistFX`/`persistCornB3`/hooks/UI.
- Código e comentários em inglês.

## Detalhes técnicos

- PostgREST `not in` com lista vazia é inválido; item 1 já garante lote não-vazio antes de chegar no delete.
- Escapar tickers com aspas duplas no filtro `in` para segurança sintática.

## Verificação

1. "Atualizar Soja" com API retornando `[ZSF27, ZSH27]` enquanto `market_data` tem `[ZSF27, ZSX26]` → após refresh só sobram `ZSF27, ZSH27` na UI (sem reload); `activity_log` tem entrada `market_data.sync` com `removed_tickers: ['ZSX26']`.
2. Mesmo teste para MILHO_CBOT.
3. Simular API retornando `soybean_cbot: []` → nenhum SOJA é apagado.
4. Confirmar que linhas de `MILHO` (B3) e `FX` permanecem intactas nos dois cenários.
5. `tsgo` limpo.

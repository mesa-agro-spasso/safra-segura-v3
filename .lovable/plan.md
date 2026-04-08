

# Milho B3 — Plano Final Confirmado

## Alteração: apenas `src/pages/Market.tsx`

### Novos estados
- `b3Tickers`: array de `{ ticker, exp_date }` do endpoint
- `b3Prices`: `Record<string, { price: number | null, updated_at: string, source: string }>` do Supabase
- `b3Loading`, `b3Error`: controle de estados

### useEffect no mount
1. Chamar `callApi<B3Response>('/market/b3-corn-quotes', undefined, { method: 'GET', query: { quantity: '10' } })`
2. Com os tickers retornados, consultar Supabase direto: `supabase.from('market_data').select('ticker, price, updated_at, source').eq('commodity', 'MILHO').in('ticker', tickers)`
3. Mesclar em `b3Prices`

### SELECT inclui `updated_at` e `source`
Confirmado necessário — usados para exibir freshness e alerta 24h (mesmo padrão da seção atual).

### Substituição das linhas 288-320
Remover bloco condicional `cornB3Rows.length > 0`. Substituir por Card sempre renderizada:
- Título "Milho B3 (Manual)" + aviso amarelo
- Colunas: Ticker | Vencimento | Preço (BRL/saca) | Atualizado | Ação
- Preço: Input editável (number, step 0.01)
- Atualizado: freshness com alerta 24h (mesmo padrão existente)
- Ação: botão salvar usando `renderEditCell` existente
- Upsert com contrato fixo: `commodity:'MILHO', currency:'BRL', price_unit:'BRL/sack', source:'manual', exchange_rate:null, ndf_*:null`

### Estados UI
- Loading: spinner
- Erro API: "Aguardando servidor acordar..." (mesmo padrão)
- Zero tickers: "Nenhum contrato B3 disponível"
- Preço vazio: sem ação (sem delete)

### Não alterado
- `cornB3Rows` filter removido (não mais necessário — tickers vêm da API)
- Tabelas Soja CBOT e Milho CBOT intocadas
- Hook `useMarketData` e `useUpsertMarketData` reutilizados sem mudança
- Nenhuma Edge Function, SQL ou schema alterado


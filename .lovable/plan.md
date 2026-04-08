

# B3 Corn — Cache-First Loading (with 3 adjustments)

## Files to change

| File | Change |
|---|---|
| `src/types/index.ts` | `price: number` → `price: number \| null` |
| `src/hooks/useMarketData.ts` | `price: number` → `price: number \| null` in mutation type |
| `src/pages/Market.tsx` | Replace useEffect + add B3 refresh to handleAutoFetch |

## 1. Types — `src/types/index.ts` line 16

`price: number` → `price: number | null`

## 2. Hook — `src/hooks/useMarketData.ts` line 29

`price: number` → `price: number | null`

## 3. Market.tsx — Replace useEffect (lines 78-117)

Load B3 from Supabase directly (no API call):

```tsx
useEffect(() => {
  const loadB3FromDb = async () => {
    setB3Loading(true);
    try {
      const { data: saved } = await supabase
        .from('market_data')
        .select('ticker, price, updated_at, source, exp_date')
        .eq('commodity', 'MILHO')
        .order('exp_date');
      const tickers: B3CornQuote[] = [];
      const priceMap: Record<string, B3SavedPrice> = {};
      (saved ?? []).forEach((row: any) => {
        tickers.push({ ticker: row.ticker, exp_date: row.exp_date });
        priceMap[row.ticker] = { price: row.price, updated_at: row.updated_at, source: row.source };
      });
      setB3Tickers(tickers);
      setB3Prices(priceMap);
    } catch (err) {
      setB3Error(err instanceof Error ? err.message : String(err));
    } finally {
      setB3Loading(false);
    }
  };
  loadB3FromDb();
}, []);
```

## 4. Market.tsx — Add B3 refresh at end of handleAutoFetch

After the existing `toast.success('Dados de mercado atualizados')` (line 168), **before** `setFetching(false)` in the finally block, add the B3 refresh block. The `setFetching(false)` stays in the outer finally, so the spinner keeps spinning through the B3 refresh (**adjustment 3**).

```tsx
// B3 ticker refresh — only insert NEW tickers
try {
  const b3Result = await callApi<B3Response>(
    '/market/b3-corn-quotes', undefined,
    { method: 'GET', query: { quantity: '10' } }
  );
  const apiTickers = b3Result.corn_b3 ?? [];
  const { data: existing } = await supabase
    .from('market_data').select('ticker').eq('commodity', 'MILHO');
  const existingSet = new Set((existing ?? []).map(r => r.ticker));
  for (const t of apiTickers) {
    if (!existingSet.has(t.ticker)) {
      await supabase.from('market_data').insert({
        ticker: t.ticker, commodity: 'MILHO', currency: 'BRL',
        price: null, price_unit: 'BRL/sack', source: 'manual',
        date: new Date().toISOString().split('T')[0], exp_date: t.exp_date,
      });
    }
  }
  // Reload B3 from DB
  const { data: refreshed } = await supabase
    .from('market_data')
    .select('ticker, price, updated_at, source, exp_date')
    .eq('commodity', 'MILHO').order('exp_date');
  const tickers: B3CornQuote[] = [];
  const priceMap: Record<string, B3SavedPrice> = {};
  (refreshed ?? []).forEach((row: any) => {
    tickers.push({ ticker: row.ticker, exp_date: row.exp_date });
    priceMap[row.ticker] = { price: row.price, updated_at: row.updated_at, source: row.source };
  });
  setB3Tickers(tickers);
  setB3Prices(priceMap);
  toast.success('Tickers B3 atualizados');
} catch (err) {
  const msg = err instanceof Error ? err.message : String(err);
  toast.error(`Falha ao atualizar tickers B3: ${msg}`);
}
```

**Adjustment 1**: Error is surfaced via `toast.error` — no silent catch.

**Adjustment 3**: `fetching` stays true because `setFetching(false)` only runs in the outer `finally` block, which executes after both yfinance and B3 refresh complete.

## 5. Empty state for B3 table

When `b3Tickers.length === 0` and `!b3Loading` and `!b3Error`, show: "Clique em 'Atualizar Dados' para carregar os tickers B3."

## 6. Null-check scope — Adjustment 2

**Only** add null-checks in B3-related display code. Specifically:
- The B3 table already uses `saved?.price != null ? ... : '-'` — no change needed there.
- The `renderEditCell` used by CBOT/FX tables is **not touched**.
- `fxRow.price.toFixed(4)`, `row.price.toFixed(2)` in Soja/Milho CBOT tables are **not touched** — yfinance always fills price.

The only new null-check: in `handleManualSave`, guard against `existing?.price` being null when pre-filling edit value (already handled by `?? ''`).

## What does NOT change
- Soja CBOT, Milho CBOT, FX display code — untouched
- Edge Functions, SQL, schema
- GeneratePricingModal (B3 null-check already implemented)


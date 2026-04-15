

# MTM Page Enhancements — Corrected Plan

## Overview
Three files modified: add nested `operation` field to `HedgeOrder` type, update the hedge orders query to join `operations` → `warehouses` + `pricing_snapshots`, and enhance the MTM page with new columns and a rewritten `handleCalculate`.

## Changes

### 1. `src/types/index.ts` — Add nested `operation` to HedgeOrder
After `created_at: string;`, add:
```ts
operation?: {
  warehouse_id: string;
  warehouses: { display_name: string } | null;
  pricing_snapshots: { trade_date: string; sale_date: string } | null;
} | null;
```

### 2. `src/hooks/useHedgeOrders.ts` — Update select
Replace `select('*')` with:
```ts
.select('*, operation:operations(warehouse_id, warehouses(display_name), pricing_snapshots(trade_date, sale_date))')
```

### 3. `src/pages/MTM.tsx`

**3a. Table headers** — after "Operação", add `Praça`, `Entrada`, `Saída`.

**3b. Table cells** — after operation_id cell, add:
```tsx
<TableCell>{o.operation?.warehouses?.display_name ?? '—'}</TableCell>
<TableCell>{o.operation?.pricing_snapshots?.trade_date ? new Date(o.operation.pricing_snapshots.trade_date + 'T12:00:00').toLocaleDateString('pt-BR') : '—'}</TableCell>
<TableCell>{o.operation?.pricing_snapshots?.sale_date ? new Date(o.operation.pricing_snapshots.sale_date + 'T12:00:00').toLocaleDateString('pt-BR') : '—'}</TableCell>
```

**3c. `handleCalculate`** — replace entire function body with the corrected version that:
- Finds `spotFx` from marketData where `commodity === 'FX'`
- Builds `positions` array with `order` (deep-cloned) + `snapshot` object (futures price resolved by matching leg ticker to marketData)
- Sends `{ positions }` to `/mtm/run`
- Saves results reading `market_snapshot` sub-object for `physical_price_current`, `futures_price_current`, `spot_rate_current`

### What does NOT change
- Other hooks, components, pages
- Results table at bottom of MTM
- Imports, state declarations


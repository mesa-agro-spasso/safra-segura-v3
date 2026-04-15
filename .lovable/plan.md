

# MTM Enhancements — sessionStorage + Results Table Columns

## Overview
Changes across three files: persist physical prices in sessionStorage, expand the results table with operation context columns, and update the type/query to support the new `payment_date` and `grain_reception_date` fields.

## Changes

### 1. `src/types/index.ts` — Expand `pricing_snapshots` in HedgeOrder (line 89)
Update from `{ trade_date: string; sale_date: string }` to:
```ts
{ trade_date: string; payment_date: string; grain_reception_date: string; sale_date: string }
```

### 2. `src/hooks/useHedgeOrders.ts` — Fetch new fields (line 11)
Update `pricing_snapshots(trade_date, sale_date)` to:
```ts
pricing_snapshots(trade_date, payment_date, grain_reception_date, sale_date)
```

### 3. `src/pages/MTM.tsx` — Three changes

**3a. sessionStorage for physicalPrices (line 21)**
Initialize state from `sessionStorage.getItem('mtm_physical_prices')` with try/catch fallback.

**3b. onChange handler (line 135)**
Write updated prices to sessionStorage on every change.

**3c. Results table (lines 152–172)**
Replace headers with: Operação, Praça, Entrada, Pagamento, Recepção, Saída, Físico, Futuros, NDF, Opção, Total, Por Saca.
Replace row cells to look up the matching order and display `warehouses.display_name`, `trade_date`, `payment_date`, `grain_reception_date`, `sale_date` (formatted pt-BR), then the existing MTM value cells.

### What does NOT change
- `handleCalculate`, active operations table, imports, any other file




# Three Surgical Fixes to Warehouse Form in Settings.tsx

## Overview
Three changes to the warehouse editing dialog in `WarehousesTab` within `src/pages/Settings.tsx`. Nothing else changes.

## Changes

### 1. Basis Config — support `reference_delta` mode
Replace the current two simple numeric inputs (lines 125–153) with a per-commodity block that:
- Detects current mode from `basis_config.soybean` / `basis_config.corn`
- **`fixed` mode (default)**: shows numeric input for value + a small link "Usar referência de outro armazém"
- **`reference_delta` mode**: shows a Select for reference warehouse (filtered to exclude current warehouse, using `warehouses` already loaded) + numeric delta input + a link "Usar valor fixo" to switch back
- Saved format: `{ mode: 'fixed', value: N }` or `{ mode: 'reference_delta', reference_warehouse_id: 'xxx', delta_brl: N }`

### 2. Interest rate — add period selector
Replace the single "Taxa de juros (% a.m.)" input (lines 159–164) with two side-by-side fields:
- Left: numeric input labeled "Taxa de juros (%)"
- Right: Select with options "Mensal (a.m.)" → `'monthly'` and "Anual (a.a.)" → `'yearly'`, bound to `interest_rate_period`

### 3. Reorder cost fields grid
Rearrange the costs section (lines 155–213) into this layout:

```text
| Custo armazenagem (R$/sc) | Tipo armazenagem        |
| Taxa de juros (%)         | Período                 |
| Corretagem CBOT           | Corretagem B3           |
| Custo mesa (%)            | Quebra mensal (%)       |
| Custo recepção (R$/sc)    | (empty)                 |
```

### What does NOT change
- `CombinationsTab`, `DateField`, hooks, types, any other file
- `handleSave` logic (already saves all fields correctly)
- Identification section, active switch


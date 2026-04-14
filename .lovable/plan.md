

# Add Warehouse Cost Defaults — Types & Settings Form

## Overview
Add cost default fields to the Warehouse type and replace the warehouse form in Settings with a richer layout including visual basis config and cost fields.

## Changes

### 1. `src/types/index.ts` — Update Warehouse interface
Add 9 new nullable fields: `interest_rate`, `interest_rate_period`, `storage_cost`, `storage_cost_type`, `reception_cost`, `brokerage_per_contract_cbot`, `brokerage_per_contract_b3`, `desk_cost_pct`, `shrinkage_rate_monthly`.

### 2. `src/pages/Settings.tsx` — WarehousesTab only

**2a. `emptyWarehouse`** — Add all new cost fields with null defaults (period defaults to `'monthly'`, storage_cost_type to `'fixed'`).

**2b. `handleSave`** — Include all 9 new fields in the `upsertWarehouse.mutateAsync()` call.

**2c. Dialog form** — Replace lines 69-93 (the `{editing && (...)}` block) with:
- **Identification section**: ID, Nome, Abreviação, Cidade, Estado, Tipo in a 2-col grid
- **Active switch**
- **Basis Config section**: bordered box with Soja (CBOT) and Milho (B3) numeric inputs, preserving `{soybean: {mode: 'fixed', value: N}}` JSONB format
- **Custos Padrão section**: bordered box with 8 fields (taxa juros, armazenagem, tipo armazenagem Select, recepção, corretagem CBOT, corretagem B3, custo mesa, quebra mensal)
- Scrollable container (`max-h-[75vh] overflow-y-auto`)

### What does NOT change
- `CombinationsTab`, hooks, any other file
- `basis_config` JSONB format internally


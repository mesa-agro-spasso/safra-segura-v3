

# Surgical Fix: inheritCost & brokerage in GeneratePricingModal.tsx

## Overview
Update `handleGenerate` in `GeneratePricingModal.tsx` to read cost defaults directly from the `Warehouse` object (which now has typed fields) instead of from `basis_config` JSONB, and resolve `brokerage_per_contract` based on benchmark (CBOT vs B3).

## Changes (single file: `src/components/GeneratePricingModal.tsx`)

### 1. Remove `basisConfig` (line 99)
Delete `const basisConfig = (warehouse.basis_config ?? {}) as Record<string, unknown>;`

### 2. Replace `inheritCost` (lines 120–124)
Change signature from `(field, basisField: string)` to `(comboField, warehouseField: keyof Warehouse)`, reading fallback from `warehouse[warehouseField]` instead of `basisConfig[basisField]`.

### 3. Replace `brokerage_per_contract` in payload (line 153)
Instead of `inheritCost(...)`, use conditional logic: if combo has a value use it, otherwise pick `warehouse.brokerage_per_contract_b3` or `warehouse.brokerage_per_contract_cbot` based on `combo.benchmark`.

### 4. Confirm remaining inheritCost calls (lines 149–155)
The other 6 fields already use matching field names (`'interest_rate'`, `'storage_cost'`, etc.) — they just need the second param typed as `keyof Warehouse` which the new signature handles. No value changes needed.

### What does NOT change
- Exchange rate logic, payment/grain reception date logic
- Snapshot saving block
- Any other file


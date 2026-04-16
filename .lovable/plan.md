

# Add Execution Spread Parameter

Four files. No DB migration (`execution_spread_pct` column already exists).

## Changes

### 1. `src/types/index.ts`
Add `execution_spread_pct: number;` to `PricingParameter` after `target_profit_brl_per_sack`.

### 2. `src/hooks/usePricingParameters.ts`
Update `useUpdatePricingParameter` to accept optional `execution_spread_pct` and include it in update payload when provided.

### 3. `src/pages/Settings.tsx` — ParametersTab
- Sigma `handleSave`: add `execution_spread_pct: currentParam?.execution_spread_pct ?? 0.05`
- Lucro alvo save: add `execution_spread_pct: p.execution_spread_pct ?? 0.05`
- Add new Card "Spread de Execução" after Lucro Alvo card with input, validation (0–1), save button that preserves sigma + target_profit

### 4. `src/pages/OperationsMTM.tsx`
- Add `executionSpread` derived value after `targetProfitCorn`
- Replace `calcBreakeven`: `(physicalCurrent - mtmPerSack) * (1 + executionSpread)`
- Add new `calcTargetPhysical` helper: `(physicalCurrent - mtmPerSack + getTargetProfit(r)) * (1 + executionSpread)`
- Replace `calcBreakeven(r) + getTargetProfit(r)` → `calcTargetPhysical(r)` in results table
- Replace `calcBreakeven(detailResult) + getTargetProfit(detailResult)` → `calcTargetPhysical(detailResult)` in detail dialog


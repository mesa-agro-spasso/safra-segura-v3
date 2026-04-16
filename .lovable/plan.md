

# Add Target Profit Parameter + Break-even Columns

Four files changed. No database migration needed (`target_profit_brl_per_sack` column already exists in `pricing_parameters`).

## Changes

### 1. `src/types/index.ts`
Add `target_profit_brl_per_sack: number;` to `PricingParameter` interface (after `sigma`).

### 2. `src/hooks/usePricingParameters.ts`
Update `useUpdatePricingParameter` mutation to accept optional `target_profit_brl_per_sack` and include it in the update payload when provided.

### 3. `src/pages/Settings.tsx` — `ParametersTab` (lines 573-621)
- Update `handleSave` (line 586): pass `target_profit_brl_per_sack: currentParam?.target_profit_brl_per_sack ?? 2.0` to preserve existing value when saving sigma.
- Add new `<Card>` after the sigma card (after line 618) for "Lucro Alvo por Saca" with input field, description text, and save button. Uses `values['target_profit']` state key, saves to all parameter rows via `updateParameter.mutateAsync`.

### 4. `src/pages/OperationsMTM.tsx`
- Add `targetProfitPerSack` derived value (after line 174): `pricingParameters?.[0]?.target_profit_brl_per_sack ?? 2.0`
- Add `calcBreakeven` helper function: computes `origination + hedgeResult / volume` where hedgeResult = futures + NDF + option MTM values
- MTM results table (lines 425-433): add two new `<TableHead>` columns ("Break-even", "Físico Alvo") and corresponding `<TableCell>` entries in each row (after "Por Saca")
- MTM detail dialog (line 693): add two `<DetailRow>` entries after "Por Saca" for break-even and target physical price


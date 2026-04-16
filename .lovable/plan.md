

# Update Break-even & Target Profit Logic in OperationsMTM

Single file: `src/pages/OperationsMTM.tsx`

## Changes

1. **Replace `calcBreakeven` helper** — new formula uses current physical price input and MTM per sack: `(physicalCurrent - mtmPerSack) * 1.01`.

2. **Replace `targetProfitPerSack` constant** with commodity-specific lookups:
   - `targetProfitSoybean` from `soybean_cbot` parameter row
   - `targetProfitCorn` from `corn_b3` parameter row
   - `getTargetProfit(r)` helper resolves which to use based on matched order's commodity

3. **Update results table cells** — use `getTargetProfit(r)` in place of `targetProfitPerSack`.

4. **Update detail dialog rows** — use `getTargetProfit(detailResult)` in place of `targetProfitPerSack`.

No other changes.




# Changes to `src/pages/MTM.tsx`

Three surgical edits, nothing else touched.

## 1. Add import (line 7)
Add `import { usePricingParameters } from '@/hooks/usePricingParameters';` after the existing `callApi` import.

## 2. Add hook call (after line 24, near other hooks)
Add `const { data: pricingParameters } = usePricingParameters();` after the `useAuth` hook call.

## 3. Replace `handleCalculate` entirely
Replace the current `handleCalculate` function (lines 33–82) with the new version that:
- Builds `sigmaMap` from `pricingParameters`
- Uses `Promise.all` on `orders.map` (async per order)
- For each order, finds the `option` leg, converts futures price to BRL/sc, calculates T_days and sigma, and calls `/pricing/option-premium` via `callApi`
- Falls back to `null` if the option premium call fails
- Rest of the function (calling `/mtm/run`, saving snapshots) stays identical


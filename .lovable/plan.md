

# Add PricingParameter type, hook, Settings tab, and sigma in GeneratePricingModal

Four precise changes across four files.

## 1. `src/types/index.ts` — append interface
Add `PricingParameter` interface at the end of the file.

## 2. `src/hooks/usePricingParameters.ts` — new file
Create hook with `usePricingParameters` (query) and `useUpdatePricingParameter` (mutation) targeting `pricing_parameters` table.

## 3. `src/pages/Settings.tsx`
- Add imports for the new hook and type
- Add `ParametersTab` component before the `Settings` component (line ~572). It displays each parameter's sigma with an inline edit + save button, validation (0 < sigma ≤ 2), and label mapping (`soybean_cbot` → "Soja CBOT", otherwise "Milho B3").
- Add third tab trigger `Parâmetros` and `TabsContent` in the `Settings` component (lines 576-581).

## 4. `src/components/GeneratePricingModal.tsx`
- Import `usePricingParameters`
- Call the hook after existing hooks (~line 38)
- Before the `for` loop in `handleGenerate` (~line 80), build `sigmaMap` from `pricingParameters`
- In `payload.push` (line 135-160), add `sigma` field using commodity-based lookup with fallbacks (soybean → 0.35, corn → 0.17)


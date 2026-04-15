

# MTM Detail Dialog — Simplified Results Table + Click-to-Detail

## Overview
Single file change: `src/pages/MTM.tsx`. Replace the dense results table with a simplified 7-column version. Clicking a row opens a Dialog with full identification, dates, market snapshot, and MTM breakdown.

## Changes

### 1. New imports (after line 13)
Add `Dialog, DialogContent, DialogHeader, DialogTitle` from `@/components/ui/dialog` and `Separator` from `@/components/ui/separator`.

### 2. New state (after line 28)
Add `detailResult` state: `useState<Record<string, unknown> | null>(null)`.

### 3. Replace results table (lines 155–199)
Replace the entire results `Card` block with a simplified table containing only: Operação, Commodity, Praça, Entrada, Saída, Total (color-coded green/red), Por Saca. Each row gets `cursor-pointer hover:bg-muted/50` and `onClick={() => setDetailResult(r)}`. Helper variables (`matchedOrder`, `ps`, `wName`, `fmtDate`) computed per row to avoid repeated `.find()` calls.

### 4. Add detail Dialog (after the results Card, before closing `</div>`)
An IIFE renders a `Dialog` controlled by `detailResult !== null`. Contains:
- **Identificação**: operation_id, commodity, volume
- **Datas**: Entrada, Pagamento, Recepção, Saída
- **Snapshot de Mercado**: futures_price_current, physical_price_current, spot_rate_current, option_premium_current
- **Resultado MTM**: Físico, Futuros, NDF, Opção, Total (color-coded), Por Saca

Each section separated by `<Separator />`. Uses a local `DetailRow` component for label/value pairs and `fmtBrl` helper.

### What does NOT change
- Active operations table (stays as-is with all current columns including Preço Físico Atual input)
- `handleCalculate`, imports for other components, hooks, state declarations (except adding `detailResult`)
- No other files


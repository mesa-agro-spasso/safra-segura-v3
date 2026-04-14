

# Refactor Market.tsx — Independent Refresh Buttons

## Overview
Replace the single "Atualizar Automático" button with 6 independent handlers (FX, Soybean, Corn CBOT, Corn B3, All, Markets) and add per-card refresh buttons.

## Changes (single file: `src/pages/Market.tsx`)

### 1. State changes
- Remove `fetching` and `lastQuotes` states
- Add `fetchingOp` state: `useState<'fx' | 'soybean' | 'corn_cbot' | 'corn_b3' | 'all' | 'markets' | null>(null)`

### 2. Extract 4 atomic functions
- `fetchQuotes()` — calls `/market/quotes` GET
- `persistFX(result)` — upserts USD/BRL
- `persistSoybean(result)` — loops soybean_cbot array
- `persistCornCBOT(result)` — loops corn_cbot array
- `persistCornB3()` — exact copy of the B3 block from `handleAutoFetch` (calls `/market/b3-corn-quotes`, inserts new tickers, reloads from DB)

### 3. Create 6 handler functions
- `handleFetchFX` — fetchQuotes → persistFX
- `handleFetchSoybean` — fetchQuotes → persistSoybean
- `handleFetchCornCBOT` — fetchQuotes → persistCornCBOT
- `handleFetchCornB3` — persistCornB3
- `handleFetchAll` — fetchQuotes → persistFX + persistSoybean + persistCornCBOT + persistCornB3
- `handleFetchMarkets` — fetchQuotes → persistSoybean + persistCornCBOT + persistCornB3

Each wraps in try/catch with toast, sets/clears `fetchingOp`.

### 4. UI layout changes
- **Header**: Replace single button with two buttons: "Atualizar Mercados" (outline, handleFetchMarkets) and "Atualizar Tudo" (primary, handleFetchAll)
- **FX Card**: Add ghost refresh button in CardHeader
- **Soja CBOT Card**: Add ghost refresh button in CardHeader
- **Milho CBOT Card**: Add ghost refresh button in CardHeader
- **Milho B3 Card**: Add ghost refresh button next to existing "Confirmar atualização" button
- All buttons disabled when `fetchingOp !== null`, spinning icon when active

### 5. Remove
- `handleAutoFetch` function
- `fetching` state
- `lastQuotes` state

### What does NOT change
- Hooks (`useMarketData`, `useUpsertMarketData`, `getHoursAgo`)
- Manual edit logic (`handleManualSave`, `handleB3Save`, `renderEditCell`, `renderB3EditCell`)
- `handleConfirmB3Update`
- B3 `useEffect` on mount
- Visual styles beyond button area


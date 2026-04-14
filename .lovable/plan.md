

# Modify Market.tsx — FX Override for Market Handlers

## Overview
Three surgical changes to `src/pages/Market.tsx`: update `fetchQuotes` to accept an optional `fxOverride` parameter, add a `getCurrentFxFromDb` helper, and update 4 handlers to use the DB exchange rate when refreshing markets individually (preserving the manually-set FX). `handleFetchFX` remains untouched.

## Changes (single file: `src/pages/Market.tsx`)

### 1. Replace `fetchQuotes`
Add optional `fxOverride` parameter that appends `fx_override` to the query string when provided.

### 2. Add `getCurrentFxFromDb` helper
Reads `price` from `market_data` where `ticker = 'USD/BRL'` via Supabase client. Returns `number | undefined`.

### 3. Update 4 handlers
- **`handleFetchSoybean`** — calls `getCurrentFxFromDb()`, passes result to `fetchQuotes(fxOverride)`
- **`handleFetchCornCBOT`** — same pattern
- **`handleFetchMarkets`** — same pattern
- **`handleFetchAll`** — calls `fetchQuotes()` WITHOUT fxOverride (FX comes fresh from yfinance)

### What does NOT change
- `handleFetchFX` — untouched
- `handleFetchCornB3` — untouched
- `persistFX`, `persistSoybean`, `persistCornCBOT`, `persistCornB3` — untouched
- All manual edit logic, hooks, UI layout


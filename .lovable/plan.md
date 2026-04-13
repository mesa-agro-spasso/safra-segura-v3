

# Fix cents/bushel conversion for option legs in execution modal

## Problem
The execution modal only converts `price` for `futures` legs in soybean CBOT orders. Option legs use `strike` and `premium` fields instead of `price`, so they need separate conversion logic at all 3 points.

## Changes — all in `src/pages/Orders.tsx`

### Point 1: `openExecutionModal` (line ~611)
When initializing `_displayPrice`/`_displayStrike`/`_displayPremium` for the modal:
- For **futures** CBOT soy: `_displayPrice = price * 100` (already works)
- For **option** CBOT soy: add `_displayStrike = strike * 100` and `_displayPremium = premium * 100`
- Keep `_displayPrice` for non-option legs as-is

### Point 2: `handleExecutionConfirm` (line ~634)
When converting back to canonical units:
- For **futures** CBOT soy: `price = _displayPrice / 100` (already works)
- For **option** CBOT soy: `strike = _displayStrike / 100` and `premium = _displayPremium / 100`
- Use destructuring to strip all `_display*` fields cleanly (also fixes the undefined-fields bug from prior plan)

### Point 3: Execution modal UI (line ~1305)
Currently shows a single "Preço (cents/bu)" input. Change to:
- For **futures**: show single "Preço (cents/bu)" input → `_displayPrice` (no change)
- For **option** CBOT soy: show **two** inputs — "Strike (cents/bu)" → `_displayStrike` and "Prêmio (cents/bu)" → `_displayPremium` — instead of the single Preço input
- For **option** non-CBOT: show Strike and Premium inputs without the cents label
- Grid adjusts from 3 cols to 4 cols for option legs to fit both fields

### Summary of field mapping

```text
leg_type   | CBOT soy? | Display fields         | Conversion
-----------+-----------+------------------------+-----------
futures    | yes       | _displayPrice (¢/bu)   | ÷100
futures    | no        | _displayPrice           | none
option     | yes       | _displayStrike (¢/bu)  | ÷100
           |           | _displayPremium (¢/bu)  | ÷100
option     | no        | _displayStrike          | none
           |           | _displayPremium         | none
ndf        | n/a       | _displayPrice           | none
```

### No changes to
- Order creation form (already handles options correctly at lines 311, 319-320, 371, 379-380)
- Order display/table
- Any other page or component


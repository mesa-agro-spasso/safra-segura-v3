

# 3 Corrections in PricingTable.tsx Header

## File: `src/pages/PricingTable.tsx` (lines 120-166)

### Correction 1 — Swap order of status lines
Move the "Tabela gerada" IIFE block (lines 148-166) to BEFORE the market update semaphore button (lines 120-147). Result: "Tabela gerada" appears first, "Última atualização de mercado" second.

### Correction 2 — Rename label
Change `Última atualização` → `Última atualização de mercado` in all three variants of the label string (lines 132, 134, 135).

### Correction 3 — Use oldest (worst) market update time, not newest
Line 126 currently computes `mostRecent` using `Math.max(...)` to find the newest update. Change to `Math.min(...)` to find the **oldest** update time. This reflects the worst-case staleness — if B3 corn was last updated 2h ago while CBOT was just updated, the line should show the B3 corn time, not the CBOT time.

Specifically:
- Line 126: `Math.max(...)` → `Math.min(...)`
- Rename `mostRecent` → `oldest` (or similar) for clarity

### What does NOT change
Everything else: ticker badges, filters, table, export, detail dialog.


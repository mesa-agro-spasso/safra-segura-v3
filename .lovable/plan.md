## Goal
Add a feature-flag system to hide (not delete) four areas for this contractual delivery: Financial Calendar, Producers tab, and Market sub-tabs Físico/Histórico. All flags default to `false`. Restoration = flip env var to `true`.

## Phase A — Setup

1. **Create `src/config/features.ts`** — single source of truth, readonly. The `=== 'true'` comparison is intentional: missing/undefined vars resolve to `false` (safe-hide default).
   ```ts
   export const FEATURES = {
     FINANCIAL_CALENDAR: import.meta.env.VITE_FEATURE_FINANCIAL_CALENDAR === 'true',
     PRODUCERS: import.meta.env.VITE_FEATURE_PRODUCERS === 'true',
     MARKET_PHYSICAL: import.meta.env.VITE_FEATURE_MARKET_PHYSICAL === 'true',
     MARKET_HISTORICAL: import.meta.env.VITE_FEATURE_MARKET_HISTORICAL === 'true',
   } as const;
   ```
2. **Update `.env`** — append the 4 vars set to `false`. Create **`.env.example`** with the same 4 vars (also `false`) for documentation.
3. No file/import deletions anywhere. All flag reads go exclusively through this module.

## Phase B — Hide Financial Calendar

- `src/components/AppSidebar.tsx`: filter the `Financeiro` item with `FEATURES.FINANCIAL_CALENDAR`.
- `src/components/AppLayout.tsx`: filter the `/financeiro` entry out of the `routes` array when the flag is off — direct URL access falls through to the existing `<NotFound />` fallback.
- Grep for any cross-links pointing to `/financeiro` and wrap with the flag.

## Phase C — Hide Producers

- `src/components/AppSidebar.tsx`: filter the `Produtores` item with `FEATURES.PRODUCERS`.
- `src/components/AppLayout.tsx`: filter the `/produtores` route the same way → falls to `<NotFound />`.
- Grep for cross-links (e.g. "Ver produtor" inside operation details) and wrap with the flag.
- The producer **autocomplete inside operation forms keeps working** — it queries Supabase via `useProducers`, with no coupling to the page route.

## Phase D — Hide Market sub-tabs Físico & Histórico

Edit `src/pages/Market.tsx`:
- Build the visible-tabs list from flags: `Bolsa` always; `Físico` only if `FEATURES.MARKET_PHYSICAL`; `Histórico` only if `FEATURES.MARKET_HISTORICAL`.
- Coerce `?tab=` param: if it points to a hidden tab, fall back to the first visible (`bolsa` in this delivery).
- If only one tab is visible, hide the entire `<TabsList>` but still render `<Tabs value="bolsa">` with the matching `<TabsContent value="bolsa">` so Radix has a valid controlled value with content in the tree (avoids uncontrolled-state warnings).
- Hidden tabs' `<TabsContent>` are simply not rendered; their page components and imports stay intact.

## Out of scope
- No backend, Supabase schema, RLS, or edge function changes.
- No business logic changes; no file deletions; no import removals.

## Files touched
- **New:** `src/config/features.ts`, `.env.example`
- **Edited:** `.env`, `src/components/AppSidebar.tsx`, `src/components/AppLayout.tsx`, `src/pages/Market.tsx`
- **Possibly edited** (only if grep finds them): components with cross-links to `/produtores` or `/financeiro`.

## Deployment note (will be flagged in delivery message)
The local `.env` does NOT propagate to production builds. After merge, the four `VITE_FEATURE_*` vars must also be set to `false` in the **Lovable Cloud project settings** (and in **Vercel** if the app is also deployed there). The task isn't truly complete until those platform-level env vars are confirmed.

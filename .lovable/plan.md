## Single fix in `src/pages/OperacoesD24.tsx` (HedgePlanEditor)

Add a defensive guard for the per-leg validation rendering loop so a missing `legResults[i]` (out-of-range during async sequential validation) doesn't crash.

### Change at lines 374–375

**Before:**
```tsx
{planValidation?.legResults[i] && (() => {
  const v = planValidation.legResults[i];
```

**After:**
```tsx
{planValidation?.legResults?.[i] && (() => {
  const v = planValidation.legResults?.[i];
  if (!v) return null;
```

### About `balance_after`

A search for `balance_after` in `src/pages/OperacoesD24.tsx` returns no matches — there is currently no access to `v.result?.balance_after` in this file to harden. No change needed for that part. (The existing `v.result?.structural_errors` / `v.result?.business_alerts` accesses already use optional chaining.)

### Files touched

- `src/pages/OperacoesD24.tsx` (one localized edit, ~2 lines)

No other files modified.


# Fix futures_price_usd in Order Creation — 2 Files

## Answer to your question

The Lovable currently saves **only 4 selected fields** in `outputs_json` (lines 208-213 of `GeneratePricingModal.tsx`):
- `costs`, `purchased_basis_brl`, `gross_price_brl`, `breakeven_basis_brl`

**`futures_price_usd` is NOT persisted.** So the fix requires both files.

---

## File 1: `src/components/GeneratePricingModal.tsx` (lines 208-213)

Persist the full engine result in `outputs_json` instead of cherry-picking fields. Replace:

```typescript
outputs_json: {
  costs: r.costs ?? {},
  purchased_basis_brl: r.purchased_basis_brl,
  gross_price_brl: r.gross_price_brl,
  breakeven_basis_brl: r.breakeven_basis_brl,
},
```

With:

```typescript
outputs_json: { ...r },
```

This spreads the entire API result object (`r`) into `outputs_json`, which includes `futures_price_usd`, `costs`, `purchased_basis_brl`, `gross_price_brl`, `breakeven_basis_brl`, and any other fields the engine returns. Future engine fields are automatically captured.

The `insurance` field is already saved separately in `insurance_json`, so no duplication concern for that.

---

## File 2: `src/pages/Orders.tsx` (line 227)

Replace:

```typescript
futures_price: snap?.futures_price_brl ?? 0,
```

With:

```typescript
futures_price: (() => {
  const isCbotSoy = com === 'soybean' && bench === 'cbot';
  if (isCbotSoy) {
    const outputsJson = (snap?.outputs_json as Record<string, unknown>) ?? {};
    return (outputsJson.futures_price_usd as number) ?? 0;
  }
  return snap?.futures_price_brl ?? 0;
})(),
```

For soybean CBOT, reads `futures_price_usd` from `outputs_json` (USD/bushel, what the API expects). For corn B3, keeps `futures_price_brl` (BRL/sc).

---

## What does NOT change

- Two-click flow, sessionStorage, legs editing, execution modal
- `PricingTable.tsx` detail dialog (already reads from `outputs_json` generically)
- Any other file


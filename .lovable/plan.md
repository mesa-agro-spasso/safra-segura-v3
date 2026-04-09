

# Make Legs Editable — with Cents-in-State Pattern

## Core Decision: Store cents/bushel in state, convert only on save

The state `legs[i].price` (and `strike`, `premium` for CBOT soybean options) will store values **in the display unit** (cents/bushel for CBOT soybean, BRL/sc for B3, R$/USD for NDF). Conversion to canonical USD/bushel happens only at two boundaries: when populating from API response (multiply by 100) and when saving to DB (divide by 100).

This eliminates the controlled-input formatting bug entirely — no `.toFixed()`, no helpers, just raw string in = raw string out.

## File: `src/pages/Orders.tsx`

### Edit 1 — Generic leg helpers (replace lines 198-199 + remove 491-511)

Replace `updateLegNotes` with:
```typescript
const updateLeg = (index: number, field: keyof Leg, value: any) => {
  setLegs(prev => prev.map((l, i) => i === index ? { ...l, [field]: value } : l));
};
const addLeg = () => {
  setLegs(prev => [...prev, { leg_type: 'futures', direction: 'sell', ticker: '', contracts: '', price: '', notes: '' }]);
};
const removeLeg = (index: number) => {
  setLegs(prev => prev.filter((_, i) => i !== index));
};
```

Remove `getLegDisplayPrice` and `getLegQtyDisplay` (lines 491-511). Keep `getLegPriceLabel` (lines 500-505) for input label hints.

### Edit 2 — handleBuildOrder: store prices in display units (lines 239-252)

When populating legs from API response, multiply price/strike/premium by 100 for CBOT soybean:
```typescript
const isCbotSoy = com === 'soybean' && bench === 'cbot';
setLegs(apiLegs.map((l: any) => {
  const mul = (isCbotSoy && (l.leg_type === 'futures' || l.leg_type === 'option')) ? 100 : 1;
  return {
    leg_type: l.leg_type ?? 'futures',
    direction: l.direction ?? 'sell',
    ticker: l.ticker ?? '',
    contracts: l.contracts != null ? String(l.contracts) : '',
    price: l.price != null ? String(l.price * mul) : '',
    ndf_rate: l.ndf_rate != null ? String(l.ndf_rate) : undefined,
    strike: l.strike != null ? String(l.strike * mul) : undefined,
    premium: l.premium != null ? String(l.premium * mul) : undefined,
    option_type: l.option_type ?? undefined,
    notes: '',
    volume_units: l.volume_units ?? undefined,
    unit_label: l.unit_label ?? undefined,
  };
}));
```

### Edit 3 — handleSaveOrder: convert cents→USD/bushel in legsPayload (lines 288-301)

```typescript
const legsPayload = legs.map(l => {
  const isCbotSoy = (apiOrder?.commodity === 'soybean' && 
    (apiOrder?.exchange as string)?.toLowerCase() === 'cbot');
  const div = (isCbotSoy && (l.leg_type === 'futures' || l.leg_type === 'option')) ? 100 : 1;
  return {
    leg_type: l.leg_type,
    direction: l.direction,
    ticker: l.ticker || undefined,
    contracts: l.contracts ? parseFloat(l.contracts) : undefined,
    price: l.price ? parseFloat(l.price) / div : undefined,
    ndf_rate: l.ndf_rate ? parseFloat(l.ndf_rate) : undefined,
    strike: l.strike ? parseFloat(l.strike) / div : undefined,
    premium: l.premium ? parseFloat(l.premium) / div : undefined,
    option_type: l.option_type || undefined,
    notes: l.notes || undefined,
    volume_units: l.volume_units ?? undefined,
    unit_label: l.unit_label ?? undefined,
  };
});
```

### Edit 4 — Replace read-only legs table (lines 589-641)

Replace with fully editable table:
- **Tipo**: `<Select>` dropdown (futures/ndf/option) via `updateLeg(i, 'leg_type', val)`
- **Dir.**: `<Select>` dropdown (buy/sell)
- **Ticker**: `<Input>` text
- **Quantidade**: `<Input>` — shows `contracts` for futures/option, `volume_units` for NDF (stored as string via updateLeg)
- **Preço**: `<Input type="text">` — `value={leg.price ?? ''}` directly, no formatting. Label hint from `getLegPriceLabel`. For NDF, input maps to `ndf_rate`.
- **Obs.**: `<Input>` text via `updateLeg(i, 'notes', ...)`
- **Remove**: `<Trash2>` icon button calling `removeLeg(i)`

For option legs, inline extra fields below row: `option_type` (call/put select), `strike` (input), `premium` (input).

**"Adicionar Perna"** button with Plus icon below the table.

All inputs use raw string values from the Leg — no `.toFixed()`, no `getLegDisplayPrice`. The price label is shown as helper text via `getLegPriceLabel`.

### Edit 5 — Execution modal unchanged

The execution modal reads `order.legs` from the database (USD/bushel), applies its own `_displayPrice` multiplication. No changes needed — confirmed compatible.

### What does NOT change
- Two-click flow structure
- sessionStorage sync (useEffect hooks already watch `legs`)
- List tab, execution modal, manual tab
- No other files


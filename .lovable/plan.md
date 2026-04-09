

# Add "Seguro" to Leg Type Dropdown — Orders.tsx (Revised)

## File: `src/pages/Orders.tsx`

### Edit 1 — Extend Leg type union (line 25)
Add `'seguro'` to `leg_type` union.

### Edit 2 — New state (after line 206)
```typescript
const [insuranceModalLegIndex, setInsuranceModalLegIndex] = useState<number | null>(null);
const [previousLegType, setPreviousLegType] = useState<Leg['leg_type'] | null>(null);
```

### Edit 3 — handleLegTypeChange intercept
If `'seguro'` selected: validate `apiOrder` + `selectedSnapshotData` exist (toast if not, don't change dropdown), store previous type, set leg to `'seguro'`, open modal. Otherwise: normal `updateLeg`.

### Edit 4 — Add `<SelectItem value="seguro">Seguro</SelectItem>` after Option item

### Edit 5 — Conversion helper
```typescript
const BUSHELS_PER_SACK_SOYBEAN = 2.20462;
const brlSackToDisplayUnit = (brlSack: number): number => {
  const isCbotSoy = com === 'soybean' && bench === 'cbot';
  if (!isCbotSoy) return brlSack;
  const outputsJson = (selectedSnapshotData?.outputs_json as Record<string, unknown>) ?? {};
  const rate = (outputsJson.exchange_rate as number) ?? 0;
  if (!rate) return 0;
  return (brlSack / rate / BUSHELS_PER_SACK_SOYBEAN) * 100;
};
```

### Edit 6 — handleInsuranceSelect (single atomic setLegs)
```typescript
const handleInsuranceSelect = (insuranceOption: Record<string, unknown>) => {
  if (insuranceModalLegIndex === null) return;
  const strike = brlSackToDisplayUnit((insuranceOption.strike_brl as number) ?? 0);
  const premium = brlSackToDisplayUnit((insuranceOption.premium_brl as number) ?? 0);
  setLegs(prev => prev.map((l, i) => i === insuranceModalLegIndex ? {
    ...l,
    leg_type: 'option',
    direction: 'buy',
    option_type: 'call',
    strike: String(strike),
    premium: String(premium),
  } : l));
  setInsuranceModalLegIndex(null);
  setPreviousLegType(null);
};
```

### Edit 7 — handleInsuranceModalClose (single atomic setLegs)
```typescript
const handleInsuranceModalClose = (open: boolean) => {
  if (!open && insuranceModalLegIndex !== null) {
    const revertType = previousLegType ?? 'futures';
    setLegs(prev => prev.map((l, i) => i === insuranceModalLegIndex ? {
      ...l,
      leg_type: revertType,
    } : l));
    setInsuranceModalLegIndex(null);
    setPreviousLegType(null);
  }
};
```

### Edit 8 — Insurance modal Dialog
3-column card grid reading `selectedSnapshotData.insurance_json` (atm/otm_5/otm_10). Shows strike, prêmio, custo total in BRL. Click calls `handleInsuranceSelect`. Empty state: "Snapshot sem dados de seguro."

### Edit 9 — Safety filter in handleSaveOrder
```typescript
const legsPayload = legs.filter(l => l.leg_type !== 'seguro').map(l => { ... });
```

SessionStorage: `'seguro'` legs persist as-is. On restore, modal won't auto-reopen (state `insuranceModalLegIndex` is not in sessionStorage), so the user sees a row with type "seguro" and can re-select or change it. Acceptable.

### What does NOT change
Two-click flow, handleBuildOrder, handleSaveOrder conversion logic, execution modal, list tab, manual tab, no other files.


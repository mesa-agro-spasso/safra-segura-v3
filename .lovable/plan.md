

# Refactor Orders.tsx — 3-Stage Flow (Auto-populate → Validate → Save)

## File: `src/pages/Orders.tsx`

### Edit 1 — Stop `clearApiOrder` from clearing legs

Remove `setLegs([])` and `order_legs`/`order_notes` sessionStorage removals from `clearApiOrder`. Only clear `apiOrder` and `buildResult`. Legs will be replaced by `autoPopulateLegs`.

### Edit 2 — Add `autoPopulateLegs` function

Silent version of current `handleBuildOrder`: calls `POST /orders/build` with `use_custom_structure: false, legs: []`. Sets `apiOrder` from `result.order`. Populates `legs` with converted values. Does NOT set `buildResult`. No success toast. Only `toast.error` on catch.

### Edit 3 — Add useEffect to trigger auto-populate

```typescript
// eslint-disable-next-line react-hooks/exhaustive-deps
useEffect(() => {
  if (!selectedWarehouse || !commodityType || !selectedSnapshot || !volume) return;
  if (!selectedSnapshotData) return;
  const volNum = parseFloat(volume);
  if (!volNum || volNum <= 0) return;
  autoPopulateLegs();
}, [selectedSnapshot, selectedWarehouse, commodityType, volume]);
```

**Constraint**: dependency array is exactly `[selectedSnapshot, selectedWarehouse, commodityType, volume]`. Do NOT add `apiOrder`, `legs`, `selectedSnapshotData`, or any other variable. The `eslint-disable-next-line` suppresses the exhaustive-deps warning. This prevents infinite loops since `autoPopulateLegs` updates `apiOrder`.

### Edit 4 — Rewrite `handleBuildOrder` as validation-only

- Guard: `if (!apiOrder || !legs.length)` → toast error
- Call `POST /orders/build` with `use_custom_structure: true` and current legs (converted from display units to canonical)
- Update `apiOrder` with ONLY `order_message`, `confirmation_message`, `commodity`, `exchange` (merge via spread)
- Do NOT replace legs
- Set `buildResult = { alerts, has_errors }`
- Toast: error if `has_errors`, success "Ordem validada" otherwise

### Edit 5 — `updateLeg`, `addLeg`, `removeLeg` clear buildResult

Add `setBuildResult(null)` to each function to force re-validation after any leg edit.

### Edit 6 — Update button states

**"Construir Ordem" button**: rename label to "Validar Ordem", `disabled={building || !apiOrder || !legs.length}`

**"Salvar Ordem" button**: `disabled={!apiOrder || !buildResult || buildResult.has_errors === true || saving}`

### Edit 7 — Insurance modal guard update

Change guard from `if (!apiOrder || !selectedSnapshotData)` to `if (!selectedSnapshotData)` since `apiOrder` exists earlier now (from auto-populate).

### What does NOT change
- `handleSaveOrder`, execution modal, list tab, manual tab
- sessionStorage sync useEffects
- Leg editing UI, insurance modal selection logic
- Conversion rules (cents/bushel in state, USD/bushel on save)


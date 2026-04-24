# Update Orders.tsx Closing Workflow

## Scope
Only `src/pages/Orders.tsx`. Two specific changes to streamline the closing workflow.

## Changes

### 1. Change HEDGE_CONFIRMADO button action (line ~1375)
Replace the "Solicitar Enc." button that calls `handleRequestClosingFromOrder` with a "Confirmar Enc." button that opens the closing modal directly.

**Current:**
```tsx
{o.status === 'EXECUTED' && o.operation_id && operationStatusMap?.[o.operation_id] === 'HEDGE_CONFIRMADO' && (
  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => handleRequestClosingFromOrder(o)}>
    Solicitar Enc.
  </Button>
)}
```

**New:**
```tsx
{o.status === 'EXECUTED' && o.operation_id && operationStatusMap?.[o.operation_id] === 'HEDGE_CONFIRMADO' && (
  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => handleOpenClosingOrderModal(o)}>
    Confirmar Enc.
  </Button>
)}
```

### 2. Update handleOpenClosingOrderModal to handle missing closing_order (line ~836-845)
Modify the function to fall back to hedge_order executed_legs when no closing_order exists yet.

**Current:**
```tsx
const { data, error } = await supabase
  .from('closing_orders')
  .select('id, legs, physical_price_brl, physical_volume_sacks')
  .eq('operation_id', order.operation_id)
  .order('created_at', { ascending: false })
  .limit(1)
  .maybeSingle();
if (error) throw error;
const rawLegs = ((data?.legs as any[]) ?? []).filter((l: any) => l.leg_type !== 'seguro');
```

**New:**
```tsx
const { data, error } = await supabase
  .from('closing_orders')
  .select('id, legs, physical_price_brl, physical_volume_sacks')
  .eq('operation_id', order.operation_id)
  .order('created_at', { ascending: false })
  .limit(1)
  .maybeSingle();
if (error && error.code !== 'PGRST116') throw error;

// If no closing_order exists yet, mirror legs from the hedge_order executed_legs
let rawLegs: any[] = [];
if (data?.legs) {
  rawLegs = ((data.legs as any[]) ?? []).filter((l: any) => l.leg_type !== 'seguro');
} else {
  const { data: hedgeData } = await supabase
    .from('hedge_orders')
    .select('executed_legs')
    .eq('operation_id', order.operation_id)
    .eq('status', 'EXECUTED')
    .order('executed_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const executedLegs = (hedgeData?.executed_legs as any[]) ?? [];
  rawLegs = executedLegs
    .filter((l: any) => l.leg_type !== 'seguro')
    .map((l: any) => ({
      ...l,
      direction: l.direction === 'sell' ? 'buy' : 'sell',
      price: null,
      ndf_rate: null,
    }));
}
```

## Constraints
- Only the two specified code blocks are modified
- No changes to imports, types, or other functions
- The fallback logic mirrors the legs from executed hedge orders and inverts the direction (sell → buy, buy → sell) since closing reverses the position
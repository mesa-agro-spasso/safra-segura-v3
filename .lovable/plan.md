

# Fix 2 Bugs in Orders.tsx — API Response + sessionStorage

## File: `src/pages/Orders.tsx`

### Edit 1 — Add `useEffect` to import (line 1)
```
import { useState, useMemo } from 'react';
→
import { useState, useMemo, useEffect } from 'react';
```

### Edit 2 — sessionStorage lazy initializers for 4 new states (lines 127-131)
Replace:
```typescript
const [buildResult, setBuildResult] = useState<Record<string, unknown> | null>(null);
const [apiOrder, setApiOrder] = useState<Record<string, unknown> | null>(null);
const [orderNotes, setOrderNotes] = useState('');
```
With:
```typescript
const [buildResult, setBuildResult] = useState<Record<string, unknown> | null>(() => {
  const saved = sessionStorage.getItem('order_buildResult');
  return saved ? JSON.parse(saved) : null;
});
const [apiOrder, setApiOrder] = useState<Record<string, unknown> | null>(() => {
  const saved = sessionStorage.getItem('order_apiOrder');
  return saved ? JSON.parse(saved) : null;
});
const [orderNotes, setOrderNotes] = useState(() => sessionStorage.getItem('order_notes') ?? '');
```

Also replace `const [legs, setLegs] = useState<Leg[]>([]);` (line 131) with:
```typescript
const [legs, setLegs] = useState<Leg[]>(() => {
  const saved = sessionStorage.getItem('order_legs');
  return saved ? JSON.parse(saved) : [];
});
```

### Edit 3 — clearApiOrder also clears sessionStorage (line 135)
Replace:
```typescript
const clearApiOrder = () => { setApiOrder(null); setBuildResult(null); setLegs([]); };
```
With:
```typescript
const clearApiOrder = () => {
  setApiOrder(null); setBuildResult(null); setLegs([]);
  sessionStorage.removeItem('order_apiOrder');
  sessionStorage.removeItem('order_buildResult');
  sessionStorage.removeItem('order_legs');
  sessionStorage.removeItem('order_notes');
};
```

### Edit 4 — Add 4 useEffect sync hooks (after line 140, before manual form)
Insert after the setter wrappers block:
```typescript
useEffect(() => {
  if (apiOrder) sessionStorage.setItem('order_apiOrder', JSON.stringify(apiOrder));
  else sessionStorage.removeItem('order_apiOrder');
}, [apiOrder]);
useEffect(() => {
  sessionStorage.setItem('order_legs', JSON.stringify(legs));
}, [legs]);
useEffect(() => {
  sessionStorage.setItem('order_notes', orderNotes);
}, [orderNotes]);
useEffect(() => {
  if (buildResult) sessionStorage.setItem('order_buildResult', JSON.stringify(buildResult));
  else sessionStorage.removeItem('order_buildResult');
}, [buildResult]);
```

### Edit 5 — Bug 1: Extract `order` from API response (lines 201-205)
Replace:
```typescript
      setBuildResult(result);
      setApiOrder(result);

      // Populate legs from API response
      const apiLegs = (result.legs as any[]) ?? [];
```
With:
```typescript
      const apiOrderData = (result.order as Record<string, unknown>) ?? {};
      const apiAlerts = (result.alerts as unknown[]) ?? [];
      setBuildResult({ alerts: apiAlerts, has_errors: result.has_errors });
      setApiOrder(apiOrderData);

      // Populate legs from API response
      const apiLegs = (apiOrderData.legs as any[]) ?? [];
```

### Edit 6 — Remove masking fallbacks in handleSaveOrder (lines 274-275)
Replace:
```typescript
          commodity: (apiOrder.commodity as string) ?? commodity,
          exchange: (apiOrder.exchange as string) ?? bench.toUpperCase(),
```
With:
```typescript
          commodity: apiOrder.commodity as string,
          exchange: apiOrder.exchange as string,
```
Keep `?? null` for order_message and confirmation_message (lines 280-281) — those can legitimately be empty.

### Edit 7 — Validation section reads messages from apiOrder (lines 650-667)
Replace:
```typescript
                {buildResult.order_message && (
                  ...
                    <pre ...>{buildResult.order_message as string}</pre>
                    <Button ... onClick={() => copyToClipboard(buildResult.order_message as string)}>
                  ...
                )}
                {buildResult.confirmation_message && (
                  ...
                    <pre ...>{buildResult.confirmation_message as string}</pre>
                    <Button ... onClick={() => copyToClipboard(buildResult.confirmation_message as string)}>
                  ...
                )}
```
With:
```typescript
                {apiOrder?.order_message && (
                  ...
                    <pre ...>{apiOrder.order_message as string}</pre>
                    <Button ... onClick={() => copyToClipboard(apiOrder.order_message as string)}>
                  ...
                )}
                {apiOrder?.confirmation_message && (
                  ...
                    <pre ...>{apiOrder.confirmation_message as string}</pre>
                    <Button ... onClick={() => copyToClipboard(apiOrder.confirmation_message as string)}>
                  ...
                )}
```

### Edit 8 — Clean new sessionStorage keys in handleSaveOrder (after line 312)
Add after existing `sessionStorage.removeItem('order_linked');`:
```typescript
      sessionStorage.removeItem('order_apiOrder');
      sessionStorage.removeItem('order_buildResult');
      sessionStorage.removeItem('order_legs');
      sessionStorage.removeItem('order_notes');
```

### What does NOT change
List tab, execution modal, manual tab, hooks, status transitions, any other file.


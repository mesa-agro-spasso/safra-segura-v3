## Two fixes in `src/pages/OperacoesD24.tsx`

Only this file is touched.

---

### Fix 1 — "Ordens Vinculadas" reads from `d24Orders`, not legacy `allOrders`

**Problem.** `ordersForSelectedOperation` filters `allOrders` (the legacy `hedge_orders` table, empty in D24), so the Sheet's "Ordens Vinculadas" section is always empty.

**Change A — Replace the memo (lines 680-683):**

```typescript
const ordersForSelectedOperation = useMemo(() => {
  if (!selectedOperation || !d24Orders) return [];
  return [...(d24Orders as any[]).filter(
    (o: any) => o.operation_id === selectedOperation.id
  )].sort((a, b) =>
    new Date(a.executed_at ?? a.created_at).getTime() -
    new Date(b.executed_at ?? b.created_at).getTime()
  );
}, [selectedOperation, d24Orders]);
```

**Change B — Replace the rendering inside the "Ordens Vinculadas" Section (lines 1768-1789).** New cards show: opening/closing badge, instrument type, direction, ticker, executed_at; plus per-row fields driven by `instrument_type`:

- `futures`: contracts, volume_units (with `bu`/`sc` unit), price (`USD/bu` or `BRL/sc`)
- `ndf`: volume_units (USD), `ndf_rate` (BRL/USD), `ndf_maturity`
- `option`: option_type, strike, premium
- Closing rows additionally show "Fecha ordem" (first 8 chars of `closes_order_id`)
- `notes` rendered when present

Uses existing `fmtDate` / `fmtDateTime` helpers and `Badge`.

---

### Fix 2 — "Assinaturas" section: show signed AND missing roles, split by flow

**Problem.** Section shows only collected signatures; user can't see who is still pending. Also opening vs closing signatures are mixed.

**Change — Replace the body of the "Assinaturas" Section (lines 1793-1812)** with an IIFE that:

1. Computes the required roles tier (`low` / `mid` / `high`) from `selectedOperation.volume_sacks` using the same constants/logic as `usePendingApprovalsCount` (KG_PER_SACK = 60; thresholds 500 t / 1000 t).
2. Splits `operationSignatures` by `flow_type` into `OPENING` and `CLOSING`.
3. For each flow, derives `collected` from `decision === 'APPROVE'` and `missing` via a `countBy` diff.
4. Renders an "Abertura" subsection always; renders "Encerramento" subsection only when there are closing signatures OR `opD24.closing_plan != null` (separated by `<Separator />`).
5. Each subsection shows:
   - Status badges row: green `outline` chips for collected roles (with `✓`), muted `secondary` chips for missing roles.
   - Signatory cards: `user_id.slice(0,8)`, decision badge (Aprovado/Rejeitado), `role_used · signed_at`, optional notes.

`Separator` is already imported (line 40). `opD24` is already declared at line 1536 inside the Sheet scope, so it's reachable here.

---

### Out of scope / constraints

- Only `src/pages/OperacoesD24.tsx`.
- No new hooks, no new Edge Functions, no schema changes.
- `d24Orders` and `operationSignatures` queries already exist — reused as-is.
- No changes to action buttons, modals, or other Sections.

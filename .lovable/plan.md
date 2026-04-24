# Add Closing (Encerramento) Workflow to Orders Page

## Scope
Only `src/pages/Orders.tsx`. No other files modified.

## Changes

### 1. Add `operationStatusMap` query (after `orders` useMemo, ~line 170)
Loads statuses for ALL visible orders via `supabase.from('operations').select('id, status').in('id', operationIds)`.

### 2. Add closing state (after `executionLegs`, ~line 670)
- `closingOrderModal`, `closingOrderLegs`, `closingOrderPhysicalPrice`, `closingOrderPhysicalVolume`, `closingOrderOriginationPrice`, `closingOrderSubmitting`.

### 3. Add closing handlers (after `handleExecutionConfirm`, ~line 792)
- `handleRequestClosingFromOrder(order)` → `POST /closing/{operation_id}/request`.
- `handleOpenClosingOrderModal(order)` → fetches latest `closing_orders.legs`, prefills fields.
- `handleExecuteClosingFromOrder()` → `POST /closing/{operation_id}/execute`, invalidates `operations`, `operation-statuses`, `hedge-orders`.

### 4. Add closing buttons in EXECUTED row actions (after `APPROVED` block, line 1262)
- "Solicitar Enc." when `operationStatusMap[op_id] === 'HEDGE_CONFIRMADO'`.
- "Confirmar Enc." when `operationStatusMap[op_id] === 'ENCERRAMENTO_APROVADO'`.

### 5. Add closing modal Dialog (before Insurance modal, ~line 1528)
Inputs: physical price, physical volume, origination price, per-leg price/NDF rate. Confirm disabled when submitting or any of 3 main fields empty.

## Constraints
- Zero local financial calculation.
- Buttons gated by both order status (`EXECUTED`) AND operation status.
- Reuses existing imports (`Dialog`, `Input`, `Label`, `Button`, `callApi`, `supabase`, `useQueryClient`).

## Out of scope
- Edge Function whitelist for `/closing/...` (manual in Dashboard).
- Backend Python `/closing/...` endpoints.

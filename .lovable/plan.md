

# Order Lifecycle V2 — Revised Plan (v3)

---

## Price Unit Conversion Rule (global, applies everywhere)

Any input where the user types a futures leg price for **soybean + cbot** displays in **USD cents/bushel (×100)** and saves internally in **USD/bushel (÷100)**.

**Applies to:**
- Modal de execução (Frente 3) — user edits `executed_legs` prices
- Any future inline price editor

**Does NOT apply to:**
- "Criar Ordem" after click 1 — values come from API, displayed as `price * 100` (pure display, no editable price input)
- NDF legs (R$/USD, no conversion)
- Corn B3 futures (BRL/sc, no conversion)

---

## Types Update — `src/types/index.ts`

- **Warehouse**: add `abbr: string`
- **HedgeOrder**: add `display_code`, `notes`, `executed_legs`, `executed_at`, `executed_by`, `cancelled_at`, `cancelled_by`, `cancellation_reason` (all nullable)
- **Leg type**: add `notes?: string`, `volume_units?: number`, `unit_label?: string`

---

## Frente 4 — Settings → Warehouses (`src/pages/Settings.tsx`)

### 4.1 Form: add `abbr` field
- Input "Abreviação (código curto)", placeholder "Ex: CON, MAT, ALT"
- Helper: "2 a 5 letras maiúsculas"
- Auto-uppercase in onChange, client validation `^[A-Z]{2,5}$`
- Include in save payload, update `emptyWarehouse`

### 4.2 Table: add "Abreviação" column after "Nome"

### 4.3 Error: catch Supabase 23505 → toast "Abreviação 'XXX' já está em uso"

---

## Frente 5 — HQ filter

Verify `useActiveArmazens()` already filters `type = 'ARMAZEM'`. Confirm, no change expected.

---

## Frente 1 — "Criar Ordem" tab — Two-click flow

### 1.1 Delete the `useEffect` that auto-generates legs
No frontend leg pre-population. Legs come only from API response.

### 1.2 Two-click flow

**New state**: `apiOrder` (full HedgeOrder from API), `orderNotes` (string)

**Click 1 — "Construir Ordem"**:
- Validates form (warehouse, commodity, snapshot, volume)
- Calls POST `/orders/build` via api-proxy with form data. `operation_id` omitted or null in payload.
- Stores API response in `apiOrder` state
- Populates legs display from `apiOrder.legs` (read-only prices/quantities from API)
- **Does NOT touch the database at all** — no INSERT in operations, no INSERT in hedge_orders

**Click 2 — "Salvar Ordem"** (only enabled when `apiOrder` is set):
- **Step 1**: INSERT into `operations` (creates new operation record)
- **Step 2**: INSERT into `hedge_orders` using the `operation_id` from step 1, including legs from `apiOrder` (with user-added per-leg notes merged), `notes=orderNotes`, status='GENERATED'
- **Compensation**: if hedge_orders INSERT fails, DELETE the operation created in step 1 (try/catch cleanup)
- **Step 3**: SELECT `display_code` from inserted hedge_order row
- Toast: "Ordem criada: CON_SOJA_260409_003"
- Reset form + clear sessionStorage

**Form change detection**: if user changes warehouse, commodity, volume, or snapshot after click 1, clear `apiOrder` and legs, disable "Salvar Ordem"

### 1.3 Remove "Taxa NDF" standalone field

### 1.4 Legs display after click 1
- Column "Quantidade" (not "Contr."): `leg.volume_units` or `leg.contracts` with unit (`ct`, `USD`)
- Column "Preço": soybean CBOT futures → `price * 100` label "USD cents/bushel"; corn B3 → as-is "BRL/sc"; NDF → `ndf_rate` "R$/USD"
- Per-leg `notes` textarea (optional, editable)

### 1.5 Order-level notes
- Textarea below legs, label "Observações da Ordem"
- Sent as `notes` in hedge_orders INSERT

### 1.6 "ID da Operação (auto)"
- Before save: disabled text "Será gerado ao salvar"
- After save: display_code in toast

---

## Frente 2 — "Ordens Existentes" tab

### 2.1 Display `display_code` instead of UUID
- `o.display_code ?? o.operation_id?.slice(0,8)`

### 2.2 "Vinculação" column
- `useMemo` map: for each order's `operation_id`, find `parent_operation_id` in operations, then find hedge_orders with that parent operation_id
- **Selection rule**: pick the most recent hedge_order (by `created_at DESC`) that is NOT `CANCELLED`. If all are cancelled, pick the most recent anyway.
- Show `—` if no parent

### 2.3 Status badges — 5 statuses
- GENERATED→gray "Gerada", SENT→blue "Enviada", APPROVED→yellow "Aprovada", EXECUTED→green "Executada", CANCELLED→red "Cancelada"
- Remove BROKER_CONFIRMED and LINKED from filters

### 2.4 Custom sort
```text
statusOrder = { SENT:1, APPROVED:2, GENERATED:3, EXECUTED:4, CANCELLED:5 }
```
Within each group: `created_at DESC`

### 2.5 Action buttons per row — "Ações" column
- GENERATED: "Enviar" (→SENT), "Cancelar" (modal)
- SENT: "Aprovar" (→APPROVED), "Rejeitar" (modal with reason)
- APPROVED: "Executar" (→ execution modal), "Cancelar" (modal)
- EXECUTED/CANCELLED: no buttons
- Cancel/Reject modal: textarea required, confirm disabled when empty
- Simple transitions: direct Supabase update + toast + invalidate

**New hook**: `useUpdateHedgeOrder` mutation in `useHedgeOrders.ts`

---

## Frente 3 — Execution Modal

Opened from "Executar" button on APPROVED orders.

- Title: "Confirmar Execução" + `display_code`
- Editable leg list pre-filled from `order.legs`
- Each leg: type (label), ticker (label), direction (label), quantidade (editable), price (editable), notes (editable)
- **Price display rule**: soybean CBOT futures → display `price * 100` (cents/bushel), user edits in cents, save `÷100` to `executed_legs`
- Validation: qty > 0, price > 0 for all legs
- On confirm: UPDATE with `status='EXECUTED'`, `executed_legs`, `executed_at=now()`, `executed_by=user.id`
- `legs` column untouched
- Toast + close + refresh

---

## Files Modified

| File | Changes |
|------|---------|
| `src/types/index.ts` | Warehouse.abbr, HedgeOrder new fields |
| `src/pages/Settings.tsx` | Abbr field + table column + error handling |
| `src/pages/Orders.tsx` | All 5 fronts |
| `src/hooks/useHedgeOrders.ts` | useUpdateHedgeOrder mutation |
| `mem://features/order-lifecycle-v2` | Rules |

---

## Memory

Save rules to `mem://features/order-lifecycle-v2` before implementation.


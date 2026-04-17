

# Reescrita completa: useFinancialCalendarData.ts e Financial.tsx

Fonte única: `operations` com `status = 'HEDGE_CONFIRMADO'`. `payment_events` deixa de ser fonte primária — vira apenas registro de pagamento realizado, consultado por `operation_id`.

## Arquivo 1 — `src/hooks/useFinancialCalendarData.ts`

Apagar tudo. Nova implementação:

**Query única**:
```ts
supabase.from('operations').select(`
  id, commodity, volume_sacks,
  warehouses(display_name),
  pricing_snapshots(payment_date, sale_date, origination_price_brl),
  hedge_orders(display_code)
`).eq('status', 'HEDGE_CONFIRMADO');
```

**Para cada operação** com `pricing_snapshots` não-nulo, emitir até 2 eventos:
- `outflow`: `start = payment_date`, `title = "Saída: {display_code}"`, `amount_brl = origination_price_brl * volume_sacks`
- `inflow`: `start = sale_date`, `title = "Entrada: {display_code}"`, `amount_brl = origination_price_brl * volume_sacks`

**Detalhes**:
- `display_code = hedge_orders[0]?.display_code ?? id.slice(0,8)`
- `commodityLabel`: soybean→Soja, corn→Milho, fallback raw
- `warehouse_display_name = warehouses?.display_name ?? '—'`
- Datas convertidas com `new Date(d + 'T12:00:00')` para evitar drift de fuso
- Pular evento se a respectiva data for nula
- IDs: `outflow-{op.id}` / `inflow-{op.id}`
- Manter shape de `CalendarEvent` (mesma interface exportada) para compatibilidade com `FinancialCalendar`

**Resource preserva**: `operation_id`, `display_code`, `commodity`, `warehouse_display_name`, `amount_brl`, `volume_sacks`. Campos `status`/`payment_event_id`/`notes`/`realized_date` viram opcionais e ficam `undefined` (calendário não precisa deles para renderizar entrada/saída por operação).

## Arquivo 2 — `src/pages/Financial.tsx`

Apagar lógica que lê `payment_events` como fonte primária.

**Query principal** (`['financial-operations']`):
Mesma query do hook acima — operações com `HEDGE_CONFIRMADO` + joins.

**Query secundária** (`['payment-events-by-op']`):
`supabase.from('payment_events').select('operation_id, status, realized_date, notes').in('operation_id', opIds)` — apenas para descobrir se cada operação já tem registro de pagamento. `enabled: opIds.length > 0`.

**Derivação por linha**:
- `paymentEvent = mapByOperationId[op.id]` (pode ser `undefined`)
- `isPaid = paymentEvent?.status === 'paid'`
- `amount_brl = origination_price_brl * volume_sacks`
- `payment_date`, `sale_date` vêm de `pricing_snapshots`
- `display_code = hedge_orders[0]?.display_code ?? id.slice(0,8)`

**Tabela — colunas**:
| Código | Praça | Commodity | Volume (sacas) | Data Pagamento | Data Venda | Valor | Status Pagamento | Ação |

- "Data Pagamento" estilizada `text-red-600 font-medium`
- "Data Venda" estilizada `text-green-600 font-medium`
- "Valor": tooltip/popover com cálculo `origination_price × volume` (preservar UX atual)
- "Status Pagamento": badge verde "Pago" se `isPaid`, senão amarelo "Pendente"
- "Ação": botão "Marcar como pago" só quando `!isPaid`

**Filtros** (preservados):
- Status: `all` / `pending` / `paid` — aplicado via `isPaid`
- Praça: select de armazéns ativos — match por `warehouses.display_name`

**Dialog "Marcar como pago"** (estado guarda a row inteira incluindo `paymentEvent`):
- Campos: `realized_date` (default hoje), `notes`
- Confirmar:
  - Se `paymentEvent` existe → `update` em `payment_events` por `id`: `status='paid', realized_date, notes, registered_by=user.id`
  - Se não existe → `insert` em `payment_events`: `operation_id, scheduled_date=payment_date, amount_brl, status='paid', realized_date, notes, registered_by=user.id`
- Toast, invalidar `['financial-operations']` e `['payment-events-by-op']`, fechar dialog

**Aba Calendário**: mantida, renderiza `<FinancialCalendar />` (que já consome o hook reescrito).

**Tipo `OperationRow`** (substitui `PaymentRow`):
```ts
{ id, commodity, volume_sacks, warehouse_display_name, display_code,
  payment_date, sale_date, origination_price_brl, amount_brl,
  paymentEvent?: { id, status, realized_date, notes } }
```

## Fora de escopo
- `FinancialCalendar.tsx`, `AnnualGrid.tsx`, `DayDetailPanel.tsx` (consomem `CalendarEvent` cuja shape é preservada)
- Migrations (schema atual já suporta inserts em `payment_events` com os campos usados)
- Hook `useActiveArmazens` e demais imports existentes
- Lógica de aprovação, sidebar, outras páginas

## Riscos
- Operações `HEDGE_CONFIRMADO` sem `pricing_snapshot_id` ficarão fora da listagem — comportamento esperado dado o contrato.
- `hedge_orders` é array (1:N do ponto de vista do PostgREST); usamos `[0]` assumindo uma ordem por operação, consistente com o restante do código.




# Calendário Financeiro — Plano Final

## Overview
Add a financial calendar to the Financeiro page with Month, Week, Agenda, and custom Year views. Events are color-coded (red=outflow from payment_events, green=inflow from pricing_snapshots). Clicking a day opens a side panel with details and the ability to mark payments as paid using the same confirmation dialog as the table.

## Dependencies
Install `react-big-calendar` and `@types/react-big-calendar`. `date-fns` is already available.

## New Files

### 1. `src/hooks/useFinancialCalendarData.ts`
- Fetch `payment_events` joined with operations/warehouses/hedge_orders → type `outflow` (red)
- Fetch `pricing_snapshots` where `sale_date IS NOT NULL` joined with operations/warehouses → type `inflow` (green)
- Return unified `CalendarEvent[]` with `id, title, start, end, type, resource`

### 2. `src/components/financial/FinancialCalendar.tsx`
- `react-big-calendar` with `dateFnsLocalizer` (pt-BR)
- Register views: `{ month: true, week: true, agenda: true, year: AnnualGrid }`
- `eventPropGetter`: green (#10b981) for inflow, red (#ef4444) for outflow
- `onSelectSlot` (day click) → open DayDetailPanel
- `onSelectEvent` → open DayDetailPanel filtered to that event's day
- `messages` with PT-BR labels: Mês, Semana, Agenda, Ano

### 3. `src/components/financial/AnnualGrid.tsx`
- Custom RBC view component (receives `date`, `onNavigate`, `onView` props)
- 4×3 grid of `react-day-picker` months with modifiers for event days (green/red dots)
- Click on a day → triggers `onSelectSlot` on parent

### 4. `src/components/financial/DayDetailPanel.tsx`
- Shadcn `Sheet` showing events for the selected day grouped by type
- For pending outflows: button "Marcar como Pago" opens a **confirmation Dialog with date input + notes textarea** — same UX as the existing table flow (`handleConfirmPay` pattern), NOT a silent update
- Inflows: view-only

## Modified File

### 5. `src/pages/Financial.tsx`
- Wrap existing table and new calendar in `Tabs` (Tabela | Calendário)
- No changes to existing table logic or pay dialog

## Key Detail: Payment Confirmation in Panel
The DayDetailPanel will include the same Dialog pattern already used in Financial.tsx: a modal with a date input for "Data de pagamento realizado" and a Textarea for "Observações", with Cancelar/Confirmar buttons. The update call mirrors `handleConfirmPay` — sets `status: 'paid'`, `realized_date`, `notes`, `registered_by`, then invalidates queries.


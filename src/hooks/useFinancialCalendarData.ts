import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  type: 'inflow' | 'outflow';
  resource: {
    operation_id: string;
    display_code: string;
    commodity: string;
    warehouse_display_name: string;
    amount_brl?: number;
    volume_sacks?: number;
    status?: string;
    payment_event_id?: string;
    notes?: string | null;
    realized_date?: string | null;
  };
}

export function useFinancialCalendarData() {
  return useQuery({
    queryKey: ['financial_calendar_data'],
    queryFn: async () => {
      // --- Outflows from payment_events ---
      const { data: events, error: evErr } = await supabase
        .from('payment_events')
        .select('*')
        .order('scheduled_date', { ascending: true });
      if (evErr) throw evErr;

      const opIds = [...new Set((events ?? []).map((e: any) => e.operation_id))];

      const { data: ops } = await supabase
        .from('operations')
        .select('id, commodity, warehouse_id, volume_sacks, pricing_snapshot_id')
        .in('id', opIds.length ? opIds : ['__none__']);

      const { data: orders } = await supabase
        .from('hedge_orders')
        .select('operation_id, display_code')
        .in('operation_id', opIds.length ? opIds : ['__none__']);

      const whIds = [...new Set((ops ?? []).map((o: any) => o.warehouse_id))];
      const { data: whs } = await supabase
        .from('warehouses')
        .select('id, display_name')
        .in('id', whIds.length ? whIds : ['__none__']);

      const opsMap = Object.fromEntries((ops ?? []).map((o: any) => [o.id, o]));
      const ordersMap = Object.fromEntries((orders ?? []).map((o: any) => [o.operation_id, o]));
      const whMap = Object.fromEntries((whs ?? []).map((w: any) => [w.id, w.display_name]));

      const outflows: CalendarEvent[] = (events ?? []).map((e: any) => {
        const op = opsMap[e.operation_id];
        const order = ordersMap[e.operation_id];
        const displayCode = order?.display_code ?? e.operation_id?.slice(0, 8);
        const commodity = op?.commodity ?? '—';
        const commodityLabel = commodity === 'soybean' ? 'Soja' : commodity === 'corn' ? 'Milho' : commodity;
        const whName = op ? (whMap[op.warehouse_id] ?? '—') : '—';
        const dateStr = e.status === 'paid' && e.realized_date ? e.realized_date : e.scheduled_date;
        const d = new Date(dateStr + 'T12:00:00');

        return {
          id: e.id,
          title: `Saída: ${displayCode} – R$${Number(e.amount_brl).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
          start: d,
          end: d,
          type: 'outflow' as const,
          resource: {
            operation_id: e.operation_id,
            display_code: displayCode,
            commodity: commodityLabel,
            warehouse_display_name: whName,
            amount_brl: e.amount_brl,
            volume_sacks: op?.volume_sacks ?? 0,
            status: e.status,
            payment_event_id: e.id,
            notes: e.notes,
            realized_date: e.realized_date,
          },
        };
      });

      // --- Inflows from pricing_snapshots (sale_date) ---
      const { data: snaps, error: snErr } = await supabase
        .from('pricing_snapshots')
        .select('id, sale_date, commodity, warehouse_id, origination_price_brl')
        .not('sale_date', 'is', null);
      if (snErr) throw snErr;

      // fetch warehouse names for snapshots
      const snapWhIds = [...new Set((snaps ?? []).map((s: any) => s.warehouse_id))];
      const { data: snapWhs } = await supabase
        .from('warehouses')
        .select('id, display_name')
        .in('id', snapWhIds.length ? snapWhIds : ['__none__']);
      const snapWhMap = Object.fromEntries((snapWhs ?? []).map((w: any) => [w.id, w.display_name]));

      // find operations linked to these snapshots to get volume + display_code
      const snapIds = (snaps ?? []).map((s: any) => s.id);
      const { data: snapOps } = await supabase
        .from('operations')
        .select('id, pricing_snapshot_id, volume_sacks')
        .in('pricing_snapshot_id', snapIds.length ? snapIds : ['__none__']);

      const { data: snapOrders } = await supabase
        .from('hedge_orders')
        .select('operation_id, display_code')
        .in('operation_id', (snapOps ?? []).map((o: any) => o.id).length ? (snapOps ?? []).map((o: any) => o.id) : ['__none__']);

      const snapOpsMap: Record<string, any> = {};
      const snapOrdersMap: Record<string, any> = {};
      for (const o of (snapOps ?? [])) {
        snapOpsMap[o.pricing_snapshot_id!] = o;
      }
      for (const o of (snapOrders ?? [])) {
        snapOrdersMap[o.operation_id] = o;
      }

      const inflows: CalendarEvent[] = (snaps ?? []).map((s: any) => {
        const commodity = s.commodity === 'soybean' ? 'Soja' : s.commodity === 'corn' ? 'Milho' : s.commodity;
        const whName = snapWhMap[s.warehouse_id] ?? '—';
        const linkedOp = snapOpsMap[s.id];
        const linkedOrder = linkedOp ? snapOrdersMap[linkedOp.id] : null;
        const displayCode = linkedOrder?.display_code ?? s.id.slice(0, 8);
        const d = new Date(s.sale_date + 'T12:00:00');

        return {
          id: `inflow-${s.id}`,
          title: `Entrada: ${commodity} ${whName}`,
          start: d,
          end: d,
          type: 'inflow' as const,
          resource: {
            operation_id: linkedOp?.id ?? '',
            display_code: displayCode,
            commodity,
            warehouse_display_name: whName,
            amount_brl: s.origination_price_brl * (linkedOp?.volume_sacks ?? 0),
            volume_sacks: linkedOp?.volume_sacks ?? 0,
            status: undefined,
            payment_event_id: undefined,
          },
        };
      });

      return [...outflows, ...inflows];
    },
  });
}

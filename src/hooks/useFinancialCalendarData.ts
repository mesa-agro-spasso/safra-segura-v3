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

const toDate = (d: string) => new Date(d + 'T12:00:00');

const commodityLabel = (c: string) =>
  c === 'soybean' ? 'Soja' : c === 'corn' ? 'Milho' : c;

export function useFinancialCalendarData() {
  return useQuery({
    queryKey: ['financial_calendar_data'],
    queryFn: async () => {
      const { data: ops, error } = await supabase
        .from('operations')
        .select(`
          id, commodity, volume_sacks, display_code,
          warehouses(display_name),
          pricing_snapshots(payment_date, sale_date, origination_price_brl)
        `)
        .in('status', ['HEDGE_CONFIRMADO', 'ACTIVE', 'PARTIALLY_CLOSED']);
      if (error) throw error;

      const events: CalendarEvent[] = [];

      for (const op of (ops ?? []) as any[]) {
        const snap = op.pricing_snapshots;
        if (!snap) continue;

        const displayCode = op.display_code ?? op.id.slice(0, 8);
        const whName = op.warehouses?.display_name ?? '—';
        const commodity = commodityLabel(op.commodity);
        const amount = Number(snap.origination_price_brl) * Number(op.volume_sacks);

        const baseResource = {
          operation_id: op.id,
          display_code: displayCode,
          commodity,
          warehouse_display_name: whName,
          amount_brl: amount,
          volume_sacks: Number(op.volume_sacks),
        };

        if (snap.payment_date) {
          events.push({
            id: `outflow-${op.id}`,
            title: `Saída: ${displayCode}`,
            start: toDate(snap.payment_date),
            end: toDate(snap.payment_date),
            type: 'outflow',
            resource: { ...baseResource },
          });
        }

        if (snap.sale_date) {
          events.push({
            id: `inflow-${op.id}`,
            title: `Entrada: ${displayCode}`,
            start: toDate(snap.sale_date),
            end: toDate(snap.sale_date),
            type: 'inflow',
            resource: { ...baseResource },
          });
        }
      }

      return events;
    },
  });
}

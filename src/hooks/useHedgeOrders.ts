import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { HedgeOrder } from '@/types';

export function useHedgeOrders(filters?: { commodity?: string; status?: string }) {
  return useQuery({
    queryKey: ['hedge_orders', filters],
    queryFn: async () => {
      let query = supabase
        .from('hedge_orders')
        .select('*, operation:operations(warehouse_id, warehouses(display_name), pricing_snapshots(trade_date, sale_date))')
        .order('created_at', { ascending: false });
      if (filters?.commodity) query = query.eq('commodity', filters.commodity);
      if (filters?.status) query = query.eq('status', filters.status);
      const { data, error } = await query;
      if (error) throw error;
      return data as unknown as HedgeOrder[];
    },
  });
}

export function useCreateHedgeOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (order: Omit<HedgeOrder, 'id' | 'created_at' | 'display_code' | 'executed_legs' | 'executed_at' | 'executed_by' | 'cancelled_at' | 'cancelled_by' | 'cancellation_reason'>) => {
      const { data, error } = await supabase
        .from('hedge_orders')
        .insert(order as never)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['hedge_orders'] }),
  });
}

export function useUpdateHedgeOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & Partial<HedgeOrder>) => {
      const { error } = await supabase
        .from('hedge_orders')
        .update(updates as never)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['hedge_orders'] }),
  });
}

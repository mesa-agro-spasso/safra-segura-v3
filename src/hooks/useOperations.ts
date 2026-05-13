import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { logActivity } from '@/lib/activityLog';
import type { Operation, OperationWithDetails } from '@/types';

export function useOperations() {
  return useQuery({
    queryKey: ['operations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('operations')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as unknown as Operation[];
    },
  });
}

export function useCreateOperation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (op: Omit<Operation, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('operations')
        .insert(op as never)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['operations'] }),
  });
}

export function useOperationsWithDetails() {
  return useQuery({
    queryKey: ['operations_with_details'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('operations')
        .select('*, display_code, exchange, warehouses(display_name), pricing_snapshots(trade_date, payment_date, grain_reception_date, sale_date, ticker, origination_price_brl, futures_price_brl, exchange_rate, target_basis_brl, additional_discount_brl, outputs_json)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as unknown as OperationWithDetails[];
    },
  });
}

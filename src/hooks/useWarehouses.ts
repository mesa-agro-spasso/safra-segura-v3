import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { logActivity } from '@/lib/activityLog';
import type { Warehouse } from '@/types';

export function useWarehouses(activeOnly = false) {
  return useQuery({
    queryKey: ['warehouses', activeOnly],
    queryFn: async () => {
      let query = supabase.from('warehouses').select('*').order('display_name');
      if (activeOnly) query = query.eq('active', true);
      const { data, error } = await query;
      if (error) throw error;
      return data as unknown as Warehouse[];
    },
  });
}

export function useActiveArmazens() {
  return useQuery({
    queryKey: ['warehouses', 'armazens'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('warehouses')
        .select('*')
        .eq('active', true)
        .eq('type', 'ARMAZEM')
        .order('display_name');
      if (error) throw error;
      return data as unknown as Warehouse[];
    },
  });
}

export function useUpsertWarehouse() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (warehouse: Partial<Warehouse> & { id: string }) => {
      const { error } = await supabase
        .from('warehouses')
        .upsert(warehouse as never, { onConflict: 'id' });
      if (error) throw error;
      void logActivity('warehouse.update', 'warehouse', warehouse.id, { fields: Object.keys(warehouse) });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['warehouses'] }),
  });
}

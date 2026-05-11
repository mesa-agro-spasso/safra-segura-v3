import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { PhysicalPrice } from './usePhysicalPrices';

export function usePhysicalPriceHistoryAll(filters: {
  warehouseId?: string | null;
  commodity?: string | null;
}) {
  const { warehouseId, commodity } = filters;
  return useQuery({
    queryKey: ['physical_prices', 'history_all', warehouseId ?? null, commodity ?? null],
    queryFn: async () => {
      let q = supabase
        .from('physical_prices')
        .select('*')
        .order('reference_date', { ascending: false })
        .order('updated_at', { ascending: false })
        .limit(1000);
      if (warehouseId) q = q.eq('warehouse_id', warehouseId);
      if (commodity) q = q.eq('commodity', commodity);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as PhysicalPrice[];
    },
  });
}

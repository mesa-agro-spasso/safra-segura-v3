import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { logActivity } from '@/lib/activityLog';

export interface PhysicalPrice {
  id: string;
  warehouse_id: string;
  commodity: string;
  reference_date: string;
  price_brl_per_sack: number;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface PhysicalPriceInput {
  warehouse_id: string;
  commodity: 'soybean' | 'corn';
  reference_date: string;
  price_brl_per_sack: number;
  notes?: string | null;
}

export function getHoursAgo(date: string): number {
  return Math.floor((Date.now() - new Date(date).getTime()) / 3600000);
}

/** Latest price per (warehouse, commodity). Done client-side via order+dedupe. */
export function useLatestPhysicalPrices() {
  return useQuery({
    queryKey: ['physical_prices', 'latest'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('physical_prices')
        .select('*')
        .order('reference_date', { ascending: false })
        .order('updated_at', { ascending: false });
      if (error) throw error;
      const seen = new Set<string>();
      const out: PhysicalPrice[] = [];
      for (const row of (data ?? []) as PhysicalPrice[]) {
        const key = `${row.warehouse_id}::${row.commodity}`;
        if (!seen.has(key)) {
          seen.add(key);
          out.push(row);
        }
      }
      return out;
    },
  });
}

export function usePhysicalPriceHistory(warehouseId: string | null, commodity: string | null) {
  return useQuery({
    queryKey: ['physical_prices', 'history', warehouseId, commodity],
    enabled: !!warehouseId && !!commodity,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('physical_prices')
        .select('*')
        .eq('warehouse_id', warehouseId!)
        .eq('commodity', commodity!)
        .order('reference_date', { ascending: true });
      if (error) throw error;
      return (data ?? []) as PhysicalPrice[];
    },
  });
}

export function useUpsertPhysicalPrice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: PhysicalPriceInput) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from('physical_prices')
        .upsert(
          { ...input, created_by: user?.id ?? null, updated_at: new Date().toISOString() },
          { onConflict: 'warehouse_id,commodity,reference_date' },
        );
      if (error) throw error;
      void logActivity('physical_price.upsert', 'physical_price', null, {
        warehouse_id: input.warehouse_id, commodity: input.commodity,
        reference_date: input.reference_date, price_brl_per_sack: input.price_brl_per_sack,
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['physical_prices'] }),
  });
}

export function useUpsertPhysicalPricesBulk() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (items: PhysicalPriceInput[]) => {
      if (items.length === 0) return;
      const { data: { user } } = await supabase.auth.getUser();
      const payload = items.map((i) => ({
        ...i,
        created_by: user?.id ?? null,
        updated_at: new Date().toISOString(),
      }));
      const { error } = await supabase
        .from('physical_prices')
        .upsert(payload, { onConflict: 'warehouse_id,commodity,reference_date' });
      if (error) throw error;
      void logActivity('physical_price.bulk_upsert', 'physical_price', null, { count: items.length });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['physical_prices'] }),
  });
}

export function useDeletePhysicalPrice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('physical_prices').delete().eq('id', id);
      if (error) throw error;
      void logActivity('physical_price.delete', 'physical_price', id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['physical_prices'] }),
  });
}

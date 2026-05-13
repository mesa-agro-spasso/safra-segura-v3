import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { logActivity } from '@/lib/activityLog';
import type { PricingSnapshot } from '@/types';

export function usePricingSnapshots() {
  return useQuery({
    queryKey: ['pricing_snapshots'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pricing_snapshots')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return data as unknown as PricingSnapshot[];
    },
  });
}

export function useSavePricingSnapshots() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (snapshots: Omit<PricingSnapshot, 'id' | 'created_at'>[]) => {
      const { error } = await supabase
        .from('pricing_snapshots')
        .insert(snapshots as never[]);
      if (error) throw error;
      void logActivity('pricing_snapshot.publish', 'pricing_snapshot', null, { count: snapshots.length });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['pricing_snapshots'] }),
  });
}

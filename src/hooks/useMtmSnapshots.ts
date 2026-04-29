import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { MtmSnapshot } from '@/types';

export function useMtmSnapshots(operationId?: string) {
  return useQuery({
    queryKey: ['mtm_snapshots', operationId],
    queryFn: async () => {
      let query = (supabase as any)
        .from('mtm_snapshots')
        .select('*')
        .order('calculated_at', { ascending: false });
      if (operationId) query = query.eq('operation_id', operationId);
      const { data, error } = await query;
      if (error) throw error;
      return data as unknown as MtmSnapshot[];
    },
  });
}

export function useSaveMtmSnapshot() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (snapshot: Omit<MtmSnapshot, 'id' | 'calculated_at' | 'snapshot_date'>) => {
      const { error } = await (supabase as any)
        .from('mtm_snapshots')
        .insert(snapshot as never);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['mtm_snapshots'] }),
  });
}

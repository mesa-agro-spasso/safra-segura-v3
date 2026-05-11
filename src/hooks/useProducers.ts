import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Producer, ProducerOperation } from '@/types';

export function useProducers() {
  return useQuery({
    queryKey: ['producers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('producers')
        .select('*')
        .order('full_name', { ascending: true, nullsFirst: false });
      if (error) throw error;
      return (data ?? []) as unknown as Producer[];
    },
  });
}

export function useProducerOperations(producerId: string | null) {
  return useQuery({
    queryKey: ['producer-operations', producerId],
    enabled: !!producerId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('operations')
        .select('id, display_code, status, commodity, volume_sacks, trade_date, warehouse_id, warehouses(display_name)')
        .eq('producer_id', producerId!)
        .order('trade_date', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as ProducerOperation[];
    },
  });
}

export function useProducerOperationCounts() {
  return useQuery({
    queryKey: ['producer-operation-counts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('operations')
        .select('producer_id')
        .not('producer_id', 'is', null);
      if (error) throw error;
      const counts: Record<string, number> = {};
      (data ?? []).forEach((row: any) => {
        if (row.producer_id) counts[row.producer_id] = (counts[row.producer_id] ?? 0) + 1;
      });
      return counts;
    },
  });
}

export function useCreateProducer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<Producer>) => {
      const { data, error } = await supabase
        .from('producers')
        .insert(payload as never)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as Producer;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['producers'] }),
  });
}

export function useUpdateProducer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: Partial<Producer> & { id: string }) => {
      const { error } = await supabase
        .from('producers')
        .update(payload as never)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['producers'] }),
  });
}

export function useDeleteProducer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('producers').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['producers'] });
      qc.invalidateQueries({ queryKey: ['producer-operation-counts'] });
      qc.invalidateQueries({ queryKey: ['operations'] });
      qc.invalidateQueries({ queryKey: ['operations_with_details'] });
    },
  });
}

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { logActivity } from '@/lib/activityLog';
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

const TERMINAL_STATUSES = new Set(['CLOSED', 'CANCELLED', 'CANCELADA', 'ENCERRADA']);

export type ProducerOpCount = { active: number; total: number };

export function useProducerOperationCounts() {
  return useQuery({
    queryKey: ['producer-operation-counts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('operations')
        .select('producer_id, status')
        .not('producer_id', 'is', null);
      if (error) throw error;
      const counts: Record<string, ProducerOpCount> = {};
      (data ?? []).forEach((row: any) => {
        if (!row.producer_id) return;
        const c = counts[row.producer_id] ?? { active: 0, total: 0 };
        c.total += 1;
        if (!TERMINAL_STATUSES.has(row.status)) c.active += 1;
        counts[row.producer_id] = c;
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
      void logActivity('producer.create', 'producer', (data as any)?.id, { full_name: payload.full_name });
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
      void logActivity('producer.update', 'producer', id, { fields: Object.keys(payload) });
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
      void logActivity('producer.delete', 'producer', id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['producers'] });
      qc.invalidateQueries({ queryKey: ['producer-operation-counts'] });
      qc.invalidateQueries({ queryKey: ['operations'] });
      qc.invalidateQueries({ queryKey: ['operations_with_details'] });
    },
  });
}

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

/**
 * Insere UMA linha de snapshot. Aceita created_at explícito para entrar
 * no lote já publicado (Adicionar à tabela) em vez de fundar um lote novo.
 */
export function useInsertPricingSnapshot() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (row: Omit<PricingSnapshot, 'id' | 'created_at'> & { created_at?: string }) => {
      const { error } = await supabase.from('pricing_snapshots').insert(row as never);
      if (error) throw error;
      void logActivity('pricing_snapshot.simulation', 'pricing_snapshot', null, {
        warehouse_id: row.warehouse_id,
        ticker: row.ticker,
        joined_batch: row.created_at ?? null,
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['pricing_snapshots'] }),
  });
}


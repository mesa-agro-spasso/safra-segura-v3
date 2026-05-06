import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { PricingCombination } from '@/types';

export function usePricingCombinations(activeOnly = false) {
  return useQuery({
    queryKey: ['pricing_combinations', activeOnly],
    queryFn: async () => {
      let query = supabase
        .from('pricing_combinations')
        .select('*')
        .order('warehouse_id')
        .order('commodity');
      if (activeOnly) query = query.eq('active', true);
      const { data, error } = await query;
      if (error) throw error;
      return data as unknown as PricingCombination[];
    },
  });
}

export function useUpsertPricingCombination() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (combo: Partial<PricingCombination>) => {
      const { error } = await supabase
        .from('pricing_combinations')
        .upsert(combo as never, { onConflict: 'id' });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['pricing_combinations'] }),
  });
}

export function useDeletePricingCombination() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('pricing_combinations')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['pricing_combinations'] }),
  });
}

export function useTogglePricingCombinationActive() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase
        .from('pricing_combinations')
        .update({ active } as never)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['pricing_combinations'] }),
  });
}

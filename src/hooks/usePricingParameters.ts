import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { PricingParameter } from '@/types';

export function usePricingParameters() {
  return useQuery({
    queryKey: ['pricing_parameters'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pricing_parameters')
        .select('*')
        .order('id');
      if (error) throw error;
      return data as PricingParameter[];
    },
  });
}

export function useUpdatePricingParameter() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, sigma, target_profit_brl_per_sack }: { id: string; sigma: number; target_profit_brl_per_sack?: number }) => {
      const update: Record<string, unknown> = { sigma, updated_at: new Date().toISOString() };
      if (target_profit_brl_per_sack !== undefined) update.target_profit_brl_per_sack = target_profit_brl_per_sack;
      const { error } = await supabase
        .from('pricing_parameters')
        .update(update)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['pricing_parameters'] }),
  });
}

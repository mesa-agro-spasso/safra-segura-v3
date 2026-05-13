import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { logActivity } from '@/lib/activityLog';
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
    mutationFn: async ({ id, sigma, target_profit_brl_per_sack, execution_spread_pct, cbot_ticker_count, b3_corn_ticker_count }: {
      id: string;
      sigma: number;
      target_profit_brl_per_sack?: number;
      execution_spread_pct?: number;
      cbot_ticker_count?: number;
      b3_corn_ticker_count?: number;
    }) => {
      const update: Record<string, unknown> = { sigma, updated_at: new Date().toISOString() };
      if (target_profit_brl_per_sack !== undefined) update.target_profit_brl_per_sack = target_profit_brl_per_sack;
      if (execution_spread_pct !== undefined) update.execution_spread_pct = execution_spread_pct;
      if (cbot_ticker_count !== undefined) update.cbot_ticker_count = cbot_ticker_count;
      if (b3_corn_ticker_count !== undefined) update.b3_corn_ticker_count = b3_corn_ticker_count;
      const { error } = await (supabase
        .from('pricing_parameters') as any)
        .update(update)
        .eq('id', id);
      if (error) throw error;
      void logActivity('pricing_parameters.update', 'pricing_parameters', id, update);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['pricing_parameters'] }),
  });
}

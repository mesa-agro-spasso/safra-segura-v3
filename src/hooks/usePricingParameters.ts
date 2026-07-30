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
    mutationFn: async (args: {
      id: string;
      sigma?: number;
      target_profit_brl_per_sack?: number;
      execution_spread_pct?: number;
      ticker_count?: number;
      rounding_increment?: number | null;
    }) => {
      const { id, sigma, target_profit_brl_per_sack, execution_spread_pct, ticker_count } = args;
      const update: Record<string, unknown> = {};
      if (sigma !== undefined) update.sigma = sigma;
      if (target_profit_brl_per_sack !== undefined) update.target_profit_brl_per_sack = target_profit_brl_per_sack;
      if (execution_spread_pct !== undefined) update.execution_spread_pct = execution_spread_pct;
      if (ticker_count !== undefined) update.ticker_count = ticker_count;
      // presence check: null is a meaningful value (desliga o piso de arredondamento)
      if (Object.prototype.hasOwnProperty.call(args, 'rounding_increment')) {
        update.rounding_increment = args.rounding_increment;
      }
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

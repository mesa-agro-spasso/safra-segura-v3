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
    mutationFn: async ({ id, sigma }: { id: string; sigma: number }) => {
      const { error } = await supabase
        .from('pricing_parameters')
        .update({ sigma, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['pricing_parameters'] }),
  });
}

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { logActivity } from '@/lib/activityLog';
import type { FxParameters } from '@/types';

export function useFxParameters() {
  return useQuery({
    queryKey: ['fx_parameters'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fx_parameters')
        .select('*')
        .eq('id', 'default')
        .single();
      if (error) throw error;
      return data as FxParameters;
    },
  });
}

export type FxParametersUpdate = Partial<
  Pick<
    FxParameters,
    | 'short_bucket_carry_ann'
    | 'short_bucket_max_days'
    | 'long_bucket_carry_ann'
    | 'safety_haircut_brl'
    | 'calibration_date'
    | 'calibration_source'
  >
>;

export function useUpdateFxParameters() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (update: FxParametersUpdate) => {
      // Somente UPDATE na linha única id='default'. updated_at é do trigger.
      const { error } = await (supabase.from('fx_parameters') as any)
        .update(update)
        .eq('id', 'default');
      if (error) throw error;
      void logActivity('fx_parameters.update', 'fx_parameters', 'default', update);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['fx_parameters'] }),
  });
}

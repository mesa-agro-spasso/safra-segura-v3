import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { logActivity } from '@/lib/activityLog';
import type { SpotSettings } from '@/types';

export function useSpotSettings() {
  return useQuery({
    queryKey: ['spot_settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('spot_settings')
        .select('*')
        .eq('id', 'default')
        .single();
      if (error) throw error;
      return data as SpotSettings;
    },
  });
}

export function useUpdateSpotSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      mode: SpotSettings['mode'];
      weekday: number;
      skip_current_week: boolean;
    }) => {
      // Somente UPDATE na linha única. updated_at é responsabilidade do trigger.
      const { error } = await (supabase.from('spot_settings') as any)
        .update({
          mode: args.mode,
          weekday: args.weekday,
          skip_current_week: args.skip_current_week,
        })
        .eq('id', 'default');
      if (error) throw error;
      void logActivity('spot_settings.update', 'spot_settings', 'default', args);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['spot_settings'] }),
  });
}

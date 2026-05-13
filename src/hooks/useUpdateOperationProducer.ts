import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { logActivity } from '@/lib/activityLog';

export function useUpdateOperationProducer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ operationId, producerId }: { operationId: string; producerId: string | null }) => {
      const { error } = await supabase
        .from('operations')
        .update({ producer_id: producerId } as never)
        .eq('id', operationId);
      if (error) throw error;
      void logActivity('operation.update_producer', 'operation', operationId, { producer_id: producerId });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['operations'] });
      qc.invalidateQueries({ queryKey: ['operations_with_details'] });
      qc.invalidateQueries({ queryKey: ['producer-operations'] });
      qc.invalidateQueries({ queryKey: ['producer-operation-counts'] });
    },
  });
}

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { logActivity } from '@/lib/activityLog';
import type { Producer } from '@/types';

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

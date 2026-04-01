import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Operation } from '@/types';

export function useOperations() {
  return useQuery({
    queryKey: ['operations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('operations')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as unknown as Operation[];
    },
  });
}

export function useCreateOperation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (op: Omit<Operation, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('operations')
        .insert(op as never)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['operations'] }),
  });
}

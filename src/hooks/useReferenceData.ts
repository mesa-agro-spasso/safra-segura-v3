import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { logActivity } from '@/lib/activityLog';
import type { Tables, TablesInsert, TablesUpdate } from '@/integrations/supabase/types';

export type ReferenceTable = 'companies' | 'brokers' | 'trading_locations' | 'harvests';

export type ReferenceRow<T extends ReferenceTable> = Tables<T>;
export type ReferenceInsert<T extends ReferenceTable> = TablesInsert<T>;
export type ReferenceUpdate<T extends ReferenceTable> = TablesUpdate<T>;

const ORDER_COLUMN: Record<ReferenceTable, string> = {
  companies: 'legal_name',
  brokers: 'legal_name',
  trading_locations: 'name',
  harvests: 'name',
};

export function useReferenceRows<T extends ReferenceTable>(table: T) {
  return useQuery({
    queryKey: ['reference', table],
    queryFn: async () => {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .order(ORDER_COLUMN[table], { ascending: true });
      if (error) throw error;
      return (data ?? []) as ReferenceRow<T>[];
    },
  });
}

export function useCreateReferenceRow<T extends ReferenceTable>(table: T) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: ReferenceInsert<T>) => {
      const { data, error } = await supabase
        .from(table)
        .insert(payload as never)
        .select()
        .single();
      if (error) throw error;
      const row = data as ReferenceRow<T>;
      void logActivity('reference.create', table, (row as { id: string }).id, { payload });
      return row;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reference', table] }),
  });
}

export function useUpdateReferenceRow<T extends ReferenceTable>(table: T) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: ReferenceUpdate<T> }) => {
      const { data, error } = await (supabase.from(table) as any)
        .update(patch)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      void logActivity('reference.update', table, id, { patch });
      return data as ReferenceRow<T>;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reference', table] }),
  });
}

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';

export type RegistryPendingRow = Tables<'v_registry_pending'>;

export interface PendingRecord {
  entity: string;
  record_id: string;
  label: string;
  missing_fields: string[];
}

export function useRegistryPending() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['registry', 'pending'],
    queryFn: async () => {
      const { data, error } = await supabase.from('v_registry_pending').select('*');
      if (error) throw error;
      return (data ?? []) as RegistryPendingRow[];
    },
  });

  const grouped = useMemo(() => {
    const map = new Map<string, PendingRecord>();
    for (const row of data ?? []) {
      const entity = row.entity ?? '';
      const record_id = row.record_id ?? '';
      const key = `${entity}:${record_id}`;
      const existing = map.get(key);
      if (existing) {
        if (row.missing_field) existing.missing_fields.push(row.missing_field);
      } else {
        map.set(key, {
          entity,
          record_id,
          label: row.label ?? record_id,
          missing_fields: row.missing_field ? [row.missing_field] : [],
        });
      }
    }
    return [...map.values()].sort((a, b) => a.label.localeCompare(b.label));
  }, [data]);

  return { rows: data ?? [], grouped, count: grouped.length, isLoading, error };
}

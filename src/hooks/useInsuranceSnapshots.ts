import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface InsuranceSnapshotRow {
  id: string;
  pricing_snapshot_id: string;
  enabled: boolean;
  premium_brl: number;
  coverage_pct: number;
  insurance_cost_brl: number;
  adjusted_price_brl: number;
  premium_source: string;
  created_at: string;
  created_by: string | null;
}

export function useInsuranceSnapshots(snapshotIds: string[]) {
  const sorted = [...snapshotIds].sort();
  return useQuery({
    queryKey: ['insurance-snapshots', ...sorted],
    enabled: snapshotIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('insurance_snapshots')
        .select('*')
        .in('pricing_snapshot_id', snapshotIds);
      if (error) throw error;
      const map: Record<string, InsuranceSnapshotRow> = {};
      (data as unknown as InsuranceSnapshotRow[]).forEach((row) => {
        map[row.pricing_snapshot_id] = row;
      });
      return map;
    },
  });
}

export function useApplyInsuranceLayer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (rows: Record<string, unknown>[]) => {
      const { error } = await supabase
        .from('insurance_snapshots')
        .upsert(rows as never[], { onConflict: 'pricing_snapshot_id' });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['insurance-snapshots'] });
    },
    onError: (err: Error) => {
      toast.error(err.message ?? 'Erro ao aplicar seguro');
    },
  });
}

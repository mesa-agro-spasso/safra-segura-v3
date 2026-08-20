import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface SimulationDraft {
  id: string;
  label: string | null;
  created_at: string;
  created_by: string | null;
  request_json: Record<string, unknown>;
  response_json: Record<string, unknown> | null;
}

/** Rascunhos vivem 3 dias. O expurgo roda antes da listagem. */
const MAX_AGE_DAYS = 3;

function cutoffISO(): string {
  return new Date(Date.now() - MAX_AGE_DAYS * 24 * 60 * 60 * 1000).toISOString();
}

export function useSimulationDrafts(enabled = true) {
  return useQuery({
    queryKey: ['simulation_drafts'],
    enabled,
    queryFn: async () => {
      // Expurgo primeiro: nada expirado pode aparecer na lista.
      await supabase.from('simulation_drafts').delete().lt('created_at', cutoffISO());

      const { data, error } = await supabase
        .from('simulation_drafts')
        .select('id, label, created_at, created_by, request_json, response_json')
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as unknown as SimulationDraft[];
    },
  });
}

export function useSaveSimulationDraft() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (draft: {
      label: string | null;
      request_json: Record<string, unknown>;
      response_json: Record<string, unknown> | null;
      created_by: string | null;
    }) => {
      const { error } = await supabase.from('simulation_drafts').insert(draft as never);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['simulation_drafts'] }),
  });
}

export function useDeleteSimulationDraft() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('simulation_drafts').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['simulation_drafts'] }),
  });
}

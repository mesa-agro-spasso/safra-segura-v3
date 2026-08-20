import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/** Identificadores dos cards do cockpit. */
export type CockpitCardId =
  | 'price_table'
  | 'market'
  | 'physical_prices'
  | 'parameters'
  | 'insurance_options'
  | 'simulation';


export interface CockpitLayout {
  version: 1;
  cards: { id: CockpitCardId }[];
}

/** Layout padrão: tabela, parâmetros e mercado. Físico nasce fora. */
export const DEFAULT_LAYOUT: CockpitLayout = {
  version: 1,
  cards: [{ id: 'price_table' }, { id: 'parameters' }, { id: 'market' }],
};

const VALID_IDS: CockpitCardId[] = ['price_table', 'market', 'physical_prices', 'parameters', 'insurance_options', 'simulation'];

/** Normaliza o JSON salvo: descarta ids desconhecidos e garante o card fixo. */
export function normalizeLayout(raw: unknown): CockpitLayout {
  const cards: { id: CockpitCardId }[] = [];
  const seen = new Set<string>();
  const list = (raw as CockpitLayout | null)?.cards;
  if (Array.isArray(list)) {
    for (const entry of list) {
      const id = entry?.id;
      if (VALID_IDS.includes(id as CockpitCardId) && !seen.has(id)) {
        seen.add(id);
        cards.push({ id: id as CockpitCardId });
      }
    }
  }
  if (cards.length === 0) return DEFAULT_LAYOUT;
  if (!seen.has('price_table')) cards.unshift({ id: 'price_table' });
  return { version: 1, cards };
}

export function useCockpitLayout(userId: string | null | undefined) {
  return useQuery({
    queryKey: ['cockpit_layout', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cockpit_layouts')
        .select('layout')
        .eq('user_id', userId as string)
        .maybeSingle();
      if (error) throw error;
      if (!data) return DEFAULT_LAYOUT;
      return normalizeLayout(data.layout);
    },
  });
}

export function useSaveCockpitLayout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, layout }: { userId: string; layout: CockpitLayout }) => {
      const { error } = await supabase
        .from('cockpit_layouts')
        .upsert(
          { user_id: userId, layout: layout as never, updated_at: new Date().toISOString() },
          { onConflict: 'user_id' },
        );
      if (error) throw error;
    },
    onSuccess: (_d, vars) =>
      queryClient.invalidateQueries({ queryKey: ['cockpit_layout', vars.userId] }),
  });
}

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface TradingLocationLite {
  id: string;
  name: string;
}

/** Todas as praças ativas. */
export function useTradingLocations() {
  return useQuery({
    queryKey: ['trading_locations', 'active'],
    queryFn: async (): Promise<TradingLocationLite[]> => {
      const { data, error } = await supabase
        .from('trading_locations')
        .select('id, name')
        .eq('active', true)
        .order('name');
      if (error) throw error;
      return (data ?? []) as TradingLocationLite[];
    },
  });
}

/**
 * Praças do usuário: distintos location_id dos armazéns em users.warehouse_ids.
 * Vazio/nulo = Sede → acesso a todas as praças.
 */
export function useMyLocations() {
  const { profile } = useAuth();
  const warehouseIds = (profile as { warehouse_ids?: string[] | null } | null)?.warehouse_ids ?? null;
  const isSede = !warehouseIds || warehouseIds.length === 0;
  const all = useTradingLocations();

  const scoped = useQuery({
    queryKey: ['my-locations', warehouseIds],
    enabled: !isSede,
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await supabase
        .from('warehouses')
        .select('location_id')
        .in('id', warehouseIds!);
      if (error) throw error;
      const ids = new Set<string>();
      for (const r of (data ?? []) as { location_id: string | null }[]) {
        if (r.location_id) ids.add(r.location_id);
      }
      return [...ids];
    },
  });

  const locations = isSede
    ? (all.data ?? [])
    : (all.data ?? []).filter((l) => (scoped.data ?? []).includes(l.id));

  return {
    isSede,
    locations,
    allLocations: all.data ?? [],
    isLoading: all.isLoading || (!isSede && scoped.isLoading),
  };
}

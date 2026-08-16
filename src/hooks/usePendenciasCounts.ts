import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Contadores do item "Pendências" da barra lateral:
 * - registry: cadastros incompletos (v_registry_pending, agrupado por registro)
 * - users: cadastros de usuários aguardando aprovação
 */
export function usePendenciasCounts() {
  return useQuery({
    queryKey: ['pendencias-counts'],
    refetchInterval: 30_000,
    queryFn: async () => {
      const [registryRes, usersRes] = await Promise.all([
        supabase.from('v_registry_pending').select('entity, record_id'),
        supabase
          .from('users')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'pending')
          .is('deleted_at', null)
          .eq('is_owner', false),
      ]);

      const keys = new Set<string>();
      for (const r of (registryRes.data ?? []) as { entity: string | null; record_id: string | null }[]) {
        keys.add(`${r.entity ?? ''}:${r.record_id ?? ''}`);
      }

      return { registry: keys.size, users: usersRes.count ?? 0 };
    },
  });
}

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

const KG_PER_SACK = 60;

const ROLES_TIERS = {
  low: ['mesa', 'comercial_n1', 'comercial_n2', 'financeiro_n1'],
  mid: ['mesa', 'comercial_n1', 'comercial_n2', 'comercial_n2', 'financeiro_n1', 'financeiro_n2'],
  high: ['mesa', 'comercial_n1', 'presidencia', 'financeiro_n1', 'financeiro_n2'],
};

const countBy = (arr: string[]) =>
  arr.reduce<Record<string, number>>((acc, r) => ({ ...acc, [r]: (acc[r] ?? 0) + 1 }), {});

const getMissingRoles = (required: string[], collected: string[]) => {
  const req = countBy(required);
  const col = countBy(collected);
  const missing: string[] = [];
  for (const [role, n] of Object.entries(req)) {
    const remaining = n - (col[role] ?? 0);
    for (let i = 0; i < remaining; i++) missing.push(role);
  }
  return missing;
};

function getRequiredRoles(
  volumeTons: number,
  policy: { threshold_x_tons: number; threshold_y_tons: number },
) {
  if (volumeTons <= policy.threshold_x_tons) return ROLES_TIERS.low;
  if (volumeTons <= policy.threshold_x_tons + policy.threshold_y_tons) return ROLES_TIERS.mid;
  return ROLES_TIERS.high;
}

export function usePendingApprovalsCount() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['pending-approvals-count', user?.id],
    enabled: !!user?.id,
    refetchInterval: 30_000,
    queryFn: async () => {
      const [{ data: userRow }, { data: policy }, { data: ops }] = await Promise.all([
        supabase.from('users').select('roles').eq('id', user!.id).maybeSingle(),
        supabase.from('approval_policies').select('*').eq('is_active', true).maybeSingle(),
        supabase.from('operations').select('id, volume_sacks').eq('status', 'EM_APROVACAO'),
      ]);

      const userRoles = (userRow?.roles ?? []) as string[];
      const operations = ops ?? [];
      if (!userRoles.length || !operations.length) return 0;

      const operationIds = operations.map((o: any) => o.id);

      const [{ data: hedgeOrders }, { data: signatures }] = await Promise.all([
        supabase
          .from('hedge_orders')
          .select('operation_id, volume_sacks, status')
          .in('operation_id', operationIds)
          .neq('status', 'CANCELLED'),
        supabase
          .from('signatures')
          .select('operation_id, role_used, user_id')
          .in('operation_id', operationIds),
      ]);

      const effectivePolicy = policy ?? { threshold_x_tons: Infinity, threshold_y_tons: 0 };

      let count = 0;
      for (const op of operations as any[]) {
        const ho = (hedgeOrders ?? []).find((h: any) => h.operation_id === op.id);
        if (!ho) continue;
        const opSigs = (signatures ?? []).filter((s: any) => s.operation_id === op.id);
        const userAlreadySigned = opSigs.some((s: any) => s.user_id === user!.id);
        if (userAlreadySigned) continue;

        const collected = opSigs.map((s: any) => s.role_used);
        const volumeSacks = Number(ho?.volume_sacks ?? op.volume_sacks ?? 0);
        const volumeTons = (volumeSacks * KG_PER_SACK) / 1000;
        const required = getRequiredRoles(volumeTons, effectivePolicy as any);
        const missing = getMissingRoles(required, collected);
        const availableForUser = userRoles.filter((r) => missing.includes(r));
        if (availableForUser.length > 0) count++;
      }

      return count;
    },
  });
}

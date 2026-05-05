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
      const [{ data: userRow }, { data: policy }] = await Promise.all([
        supabase.from('users').select('roles').eq('id', user!.id).maybeSingle(),
        supabase.from('approval_policies').select('*').eq('is_active', true).maybeSingle(),
      ]);

      const userRoles = (userRow?.roles ?? []) as string[];
      if (!userRoles.length) return 0;

      const { data: sigs } = await (supabase as any)
        .from('signatures')
        .select('operation_id, flow_type, batch_id');
      const groups = new Map<string, { operationId: string; flowType: string; batchId: string | null }>();
      for (const s of (sigs ?? []) as any[]) {
        const batchId = (s.batch_id ?? null) as string | null;
        const key = `${s.operation_id}:${s.flow_type}:${batchId ?? 'none'}`;
        if (!groups.has(key)) {
          groups.set(key, { operationId: s.operation_id, flowType: s.flow_type, batchId });
        }
      }
      if (!groups.size) return 0;

      const events = [...groups.values()];
      const opIds = [...new Set(events.filter((e) => !e.batchId).map((e) => e.operationId))];
      const batchIds = [...new Set(events.filter((e) => e.batchId).map((e) => e.batchId as string))];
      const allOpIds = [...new Set(events.map((e) => e.operationId))];

      const [opsRes, batchesRes, allSigsRes] = await Promise.all([
        opIds.length
          ? (supabase as any).from('operations').select('id, volume_sacks').in('id', opIds)
          : Promise.resolve({ data: [] }),
        batchIds.length
          ? (supabase as any)
              .from('warehouse_closing_batches')
              .select('id, total_volume_sacks')
              .in('id', batchIds)
          : Promise.resolve({ data: [] }),
        (supabase as any)
          .from('signatures')
          .select('operation_id, flow_type, batch_id, role_used, user_id, decision')
          .in('operation_id', allOpIds),
      ]);

      const opMap = new Map<string, any>((opsRes.data ?? []).map((o: any) => [o.id, o]));
      const batchMap = new Map<string, any>((batchesRes.data ?? []).map((b: any) => [b.id, b]));
      const allSigs = (allSigsRes.data ?? []) as any[];

      const effectivePolicy = policy ?? { threshold_x_tons: Infinity, threshold_y_tons: 0 };

      let count = 0;
      for (const ev of events) {
        const src = ev.batchId ? batchMap.get(ev.batchId) : opMap.get(ev.operationId);
        if (!src) continue;

        const evSigs = allSigs.filter(
          (s) =>
            s.operation_id === ev.operationId &&
            s.flow_type === ev.flowType &&
            (s.batch_id ?? null) === ev.batchId &&
            s.decision === 'APPROVE',
        );
        const userAlreadySigned = evSigs.some((s) => s.user_id === user!.id);
        if (userAlreadySigned) continue;

        const collected = evSigs.map((s) => s.role_used);
        const volumeSacks = Number(
          (ev.batchId ? src.total_volume_sacks : src.volume_sacks) ?? 0,
        );
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

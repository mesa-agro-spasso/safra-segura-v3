# Activity Log para Auditoria

Sistema simples de captura e armazenamento de eventos. Sem UI, consulta via SQL no Supabase.

## 1. Migration — `public.activity_log`

```sql
CREATE TABLE public.activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email text,
  action text NOT NULL,
  entity_type text,
  entity_id text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb
);

ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

-- Authenticated podem inserir os próprios logs
CREATE POLICY "users insert own activity"
  ON public.activity_log FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Sem policies de SELECT/UPDATE/DELETE → consulta apenas via service_role / SQL editor
CREATE INDEX idx_activity_log_occurred_at ON public.activity_log (occurred_at DESC);
CREATE INDEX idx_activity_log_user_id ON public.activity_log (user_id);
```

## 2. Utilitário — `src/lib/activityLog.ts`

```ts
import { supabase } from '@/integrations/supabase/client';

export async function logActivity(
  action: string,
  entityType?: string,
  entityId?: string | null,
  details?: Record<string, unknown>,
): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return; // só loga autenticado (RLS exige)
    await supabase.from('activity_log').insert({
      user_id: user.id,
      user_email: user.email ?? null,
      action,
      entity_type: entityType ?? null,
      entity_id: entityId ?? null,
      details: details ?? {},
    });
  } catch (err) {
    console.warn('[activityLog] failed', err);
  }
}
```

Fire-and-forget: chamadores invocam sem `await` (ou com `void`); função nunca lança.

## 3. Pontos de instrumentação

Adicionar `void logActivity(...)` no `onSuccess` (ou final do `mutationFn`) das mutations existentes. Convenção `action`: `<entity>.<verb>` em snake_case.

**Auth (`AuthContext.tsx`)**
- `signIn` → `auth.login`
- `signOut` → `auth.logout` (chamar antes do signOut)
- `signUp` → `auth.signup`

**Operações (`useOperations.ts`)**
- create → `operation.create` (entity_id = id retornado)
- update / cancel / close handlers existentes → `operation.update`, `operation.cancel`, `operation.close`

**Ordens / Hedge (`useHedgeOrders.ts`)**
- create → `hedge_order.create`
- update → `hedge_order.update` (incluir status nos details quando cancelled/executed)

**Produtores (`useProducers.ts`)**
- create / update / delete → `producer.create | update | delete`

**Armazéns (`useWarehouses.ts`)**
- update → `warehouse.update`

**Configurações**
- `usePricingParameters` update → `pricing_parameters.update`
- `usePricingCombinations` upsert/delete/toggle → `pricing_combination.upsert | delete | toggle`

**Mercado / FX**
- `useMarketData` upsert → `market_data.update` (ticker nos details)
- `usePhysicalPrices` upsert/bulk/delete → `physical_price.upsert | bulk_upsert | delete`

**Tabela de preços**
- `usePricingSnapshots` create → `pricing_snapshot.publish` (count nos details)

**Outros existentes**
- `useUpdateOperationProducer` → `operation.update_producer`
- `useMtmSnapshots` create → `mtm_snapshot.create`
- Block trade execution (`blockTradeExecution.ts`) → `block_trade.execute`

Pular qualquer item acima que, na verificação durante implementação, não exista. Não criar mutations novas.

## Fora de escopo

- Nenhuma página, rota, sidebar, componente visual.
- Sem mudança em lógica de negócio.
- Sem backend Python.
- GETs, navegação e UI pura não são logados.

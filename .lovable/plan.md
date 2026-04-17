

# Filtrar ordens canceladas em usePendingApprovalsCount

## Mudança em `src/hooks/usePendingApprovalsCount.ts`

### 1. Query `hedge_orders` (linhas ~57-60)
Adicionar `status` ao select e `.neq('status', 'CANCELLED')`:
```ts
supabase
  .from('hedge_orders')
  .select('operation_id, volume_sacks, status')
  .in('operation_id', operationIds)
  .neq('status', 'CANCELLED'),
```

### 2. Loop `for (const op of operations)` (linha ~75)
Após `const ho = (hedgeOrders ?? []).find(...)`, adicionar early-continue:
```ts
const ho = (hedgeOrders ?? []).find((h: any) => h.operation_id === op.id);
if (!ho) continue;
```

## Efeito
Operações cuja única hedge order foi cancelada não contam mais no badge de pendências do sidebar — alinhado com a filtragem já aplicada em `Approvals.tsx`.

## Fora de escopo
Qualquer outra lógica do hook ou demais arquivos.




# Filtrar ordens canceladas em Approvals.tsx

## Mudança em `src/pages/Approvals.tsx`

### 1. Query `pending-hedge-orders` (linhas ~119-127)
Adicionar `status` ao select e filtrar `.neq('status', 'CANCELLED')`:
```ts
.select('operation_id, display_code, origination_price_brl, volume_sacks, status')
.in('operation_id', operationIds)
.neq('status', 'CANCELLED');
```

### 2. `useMemo` de `rows` (linha ~144)
Após `const ho = hedgeOrders.find(...)`, descartar a operação se não houver hedge order ativa. Adicionar early-return no `.map`:
```ts
const ho = hedgeOrders.find((h: any) => h.operation_id === op.id);
if (!ho) return null;
```
E ajustar o `.filter` final para também remover os `null`:
```ts
.filter((r): r is NonNullable<typeof r> => r !== null && !r.userAlreadySigned && r.availableForUser.length > 0);
```

## Efeito
Operações cuja única hedge order foi cancelada deixam de aparecer na lista de aprovações pendentes — pois sem ordem ativa não há valor/código para assinar.

## Fora de escopo
Qualquer outra lógica, query ou UI da página.


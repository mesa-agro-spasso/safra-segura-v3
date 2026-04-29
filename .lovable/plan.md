# Aprovações — filtros e seção "Assinadas por mim"

Único arquivo modificado: `src/pages/Approvals.tsx`.

## 1. Ampliar query `pending-operations-d24`

Remover o `.eq('status', 'DRAFT')` para trazer todas as operações que tenham assinatura `OPENING`. O filtro de status passa a ser feito no `useMemo` para classificar entre Pendente e Assinada-por-mim.

```ts
const { data: operations = [] } = useQuery({
  queryKey: ['pending-operations-d24'],
  staleTime: 0,
  queryFn: async () => {
    const { data: sigs } = await (supabase as any)
      .from('signatures').select('operation_id').eq('flow_type', 'OPENING');
    const ids = [...new Set((sigs ?? []).map((s: any) => s.operation_id as string))];
    if (!ids.length) return [];
    const { data, error } = await (supabase as any)
      .from('operations')
      .select('*, warehouses(display_name), pricing_snapshots(payment_date)')
      .in('id', ids);
    if (error) throw error;
    return data ?? [];
  },
});
```

## 2. Reestruturar `useMemo` em duas listas

- `pendingRows`: operações `DRAFT` onde o usuário ainda não assinou e tem papel disponível (lógica atual).
- `signedRows`: operações com assinatura OPENING `APPROVE` do usuário logado (qualquer status).

Cada row mantém os mesmos campos (warehouse, commodity, volumeSacks, valueBRL, paymentDate, collected, missing, required, displayCode, operationId), além de `status` para badge na seção "Assinadas".

## 3. Filtros

Adicionar estados:
```ts
const [filterWarehouse, setFilterWarehouse] = useState<string>('all');
const [filterCommodity, setFilterCommodity] = useState<string>('all');
const [filterPaymentFrom, setFilterPaymentFrom] = useState<string>('');
const [filterPaymentTo, setFilterPaymentTo] = useState<string>('');
```

Derivar `warehouseOptions` e `commodityOptions` distintas a partir de `pendingRows ∪ signedRows`.

Aplicar a mesma função `applyFilters(rows)` para gerar `filteredPending` e `filteredSigned`.

UI dos filtros: Card acima dos dois resultados, com Select (Praça), Select (Commodity), Input type=date (de) e Input type=date (até), além de botão "Limpar".

## 4. UI

- Substituir referências de `rows` por `filteredPending` no Card "Pendentes".
- Novo Card "Assinadas por mim ({filteredSigned.length})" abaixo, com tabela read-only (sem coluna Ação, linhas com `opacity-70`) e badge de status.

## Restrições
- Apenas `src/pages/Approvals.tsx`.
- Sem hooks ou Edge Functions novos.
- Casts `as any` mantidos.

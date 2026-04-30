## Objetivo

Fazer a tela Financeiro e o calendário financeiro listarem operações em mais estados (`HEDGE_CONFIRMADO`, `ACTIVE`, `PARTIALLY_CLOSED`) e usar o `display_code` direto da tabela `operations`, removendo o join legado com `hedge_orders`.

## Arquivos afetados

- `src/pages/Financial.tsx`
- `src/hooks/useFinancialCalendarData.ts`

Nenhum outro arquivo será tocado. Sem novos hooks, Edge Functions ou migrações.

## Mudanças (idênticas nos dois arquivos)

### 1. `src/hooks/useFinancialCalendarData.ts`

Na query `financial_calendar_data`:

```ts
const { data: ops, error } = await supabase
  .from('operations')
  .select(`
    id, commodity, volume_sacks, display_code,
    warehouses(display_name),
    pricing_snapshots(payment_date, sale_date, origination_price_brl)
  `)
  .in('status', ['HEDGE_CONFIRMADO', 'ACTIVE', 'PARTIALLY_CLOSED']);
```

E na derivação do `displayCode`:

```ts
const displayCode = op.display_code ?? op.id.slice(0, 8);
```

(remove o bloco que lia `op.hedge_orders[0]?.display_code`).

### 2. `src/pages/Financial.tsx`

Na query `financial-operations`:

```ts
const { data, error } = await supabase
  .from('operations')
  .select(`
    id, commodity, volume_sacks, display_code,
    warehouses(display_name),
    pricing_snapshots(payment_date, sale_date, origination_price_brl)
  `)
  .in('status', ['HEDGE_CONFIRMADO', 'ACTIVE', 'PARTIALLY_CLOSED']);
```

No mapeamento de `rows`:

```ts
const displayCode = op.display_code ?? op.id.slice(0, 8);
```

(remove o bloco que lia `op.hedge_orders`).

## Notas técnicas

- A coluna `operations.display_code` já existe (preenchida pelo trigger `set_operation_display_code`), portanto o fallback `op.id.slice(0, 8)` praticamente nunca será usado.
- O título do `CardTitle` ("Operações Confirmadas") permanece — não foi solicitada mudança de copy.
- Os tipos retornados continuam usando `as any[]` / `OperationRow`, sem alteração de contrato.
- Nenhuma invalidação de cache adicional é necessária; as `queryKey`s permanecem as mesmas.

## Validação após implementação

1. Abrir `/financeiro` → aba Tabela: operações em `ACTIVE` e `PARTIALLY_CLOSED` agora aparecem.
2. Aba Calendário: eventos de inflow/outflow para essas operações também são gerados.
3. Coluna "Código" mostra o `display_code` da operação (não mais o da hedge_order).

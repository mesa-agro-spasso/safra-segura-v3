

## Mudança em `src/pages/Orders.tsx` — `handleExecutionConfirm`

Inserir bloco de avanço da operação para `HEDGE_CONFIRMADO` logo após o `await updateOrder.mutateAsync(...)` que marca a ordem como `EXECUTED` (após linha 729) e antes do `toast.success` (linha 730).

### Bloco a inserir
```ts
// Advance operation to HEDGE_CONFIRMADO
const { error: opError } = await supabase
  .from('operations')
  .update({ status: 'HEDGE_CONFIRMADO' })
  .eq('id', executionModal.operation_id);
if (opError) {
  toast.error('Ordem executada, mas falha ao atualizar status da operação: ' + opError.message);
} else {
  queryClient.invalidateQueries({ queryKey: ['operations'] });
  queryClient.invalidateQueries({ queryKey: ['operation-status'] });
  queryClient.invalidateQueries({ queryKey: ['operations_with_details'] });
  queryClient.invalidateQueries({ queryKey: ['financial_calendar_data'] });
}
```

### Pré-condições já satisfeitas
- `supabase` importado (linha 9)
- `queryClient` instanciado (linha 83)
- `toast` importado de sonner (linha 19)
- `executionModal.operation_id` disponível no escopo

### Nada mais é alterado
Nenhuma outra linha de `handleExecutionConfirm` ou de qualquer outro arquivo é tocada. O `toast.success`, fechamento do modal e `catch` permanecem como estão.

### Efeito esperado
Após confirmar execução: ordem vira `EXECUTED` + operação vira `HEDGE_CONFIRMADO`, fazendo a operação aparecer automaticamente em `Financial.tsx` e no `FinancialCalendar` (ambos consomem operações `HEDGE_CONFIRMADO`).


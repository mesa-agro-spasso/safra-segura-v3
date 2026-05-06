## Lote 2C-2b — Modal de Execução do Block Trade

Editar **apenas** `src/pages/ArmazensD24.tsx`. Sem alterações em outros arquivos, sem migrations (estrutura de `orders` e `warehouse_closing_batches` já comporta tudo).

### 1. Atualizar callsite na lista de batches (~linha 882-893)

No `onClick` do botão "Executar", anexar `_batchId` ao `btProposals` para o modal localizar o batch:

```tsx
setBtProposals({
  proposals: batch.allocation_snapshot ?? [],
  total_volume_allocated_sacks: batch.total_volume_sacks,
  strategy_used: batch.allocation_strategy,
  warnings: [],
  _batchId: batch.id,
} as AllocateBatchResponse & { _batchId: string });
setBtExecutionOpen(true);
```

### 2. Atualizar render do modal (~linha 1394)

```tsx
<BlockTradeExecutionModal
  open={btExecutionOpen}
  onClose={() => setBtExecutionOpen(false)}
  batch={
    btBatches.find((b: any) => b.id === (btProposals as any)?._batchId) ??
    btBatches.find((b: any) => b.status === 'DRAFT') ?? null
  }
  proposals={btProposals}
  d24Orders={btD24Orders as any[]}
  userId={user?.id ?? null}
  onExecuted={() => {
    setBtExecutionOpen(false);
    queryClient.invalidateQueries({ queryKey: ['warehouse-closing-batches'] });
    queryClient.invalidateQueries({ queryKey: ['operations_with_details'] });
    queryClient.invalidateQueries({ queryKey: ['d24-orders-for-bt'] });
  }}
/>
```

### 3. Substituir o componente `BlockTradeExecutionModal` (linhas 1531-1553)

Reescrita completa com 2 etapas (`step: 1 | 2`):

**Estado interno**: `step`, `volumes` (Record<op_id, number>), `prices` (Record<instrument, number|''>), `submitting`, `executedSummary`. `useQueryClient` para invalidações pós-execução.

**Init via useEffect([open])**: ao abrir, popular `volumes` com `volume_to_close_sacks` de cada proposal; resetar `prices`, `step=1`, `executedSummary=null`.

**Derivações memoizadas**:
- `totalEdited`, `totalExpected`, `volumeOk` (delta < 0.01)
- `openOrdersByOpId`: filtra `d24Orders` por `operation_id` e `!is_closing`, ordenados por `executed_at` ASC (FIFO)
- `batchInstruments`: set único de `instrument_type` em todas as operações do batch

**Etapa 1 — Edição** (layout 2 colunas em md+):
- *Esquerda* — Tabela de volumes editáveis (1 linha por proposal): código, volume proposto (read-only), input editável, diferença colorida. Rodapé com `total X sc / Y sc` em verde/vermelho conforme `volumeOk`.
- *Direita* — Um Input por instrumento em `batchInstruments`, com label diferenciado para `futures` (USD/bushel), `ndf` (R$/USD), `option` (premium).
- Botão "Revisar →" habilitado só se `volumeOk && batchInstruments.every(i => Number(prices[i]) > 0)`.

**Etapa 2a — Resumo pré-execução** (antes do confirm):
Tabela calculada via mesma lógica do handler: para cada op, para cada instrumento (FIFO), proporção = `volumes[op] / current_volume_sacks`, contracts/volume_units arredondados a 2 casas, `direction` invertida. Botões "← Voltar" e "Confirmar Execução" (destructive).

**handleExecute**:
- Para cada proposal × cada instrumento (FIFO): `INSERT into orders` com `is_closing=true`, `closes_order_id=openOrder.id`, `batch_id`, `executed_by=userId`, preço alocado conforme tipo (`price` para futures, `ndf_rate` para ndf, `premium` para option), herdando `currency`, `ticker`, `option_type`, `strike`, `expiration_date`, `ndf_maturity` da order de abertura.
- Após inserts, `UPDATE warehouse_closing_batches SET status='EXECUTED', generated_orders_count=N WHERE id=batch.id`.
- Em sucesso: monta `executedSummary`, vai para etapa 2 pós-execução, toast.success, invalida queries.
- Erros (insert/update) viram `toast.error` no catch — sem swallow.

**Etapa 2b — Pós-execução** (quando `executedSummary !== null`):
Check verde + tabela com `display_code` e `volume_closed`, botão "Fechar" único que chama `onExecuted()` + `onClose()`.

### Pontos de atenção técnicos

- `proposals.proposals[].operation_id` e `display_code` vêm tanto da resposta da API quanto do snapshot persistido — mesma forma, ok.
- Cast `(supabase as any).from('orders').insert(...)` segue o padrão já usado em `handleBtSendForSignature`.
- `batch?.id` necessário para o INSERT — modal protege com guard `if (!batch || !proposals || !userId) return;`.
- Trigger `advance_operation_after_order` cuida da transição de status da operation; nada a fazer no frontend.

### Checklist de validação (a rodar após implementação)

1. Botão "Executar" em batch DRAFT abre modal já em etapa 1.
2. Tabela de volumes editável; total fica vermelho ao divergir e verde ao bater.
3. "Revisar →" desabilitado até volumes OK + todos os preços preenchidos.
4. Etapa 2 pré-execução mostra contratos proporcionais corretos (regra de três sobre as orders de abertura FIFO).
5. "Confirmar Execução" insere N orders com `is_closing=true`, `batch_id`, `closes_order_id` corretos no Supabase.
6. `warehouse_closing_batches` vai para `status='EXECUTED'` com `generated_orders_count=N`.
7. Batch some dos botões de ação na lista (não é mais DRAFT).
8. Resumo pós-execução exibido; "Fechar" invalida queries e fecha modal.

Reportar resultado item a item após implementar.
## Tipagem completa do endpoint allocateClosingBatch

Apenas 2 arquivos. Sem mudanças visuais.

### 1. `src/types/d24.ts` — append ao final

Adicionar 4 novas interfaces após `OperationBalanceOut`:

- `OperationSummaryIn` — resumo de operação enviado no batch (inclui `existing_orders: OrderIn[]` e `mtm_total_brl?`).
- `ClosingAllocationProposalOut` — proposta de fechamento por operação retornada pelo backend.
- `AllocateBatchRequest` — payload do POST `/closing-batches/allocate` (warehouse, commodity, exchange, target_volume_sacks, strategy, operations[]).
- `AllocateBatchResponse` — retorno (proposals[], total_volume_allocated_sacks, strategy_used, warnings[]).

Strings simples para `commodity`, `exchange` e `strategy` (paridade com backend, conforme padrão já adotado no arquivo).

### 2. `src/services/d24Api.ts`

- Adicionar `AllocateBatchRequest` e `AllocateBatchResponse` ao bloco de imports de `@/types/d24`.
- Substituir a função `allocateClosingBatch` (atualmente `Record<string, unknown> → Promise<unknown>`) pela versão tipada `AllocateBatchRequest → Promise<AllocateBatchResponse>`. Corpo da chamada via `supabase.functions.invoke('api-proxy', { body: { endpoint: '/closing-batches/allocate', body: payload } })` permanece idêntico.

### Garantias

- Nenhum outro arquivo é tocado.
- Função `allocateClosingBatch` ainda não tem consumidores no frontend — mudança de assinatura é segura.
- Padrão de proxy preservado.

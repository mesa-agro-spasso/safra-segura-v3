# Lote 2C-1 — Approvals + usePendingApprovalsCount

Mostrar uma linha por evento de governança `(operation_id, flow_type, batch_id)` em vez de uma por operação. Inclui CLOSING e batches Block Trade. Sem mudar lógica de alçada nem layout.

## Arquivos

- `src/pages/Approvals.tsx`
- `src/hooks/usePendingApprovalsCount.ts`

## src/pages/Approvals.tsx

### 1. Atualizar `SigningTarget`

```ts
interface SigningTarget {
  operationId: string;
  batchId: string | null;
  flowType: 'OPENING' | 'CLOSING';
  displayCode: string;
  available: string[];
  collected: string[];
  required: string[];
}
```

### 2. Substituir query `pending-operations-d24` por `signature-events`

Buscar **todas** as signatures (sem filtro `flow_type`), deduplicar por chave `${operation_id}:${flow_type}:${batch_id ?? 'none'}`, e em seguida buscar dois grupos:

- Grupos com `batch_id != null` → `warehouse_closing_batches` (`id, warehouse_id, commodity, total_volume_sacks, allocation_strategy, created_at`) + join `warehouses(display_name)`.
- Grupos com `batch_id == null` → `operations` (atual, já com `warehouses` + `pricing_snapshots`).

Retornar lista de eventos com shape unificado:

```ts
{ operationId, batchId, flowType, batch?: row, operation?: row }
```

### 3. Manter query `pending-signatures` mas alargar o `select`

Já busca `*`. Garantir que retorna `operation_id, flow_type, batch_id, role_used, user_id, decision`.

### 4. Reescrever `allRows` com filtro por `(operation_id, flow_type, batch_id)`

```ts
const opSignatures = signatures.filter(
  (s) =>
    s.operation_id === ev.operationId &&
    s.flow_type === ev.flowType &&
    (s.batch_id ?? null) === ev.batchId
);
```

Para cada evento construir uma row:

```ts
{
  eventKey,
  operationId,
  batchId,
  flowType,
  isBatch: batchId != null,
  displayCode: isBatch ? `BATCH-${batchId.slice(0,8)}` : op.display_code,
  status: isBatch ? batch.status : op.status,
  warehouse, commodity,
  volumeSacks: isBatch ? batch.total_volume_sacks : op.volume_sacks,
  valueBRL: isBatch ? 0 : volumeSacks * origination_price_brl,
  paymentDate: isBatch ? null : op.pricing_snapshots?.payment_date,
  collected, required, missing, availableForUser, userAlreadySigned,
}
```

Cálculo de alçada idêntico ao atual (volume em toneladas → `getRequiredRoles`).

### 5. Filtros pendente / assinado

- **Pendente:** `!userAlreadySigned && availableForUser.length > 0`. Remover o filtro hardcoded `r.status === 'DRAFT'` (CLOSING acontece em ACTIVE/PARTIALLY_CLOSED; batches em DRAFT do batch). Passar a depender só do estado do evento (existência da signature inicial já garante elegibilidade).
- **Assinado por mim:** inalterado (`userAlreadySigned`).

Usar `row.eventKey` como `key` do React em ambas as tabelas.

### 6. Badges na coluna "Código" (tabela Pendentes e Assinadas)

Substituir o uso de `row.isClosing`:

```tsx
{row.isBatch && (
  <Badge variant="outline" className="border-purple-500 text-purple-500 text-[10px]">
    Block Trade
  </Badge>
)}
{!row.isBatch && row.flowType === 'CLOSING' && (
  <Badge variant="outline" className="border-orange-500 text-orange-500 text-[10px]">
    Encerramento
  </Badge>
)}
```

### 7. `openSign` / `openReject`

Passar `batchId` e `flowType` para o `SigningTarget`. Botão "Recusar" só renderiza quando `row.flowType === 'OPENING' && !row.isBatch`.

### 8. `handleSign`

```ts
await supabase.from('signatures').insert({
  operation_id: signing.operationId,
  batch_id: signing.batchId ?? null,
  user_id: user.id,
  role_used: selectedRole,
  flow_type: signing.flowType,   // não hardcoded
  decision: 'APPROVE',
  notes: notes || null,
  signed_at: new Date().toISOString(),
});
```

Invalidar também `['signature-events']`.

### 9. `handleReject`

Verificação no início: `if (rejecting.flowType !== 'OPENING' || rejecting.batchId) return;`. Resto inalterado.

## src/hooks/usePendingApprovalsCount.ts

Mesma mudança estrutural:

1. Buscar `signatures` sem filtro de `flow_type`, retornando `operation_id, flow_type, batch_id`.
2. Deduplicar por `(operation_id, flow_type, batch_id)`.
3. Carregar em paralelo:
   - `operations` (id, status, volume_sacks) para grupos sem batch.
   - `warehouse_closing_batches` (id, status, total_volume_sacks) para grupos com batch.
   - Todas as signatures dos `operation_id`s envolvidos.
4. Iterar eventos: filtrar `opSigs` por `(operation_id, flow_type, batch_id)`, calcular `volumeTons` (operações: do `volume_sacks` da operação; batches: do `total_volume_sacks`), aplicar `getRequiredRoles`/`getMissingRoles`, e incrementar contador se usuário pode assinar e ainda não assinou.

Remover o filtro `.eq('status','DRAFT')` em operations — CLOSING ocorre em ACTIVE/PARTIALLY_CLOSED.

## Validação manual

1. Op DRAFT com OPENING parcial → linha em "Pendentes" para roles faltantes.
2. Op DRAFT com OPENING totalmente assinada → linha em "Assinadas por mim".
3. Op ACTIVE com CLOSING (mesa) → linha separada com badge laranja "Encerramento".
4. Mesma operação com OPENING + CLOSING → duas linhas distintas, badges não duplicam.
5. Batch com signature → linha com badge roxa "Block Trade", `displayCode` `BATCH-xxxxxxxx`.
6. Botão "Recusar" só aparece em OPENING não-batch.
7. Badge no menu reflete OPENING + CLOSING + batches.

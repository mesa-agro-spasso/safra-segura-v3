## Plano: Migrar Approvals.tsx e usePendingApprovalsCount.ts para D24

Migrar a tela de aprovações e o contador de aprovações pendentes para o modelo D24, eliminando dependência da tabela legada `hedge_orders` e adotando a lógica baseada em `signatures.flow_type='OPENING'` sobre operações `DRAFT`.

### Arquivo 1: `src/pages/Approvals.tsx`

**1.1 Substituir query `pending-operations`**
- Remover query atual que filtra `operations` por `status IN ('EM_APROVACAO', 'ENCERRAMENTO_SOLICITADO')`.
- Nova query `pending-operations-d24`:
  - Primeiro busca `signatures` com `flow_type='OPENING'` para coletar `operation_id` distintos.
  - Depois busca `operations` com esses IDs, filtrando `status='DRAFT'`, com joins em `warehouses(display_name)` e `pricing_snapshots(payment_date)`.

**1.2 Remover query `pending-hedge-orders`**
- Remover por completo a query e a variável `hedgeOrders`.

**1.3 Atualizar query `pending-signatures`**
- Trocar `.from('signatures')` por `.from('signatures' as any)` e remover o join `signer:users(full_name)` (não é mais usado nas linhas).

**1.4 Reescrever `useMemo rows`**
- Não mais procurar por `ho` em `hedgeOrders`. Derivar tudo direto de `op`:
  - `displayCode` = `op.display_code ?? op.id.slice(0,8)`
  - `warehouse` = `op.warehouses?.display_name`
  - `paymentDate` = `op.pricing_snapshots?.payment_date`
  - `volumeSacks` = `op.volume_sacks`
  - `valueBRL` = `volumeSacks * op.origination_price_brl`
  - `isClosing` = `false`
- Filtrar assinaturas com `decision === 'APPROVE'` para `userAlreadySigned`.
- Manter filtro final `!userAlreadySigned && availableForUser.length > 0`.

**1.5 Reescrever `handleSign`**
- Inserir em `signatures` com campos D24: `flow_type: 'OPENING'`, `decision: 'APPROVE'`, `notes`, `signed_at`.
- Remover update de `operations.status` (não há mais `APROVADA` no D24). Apenas mostrar toast indicando que todas as assinaturas foram coletadas quando `allSigned` for verdadeiro.
- Invalidar queries: `pending-signatures`, `pending-operations-d24`, `signatures-for-ops`, `pending-approvals-count`.

**1.6 Reescrever `handleReject`**
- Remover update em `hedge_orders` por completo.
- Update em `operations`: `status='CANCELLED'`, `cancellation_reason`, `cancelled_at`, `cancelled_by`.
- Insert em `signatures` com `flow_type: 'OPENING'`, `decision: 'REJECT'`, `notes`.
- Invalidar queries D24 (sem `hedge-orders`).

### Arquivo 2: `src/hooks/usePendingApprovalsCount.ts`

**2.1 Reescrever `queryFn`**
- Remover a busca por `hedge_orders` por completo.
- Buscar `users.roles` e `approval_policies` ativa em paralelo.
- Buscar `signatures` com `flow_type='OPENING'` para descobrir IDs de operações em fluxo.
- Buscar `operations` com esses IDs filtrando `status='DRAFT'` e todas as `signatures` daqueles IDs (em paralelo).
- Para cada operação, considerar apenas assinaturas com `decision='APPROVE'` no cálculo de `collected`/`userAlreadySigned`.
- Calcular `volumeTons` direto de `op.volume_sacks` (não mais `ho.volume_sacks`).
- Manter mesma lógica de matching de roles e contagem.

### Restrições aplicadas
- Apenas dois arquivos modificados.
- Nenhum novo hook ou Edge Function.
- Casts `as any` para `signatures`/`operations` quando necessário (tipos podem estar desatualizados).
- Helpers `KG_PER_SACK`, `ROLES_TIERS`, `countBy`, `getMissingRoles`, `getRequiredRoles`, `allSigned` permanecem inalterados.
- UI da tabela e dos diálogos permanece idêntica — apenas a fonte dos dados muda.
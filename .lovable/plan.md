

# Botão "Recusar" em Approvals.tsx

## Mudança em `src/pages/Approvals.tsx`

### 1. Estado novo
Adicionar após `signing`/`selectedRole`/`notes`/`submitting`:
```ts
const [rejecting, setRejecting] = useState<SigningTarget | null>(null);
const [rejectReason, setRejectReason] = useState('');
```
(reutiliza `submitting` já existente)

### 2. Handler `openReject` e `handleReject`
- `openReject(row)`: popula `rejecting` com mesma shape do `signing` e zera `rejectReason`.
- `handleReject`: 
  1. UPDATE `hedge_orders` → `status='CANCELLED'` + `cancellation_reason/cancelled_at/cancelled_by` (filtrado por `operation_id` e `.neq('status','CANCELLED')`)
  2. UPDATE `operations` → `status='CANCELADA'` + `rejection_reason/rejected_by/rejected_at`
  3. INSERT em `signatures` com `signature_type='REPROVACAO'`, `role_used=rejecting.available[0]`, `notes=rejectReason`
  4. Invalida queries: `pending-operations`, `pending-signatures`, `operations`, `hedge-orders`, `pending-approvals-count`
  5. `toast.success` / `toast.error` / `setRejecting(null)`

### 3. Coluna "Ação" da tabela
Trocar a célula atual por um flex com dois botões:
```tsx
<div className="flex justify-end gap-2">
  <Button size="sm" onClick={() => openSign(row)}>Assinar</Button>
  <Button size="sm" variant="destructive" onClick={() => openReject(row)}>Recusar</Button>
</div>
```

### 4. Dialog de recusa
Adicionar segundo `<Dialog>` (controlado por `rejecting`) após o dialog de assinatura existente, com `<Textarea>` obrigatório para motivo e botão `destructive` desabilitado quando `!rejectReason.trim() || submitting`.

## Pré-condições já satisfeitas
- `supabase`, `toast`, `queryClient`, `user` no escopo
- `Textarea`, `Label`, `Dialog*`, `Button` já importados
- Colunas `rejection_reason`, `rejected_by`, `rejected_at` existem em `operations`
- Colunas `cancellation_reason`, `cancelled_at`, `cancelled_by`, `status` existem em `hedge_orders`
- Filtro `.neq('status','CANCELLED')` já está nas queries de listagem → operação recusada some imediatamente

## Fora de escopo
Lógica do dialog de assinatura, queries existentes, demais arquivos.


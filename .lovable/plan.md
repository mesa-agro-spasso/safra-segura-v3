
# Plano — Refatoração OperacoesD24

Apenas `src/pages/OperacoesD24.tsx`. Sem novos arquivos, hooks ou Edge Functions.

## 1. Estado novo (junto com `closingOp` ~linha 631)

```ts
const [editPlanOp, setEditPlanOp] = useState<OperationWithDetails | null>(null);
const [registerExecutionOp, setRegisterExecutionOp] = useState<OperationWithDetails | null>(null);
```

## 2. Queries de assinaturas (após `filteredOperations` ~linha 668)

- `signaturesForOps`: select `operation_id` em lote para todas as `filteredOperations`. Deriva `signedOperationIds: Set<string>` via `useMemo`.
- `operationSignatures`: select completo (`*, signer:users(full_name)`) filtrado por `selectedOperation.id`, habilitado só com Sheet aberto.

## 3. Handlers (no escopo do componente principal)

- `handleSendForSignature(op)` → INSERT em `signatures` (`flow_type:'APROVACAO'`, `decision:'PENDING'`, `user_id:user.id`, `role_used:'mesa'`, `signed_at:now`). Invalida `['signatures-for-ops']` e `['signatures', op.id]`.
- `handleCancelOperation(op)` → UPDATE `operations.status='CANCELLED'`. Invalida `['operations_with_details']` e `['operations']`.
- `renderOpActions(op)` retorna botões conforme status (DRAFT/RASCUNHO → Editar Plano + Enviar p/Assinatura ou Registrar Execução + Cancelar; ACTIVE/PARTIALLY_CLOSED → Encerrar). Cast `as any` em `from('signatures' as any)`/`from('operations' as any)`.

## 4. Tabela de operações (~linhas 933-975)

- Adicionar `<TableHead>Ações</TableHead>` fixa (fora do `ColumnSelector`) após o `TableHead` de Status.
- Substituir a `<TableCell>` do botão "Encerrar" atual por `<TableCell onClick={e => e.stopPropagation()}>{renderOpActions(op)}</TableCell>`.

## 5. Sheet — seção "Plano de Hedge" volta a somente leitura (~1424-1469)

- Remover bloco `{isDraft && <HedgePlanEditor ... />}`.
- Remover gating `!isDraft &&` para que cards de leitura apareçam sempre.
- Adicionar botão "Editar" no trigger da Section quando `isDraft`. Como o `Section` atual encapsula o trigger, a forma mais simples é renderizar acima da Section um pequeno header sobreposto OU passar um `action` via children topo. Implementação concreta: trocar a Section por um wrapper inline com `Collapsible`/`CollapsibleTrigger` apenas para esta seção, mantendo aparência idêntica, com `<Button>Editar</Button>` no trigger (com `e.stopPropagation()`), chamando `setEditPlanOp(selectedOperation)`. (Section permanece para as outras subseções.)

## 6. Nova seção "Assinaturas" (após "Ordens Vinculadas", ~1526)

```tsx
<Section title={`Assinaturas (${operationSignatures?.length ?? 0})`} defaultOpen={false}>
  {(!operationSignatures || operationSignatures.length === 0) ? (
    <p className="text-sm text-muted-foreground">Nenhuma assinatura registrada.</p>
  ) : (
    <div className="space-y-2">
      {operationSignatures.map(s => (
        <div key={s.id} className="rounded-md border p-3 text-sm space-y-1">
          <div className="flex items-center justify-between">
            <span className="font-medium">{s.signer?.full_name ?? s.user_id?.slice(0,8)}</span>
            <Badge variant="outline">{s.decision}</Badge>
          </div>
          <div className="text-xs text-muted-foreground">
            {s.role_used} · {s.flow_type} · {fmtDateTime(s.signed_at)}
          </div>
          {s.notes && <p className="text-xs">{s.notes}</p>}
        </div>
      ))}
    </div>
  )}
</Section>
```

## 7. Dialog "Editar Plano de Hedge"

Novo Dialog renderizado próximo ao `ClosingModal` no fim do componente principal:

```tsx
<Dialog open={!!editPlanOp} onOpenChange={(o) => { if (!o) setEditPlanOp(null); }}>
  <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
    <DialogHeader>
      <DialogTitle>
        Editar Plano de Hedge — {editPlanOp?.warehouses?.display_name ?? '—'} / {(editPlanOp as any)?.display_code ?? editPlanOp?.id.slice(0,8)}
      </DialogTitle>
    </DialogHeader>
    {editPlanOp && (
      <HedgePlanEditor
        operation={editPlanOp}
        opD24={editPlanOp as any}
        planLegs={Array.isArray((editPlanOp as any).hedge_plan)
          ? (editPlanOp as any).hedge_plan
          : ((editPlanOp as any).hedge_plan?.plan ?? [])}
        userId={user?.id ?? ''}
        onSaved={() => {
          queryClient.invalidateQueries({ queryKey: ['operations_with_details'] });
          queryClient.invalidateQueries({ queryKey: ['operations'] });
          setEditPlanOp(null);
        }}
        copyToClipboard={copyToClipboard}
      />
    )}
  </DialogContent>
</Dialog>
```

`HedgePlanEditor` já existe e encapsula todo o estado de edição — nada nele muda.

## 8. Dialog "Registrar Execução" (placeholder)

```tsx
<Dialog open={!!registerExecutionOp} onOpenChange={(o) => { if (!o) setRegisterExecutionOp(null); }}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Registrar Execução — {registerExecutionOp?.warehouses?.display_name ?? '—'}</DialogTitle>
    </DialogHeader>
    <p className="text-sm text-muted-foreground">
      Funcionalidade de registro de execução será implementada na próxima etapa.
    </p>
    <DialogFooter>
      <Button variant="outline" onClick={() => setRegisterExecutionOp(null)}>Fechar</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

## Notas técnicas

- `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogFooter` já estão importados (linha 38).
- `fmtDateTime` já existe (linha 495).
- Não há mudança em `HedgePlanEditor`; ele continua válido tanto fora (Dialog) como antes — apenas removemos a invocação dentro do Sheet.
- Casts `as any` mantidos para `signatures`/`operations` por contornar tipagem.
- Polling/realtime não incluído; invalidação manual via `queryClient` cobre os casos.

# Alterações em src/pages/Approvals.tsx

Quatro mudanças cirúrgicas no arquivo, sem afetar nenhum outro componente.

## 1. Query de operações pendentes (linha 119)

Incluir operações de encerramento no filtro:

```typescript
// DE:
.eq('status', 'EM_APROVACAO');

// PARA:
.in('status', ['EM_APROVACAO', 'ENCERRAMENTO_SOLICITADO']);
```

## 2. Campo isClosing no useMemo de rows (após linha 178)

Adicionar flag booleana logo após `displayCode`:

```typescript
return {
  operationId: op.id,
  displayCode: ho?.display_code ?? '—',
  isClosing: op.status === 'ENCERRAMENTO_SOLICITADO',  // NOVO
  warehouse: op.warehouse?.display_name ?? '—',
  // ...resto inalterado
};
```

## 3. Badge "Encerramento" na célula displayCode (linha 353)

Trocar a célula simples por um wrapper com badge condicional laranja:

```tsx
<TableCell className="font-mono text-xs">
  <div className="flex items-center gap-2">
    {row.displayCode}
    {row.isClosing && (
      <Badge variant="outline" className="border-orange-500 text-orange-500 text-[10px]">
        Encerramento
      </Badge>
    )}
  </div>
</TableCell>
```

## 4. handleSign — status condicional ao concluir todas as assinaturas (linhas 286–295)

Antes de marcar como APROVADA, ler o status atual e decidir entre APROVADA e ENCERRAMENTO_APROVADO:

```typescript
if (allSigned(signing.required, newCollected)) {
  const { data: opData } = await supabase
    .from('operations')
    .select('status')
    .eq('id', signing.operationId)
    .single();

  const nextStatus = opData?.status === 'ENCERRAMENTO_SOLICITADO'
    ? 'ENCERRAMENTO_APROVADO'
    : 'APROVADA';

  const { error: updateError } = await supabase
    .from('operations')
    .update({ status: nextStatus })
    .eq('id', signing.operationId);
  if (updateError) throw updateError;
  toast.success(
    nextStatus === 'ENCERRAMENTO_APROVADO'
      ? 'Encerramento aprovado'
      : 'Operação totalmente aprovada'
  );
} else {
  // ... ramo "Assinatura registrada" inalterado
}
```

## Fora de escopo

- Nenhuma outra alteração no arquivo (handleReject, dialogs, queries restantes ficam intactos).
- Nenhuma alteração em outras páginas, hooks ou no schema do banco.
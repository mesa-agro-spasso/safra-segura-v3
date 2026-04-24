# Update Closing Buttons in Orders.tsx and OperationsMTM.tsx

## Scope
Two specific files with targeted button logic changes for the operation closing workflow.

## Changes

### 1. Orders.tsx - Lines 1399-1408
Replace the two EXECUTED closing button blocks with corrected logic:

**Current code:**
```tsx
{o.status === 'EXECUTED' && o.operation_id && operationStatusMap?.[o.operation_id] === 'HEDGE_CONFIRMADO' && (
  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => handleOpenClosingOrderModal(o)}>
    Confirmar Enc.
  </Button>
)}
{o.status === 'EXECUTED' && o.operation_id && operationStatusMap?.[o.operation_id] === 'ENCERRAMENTO_APROVADO' && (
  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => handleOpenClosingOrderModal(o)}>
    Confirmar Enc.
  </Button>
)}
```

**New code:**
```tsx
{o.status === 'EXECUTED' && o.operation_id && operationStatusMap?.[o.operation_id] === 'HEDGE_CONFIRMADO' && (
  <Button variant="ghost" size="sm" className="h-7 text-xs"
    onClick={() => handleRequestClosingFromOrder(o)}>
    Solicitar Enc.
  </Button>
)}
{o.status === 'EXECUTED' && o.operation_id && operationStatusMap?.[o.operation_id] === 'ENCERRAMENTO_APROVADO' && (
  <Button variant="ghost" size="sm" className="h-7 text-xs"
    onClick={() => handleOpenClosingOrderModal(o)}>
    Confirmar Enc.
  </Button>
)}
```

**Key change:** HEDGE_CONFIRMADO now shows "Solicitar Enc." calling `handleRequestClosingFromOrder` instead of "Confirmar Enc."

### 2. OperationsMTM.tsx - Lines 596-617
Replace the TableCell closing actions with the specified blocks:

**New code:**
```tsx
<TableCell onClick={(e) => e.stopPropagation()}>
  {op.status === 'HEDGE_CONFIRMADO' && (
    <Button
      size="sm"
      variant="outline"
      className="h-7 text-xs"
      onClick={() => handleRequestClosing(op.id)}
    >
      Solicitar Encerramento
    </Button>
  )}
  {op.status === 'ENCERRAMENTO_APROVADO' && (
    <Button
      size="sm"
      variant="default"
      className="h-7 text-xs"
      onClick={() => handleOpenClosingModal(op)}
    >
      Confirmar Encerramento
    </Button>
  )}
</TableCell>
```

Note: No button shown for ENCERRAMENTO_SOLICITADO status (as specified).

## Constraints
- Only modify the specified code blocks
- No changes to imports, types, or other functions
- Preserve all styling (variant, size, className)



# Adicionar fluxo de Encerramento de Operações em `OperationsMTM.tsx`

## Escopo
Apenas `src/pages/OperationsMTM.tsx`. Nenhum outro arquivo modificado.

## Pré-requisito fora do escopo do Lovable
Os endpoints `POST /closing/{operation_id}/request` e `POST /closing/{operation_id}/execute` precisam estar no whitelist `ALLOWED_POST_ENDPOINTS` da Edge Function `api-proxy` (gerenciada manualmente no Supabase Dashboard, igual ao caso de `/utils/convert-price`). Sem isso, os botões retornarão "Endpoint não permitido". Vou assumir que o whitelist será atualizado fora do Lovable, conforme convenção já estabelecida.

## Mudanças em `src/pages/OperationsMTM.tsx`

### 1. Imports (linha 1)
Adicionar `useQueryClient` ao import do react-query. Atualmente o arquivo **não importa nada de `@tanstack/react-query`** — os hooks usados (`useHedgeOrders`, `useOperationsWithDetails`) encapsulam essa dependência. Vou adicionar:
```ts
import { useQueryClient } from '@tanstack/react-query';
```

### 2. STATUS_BADGE (após linha 32, HEDGE_CONFIRMADO)
Adicionar duas entradas:
```ts
ENCERRAMENTO_SOLICITADO: { label: 'Enc. Solicitado', variant: 'outline', className: 'border-orange-500 text-orange-500' },
ENCERRAMENTO_APROVADO: { label: 'Enc. Aprovado', variant: 'outline', className: 'border-blue-500 text-blue-500' },
```

### 3. Hook e novos estados (próximo às outras declarações em ~linha 47–73)
```ts
const queryClient = useQueryClient();

const [filterStatus, setFilterStatus] = useState<'active' | 'closed' | 'all'>('active');

const [closingOperation, setClosingOperation] = useState<OperationWithDetails | null>(null);
const [closingLegs, setClosingLegs] = useState<any[]>([]);
const [closingPhysicalPrice, setClosingPhysicalPrice] = useState('');
const [closingPhysicalVolume, setClosingPhysicalVolume] = useState('');
const [closingOriginationPrice, setClosingOriginationPrice] = useState('');
const [closingSubmitting, setClosingSubmitting] = useState(false);
```

### 4. `filteredOperations` useMemo (após `ordersForSelectedOperation`, ~linha 198)
```ts
const filteredOperations = useMemo(() => {
  if (!operations) return [];
  const STATUS_ORDER: Record<string, number> = {
    ENCERRAMENTO_APROVADO: 1,
    ENCERRAMENTO_SOLICITADO: 2,
    HEDGE_CONFIRMADO: 3,
    APROVADA: 4,
    EM_APROVACAO: 5,
    SUBMETIDA: 6,
    RASCUNHO: 7,
    ENCERRADA: 98,
    CANCELADA: 99,
    REPROVADA: 99,
  };
  const filtered = filterStatus === 'active'
    ? operations.filter(op => !['ENCERRADA', 'CANCELADA', 'REPROVADA'].includes(op.status))
    : filterStatus === 'closed'
    ? operations.filter(op => op.status === 'ENCERRADA')
    : operations;
  return [...filtered].sort((a, b) => {
    const orderA = STATUS_ORDER[a.status] ?? 50;
    const orderB = STATUS_ORDER[b.status] ?? 50;
    if (orderA !== orderB) return orderA - orderB;
    return new Date(b.created_at ?? '').getTime() - new Date(a.created_at ?? '').getTime();
  });
}, [operations, filterStatus]);
```

### 5. Handlers (antes do `return`, após `handleCalculate`, ~linha 404)
```ts
const handleRequestClosing = async (operationId: string) => {
  try {
    await callApi(`/closing/${operationId}/request`, {
      notes: null,
      created_by: user?.id ?? null,
    });
    toast.success('Encerramento solicitado. Aguardando assinaturas.');
    queryClient.invalidateQueries({ queryKey: ['operations_with_details'] });
    queryClient.invalidateQueries({ queryKey: ['operations'] });
  } catch (err) {
    toast.error(err instanceof Error ? err.message : 'Erro ao solicitar encerramento');
  }
};

const handleOpenClosingModal = async (op: OperationWithDetails) => {
  setClosingOperation(op);
  setClosingPhysicalPrice('');
  setClosingPhysicalVolume(String(op.volume_sacks));
  const ps = op.pricing_snapshots;
  setClosingOriginationPrice(ps?.origination_price_brl ? String(ps.origination_price_brl) : '');
  try {
    const { data } = await supabase
      .from('closing_orders')
      .select('legs')
      .eq('operation_id', op.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    setClosingLegs((data?.legs as any[]) ?? []);
  } catch {
    setClosingLegs([]);
  }
};

const handleExecuteClosing = async () => {
  if (!closingOperation || !user) return;
  setClosingSubmitting(true);
  try {
    await callApi(`/closing/${closingOperation.id}/execute`, {
      physical_price_brl: parseFloat(closingPhysicalPrice),
      physical_volume_sacks: parseFloat(closingPhysicalVolume),
      origination_price_brl: parseFloat(closingOriginationPrice),
      executed_legs: closingLegs,
      insurance_cost_brl: 0,
      executed_by: user.id,
    });
    toast.success('Operação encerrada com sucesso.');
    setClosingOperation(null);
    queryClient.invalidateQueries({ queryKey: ['operations_with_details'] });
    queryClient.invalidateQueries({ queryKey: ['operations'] });
  } catch (err) {
    toast.error(err instanceof Error ? err.message : 'Erro ao encerrar operação');
  } finally {
    setClosingSubmitting(false);
  }
};
```

### 6. CardHeader da TAB 1 (linha 449)
Substituir:
```tsx
<CardHeader><CardTitle className="text-sm">Todas as Operações</CardTitle></CardHeader>
```
Por:
```tsx
<CardHeader>
  <div className="flex items-center justify-between">
    <CardTitle className="text-sm">Todas as Operações</CardTitle>
    <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as any)}>
      <SelectTrigger className="w-32 h-8 text-xs"><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value="active">Ativas</SelectItem>
        <SelectItem value="closed">Encerradas</SelectItem>
        <SelectItem value="all">Todas</SelectItem>
      </SelectContent>
    </Select>
  </div>
</CardHeader>
```

### 7. Cabeçalho e corpo da tabela TAB 1 (linhas 452–489)
- Adicionar `<TableHead></TableHead>` no header (após "Status") para a coluna de ações.
- Trocar `{operations.map((op) => {` por `{filteredOperations.map((op) => {`.
- Após o `<TableCell>` do Status (linha 485), adicionar:
```tsx
<TableCell onClick={(e) => e.stopPropagation()}>
  {op.status === 'HEDGE_CONFIRMADO' && (
    <Button size="sm" variant="outline" className="h-7 text-xs"
      onClick={() => handleRequestClosing(op.id)}>
      Solicitar Encerramento
    </Button>
  )}
  {op.status === 'ENCERRAMENTO_APROVADO' && (
    <Button size="sm" variant="default" className="h-7 text-xs"
      onClick={() => handleOpenClosingModal(op)}>
      Confirmar Encerramento
    </Button>
  )}
</TableCell>
```

### 8. Dialog de Encerramento (antes do `</div>` final do return, ~linha 983 ou 1080)
Adicionar junto aos outros dialogs no fim do componente:
```tsx
{closingOperation && (
  <Dialog open onOpenChange={(o) => { if (!o) setClosingOperation(null); }}>
    <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>
          Confirmar Encerramento — {closingOperation.warehouses?.display_name ?? '—'}
        </DialogTitle>
      </DialogHeader>

      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-muted-foreground">Preço Físico Venda (R$/sc)</label>
            <Input type="number" step="0.01"
              value={closingPhysicalPrice}
              onChange={(e) => setClosingPhysicalPrice(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Volume Vendido (sacas)</label>
            <Input type="number" step="0.01"
              value={closingPhysicalVolume}
              onChange={(e) => setClosingPhysicalVolume(e.target.value)} />
          </div>
        </div>

        <div>
          <label className="text-xs text-muted-foreground">Preço Originação (R$/sc)</label>
          <Input type="number" step="0.01"
            value={closingOriginationPrice}
            onChange={(e) => setClosingOriginationPrice(e.target.value)} />
        </div>

        {closingLegs.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Pernas de Encerramento
            </p>
            {closingLegs.map((leg: any, i: number) => (
              <div key={i} className="border rounded p-2 space-y-1">
                <p className="text-xs font-medium">{leg.leg_type} · {leg.direction}</p>
                {leg.leg_type === 'ndf' ? (
                  <div>
                    <label className="text-xs text-muted-foreground">Taxa NDF (BRL/USD)</label>
                    <Input type="number" step="0.0001"
                      value={leg.ndf_rate ?? ''}
                      onChange={(e) => {
                        const updated = [...closingLegs];
                        updated[i] = { ...updated[i], ndf_rate: parseFloat(e.target.value) || null };
                        setClosingLegs(updated);
                      }} />
                  </div>
                ) : (
                  <div>
                    <label className="text-xs text-muted-foreground">
                      Preço {leg.currency === 'USD' ? '(USD/bu)' : '(R$/sc)'}
                    </label>
                    <Input type="number" step="0.0001"
                      value={leg.price ?? ''}
                      onChange={(e) => {
                        const updated = [...closingLegs];
                        updated[i] = { ...updated[i], price: parseFloat(e.target.value) || null };
                        setClosingLegs(updated);
                      }} />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex justify-end gap-2 mt-4">
        <Button variant="outline" onClick={() => setClosingOperation(null)} disabled={closingSubmitting}>
          Cancelar
        </Button>
        <Button onClick={handleExecuteClosing} disabled={closingSubmitting}>
          {closingSubmitting ? 'Encerrando...' : 'Confirmar Encerramento'}
        </Button>
      </div>
    </DialogContent>
  </Dialog>
)}
```

## Constraints
- Zero cálculo financeiro local — encerramento via `/closing/.../execute`.
- Invalidação dupla: `['operations_with_details']` (usado pelo hook desta página) + `['operations']` (consistência cross-page).
- `onClick={(e) => e.stopPropagation()}` na nova `<TableCell>` para evitar abrir o dialog de detalhes ao clicar nos botões.
- Botões só aparecem nos status corretos: `HEDGE_CONFIRMADO` → Solicitar; `ENCERRAMENTO_APROVADO` → Confirmar.
- Nenhuma alteração em hooks, schema, Edge Function, ou outros arquivos.

## Fora de escopo
- Whitelist dos endpoints `/closing/...` na Edge Function (gerenciada manualmente no Dashboard).
- Backend Python `/closing/{id}/request` e `/closing/{id}/execute` (assumidos prontos no Render).
- UI de aprovação do encerramento na página `Approvals.tsx` (já implementada em mensagem anterior).


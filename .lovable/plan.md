
# Reformulação de `src/pages/OrdensD24.tsx`

Único arquivo tocado: `src/pages/OrdensD24.tsx`. Sem novos hooks, sem Edge Functions, sem migrações.

## Parte 1 — Imports e estado

No topo do arquivo:
- Adicionar `import { useNavigate } from 'react-router-dom';`
- Adicionar `import { useMarketData } from '@/hooks/useMarketData';`
- (`useQuery` e `supabase` já existem.)

Dentro do componente `OrdensD24`:
- `const navigate = useNavigate();`
- `const { data: marketData = [] } = useMarketData();`
- `const [closingOrder, setClosingOrder] = useState<any | null>(null);`

## Parte 2 — Header com botão "Nova Ordem"

Trocar o header existente por um com botão à direita que navega para `/operacoes-d24`, com `title` explicativo:

```tsx
<div className="flex items-center justify-between">
  <h1 className="text-2xl font-bold">Ordens D24</h1>
  <Button
    size="sm"
    onClick={() => navigate('/operacoes-d24')}
    title="Para criar uma nova ordem, crie ou selecione uma operação em Operações D24"
  >
    Nova Ordem
  </Button>
</div>
```

## Parte 3 — Reformulação da tabela

Substituir o `<TableHeader>` e o `map` do `<TableBody>` para refletir as novas colunas. Remover `StatusBadge`, `legsSummary`, `renderActions` da renderização (o componente helper `StatusBadge` continua no arquivo, sem uso aqui — pode ser deixado para não tocar mais nada).

Novas colunas, na ordem:

| Coluna | Render |
|---|---|
| Praça | `op?.warehouses?.display_name ?? warehouseNameById.get(op?.warehouse_id ?? '') ?? '—'` |
| Operação | `(op as any)?.display_code ?? order.operation_id.slice(0,8)` (font-mono xs) |
| Instrumento | `<Badge variant="outline">{order.instrument_type}</Badge>` |
| Direção | `<Badge variant="secondary">{order.direction}</Badge>` |
| Ticker | `order.ticker ?? '—'` (font-mono) |
| Contratos | `Number(order.contracts).toLocaleString('pt-BR', { maximumFractionDigits: 4 })` |
| Preço/Taxa | futures/option: `order.price != null ? Number(order.price).toFixed(4) : '—'`; ndf: `order.ndf_rate != null ? Number(order.ndf_rate).toFixed(4) + ' BRL/USD' : '—'` |
| Volume (sc) | `Number(order.volume_units).toLocaleString('pt-BR', { maximumFractionDigits: 0 })` |
| Encerramento | `order.is_closing ? 'Sim' : '—'` |
| Data | `formatDateBR(order.executed_at ?? order.created_at)` |
| Ações | Botão "Fechar" (size sm, variant outline) apenas se `!order.is_closing`, `onClick={() => setClosingOrder(order)}` |

`colSpan` da linha "Nenhuma ordem" passa a ser `11`.

## Parte 4 — Componente `CloseOrderModal` (mesmo arquivo)

Definido após `OrdensD24` (antes do `export default` movido apropriadamente, ou logo abaixo). Renderizado dentro do JSX do `OrdensD24`:

```tsx
<CloseOrderModal
  order={closingOrder}
  operation={closingOrder ? opById.get(closingOrder.operation_id) ?? null : null}
  marketData={marketData as any[]}
  userId={user?.id ?? null}
  onClose={() => setClosingOrder(null)}
  onClosed={() => {
    setClosingOrder(null);
    queryClient.invalidateQueries({ queryKey: ['d24-orders-all'] });
    queryClient.invalidateQueries({ queryKey: ['operations'] });
  }}
/>
```

### Implementação do componente

```tsx
interface CloseOrderModalProps {
  order: any | null;
  operation: any | null;
  marketData: any[];
  userId: string | null;
  onClose: () => void;
  onClosed: () => void;
}

const CloseOrderModal: React.FC<CloseOrderModalProps> = ({
  order, operation, marketData, userId, onClose, onClosed,
}) => {
  const isOpen = order !== null;
  const isNdf = order?.instrument_type === 'ndf';
  const exchange = (operation as any)?.exchange?.toLowerCase() ?? 'cbot';
  const CONTRACT_SIZE = exchange === 'b3' ? 450 : 5000;
  const oppositeDirection = order?.direction === 'sell' ? 'buy' : 'sell';

  const defaultPrice = useMemo(() => {
    if (!order) return '';
    if (isNdf) {
      const fx = marketData.find(m => m.commodity === 'FX')?.price;
      return fx != null ? String(fx) : '';
    }
    const px = marketData.find(m => m.ticker === order.ticker)?.price;
    return px != null ? String(px) : '';
  }, [order, isNdf, marketData]);

  const [contracts, setContracts] = useState('');
  const [price, setPrice] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Reset on order change
  React.useEffect(() => {
    if (order) {
      setContracts(String(order.contracts ?? ''));
      setPrice(defaultPrice);
      setNotes('');
    }
  }, [order, defaultPrice]);

  if (!order) return null;

  const priceLabel = isNdf
    ? 'Taxa executada (BRL/USD)'
    : `Preço executado (${priceUnitLabel(order.instrument_type, exchange)})`;

  const handleConfirm = async () => {
    if (!userId) { toast.error('Usuário não autenticado'); return; }
    const qty = parseFloat(contracts);
    if (!qty || qty <= 0) { toast.error('Contratos inválidos'); return; }
    setSubmitting(true);
    try {
      const payload = {
        operation_id: order.operation_id,
        instrument_type: order.instrument_type,
        direction: oppositeDirection,
        currency: order.currency,
        contracts: qty,
        volume_units: isNdf ? qty : qty * CONTRACT_SIZE,
        price: !isNdf && price ? parseFloat(price) : null,
        ndf_rate: isNdf && price ? parseFloat(price) : null,
        ndf_maturity: order.ndf_maturity ?? null,
        option_type: order.option_type ?? null,
        strike: order.strike ?? null,
        premium: order.premium ?? null,
        expiration_date: order.expiration_date ?? null,
        ticker: order.ticker ?? null,
        is_counterparty_insurance: false,
        executed_at: new Date().toISOString(),
        executed_by: userId,
        is_closing: true,
        closes_order_id: order.id,
        notes: notes || null,
      };
      const { error } = await supabase.from('orders' as any).insert(payload as never);
      if (error) throw new Error(error.message);
      toast.success('Ordem fechada');
      onClosed();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao fechar ordem');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Fechar Ordem — {order.instrument_type} {order.direction} {order.ticker ?? ''}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <div>
            <Label>Direção (auto, oposta)</Label>
            <Input value={oppositeDirection} readOnly className="bg-muted" />
          </div>
          <div>
            <Label>Contratos</Label>
            <Input type="number" value={contracts} onChange={e => setContracts(e.target.value)} />
          </div>
          <div>
            <Label>{priceLabel}</Label>
            <Input type="number" value={price} onChange={e => setPrice(e.target.value)} />
          </div>
          <div>
            <Label>Observações</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>Cancelar</Button>
          <Button onClick={handleConfirm} disabled={submitting}>
            {submitting ? 'Fechando…' : 'Confirmar fechamento'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
```

## Notas técnicas

- `supabase.from('orders' as any)` para preservar `executed_by = auth.uid()` da RLS.
- Trigger `advance_operation_after_order` cuida do status (`PARTIALLY_CLOSED`/`CLOSED`).
- Refresh: invalidar `d24-orders-all` e `operations` em `onClosed`.
- O componente legado `DetailSheet` no fim do arquivo permanece intocado (não é usado pela nova tabela).

Após aprovação, aplico as mudanças exclusivamente em `src/pages/OrdensD24.tsx`.

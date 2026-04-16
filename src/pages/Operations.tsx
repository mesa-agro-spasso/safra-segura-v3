import { useState, useMemo } from 'react';
import { useOperationsWithDetails } from '@/hooks/useOperations';
import { useHedgeOrders } from '@/hooks/useHedgeOrders';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import type { OperationWithDetails } from '@/types';

const STATUS_BADGE: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive'; className?: string }> = {
  RASCUNHO: { label: 'Rascunho', variant: 'secondary' },
  SUBMETIDA: { label: 'Submetida', variant: 'outline' },
  EM_APROVACAO: { label: 'Em Aprovação', variant: 'outline', className: 'border-yellow-500 text-yellow-500' },
  APROVADA: { label: 'Aprovada', variant: 'outline', className: 'border-blue-500 text-blue-500' },
  HEDGE_CONFIRMADO: { label: 'Hedge Confirmado', variant: 'default' },
  MONITORAMENTO: { label: 'Monitoramento', variant: 'outline', className: 'border-green-500 text-green-500' },
  ENCERRADA: { label: 'Encerrada', variant: 'secondary' },
  CANCELADA: { label: 'Cancelada', variant: 'destructive' },
};

const fmtDate = (d?: string | null) =>
  d ? new Date(d + 'T12:00:00').toLocaleDateString('pt-BR') : '—';

const DetailRow = ({ label, value }: { label: string; value: string }) => (
  <div className="flex justify-between py-2">
    <span className="text-sm text-muted-foreground">{label}</span>
    <span className="text-sm font-medium">{value}</span>
  </div>
);

const Operations = () => {
  const { data: operations, isLoading } = useOperationsWithDetails();
  const { data: allOrders } = useHedgeOrders();
  const [selected, setSelected] = useState<OperationWithDetails | null>(null);

  const ordersForSelected = useMemo(() => {
    if (!selected || !allOrders) return [];
    return allOrders.filter(o => o.operation_id === selected.id);
  }, [selected, allOrders]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Operações</h1>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : !operations?.length ? (
        <p className="text-muted-foreground text-center py-12">Nenhuma operação encontrada.</p>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Todas as Operações</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Praça</TableHead>
                  <TableHead>Commodity</TableHead>
                  <TableHead>Ticker</TableHead>
                  <TableHead>Volume</TableHead>
                  <TableHead>Preço Orig.</TableHead>
                  <TableHead>Entrada</TableHead>
                  <TableHead>Pagamento</TableHead>
                  <TableHead>Recepção</TableHead>
                  <TableHead>Saída</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {operations.map((op) => {
                  const ps = op.pricing_snapshots;
                  const badge = STATUS_BADGE[op.status] ?? { label: op.status, variant: 'secondary' as const };
                  return (
                    <TableRow key={op.id} className="cursor-pointer" onClick={() => setSelected(op)}>
                      <TableCell>{op.warehouses?.display_name ?? '—'}</TableCell>
                      <TableCell>{op.commodity === 'soybean' ? 'Soja' : 'Milho'}</TableCell>
                      <TableCell>{ps?.ticker ?? '—'}</TableCell>
                      <TableCell>{op.volume_sacks.toLocaleString('pt-BR')} sc</TableCell>
                      <TableCell>{ps ? `R$ ${ps.origination_price_brl.toFixed(2)}` : '—'}</TableCell>
                      <TableCell>{fmtDate(ps?.trade_date)}</TableCell>
                      <TableCell>{fmtDate(ps?.payment_date)}</TableCell>
                      <TableCell>{fmtDate(ps?.grain_reception_date)}</TableCell>
                      <TableCell>{fmtDate(ps?.sale_date)}</TableCell>
                      <TableCell>
                        <Badge variant={badge.variant} className={badge.className}>
                          {badge.label}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {selected && (() => {
        const ps = selected.pricing_snapshots;
        return (
          <Dialog open={!!selected} onOpenChange={(o) => { if (!o) setSelected(null); }}>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>
                  {selected.warehouses?.display_name ?? '—'} — {selected.id.slice(0, 8)}
                </DialogTitle>
              </DialogHeader>

              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Identificação</p>
              <DetailRow label="Commodity" value={selected.commodity === 'soybean' ? 'Soja' : 'Milho'} />
              <DetailRow label="Volume" value={`${selected.volume_sacks.toLocaleString('pt-BR')} sc`} />
              <DetailRow label="Status" value={STATUS_BADGE[selected.status]?.label ?? selected.status} />
              <DetailRow label="Criada em" value={fmtDate(selected.created_at?.slice(0, 10))} />
              {selected.notes && <DetailRow label="Notas" value={selected.notes} />}

              <Separator />
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Precificação</p>
              <DetailRow label="Ticker" value={ps?.ticker ?? '—'} />
              <DetailRow label="Preço Originação" value={ps ? `R$ ${ps.origination_price_brl.toFixed(2)}` : '—'} />
              <DetailRow label="Preço Futuros (BRL)" value={ps ? `R$ ${ps.futures_price_brl.toFixed(2)}` : '—'} />
              <DetailRow label="Câmbio" value={ps?.exchange_rate != null ? ps.exchange_rate.toFixed(4) : '—'} />

              <Separator />
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Datas</p>
              <DetailRow label="Entrada" value={fmtDate(ps?.trade_date)} />
              <DetailRow label="Pagamento" value={fmtDate(ps?.payment_date)} />
              <DetailRow label="Recepção" value={fmtDate(ps?.grain_reception_date)} />
              <DetailRow label="Saída" value={fmtDate(ps?.sale_date)} />

              {ordersForSelected.length > 0 && (
                <>
                  <Separator />
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Ordens Vinculadas ({ordersForSelected.length})
                  </p>
                  {ordersForSelected.map((o) => (
                    <div key={o.id} className="rounded-md border p-3 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{o.display_code ?? o.id.slice(0, 8)}</span>
                        <Badge variant="outline">{o.status}</Badge>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>{(o.legs as any[])?.length ?? 0} pernas</span>
                        <span>{o.volume_sacks.toLocaleString('pt-BR')} sc</span>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </DialogContent>
          </Dialog>
        );
      })()}
    </div>
  );
};

export default Operations;

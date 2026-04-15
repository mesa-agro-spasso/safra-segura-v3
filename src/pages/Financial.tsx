import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useActiveArmazens } from '@/hooks/useWarehouses';
import { toast } from 'sonner';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface PaymentRow {
  id: string;
  operation_id: string;
  scheduled_date: string;
  amount_brl: number;
  status: string;
  realized_date: string | null;
  notes: string | null;
  registered_by: string | null;
  // joined
  commodity?: string;
  warehouse_display_name?: string;
  display_code?: string;
  volume_sacks?: number;
  sale_date?: string | null;
}

const fmtBrl = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const fmtDate = (d: string | null) => {
  if (!d) return '—';
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
};

export default function Financial() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: armazens } = useActiveArmazens();

  const [statusFilter, setStatusFilter] = useState('all');
  const [warehouseFilter, setWarehouseFilter] = useState('all');
  const [payDialog, setPayDialog] = useState<PaymentRow | null>(null);
  const [realizedDate, setRealizedDate] = useState('');
  const [payNotes, setPayNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const { data: rows, isLoading } = useQuery({
    queryKey: ['payment_events'],
    queryFn: async () => {
      // Fetch payment_events
      const { data: events, error } = await supabase
        .from('payment_events')
        .select('*')
        .order('status', { ascending: true })
        .order('scheduled_date', { ascending: true });
      if (error) throw error;
      if (!events || events.length === 0) return [] as PaymentRow[];

      const opIds = [...new Set(events.map((e: any) => e.operation_id))];

      // Batch fetch operations for commodity + warehouse_id
      const { data: ops } = await supabase
        .from('operations')
        .select('id, commodity, warehouse_id, volume_sacks, pricing_snapshot_id')
        .in('id', opIds);

      // Batch fetch hedge_orders for display_code
      const { data: orders } = await supabase
        .from('hedge_orders')
        .select('operation_id, display_code')
        .in('operation_id', opIds);

      // Batch fetch warehouse names
      const whIds = [...new Set((ops ?? []).map((o: any) => o.warehouse_id))];
      const { data: whs } = await supabase
        .from('warehouses')
        .select('id, display_name')
        .in('id', whIds.length ? whIds : ['__none__']);

      const opsMap = Object.fromEntries((ops ?? []).map((o: any) => [o.id, o]));
      const ordersMap = Object.fromEntries((orders ?? []).map((o: any) => [o.operation_id, o]));
      const whMap = Object.fromEntries((whs ?? []).map((w: any) => [w.id, w.display_name]));

      const snapIds = [...new Set((ops ?? []).map((o: any) => o.pricing_snapshot_id).filter(Boolean))];
      const { data: snaps } = await supabase
        .from('pricing_snapshots')
        .select('id, sale_date')
        .in('id', snapIds.length ? snapIds : ['__none__']);
      const snapsMap = Object.fromEntries((snaps ?? []).map((s: any) => [s.id, s]));

      return events.map((e: any): PaymentRow => {
        const op = opsMap[e.operation_id];
        const order = ordersMap[e.operation_id];
        return {
          ...e,
          commodity: op?.commodity ?? '—',
          warehouse_display_name: op ? (whMap[op.warehouse_id] ?? '—') : '—',
          display_code: order?.display_code ?? e.operation_id?.slice(0, 8),
          volume_sacks: op?.volume_sacks ?? 0,
          sale_date: snapsMap[op?.pricing_snapshot_id]?.sale_date ?? null,
        };
      });
    },
  });

  const filtered = useMemo(() => {
    if (!rows) return [];
    return rows.filter((r) => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (warehouseFilter !== 'all') {
        // match by warehouse display_name
        if (r.warehouse_display_name !== warehouseFilter) return false;
      }
      return true;
    });
  }, [rows, statusFilter, warehouseFilter]);

  const openPayDialog = (row: PaymentRow) => {
    setPayDialog(row);
    setRealizedDate(new Date().toISOString().split('T')[0]);
    setPayNotes('');
  };

  const handleConfirmPay = async () => {
    if (!payDialog || !realizedDate) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('payment_events')
        .update({
          status: 'paid',
          realized_date: realizedDate,
          notes: payNotes || null,
          registered_by: user?.id ?? null,
        } as never)
        .eq('id', payDialog.id);
      if (error) throw error;
      toast.success('Pagamento registrado com sucesso');
      setPayDialog(null);
      queryClient.invalidateQueries({ queryKey: ['payment_events'] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao atualizar pagamento');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4 p-4">
      <h1 className="text-2xl font-bold">Financeiro</h1>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="pending">Pendente</SelectItem>
            <SelectItem value="paid">Pago</SelectItem>
          </SelectContent>
        </Select>

        <Select value={warehouseFilter} onValueChange={setWarehouseFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Warehouse" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as praças</SelectItem>
            {(armazens ?? []).map((w) => (
              <SelectItem key={w.id} value={w.display_name}>{w.display_name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardHeader><CardTitle>Eventos de Pagamento</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground text-sm">Carregando…</p>
          ) : filtered.length === 0 ? (
            <p className="text-muted-foreground text-sm">Nenhum evento encontrado.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Praça</TableHead>
                  <TableHead>Commodity</TableHead>
                  <TableHead>Data Prevista</TableHead>
                  <TableHead>Data de Venda</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Data Realizado</TableHead>
                  <TableHead>Observações</TableHead>
                  <TableHead>Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-xs">{r.display_code}</TableCell>
                    <TableCell>{r.warehouse_display_name}</TableCell>
                    <TableCell>{r.commodity === 'soybean' ? 'Soja' : r.commodity === 'corn' ? 'Milho' : r.commodity}</TableCell>
                    <TableCell>{fmtDate(r.scheduled_date)}</TableCell>
                    <TableCell>{fmtDate(r.sale_date)}</TableCell>
                    <TableCell>
                      {/* Desktop: tooltip on hover; Mobile: popover on tap */}
                      <span className="hidden md:inline">
                        <TooltipProvider delayDuration={200}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="cursor-help underline decoration-dotted underline-offset-4">
                                {fmtBrl(r.amount_brl)}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="text-xs space-y-1 max-w-[260px]">
                              <p className="font-semibold">Cálculo do valor</p>
                              <p>Preço originação: {r.volume_sacks ? fmtBrl(r.amount_brl / r.volume_sacks) : '—'}/sc</p>
                              <p>Volume: {r.volume_sacks?.toLocaleString('pt-BR') ?? '—'} sacas</p>
                              <p className="border-t pt-1 font-medium">{r.volume_sacks ? fmtBrl(r.amount_brl / r.volume_sacks) : '—'} × {r.volume_sacks?.toLocaleString('pt-BR') ?? '—'} = {fmtBrl(r.amount_brl)}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </span>
                      <span className="md:hidden">
                        <Popover>
                          <PopoverTrigger asChild>
                            <span className="cursor-pointer underline decoration-dotted underline-offset-4">
                              {fmtBrl(r.amount_brl)}
                            </span>
                          </PopoverTrigger>
                          <PopoverContent side="top" className="text-xs space-y-1 w-auto max-w-[260px] p-3">
                            <p className="font-semibold">Cálculo do valor</p>
                            <p>Preço originação: {r.volume_sacks ? fmtBrl(r.amount_brl / r.volume_sacks) : '—'}/sc</p>
                            <p>Volume: {r.volume_sacks?.toLocaleString('pt-BR') ?? '—'} sacas</p>
                            <p className="border-t pt-1 font-medium">{r.volume_sacks ? fmtBrl(r.amount_brl / r.volume_sacks) : '—'} × {r.volume_sacks?.toLocaleString('pt-BR') ?? '—'} = {fmtBrl(r.amount_brl)}</p>
                          </PopoverContent>
                        </Popover>
                      </span>
                    </TableCell>
                    <TableCell>
                      {r.status === 'paid' ? (
                        <Badge className="bg-green-600 text-white">Pago</Badge>
                      ) : (
                        <Badge className="bg-yellow-500 text-black">Pendente</Badge>
                      )}
                    </TableCell>
                    <TableCell>{fmtDate(r.realized_date)}</TableCell>
                    <TableCell className="max-w-[200px] truncate text-xs">{r.notes ?? '—'}</TableCell>
                    <TableCell>
                      {r.status === 'pending' && (
                        <Button size="sm" variant="outline" onClick={() => openPayDialog(r)}>
                          Marcar como pago
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Pay Dialog */}
      <Dialog open={payDialog !== null} onOpenChange={(open) => { if (!open) setPayDialog(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar Pagamento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Data de pagamento realizado *</label>
              <Input type="date" value={realizedDate} onChange={(e) => setRealizedDate(e.target.value)} required />
            </div>
            <div>
              <label className="text-sm font-medium">Observações</label>
              <Textarea value={payNotes} onChange={(e) => setPayNotes(e.target.value)} placeholder="Opcional" />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancelar</Button>
            </DialogClose>
            <Button onClick={handleConfirmPay} disabled={saving || !realizedDate}>
              {saving ? 'Salvando…' : 'Confirmar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

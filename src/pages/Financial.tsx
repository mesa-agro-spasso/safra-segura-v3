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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import FinancialCalendar from '@/components/financial/FinancialCalendar';

interface PaymentEventLite {
  id: string;
  status: string;
  realized_date: string | null;
  notes: string | null;
}

interface OperationRow {
  id: string;
  commodity: string;
  volume_sacks: number;
  warehouse_display_name: string;
  display_code: string;
  payment_date: string | null;
  sale_date: string | null;
  origination_price_brl: number;
  amount_brl: number;
  paymentEvent?: PaymentEventLite;
}

const fmtBrl = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const fmtDate = (d: string | null) => {
  if (!d) return '—';
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
};

const commodityLabel = (c: string) =>
  c === 'soybean' ? 'Soja' : c === 'corn' ? 'Milho' : c;

export default function Financial() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: armazens } = useActiveArmazens();

  const [statusFilter, setStatusFilter] = useState('all');
  const [warehouseFilter, setWarehouseFilter] = useState('all');
  const [payDialog, setPayDialog] = useState<OperationRow | null>(null);
  const [realizedDate, setRealizedDate] = useState('');
  const [payNotes, setPayNotes] = useState('');
  const [saving, setSaving] = useState(false);

  // Primary query: operations HEDGE_CONFIRMADO
  const { data: operations, isLoading } = useQuery({
    queryKey: ['financial-operations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('operations')
        .select(`
          id, commodity, volume_sacks, display_code,
          warehouses(display_name),
          pricing_snapshots(payment_date, sale_date, origination_price_brl)
        `)
        .in('status', ['HEDGE_CONFIRMADO', 'ACTIVE', 'PARTIALLY_CLOSED']);
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const opIds = useMemo(() => (operations ?? []).map((o: any) => o.id), [operations]);

  // Secondary query: payment_events to know if each op has been paid
  const { data: paymentEvents } = useQuery({
    queryKey: ['payment-events-by-op', opIds.sort().join(',')],
    enabled: opIds.length > 0,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('payment_events')
        .select('id, operation_id, status, realized_date, notes')
        .in('operation_id', opIds);
      if (error) throw error;
      return data ?? [];
    },
  });

  const rows: OperationRow[] = useMemo(() => {
    if (!operations) return [];
    const peMap: Record<string, PaymentEventLite> = {};
    for (const pe of (paymentEvents ?? []) as any[]) {
      // If multiple events exist, prefer paid > pending
      const existing = peMap[pe.operation_id];
      if (!existing || (pe.status === 'paid' && existing.status !== 'paid')) {
        peMap[pe.operation_id] = {
          id: pe.id,
          status: pe.status,
          realized_date: pe.realized_date,
          notes: pe.notes,
        };
      }
    }

    return (operations as any[])
      .filter((op) => op.pricing_snapshots)
      .map((op): OperationRow => {
        const snap = op.pricing_snapshots;
        const displayCode = op.display_code ?? op.id.slice(0, 8);
        const whName = op.warehouses?.display_name ?? '—';
        const origPrice = Number(snap.origination_price_brl);
        const vol = Number(op.volume_sacks);
        return {
          id: op.id,
          commodity: op.commodity,
          volume_sacks: vol,
          warehouse_display_name: whName,
          display_code: displayCode,
          payment_date: snap.payment_date ?? null,
          sale_date: snap.sale_date ?? null,
          origination_price_brl: origPrice,
          amount_brl: origPrice * vol,
          paymentEvent: peMap[op.id],
        };
      });
  }, [operations, paymentEvents]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      const isPaid = r.paymentEvent?.status === 'paid';
      if (statusFilter === 'paid' && !isPaid) return false;
      if (statusFilter === 'pending' && isPaid) return false;
      if (warehouseFilter !== 'all' && r.warehouse_display_name !== warehouseFilter) return false;
      return true;
    });
  }, [rows, statusFilter, warehouseFilter]);

  const openPayDialog = (row: OperationRow) => {
    setPayDialog(row);
    setRealizedDate(new Date().toISOString().split('T')[0]);
    setPayNotes('');
  };

  const handleConfirmPay = async () => {
    if (!payDialog || !realizedDate) return;
    setSaving(true);
    try {
      if (payDialog.paymentEvent) {
        const { error } = await (supabase as any)
          .from('payment_events')
          .update({
            status: 'paid',
            realized_date: realizedDate,
            notes: payNotes || null,
            registered_by: user?.id ?? null,
          } as never)
          .eq('id', payDialog.paymentEvent.id);
        if (error) throw error;
      } else {
        if (!payDialog.payment_date) {
          throw new Error('Operação sem data de pagamento prevista.');
        }
        const { error } = await (supabase as any)
          .from('payment_events')
          .insert({
            operation_id: payDialog.id,
            scheduled_date: payDialog.payment_date,
            amount_brl: payDialog.amount_brl,
            status: 'paid',
            realized_date: realizedDate,
            notes: payNotes || null,
            registered_by: user?.id ?? null,
          } as never);
        if (error) throw error;
      }
      toast.success('Pagamento registrado com sucesso');
      setPayDialog(null);
      queryClient.invalidateQueries({ queryKey: ['financial-operations'] });
      queryClient.invalidateQueries({ queryKey: ['payment-events-by-op'] });
      queryClient.invalidateQueries({ queryKey: ['financial_calendar_data'] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao atualizar pagamento');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4 p-4">
      <h1 className="text-2xl font-bold">Financeiro</h1>

      <Tabs defaultValue="tabela">
        <TabsList>
          <TabsTrigger value="tabela">Tabela</TabsTrigger>
          <TabsTrigger value="calendario">Calendário</TabsTrigger>
        </TabsList>

        <TabsContent value="tabela">
          {/* Filters */}
          <div className="flex flex-wrap gap-3 mb-4">
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
                <SelectValue placeholder="Praça" />
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
            <CardHeader><CardTitle>Operações Confirmadas</CardTitle></CardHeader>
            <CardContent>
              {isLoading ? (
                <p className="text-muted-foreground text-sm">Carregando…</p>
              ) : filtered.length === 0 ? (
                <p className="text-muted-foreground text-sm">Nenhuma operação encontrada.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Código</TableHead>
                      <TableHead>Praça</TableHead>
                      <TableHead>Commodity</TableHead>
                      <TableHead>Volume (sacas)</TableHead>
                      <TableHead>Data Pagamento</TableHead>
                      <TableHead>Data Venda</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Status Pagamento</TableHead>
                      <TableHead>Ação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((r) => {
                      const isPaid = r.paymentEvent?.status === 'paid';
                      return (
                        <TableRow key={r.id}>
                          <TableCell className="font-mono text-xs">{r.display_code}</TableCell>
                          <TableCell>{r.warehouse_display_name}</TableCell>
                          <TableCell>{commodityLabel(r.commodity)}</TableCell>
                          <TableCell>{r.volume_sacks.toLocaleString('pt-BR')}</TableCell>
                          <TableCell className="text-red-600 font-medium">{fmtDate(r.payment_date)}</TableCell>
                          <TableCell className="text-green-600 font-medium">{fmtDate(r.sale_date)}</TableCell>
                          <TableCell>
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
                                    <p>Preço originação: {fmtBrl(r.origination_price_brl)}/sc</p>
                                    <p>Volume: {r.volume_sacks.toLocaleString('pt-BR')} sacas</p>
                                    <p className="border-t pt-1 font-medium">
                                      {fmtBrl(r.origination_price_brl)} × {r.volume_sacks.toLocaleString('pt-BR')} = {fmtBrl(r.amount_brl)}
                                    </p>
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
                                  <p>Preço originação: {fmtBrl(r.origination_price_brl)}/sc</p>
                                  <p>Volume: {r.volume_sacks.toLocaleString('pt-BR')} sacas</p>
                                  <p className="border-t pt-1 font-medium">
                                    {fmtBrl(r.origination_price_brl)} × {r.volume_sacks.toLocaleString('pt-BR')} = {fmtBrl(r.amount_brl)}
                                  </p>
                                </PopoverContent>
                              </Popover>
                            </span>
                          </TableCell>
                          <TableCell>
                            {isPaid ? (
                              <Badge className="bg-green-600 text-white">Pago</Badge>
                            ) : (
                              <Badge className="bg-yellow-500 text-black">Pendente</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {!isPaid && (
                              <Button size="sm" variant="outline" onClick={() => openPayDialog(r)}>
                                Marcar como pago
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="calendario">
          <FinancialCalendar />
        </TabsContent>
      </Tabs>

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

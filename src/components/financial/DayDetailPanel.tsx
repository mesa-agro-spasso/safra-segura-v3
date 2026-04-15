import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { CalendarEvent } from '@/hooks/useFinancialCalendarData';

interface DayDetailPanelProps {
  open: boolean;
  onClose: () => void;
  date: Date | null;
  events: CalendarEvent[];
}

const fmtBrl = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function DayDetailPanel({ open, onClose, date, events }: DayDetailPanelProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [payTarget, setPayTarget] = useState<CalendarEvent | null>(null);
  const [realizedDate, setRealizedDate] = useState('');
  const [payNotes, setPayNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const outflows = events.filter((e) => e.type === 'outflow');
  const inflows = events.filter((e) => e.type === 'inflow');

  const openPayDialog = (ev: CalendarEvent) => {
    setPayTarget(ev);
    setRealizedDate(new Date().toISOString().split('T')[0]);
    setPayNotes('');
  };

  const handleConfirmPay = async () => {
    if (!payTarget?.resource.payment_event_id || !realizedDate) return;
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
        .eq('id', payTarget.resource.payment_event_id);
      if (error) throw error;
      toast.success('Pagamento registrado com sucesso');
      setPayTarget(null);
      queryClient.invalidateQueries({ queryKey: ['financial_calendar_data'] });
      queryClient.invalidateQueries({ queryKey: ['payment_events'] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao atualizar pagamento');
    } finally {
      setSaving(false);
    }
  };

  const dateLabel = date
    ? date.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })
    : '';

  return (
    <>
      <Sheet open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
        <SheetContent className="w-[400px] sm:w-[440px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="capitalize">{dateLabel}</SheetTitle>
          </SheetHeader>

          <div className="mt-4 space-y-6">
            {/* Outflows */}
            {outflows.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-destructive mb-2">Saídas ({outflows.length})</h3>
                <div className="space-y-3">
                  {outflows.map((ev) => (
                    <div key={ev.id} className="rounded-md border p-3 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs">{ev.resource.display_code}</span>
                        {ev.resource.status === 'paid' ? (
                          <Badge className="bg-green-600 text-white">Pago</Badge>
                        ) : (
                          <Badge className="bg-yellow-500 text-black">Pendente</Badge>
                        )}
                      </div>
                      <p className="text-sm">{ev.resource.commodity} — {ev.resource.warehouse_display_name}</p>
                      <p className="text-sm font-medium">{ev.resource.amount_brl != null ? fmtBrl(ev.resource.amount_brl) : '—'}</p>
                      {ev.resource.volume_sacks ? (
                        <p className="text-xs text-muted-foreground">{ev.resource.volume_sacks.toLocaleString('pt-BR')} sacas</p>
                      ) : null}
                      {ev.resource.status === 'pending' && (
                        <Button size="sm" variant="outline" className="mt-1" onClick={() => openPayDialog(ev)}>
                          Marcar como pago
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Inflows */}
            {inflows.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-green-600 mb-2">Entradas ({inflows.length})</h3>
                <div className="space-y-3">
                  {inflows.map((ev) => (
                    <div key={ev.id} className="rounded-md border p-3 space-y-1">
                      <span className="font-mono text-xs">{ev.resource.display_code}</span>
                      <p className="text-sm">{ev.resource.commodity} — {ev.resource.warehouse_display_name}</p>
                      {ev.resource.amount_brl != null && ev.resource.amount_brl > 0 && (
                        <p className="text-sm font-medium">{fmtBrl(ev.resource.amount_brl)}</p>
                      )}
                      {ev.resource.volume_sacks ? (
                        <p className="text-xs text-muted-foreground">{ev.resource.volume_sacks.toLocaleString('pt-BR')} sacas</p>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {events.length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhum evento neste dia.</p>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Pay confirmation dialog — same UX as table */}
      <Dialog open={payTarget !== null} onOpenChange={(v) => { if (!v) setPayTarget(null); }}>
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
    </>
  );
}

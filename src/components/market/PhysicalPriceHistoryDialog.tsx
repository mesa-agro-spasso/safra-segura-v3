import { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Trash2, Edit2, Check, X } from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  usePhysicalPriceHistory,
  useUpsertPhysicalPrice,
  useDeletePhysicalPrice,
} from '@/hooks/usePhysicalPrices';
import { useAuthorization } from '@/hooks/useAuthorization';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  warehouseId: string | null;
  warehouseName: string;
  commodity: 'soybean' | 'corn' | null;
}

const commodityLabel = (c: string) => (c === 'soybean' ? 'Soja' : c === 'corn' ? 'Milho' : c);

type Period = '1m' | '6m' | '1a' | '5a' | 'tudo';
const PERIOD_DAYS: Record<Period, number | null> = {
  '1m': 30,
  '6m': 182,
  '1a': 365,
  '5a': 365 * 5,
  'tudo': null,
};

export function PhysicalPriceHistoryDialog({
  open, onOpenChange, warehouseId, warehouseName, commodity,
}: Props) {
  const { data: history = [], isLoading } = usePhysicalPriceHistory(warehouseId, commodity);
  const upsert = useUpsertPhysicalPrice();
  const del = useDeletePhysicalPrice();
  const auth = useAuthorization();
  const canEdit = auth.hasAccessLevel('full') || auth.isAdmin();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [period, setPeriod] = useState<Period>('tudo');

  const chartData = useMemo(() => {
    const all = history.map((h) => ({
      date: h.reference_date,
      price: Number(h.price_brl_per_sack),
    }));
    const days = PERIOD_DAYS[period];
    if (days == null) return all;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    return all.filter((d) => new Date(d.date) >= cutoff);
  }, [history, period]);

  const yDomain = useMemo<[number, number] | undefined>(() => {
    if (chartData.length === 0) return undefined;
    const prices = chartData.map((d) => d.price);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    if (min === max) return [min * 0.9, max * 1.1];
    return [min * 0.9, max * 1.1];
  }, [chartData]);

  const handleSaveEdit = async (row: typeof history[number]) => {
    const p = parseFloat(editValue);
    if (!Number.isFinite(p) || p <= 0) { toast.error('Preço inválido'); return; }
    try {
      await upsert.mutateAsync({
        warehouse_id: row.warehouse_id,
        commodity: row.commodity as 'soybean' | 'corn',
        reference_date: row.reference_date,
        price_brl_per_sack: p,
        notes: row.notes,
      });
      toast.success('Atualizado');
      setEditingId(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Excluir este registro?')) return;
    try {
      await del.mutateAsync(id);
      toast.success('Registro excluído');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {warehouseName} — {commodity ? commodityLabel(commodity) : ''}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
            </div>
          ) : history.length === 0 ? (
            <p className="text-muted-foreground text-sm">Sem histórico de preços.</p>
          ) : (
            <>
              <div className="flex justify-end">
                <ToggleGroup
                  type="single"
                  value={period}
                  onValueChange={(v) => v && setPeriod(v as Period)}
                  size="sm"
                >
                  <ToggleGroupItem value="1m">1m</ToggleGroupItem>
                  <ToggleGroupItem value="6m">6m</ToggleGroupItem>
                  <ToggleGroupItem value="1a">1a</ToggleGroupItem>
                  <ToggleGroupItem value="5a">5a</ToggleGroupItem>
                  <ToggleGroupItem value="tudo">Tudo</ToggleGroupItem>
                </ToggleGroup>
              </div>

              <div className="h-64 w-full">
                {chartData.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                    Sem dados no período selecionado.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                      <YAxis
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={11}
                        domain={yDomain}
                        tickFormatter={(v: number) => v.toFixed(2)}
                      />
                      <Tooltip
                        contentStyle={{
                          background: 'hsl(var(--popover))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: 6,
                        }}
                        formatter={(v: number) => [`R$ ${v.toFixed(2)}`, 'Preço']}
                      />
                      <Line
                        type="monotone"
                        dataKey="price"
                        stroke="hsl(var(--primary))"
                        strokeWidth={2}
                        dot={{ r: 3 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead className="text-right">Preço (R$/sc)</TableHead>
                    <TableHead>Notas</TableHead>
                    {canEdit && <TableHead className="w-24"></TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...history].reverse().map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>{row.reference_date}</TableCell>
                      <TableCell className="text-right">
                        {editingId === row.id ? (
                          <Input
                            type="number"
                            step="0.01"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            className="h-7 w-24 ml-auto text-right"
                            autoFocus
                            onKeyDown={(e) => e.key === 'Enter' && handleSaveEdit(row)}
                          />
                        ) : (
                          Number(row.price_brl_per_sack).toFixed(2)
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{row.notes ?? '-'}</TableCell>
                      {canEdit && (
                        <TableCell>
                          {editingId === row.id ? (
                            <div className="flex gap-1">
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => handleSaveEdit(row)}>
                                <Check className="h-3 w-3" />
                              </Button>
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setEditingId(null)}>
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          ) : (
                            <div className="flex gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0"
                                onClick={() => {
                                  setEditingId(row.id);
                                  setEditValue(String(row.price_brl_per_sack));
                                }}
                              >
                                <Edit2 className="h-3 w-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0 text-destructive"
                                onClick={() => handleDelete(row.id)}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

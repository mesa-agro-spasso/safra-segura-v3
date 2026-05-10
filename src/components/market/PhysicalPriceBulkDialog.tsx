import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { useActiveArmazens } from '@/hooks/useWarehouses';
import {
  useLatestPhysicalPrices,
  useUpsertPhysicalPricesBulk,
  type PhysicalPriceInput,
} from '@/hooks/usePhysicalPrices';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const todayISO = () => new Date().toISOString().slice(0, 10);

export function PhysicalPriceBulkDialog({ open, onOpenChange }: Props) {
  const { data: armazens = [] } = useActiveArmazens();
  const { data: latest = [] } = useLatestPhysicalPrices();
  const bulk = useUpsertPhysicalPricesBulk();

  const [date, setDate] = useState(todayISO());
  // values[`${warehouse_id}::${commodity}`] = string
  const [values, setValues] = useState<Record<string, string>>({});

  // Pre-fill with last known price per cell
  useEffect(() => {
    if (!open) return;
    const next: Record<string, string> = {};
    for (const w of armazens) {
      for (const c of ['soybean', 'corn'] as const) {
        const key = `${w.id}::${c}`;
        const found = latest.find((p) => p.warehouse_id === w.id && p.commodity === c);
        next[key] = found ? String(found.price_brl_per_sack) : '';
      }
    }
    setValues(next);
    setDate(todayISO());
  }, [open, armazens, latest]);

  const setCell = (key: string, v: string) => setValues((prev) => ({ ...prev, [key]: v }));

  const handleSubmit = async () => {
    const items: PhysicalPriceInput[] = [];
    for (const w of armazens) {
      for (const c of ['soybean', 'corn'] as const) {
        const key = `${w.id}::${c}`;
        const raw = (values[key] ?? '').trim();
        if (!raw) continue;
        const p = parseFloat(raw);
        if (!Number.isFinite(p) || p <= 0) {
          toast.error(`Preço inválido em ${w.display_name} (${c === 'soybean' ? 'Soja' : 'Milho'})`);
          return;
        }
        items.push({
          warehouse_id: w.id,
          commodity: c,
          reference_date: date,
          price_brl_per_sack: p,
        });
      }
    }
    if (items.length === 0) { toast.error('Nenhum preço informado'); return; }
    try {
      await bulk.mutateAsync(items);
      toast.success(`${items.length} preços registrados`);
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Cadastrar preços em massa</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-end gap-3">
            <div>
              <Label>Data de referência</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-44" />
            </div>
            <p className="text-xs text-muted-foreground pb-2">
              Pré-preenchido com o último preço conhecido. Edite, deixe em branco para pular.
            </p>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Armazém</TableHead>
                <TableHead className="text-right">Soja (R$/sc)</TableHead>
                <TableHead className="text-right">Milho (R$/sc)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {armazens.map((w) => (
                <TableRow key={w.id}>
                  <TableCell className="font-medium">{w.display_name}</TableCell>
                  <TableCell className="text-right">
                    <Input
                      type="number"
                      step="0.01"
                      className="h-8 text-right"
                      value={values[`${w.id}::soybean`] ?? ''}
                      onChange={(e) => setCell(`${w.id}::soybean`, e.target.value)}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <Input
                      type="number"
                      step="0.01"
                      className="h-8 text-right"
                      value={values[`${w.id}::corn`] ?? ''}
                      onChange={(e) => setCell(`${w.id}::corn`, e.target.value)}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={bulk.isPending}>
            {bulk.isPending ? 'Salvando...' : 'Salvar todos'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

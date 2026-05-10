import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useActiveArmazens } from '@/hooks/useWarehouses';
import { useUpsertPhysicalPrice } from '@/hooks/usePhysicalPrices';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultWarehouseId?: string;
  defaultCommodity?: 'soybean' | 'corn';
  defaultDate?: string;
  defaultPrice?: number;
}

const todayISO = () => new Date().toISOString().slice(0, 10);

export function PhysicalPriceFormDialog({
  open, onOpenChange, defaultWarehouseId, defaultCommodity, defaultDate, defaultPrice,
}: Props) {
  const { data: armazens = [] } = useActiveArmazens();
  const upsert = useUpsertPhysicalPrice();

  const [warehouseId, setWarehouseId] = useState(defaultWarehouseId ?? '');
  const [commodity, setCommodity] = useState<'soybean' | 'corn'>(defaultCommodity ?? 'soybean');
  const [date, setDate] = useState(defaultDate ?? todayISO());
  const [price, setPrice] = useState<string>(defaultPrice ? String(defaultPrice) : '');
  const [notes, setNotes] = useState('');

  const handleSubmit = async () => {
    const p = parseFloat(price);
    if (!warehouseId) { toast.error('Selecione um armazém'); return; }
    if (!Number.isFinite(p) || p <= 0) { toast.error('Preço inválido'); return; }
    try {
      await upsert.mutateAsync({
        warehouse_id: warehouseId,
        commodity,
        reference_date: date,
        price_brl_per_sack: p,
        notes: notes.trim() || null,
      });
      toast.success('Preço registrado');
      onOpenChange(false);
      setPrice('');
      setNotes('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cadastrar preço físico</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Armazém</Label>
            <Select value={warehouseId} onValueChange={setWarehouseId}>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                {armazens.map((w) => (
                  <SelectItem key={w.id} value={w.id}>{w.display_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Commodity</Label>
            <Select value={commodity} onValueChange={(v) => setCommodity(v as 'soybean' | 'corn')}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="soybean">Soja</SelectItem>
                <SelectItem value="corn">Milho</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Data de referência</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <Label>Preço (R$/saca)</Label>
            <Input type="number" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} />
          </div>
          <div>
            <Label>Notas (opcional)</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={upsert.isPending}>
            {upsert.isPending ? 'Salvando...' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

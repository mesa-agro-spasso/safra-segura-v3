import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { StarRating } from './StarRating';
import { useActiveArmazens } from '@/hooks/useWarehouses';
import { useCreateProducer, useUpdateProducer } from '@/hooks/useProducers';
import { maskTaxId, maskPhoneBR } from '@/lib/masks';
import { toast } from 'sonner';
import type { Producer } from '@/types';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  producer?: Producer | null;
  onCreated?: (p: Producer) => void;
}

const empty = {
  full_name: '',
  responsible_name: '',
  tax_id: '',
  phone: '',
  email: '',
  farm_address: '',
  warehouse_ids: [] as string[],
  credit_rating: null as number | null,
  notes: '',
};

export function ProducerFormDialog({ open, onOpenChange, producer, onCreated }: Props) {
  const [form, setForm] = useState(empty);
  const { data: warehouses = [] } = useActiveArmazens();
  const create = useCreateProducer();
  const update = useUpdateProducer();
  const isEdit = !!producer;

  useEffect(() => {
    if (open) {
      setForm(producer ? {
        full_name: producer.full_name ?? '',
        responsible_name: producer.responsible_name ?? '',
        tax_id: producer.tax_id ?? '',
        phone: producer.phone ?? '',
        email: producer.email ?? '',
        farm_address: producer.farm_address ?? '',
        warehouse_ids: producer.warehouse_ids ?? [],
        credit_rating: producer.credit_rating,
        notes: producer.notes ?? '',
      } : empty);
    }
  }, [open, producer]);

  const handleSave = async () => {
    const payload = {
      full_name: form.full_name.trim() || null,
      responsible_name: form.responsible_name.trim() || null,
      tax_id: form.tax_id.trim() || null,
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      farm_address: form.farm_address.trim() || null,
      warehouse_ids: form.warehouse_ids,
      credit_rating: form.credit_rating,
      notes: form.notes.trim() || null,
    };
    try {
      if (isEdit && producer) {
        await update.mutateAsync({ id: producer.id, ...payload });
        toast.success('Produtor atualizado');
      } else {
        const created = await create.mutateAsync(payload);
        toast.success('Produtor criado');
        onCreated?.(created);
      }
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message ?? 'Erro ao salvar');
    }
  };

  const toggleWarehouse = (id: string) => {
    setForm((f) => ({
      ...f,
      warehouse_ids: f.warehouse_ids.includes(id)
        ? f.warehouse_ids.filter((w) => w !== id)
        : [...f.warehouse_ids, id],
    }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar produtor' : 'Novo produtor'}</DialogTitle>
        </DialogHeader>
        <ScrollArea className="flex-1 pr-4 -mr-4">
          <div className="grid grid-cols-2 gap-4 py-2">
            <div className="col-span-2 space-y-2">
              <Label>Nome completo</Label>
              <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} placeholder="Nome do produtor ou empresa" />
            </div>
            <div className="space-y-2">
              <Label>Responsável</Label>
              <Input value={form.responsible_name} onChange={(e) => setForm({ ...form, responsible_name: e.target.value })} placeholder="Se for empresa" />
            </div>
            <div className="space-y-2">
              <Label>CPF / CNPJ</Label>
              <Input value={form.tax_id} onChange={(e) => setForm({ ...form, tax_id: maskTaxId(e.target.value) })} placeholder="000.000.000-00" />
            </div>
            <div className="space-y-2">
              <Label>Telefone</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: maskPhoneBR(e.target.value) })} placeholder="(00) 00000-0000" />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="email@dominio.com" />
            </div>
            <div className="col-span-2 space-y-2">
              <Label>Endereço da fazenda</Label>
              <Textarea rows={2} value={form.farm_address} onChange={(e) => setForm({ ...form, farm_address: e.target.value })} />
            </div>
            <div className="col-span-2 space-y-2">
              <Label>Praças vinculadas</Label>
              <div className="border rounded-md p-3 grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                {warehouses.length === 0 && <span className="text-sm text-muted-foreground">Nenhuma praça ativa</span>}
                {warehouses.map((w) => (
                  <label key={w.id} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox checked={form.warehouse_ids.includes(w.id)} onCheckedChange={() => toggleWarehouse(w.id)} />
                    <span>{w.display_name}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Nota de crédito</Label>
              <div className="space-y-3 rounded-md border p-3">
                <StarRating
                  value={form.credit_rating}
                  onChange={(value) => setForm((current) => ({ ...current, credit_rating: value }))}
                  size={22}
                />
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-muted-foreground">
                    {form.credit_rating === null
                      ? 'Sem nota'
                      : `${form.credit_rating} estrela${form.credit_rating > 1 ? 's' : ''}`}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setForm((current) => ({ ...current, credit_rating: null }))}
                  >
                    Limpar nota
                  </Button>
                </div>
              </div>
            </div>
            <div className="col-span-2 space-y-2">
              <Label>Notas</Label>
              <Textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
          </div>
        </ScrollArea>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={create.isPending || update.isPending}>
            {isEdit ? 'Salvar' : 'Criar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

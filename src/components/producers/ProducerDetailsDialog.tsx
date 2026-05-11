import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Pencil } from 'lucide-react';
import { StarRating } from './StarRating';
import { ProducerOperationsList } from './ProducerOperationsList';
import { useActiveArmazens } from '@/hooks/useWarehouses';
import type { Producer } from '@/types';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  producer: Producer | null;
  onEdit?: (p: Producer) => void;
}

const Field = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="space-y-0.5">
    <div className="text-xs text-muted-foreground">{label}</div>
    <div className="text-sm">{value || <span className="text-muted-foreground">—</span>}</div>
  </div>
);

export function ProducerDetailsDialog({ open, onOpenChange, producer, onEdit }: Props) {
  const { data: warehouses = [] } = useActiveArmazens();
  if (!producer) return null;
  const wMap = Object.fromEntries(warehouses.map((w) => [w.id, w.display_name]));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <span>{producer.full_name ?? 'Produtor sem nome'}</span>
            <StarRating value={producer.credit_rating} readOnly />
            {onEdit && (
              <Button variant="ghost" size="sm" className="ml-auto" onClick={() => onEdit(producer)}>
                <Pencil className="h-3.5 w-3.5" /> Editar
              </Button>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4 py-2">
          <Field label="Responsável" value={producer.responsible_name} />
          <Field label="CPF / CNPJ" value={producer.tax_id && <span className="font-mono">{producer.tax_id}</span>} />
          <Field label="Telefone" value={producer.phone} />
          <Field label="Email" value={producer.email} />
          <div className="col-span-2"><Field label="Endereço da fazenda" value={producer.farm_address} /></div>
          <div className="col-span-2">
            <div className="text-xs text-muted-foreground mb-1">Praças vinculadas</div>
            <div className="flex flex-wrap gap-1">
              {(producer.warehouse_ids ?? []).length === 0 && <span className="text-sm text-muted-foreground">—</span>}
              {(producer.warehouse_ids ?? []).map((wid) => (
                <Badge key={wid} variant="secondary">{wMap[wid] ?? wid}</Badge>
              ))}
            </div>
          </div>
          {producer.notes && <div className="col-span-2"><Field label="Notas" value={producer.notes} /></div>}
        </div>

        <Separator className="my-2" />

        <div>
          <div className="text-sm font-semibold mb-1">Operações</div>
          <ProducerOperationsList producerId={producer.id} onNavigate={() => onOpenChange(false)} />
        </div>
      </DialogContent>
    </Dialog>
  );
}

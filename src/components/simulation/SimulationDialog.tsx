import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { SimulationPanel } from '@/components/simulation/SimulationPanel';

interface SimulationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** created_at do lote exibido hoje — usado por "Adicionar à tabela". */
  currentBatchCreatedAt?: string | null;
}

/** Mesma simulação do card do cockpit, apresentada em diálogo. */
export function SimulationDialog({ open, onOpenChange, currentBatchCreatedAt }: SimulationDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onOpenChange(false); }}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Simulação livre</DialogTitle>
          <DialogDescription>
            Todo o cálculo é da API. Nada é gravado até você escolher um dos desfechos.
          </DialogDescription>
        </DialogHeader>

        <SimulationPanel
          active={open}
          currentBatchCreatedAt={currentBatchCreatedAt}
          onClose={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

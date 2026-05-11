import { useNavigate } from 'react-router-dom';
import { useProducerOperations } from '@/hooks/useProducers';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Rascunho',
  ACTIVE: 'Ativa',
  PARTIALLY_CLOSED: 'Parc. encerrada',
  CLOSED: 'Encerrada',
  CANCELLED: 'Cancelada',
  HEDGE_CONFIRMADO: 'Hedge confirmado',
  CANCELADA: 'Cancelada',
  ENCERRADA: 'Encerrada',
};

const COMMODITY_LABEL: Record<string, string> = {
  soybean: 'Soja',
  corn: 'Milho',
};

export function ProducerOperationsList({ producerId }: { producerId: string }) {
  const navigate = useNavigate();
  const { data, isLoading } = useProducerOperations(producerId);

  if (isLoading) return <Skeleton className="h-10 w-full" />;
  if (!data || data.length === 0) {
    return <p className="text-sm text-muted-foreground py-2 px-3">Nenhuma operação vinculada a este produtor.</p>;
  }

  return (
    <div className="space-y-1 py-2">
      {data.map((op) => (
        <button
          key={op.id}
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/operacoes?op=${op.id}`);
          }}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-muted/60 text-left text-sm transition-colors"
        >
          <span className="font-mono text-xs">{op.display_code ?? op.id.slice(0, 8)}</span>
          <Badge variant="secondary" className="text-xs">{STATUS_LABEL[op.status] ?? op.status}</Badge>
          <span className="text-muted-foreground">{COMMODITY_LABEL[op.commodity] ?? op.commodity}</span>
          <span>{op.volume_sacks.toLocaleString('pt-BR')} sc</span>
          <span className="text-muted-foreground">{op.warehouses?.display_name ?? '—'}</span>
          <span className="ml-auto text-muted-foreground text-xs">
            {new Date(op.trade_date).toLocaleDateString('pt-BR')}
          </span>
        </button>
      ))}
    </div>
  );
}

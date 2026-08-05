import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useLatestPhysicalPrices, getHoursAgo } from '@/hooks/usePhysicalPrices';
import { StickyTableScroll, STICKY_HEAD } from '@/components/cockpit/StickyTableScroll';
import { cn } from '@/lib/utils';
import type { Warehouse } from '@/types';

const COMMODITY_LABELS: Record<string, string> = { soybean: 'Soja', corn: 'Milho' };

function formatDate(value: string | null | undefined): string {
  if (!value) return '-';
  const [y, m, d] = value.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

/** Card de referência, somente leitura: último preço físico por praça/commodity. */
export function PhysicalPricesCard({ warehouseMap }: { warehouseMap: Record<string, Warehouse> }) {
  const { data, isLoading } = useLatestPhysicalPrices();

  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando preços físicos…</p>;
  if (!data || data.length === 0) return <p className="text-sm text-muted-foreground">Sem preços físicos registrados.</p>;

  return (
    <StickyTableScroll maxHeightClass="max-h-[320px]">
      <Table
        unstyledWrapper
        className="border-separate border-spacing-0 [&_tbody_td]:border-b [&_tbody_td]:border-border"
      >
        <TableHeader>
          <TableRow>
            <TableHead className={cn(STICKY_HEAD, 'border-b border-border')}>Praça</TableHead>
            <TableHead className={cn(STICKY_HEAD, 'border-b border-border')}>Commodity</TableHead>
            <TableHead className={cn(STICKY_HEAD, 'border-b border-border text-center')}>Referência</TableHead>
            <TableHead className={cn(STICKY_HEAD, 'border-b border-border text-right')}>Preço (R$/sc)</TableHead>
            <TableHead className={cn(STICKY_HEAD, 'border-b border-border text-right')}>Atualizado</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row) => (
            <TableRow key={`${row.warehouse_id}-${row.commodity}`}>
              <TableCell className="text-xs font-medium">
                {warehouseMap[row.warehouse_id]?.display_name ?? row.warehouse_id}
              </TableCell>
              <TableCell className="text-xs">{COMMODITY_LABELS[row.commodity] ?? row.commodity}</TableCell>
              <TableCell className="text-center text-xs">{formatDate(row.reference_date)}</TableCell>
              <TableCell className="text-right tabular-nums text-xs">
                {row.price_brl_per_sack.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </TableCell>
              <TableCell className="text-right text-xs text-muted-foreground">
                {getHoursAgo(row.updated_at)}h
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </StickyTableScroll>
  );
}

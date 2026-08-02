import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { PricingCombination, PricingSnapshot, Warehouse } from '@/types';

const COMMODITY_LABELS: Record<string, string> = { soybean: 'Soja', corn: 'Milho' };

/** Colunas congeladas à esquerda (praça e commodity). */
const STICKY_PRACA = 'sticky left-0 z-20 bg-card w-40 min-w-[10rem]';
const STICKY_COMMODITY = 'sticky left-40 z-20 bg-card w-24 min-w-[6rem] shadow-[inset_-1px_0_0_hsl(var(--border))]';


function formatDate(value: unknown): string {
  if (typeof value !== 'string' || value.length < 10) return '-';
  const [y, m, d] = value.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

function num(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function fmt(value: number | null, digits = 2): string {
  return value == null ? '-' : value.toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export interface PriceTableCardProps {
  combos: PricingCombination[];
  warehouseMap: Record<string, Warehouse>;
  snapshotByKey: Record<string, PricingSnapshot>;
  calcResults: Record<string, Record<string, unknown>> | null;
  /** Combinações com edição ainda não recalculada. */
  pendingIds: Set<string>;
  skippedMap: Record<string, string>;
}

export function PriceTableCard({
  combos,
  warehouseMap,
  snapshotByKey,
  calcResults,
  pendingIds,
  skippedMap,
}: PriceTableCardProps) {
  const [commodity, setCommodity] = useState<string>('all');
  const [warehouseId, setWarehouseId] = useState<string>('all');

  const warehouseOptions = useMemo(() => {
    const ids = Array.from(new Set(combos.map((c) => c.warehouse_id)));
    return ids
      .map((id) => ({ id, name: warehouseMap[id]?.display_name ?? id }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [combos, warehouseMap]);

  const rows = combos.filter(
    (c) =>
      (commodity === 'all' || c.commodity === commodity) &&
      (warehouseId === 'all' || c.warehouse_id === warehouseId),
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1">
          {[
            { v: 'all', l: 'Todas' },
            { v: 'soybean', l: 'Soja' },
            { v: 'corn', l: 'Milho' },
          ].map((opt) => (
            <Button
              key={opt.v}
              size="sm"
              variant={commodity === opt.v ? 'default' : 'outline'}
              className="h-7 text-xs"
              onClick={() => setCommodity(opt.v)}
            >
              {opt.l}
            </Button>
          ))}
        </div>
        <Select value={warehouseId} onValueChange={setWarehouseId}>
          <SelectTrigger className="h-7 w-56 text-xs">
            <SelectValue placeholder="Praça" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as praças</SelectItem>
            {warehouseOptions.map((w) => (
              <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="w-full min-w-0 overflow-auto max-h-[420px]">
        <Table>
          <TableHeader className="sticky top-0 bg-card z-30">
            <TableRow>
              <TableHead className={cn(STICKY_PRACA, 'z-40')}>Praça</TableHead>
              <TableHead className={cn(STICKY_COMMODITY, 'z-40')}>Commodity</TableHead>
              <TableHead>Ticker</TableHead>
              <TableHead className="text-center">Recepção</TableHead>
              <TableHead className="text-center">Pagamento</TableHead>
              <TableHead className="text-center">Venda</TableHead>
              <TableHead className="text-right">Basis Alvo</TableHead>
              <TableHead className="text-right">Futuros (BRL)</TableHead>
              <TableHead className="text-right">Câmbio</TableHead>
              <TableHead className="text-right">Preço Originação</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={10} className="text-center text-sm text-muted-foreground py-8">
                  Nenhuma combinação ativa para os filtros.
                </TableCell>
              </TableRow>
            )}
            {rows.map((combo) => {
              const calc = calcResults?.[combo.id];
              const snap = snapshotByKey[`${combo.warehouse_id}|${combo.commodity}|${combo.ticker}`];
              const source = (calc ?? snap) as Record<string, unknown> | undefined;
              const pending = pendingIds.has(combo.id);
              const issue = skippedMap[combo.id];

              const reception = calc ? calc.grain_reception_date : snap?.grain_reception_date;
              const payment = calc ? calc.payment_date : snap?.payment_date;
              const sale = calc ? calc.sale_date : snap?.sale_date;
              const basis = calc ? num(calc.target_basis_brl) : num(snap?.target_basis_brl);
              const futures = calc ? num(calc.futures_price_brl) : num(snap?.futures_price_brl);
              const fx = calc ? num(calc.exchange_rate) : num(snap?.exchange_rate);
              const price = calc ? num(calc.origination_price_brl) : num(snap?.origination_price_brl);

              return (
                <TableRow key={combo.id} className={cn(pending && 'opacity-50')}>
                  <TableCell className="font-medium text-xs">
                    {warehouseMap[combo.warehouse_id]?.display_name ?? combo.warehouse_id}
                  </TableCell>
                  <TableCell>
                    <span
                      className={cn(
                        'text-xs px-1.5 py-0.5 rounded',
                        combo.commodity === 'soybean' ? 'bg-primary/10 text-primary' : 'bg-amber-900/30 text-amber-500',
                      )}
                    >
                      {COMMODITY_LABELS[combo.commodity] ?? combo.commodity}
                    </span>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{combo.ticker}</TableCell>
                  <TableCell className="text-center text-xs">{formatDate(reception)}</TableCell>
                  <TableCell className="text-center text-xs">{formatDate(payment)}</TableCell>
                  <TableCell className="text-center text-xs">{formatDate(sale)}</TableCell>
                  <TableCell className="text-right tabular-nums text-xs">
                    {basis == null ? '-' : `R$ ${fmt(basis)}`}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-xs">
                    {futures == null ? '-' : `R$ ${fmt(futures)}`}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-xs">{fmt(fx, 4)}</TableCell>
                  <TableCell className="text-right">
                    {issue ? (
                      <span className="text-xs text-[hsl(var(--warning))]">{issue}</span>
                    ) : !source ? (
                      <span className="text-xs text-muted-foreground">sem preço no lote vigente</span>
                    ) : (
                      <span className="inline-flex items-center gap-2 justify-end">
                        {pending && (
                          <Badge variant="outline" className="text-[10px] border-amber-500 text-amber-500">
                            não recalculado
                          </Badge>
                        )}
                        <span className="font-bold text-primary tabular-nums">R$ {fmt(price)}</span>
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

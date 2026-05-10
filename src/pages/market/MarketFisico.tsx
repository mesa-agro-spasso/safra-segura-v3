import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Plus, Layers } from 'lucide-react';
import { useActiveArmazens } from '@/hooks/useWarehouses';
import { useLatestPhysicalPrices, getHoursAgo } from '@/hooks/usePhysicalPrices';
import { PhysicalPriceFormDialog } from '@/components/market/PhysicalPriceFormDialog';
import { PhysicalPriceBulkDialog } from '@/components/market/PhysicalPriceBulkDialog';
import { PhysicalPriceHistoryDialog } from '@/components/market/PhysicalPriceHistoryDialog';

const COMMODITIES: { value: 'soybean' | 'corn'; label: string }[] = [
  { value: 'soybean', label: 'Soja' },
  { value: 'corn', label: 'Milho' },
];

interface Row {
  warehouseId: string;
  warehouseName: string;
  commodity: 'soybean' | 'corn';
  commodityLabel: string;
  price: number | null;
  refDate: string | null;
  updatedAt: string | null;
}

function daysSinceRefDate(refDate: string): number {
  // Compare midnight-to-midnight in local time
  const ref = new Date(refDate + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.floor((today.getTime() - ref.getTime()) / 86_400_000);
}

function freshnessBadge(refDate: string | null) {
  if (!refDate) return <Badge variant="secondary">sem registro</Badge>;
  const d = daysSinceRefDate(refDate);
  const label = d === 0 ? 'hoje' : d === 1 ? '1d' : `${d}d`;
  if (d <= 1) return <Badge className="bg-[hsl(var(--success,142_71%_45%))] text-white hover:bg-[hsl(var(--success,142_71%_45%))]">{label}</Badge>;
  if (d <= 3) return <Badge className="bg-[hsl(var(--warning))] text-white hover:bg-[hsl(var(--warning))]">{label}</Badge>;
  return <Badge variant="destructive">{label}</Badge>;
}

const MarketFisico = () => {
  const { data: armazens = [], isLoading: loadingW } = useActiveArmazens();
  const { data: latest = [], isLoading: loadingP } = useLatestPhysicalPrices();
  const [openSingle, setOpenSingle] = useState(false);
  const [openBulk, setOpenBulk] = useState(false);
  const [detail, setDetail] = useState<{ wId: string; wName: string; commodity: 'soybean' | 'corn' } | null>(null);

  const rows: Row[] = useMemo(() => {
    const out: Row[] = [];
    for (const w of armazens) {
      for (const c of COMMODITIES) {
        const found = latest.find((p) => p.warehouse_id === w.id && p.commodity === c.value);
        out.push({
          warehouseId: w.id,
          warehouseName: w.display_name,
          commodity: c.value,
          commodityLabel: c.label,
          price: found ? Number(found.price_brl_per_sack) : null,
          refDate: found?.reference_date ?? null,
          updatedAt: found?.updated_at ?? null,
        });
      }
    }
    return out;
  }, [armazens, latest]);

  const isLoading = loadingW || loadingP;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Preços Físicos</h2>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setOpenSingle(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Cadastrar preço
          </Button>
          <Button onClick={() => setOpenBulk(true)}>
            <Layers className="mr-2 h-4 w-4" />
            Cadastrar em massa
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Último preço por armazém e commodity</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : rows.length === 0 ? (
            <p className="text-muted-foreground text-sm">Nenhum armazém ativo cadastrado.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Armazém</TableHead>
                  <TableHead>Commodity</TableHead>
                  <TableHead className="text-right">Último preço (R$/sc)</TableHead>
                  <TableHead>Data ref.</TableHead>
                  <TableHead>Atualizado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow
                    key={`${r.warehouseId}::${r.commodity}`}
                    className="cursor-pointer"
                    onClick={() => setDetail({ wId: r.warehouseId, wName: r.warehouseName, commodity: r.commodity })}
                  >
                    <TableCell className="font-medium">{r.warehouseName}</TableCell>
                    <TableCell>{r.commodityLabel}</TableCell>
                    <TableCell className="text-right">
                      {r.price != null ? `R$ ${r.price.toFixed(2)}` : '-'}
                    </TableCell>
                    <TableCell>{r.refDate ?? '-'}</TableCell>
                    <TableCell>{freshnessBadge(r.updatedAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <PhysicalPriceFormDialog open={openSingle} onOpenChange={setOpenSingle} />
      <PhysicalPriceBulkDialog open={openBulk} onOpenChange={setOpenBulk} />
      <PhysicalPriceHistoryDialog
        open={!!detail}
        onOpenChange={(o) => !o && setDetail(null)}
        warehouseId={detail?.wId ?? null}
        warehouseName={detail?.wName ?? ''}
        commodity={detail?.commodity ?? null}
      />
    </div>
  );
};

export default MarketFisico;

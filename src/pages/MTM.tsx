import { useState } from 'react';
import { useHedgeOrders } from '@/hooks/useHedgeOrders';
import { useMarketData } from '@/hooks/useMarketData';
import { useMtmSnapshots, useSaveMtmSnapshot } from '@/hooks/useMtmSnapshots';
import { useAuth } from '@/contexts/AuthContext';
import { callApi } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { Calculator } from 'lucide-react';

const MTM = () => {
  const { data: orders, isLoading: loadingOrders } = useHedgeOrders({ status: 'EXECUTED' });
  const { data: marketData } = useMarketData();
  const { data: mtmSnapshots } = useMtmSnapshots();
  const saveMtm = useSaveMtmSnapshot();
  const { user } = useAuth();
  const [physicalPrices, setPhysicalPrices] = useState<Record<string, string>>(() => {
    try {
      const stored = sessionStorage.getItem('mtm_physical_prices');
      return stored ? JSON.parse(stored) : {};
    } catch { return {}; }
  });
  const [calculating, setCalculating] = useState(false);
  const [results, setResults] = useState<Record<string, unknown>[] | null>(null);

  const handleCalculate = async () => {
    if (!orders?.length || !marketData?.length) {
      toast.error('Dados insuficientes');
      return;
    }
    setCalculating(true);
    try {
      const spotFx = marketData.find((m) => m.commodity === 'FX')?.price ?? null;

      const positions = orders.map((o) => {
        const futuresLeg = (o.legs as { leg_type: string; ticker: string }[]).find(
          (l) => l.leg_type === 'futures'
        );
        const futuresPrice = futuresLeg
          ? (marketData.find((m) => m.ticker === futuresLeg.ticker)?.price ?? 0)
          : 0;

        return {
          order: JSON.parse(JSON.stringify(o)),
          snapshot: {
            futures_price_current: futuresPrice,
            physical_price_current: parseFloat(physicalPrices[o.operation_id] || '0'),
            spot_rate_current: spotFx,
            option_premium_current: null,
          },
        };
      });

      const result = await callApi<{ results: Record<string, unknown>[] }>('/mtm/run', {
        positions,
      });

      if (result?.results) {
        setResults(result.results);
        for (const r of result.results) {
          await saveMtm.mutateAsync({
            operation_id: r.operation_id as string,
            volume_sacks: r.volume_sacks as number,
            physical_price_current: (r.market_snapshot as Record<string, number>).physical_price_current,
            futures_price_current: (r.market_snapshot as Record<string, number>).futures_price_current,
            spot_rate_current: ((r.market_snapshot as Record<string, number | null>).spot_rate_current) ?? null,
            mtm_physical_brl: r.mtm_physical_brl as number,
            mtm_futures_brl: r.mtm_futures_brl as number,
            mtm_ndf_brl: (r.mtm_ndf_brl as number) ?? 0,
            mtm_option_brl: (r.mtm_option_brl as number) ?? 0,
            mtm_total_brl: r.mtm_total_brl as number,
            mtm_per_sack_brl: r.mtm_per_sack_brl as number,
            total_exposure_brl: r.total_exposure_brl as number,
            calculated_by: user?.id ?? null,
          });
        }
        toast.success('MTM calculado e salvo');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao calcular MTM');
    } finally {
      setCalculating(false);
    }
  };

  const loading = loadingOrders;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Mark-to-Market</h2>
        <Button onClick={handleCalculate} disabled={calculating || !orders?.length}>
          <Calculator className={`mr-2 h-4 w-4 ${calculating ? 'animate-spin' : ''}`} />
          {calculating ? 'Calculando...' : 'Calcular MTM'}
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>
      ) : !orders?.length ? (
        <p className="text-center text-muted-foreground py-12">Nenhuma ordem executada encontrada.</p>
      ) : (
        <Card>
          <CardHeader><CardTitle className="text-sm">Operações Ativas</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Operação</TableHead>
                  <TableHead>Praça</TableHead>
                  <TableHead>Entrada</TableHead>
                  <TableHead>Saída</TableHead>
                  <TableHead>Commodity</TableHead>
                  <TableHead>Volume</TableHead>
                  <TableHead>Preço Orig.</TableHead>
                  <TableHead>Preço Físico Atual (R$/sc)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell className="font-mono text-xs">{o.operation_id.slice(0, 8)}</TableCell>
                    <TableCell>{o.operation?.warehouses?.display_name ?? '—'}</TableCell>
                    <TableCell>{o.operation?.pricing_snapshots?.trade_date ? new Date(o.operation.pricing_snapshots.trade_date + 'T12:00:00').toLocaleDateString('pt-BR') : '—'}</TableCell>
                    <TableCell>{o.operation?.pricing_snapshots?.sale_date ? new Date(o.operation.pricing_snapshots.sale_date + 'T12:00:00').toLocaleDateString('pt-BR') : '—'}</TableCell>
                    <TableCell>{o.commodity}</TableCell>
                    <TableCell>{o.volume_sacks.toLocaleString()}</TableCell>
                    <TableCell>R$ {o.origination_price_brl.toFixed(2)}</TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        step="0.01"
                        className="h-8 w-28"
                        placeholder="0.00"
                        value={physicalPrices[o.operation_id] || ''}
                        onChange={(e) => setPhysicalPrices((p) => {
                          const updated = { ...p, [o.operation_id]: e.target.value };
                          try { sessionStorage.setItem('mtm_physical_prices', JSON.stringify(updated)); } catch {}
                          return updated;
                        })}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {results && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Resultado MTM</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Operação</TableHead>
                  <TableHead>Commodity</TableHead>
                  <TableHead>Praça</TableHead>
                  <TableHead>Entrada</TableHead>
                  <TableHead>Pagamento</TableHead>
                  <TableHead>Recepção</TableHead>
                  <TableHead>Saída</TableHead>
                  <TableHead>Físico</TableHead>
                  <TableHead>Futuros</TableHead>
                  <TableHead>NDF</TableHead>
                  <TableHead>Opção</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Por Saca</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.map((r, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-mono text-xs">{(r.operation_id as string)?.slice(0, 8)}</TableCell>
                    <TableCell>{orders?.find(o => o.operation_id === r.operation_id)?.commodity ?? '—'}</TableCell>
                    <TableCell>{orders?.find(o => o.operation_id === r.operation_id)?.operation?.warehouses?.display_name ?? '—'}</TableCell>
                    <TableCell>{orders?.find(o => o.operation_id === r.operation_id)?.operation?.pricing_snapshots?.trade_date ? new Date((orders.find(o => o.operation_id === r.operation_id)!.operation!.pricing_snapshots!.trade_date) + 'T12:00:00').toLocaleDateString('pt-BR') : '—'}</TableCell>
                    <TableCell>{orders?.find(o => o.operation_id === r.operation_id)?.operation?.pricing_snapshots?.payment_date ? new Date((orders.find(o => o.operation_id === r.operation_id)!.operation!.pricing_snapshots!.payment_date) + 'T12:00:00').toLocaleDateString('pt-BR') : '—'}</TableCell>
                    <TableCell>{orders?.find(o => o.operation_id === r.operation_id)?.operation?.pricing_snapshots?.grain_reception_date ? new Date((orders.find(o => o.operation_id === r.operation_id)!.operation!.pricing_snapshots!.grain_reception_date) + 'T12:00:00').toLocaleDateString('pt-BR') : '—'}</TableCell>
                    <TableCell>{orders?.find(o => o.operation_id === r.operation_id)?.operation?.pricing_snapshots?.sale_date ? new Date((orders.find(o => o.operation_id === r.operation_id)!.operation!.pricing_snapshots!.sale_date) + 'T12:00:00').toLocaleDateString('pt-BR') : '—'}</TableCell>
                    <TableCell>R$ {((r.mtm_physical_brl as number) ?? 0).toFixed(2)}</TableCell>
                    <TableCell>R$ {((r.mtm_futures_brl as number) ?? 0).toFixed(2)}</TableCell>
                    <TableCell>R$ {((r.mtm_ndf_brl as number) ?? 0).toFixed(2)}</TableCell>
                    <TableCell>R$ {((r.mtm_option_brl as number) ?? 0).toFixed(2)}</TableCell>
                    <TableCell className="font-bold">R$ {((r.mtm_total_brl as number) ?? 0).toFixed(2)}</TableCell>
                    <TableCell>R$ {((r.mtm_per_sack_brl as number) ?? 0).toFixed(2)}/sc</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default MTM;

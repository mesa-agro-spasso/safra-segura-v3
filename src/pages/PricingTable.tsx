import { useState, useMemo } from 'react';
import { usePricingSnapshots } from '@/hooks/usePricingSnapshots';
import { useMarketData, getHoursAgo } from '@/hooks/useMarketData';
import { useActiveArmazens } from '@/hooks/useWarehouses';
import { callApi } from '@/lib/api';
import { useSavePricingSnapshots } from '@/hooks/usePricingSnapshots';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { RefreshCw, AlertTriangle } from 'lucide-react';

const B3_CORN_TICKERS = ['CCMF27', 'CCMK27'];

const PricingTable = () => {
  const { data: snapshots, isLoading: loadingSnapshots } = usePricingSnapshots();
  const { data: marketData, isLoading: loadingMarket } = useMarketData();
  const { data: warehouses } = useActiveArmazens();
  const saveSnapshots = useSavePricingSnapshots();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [generating, setGenerating] = useState(false);
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(new Set());

  const staleTickers = useMemo(() => {
    if (!marketData) return [];
    return marketData.filter((m) => getHoursAgo(m.updated_at) > 24);
  }, [marketData]);

  const staleCorn = useMemo(() => staleTickers.filter((t) => B3_CORN_TICKERS.includes(t.ticker)), [staleTickers]);
  const staleOther = useMemo(() => staleTickers.filter((t) => !B3_CORN_TICKERS.includes(t.ticker)), [staleTickers]);

  const latestSnapshot = snapshots?.[0];
  const lastUpdated = latestSnapshot ? new Date(latestSnapshot.created_at) : null;

  // Group snapshots by warehouse × commodity × payment_date
  const grouped = useMemo(() => {
    if (!snapshots?.length) return { warehouseIds: [], columns: [], matrix: {} };
    const latest = snapshots[0].created_at;
    const batch = snapshots.filter((s) => s.created_at === latest);
    const warehouseIds = [...new Set(batch.map((s) => s.warehouse_id))];
    const columns = [...new Set(batch.map((s) => `${s.commodity}|${s.payment_date}`))].sort();
    const matrix: Record<string, typeof batch[0]> = {};
    batch.forEach((s) => { matrix[`${s.warehouse_id}|${s.commodity}|${s.payment_date}`] = s; });
    return { warehouseIds, columns, matrix, batch };
  }, [snapshots]);

  const handleGenerate = async () => {
    if (!marketData?.length || !warehouses?.length) {
      toast.error('Dados de mercado ou armazéns não disponíveis');
      return;
    }
    setGenerating(true);
    try {
      const marketPayload: Record<string, unknown> = {};
      marketData.forEach((m) => {
        marketPayload[m.ticker] = { price: m.price, exchange_rate: m.exchange_rate };
      });

      const combinations = warehouses.flatMap((w) =>
        ['SOJA', 'MILHO'].flatMap((commodity) =>
          ['2026-01-15', '2026-02-15', '2026-03-15'].map((payment_date) => ({
            warehouse_id: w.id,
            commodity,
            payment_date,
          }))
        )
      );

      const result = await callApi<{ snapshots: Record<string, unknown>[] }>('/pricing/table', {
        market_data: marketPayload,
        combinations,
      });

      if (result?.snapshots?.length) {
        await saveSnapshots.mutateAsync(
          result.snapshots.map((s: Record<string, unknown>) => ({
            ...(s as Omit<import('@/types').PricingSnapshot, 'id' | 'created_at'>),
            created_by: user?.id ?? null,
          }))
        );
        toast.success('Tabela gerada com sucesso');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao gerar tabela');
    } finally {
      setGenerating(false);
    }
  };

  const warehouseMap = useMemo(() => {
    const map: Record<string, string> = {};
    warehouses?.forEach((w) => { map[w.id] = w.display_name; });
    return map;
  }, [warehouses]);

  const loading = loadingSnapshots || loadingMarket;

  return (
    <div className="space-y-4">
      {/* Market freshness alerts */}
      {staleOther.length > 0 && !dismissedAlerts.has('other') && (
        <div className="flex items-center justify-between rounded-lg border border-[hsl(var(--warning))] bg-[hsl(var(--warning)/0.1)] p-3 text-sm">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-[hsl(var(--warning))]" />
            <span>Dados de mercado desatualizados ({staleOther.map((t) => t.ticker).join(', ')})</span>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => setDismissedAlerts((s) => new Set(s).add('other'))}>Ignorar</Button>
            <Button size="sm" onClick={() => navigate('/mercado')}>Atualizar Mercado</Button>
          </div>
        </div>
      )}
      {staleCorn.length > 0 && !dismissedAlerts.has('corn') && (
        <div className="flex items-center justify-between rounded-lg border border-[hsl(var(--warning))] bg-[hsl(var(--warning)/0.1)] p-3 text-sm">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-[hsl(var(--warning))]" />
            <span>Milho B3 desatualizado ({staleCorn.map((t) => t.ticker).join(', ')})</span>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => setDismissedAlerts((s) => new Set(s).add('corn'))}>Ignorar</Button>
            <Button size="sm" onClick={() => navigate('/mercado')}>Atualizar Mercado</Button>
          </div>
        </div>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Tabela de Preços</CardTitle>
            {lastUpdated && (
              <p className="text-xs text-muted-foreground mt-1">
                Atualizado em {lastUpdated.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} de {lastUpdated.toLocaleDateString('pt-BR')}
              </p>
            )}
          </div>
          <Button onClick={handleGenerate} disabled={generating || loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${generating ? 'animate-spin' : ''}`} />
            {generating ? 'Gerando...' : 'Gerar Tabela'}
          </Button>
        </CardHeader>
        <CardContent>
          {/* Market data freshness */}
          {marketData && (
            <div className="flex flex-wrap gap-3 mb-4">
              {marketData.map((m) => {
                const hours = getHoursAgo(m.updated_at);
                return (
                  <span key={m.ticker} className={`text-xs px-2 py-1 rounded ${hours > 24 ? 'bg-[hsl(var(--warning)/0.2)] text-[hsl(var(--warning))]' : 'bg-muted text-muted-foreground'}`}>
                    {m.ticker}: {hours}h atrás
                  </span>
                );
              })}
            </div>
          )}

          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : grouped.columns.length === 0 ? (
            <p className="text-center text-muted-foreground py-12">Nenhum snapshot disponível. Clique em "Gerar Tabela".</p>
          ) : (
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Praça</TableHead>
                    {grouped.columns.map((col) => {
                      const [commodity, date] = col.split('|');
                      return <TableHead key={col} className="text-center">{commodity}<br /><span className="text-xs font-normal">{date}</span></TableHead>;
                    })}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {grouped.warehouseIds.map((wId) => (
                    <TableRow key={wId}>
                      <TableCell className="font-medium">{warehouseMap[wId] || wId}</TableCell>
                      {grouped.columns.map((col) => {
                        const [commodity, date] = col.split('|');
                        const snap = grouped.matrix[`${wId}|${commodity}|${date}`];
                        if (!snap) return <TableCell key={col} className="text-center">-</TableCell>;
                        const inputs = snap.inputs_json as Record<string, unknown>;
                        const outputs = snap.outputs_json as Record<string, unknown>;
                        const insurance = snap.insurance_json as Record<string, unknown>;
                        return (
                          <TableCell key={col} className="text-center">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button className="font-bold text-primary hover:underline cursor-pointer">
                                  R$ {snap.origination_price_brl.toFixed(2)}
                                </button>
                              </TooltipTrigger>
                              <TooltipContent className="max-w-xs text-left space-y-1">
                                <p className="font-semibold">Detalhes</p>
                                <p>Basis alvo: R$ {snap.target_basis_brl.toFixed(2)}</p>
                                <p>Futuros: R$ {snap.futures_price_brl.toFixed(2)}</p>
                                <p>Câmbio: {snap.exchange_rate?.toFixed(4) ?? '-'}</p>
                                {inputs && Object.keys(inputs).length > 0 && (
                                  <p>Custos: {JSON.stringify(inputs)}</p>
                                )}
                                {insurance && Object.keys(insurance).length > 0 && (
                                  <p>Seguro: {JSON.stringify(insurance)}</p>
                                )}
                              </TooltipContent>
                            </Tooltip>
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default PricingTable;

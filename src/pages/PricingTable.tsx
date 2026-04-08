import { useState, useMemo } from 'react';
import { usePricingSnapshots } from '@/hooks/usePricingSnapshots';
import { useMarketData, getHoursAgo } from '@/hooks/useMarketData';
import { useActiveArmazens } from '@/hooks/useWarehouses';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { useNavigate } from 'react-router-dom';
import { RefreshCw, AlertTriangle, Download } from 'lucide-react';
import { GeneratePricingModal } from '@/components/GeneratePricingModal';
import { ExportPricingModal } from '@/components/ExportPricingModal';

const B3_CORN_TICKERS = ['CCMF27', 'CCMK27'];

const formatDate = (d: string | null | undefined) => {
  if (!d) return '-';
  const parts = d.split('-');
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return d;
};

const PricingTable = () => {
  const { data: snapshots, isLoading: loadingSnapshots } = usePricingSnapshots();
  const { data: marketData, isLoading: loadingMarket } = useMarketData();
  const { data: warehouses } = useActiveArmazens();
  const navigate = useNavigate();
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(new Set());
  const [modalOpen, setModalOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [tickersExpanded, setTickersExpanded] = useState(false);
  const [detailSnap, setDetailSnap] = useState<any>(null);
  const [filterCommodity, setFilterCommodity] = useState<string>('all');
  const [filterWarehouse, setFilterWarehouse] = useState<string>('all');
  const [filterTicker, setFilterTicker] = useState<string>('all');

  const staleTickers = useMemo(() => {
    if (!marketData) return [];
    return marketData.filter((m) => getHoursAgo(m.updated_at) > 24);
  }, [marketData]);

  const staleCorn = useMemo(() => staleTickers.filter((t) => B3_CORN_TICKERS.includes(t.ticker)), [staleTickers]);
  const staleOther = useMemo(() => staleTickers.filter((t) => !B3_CORN_TICKERS.includes(t.ticker)), [staleTickers]);

  const warehouseMap = useMemo(() => {
    const map: Record<string, string> = {};
    warehouses?.forEach((w) => { map[w.id] = w.display_name; });
    return map;
  }, [warehouses]);

  // Get latest batch of snapshots, sorted and filtered
  const allRows = useMemo(() => {
    if (!snapshots?.length) return [];
    const latest = snapshots[0].created_at;
    const batch = snapshots.filter((s) => s.created_at === latest);
    return batch.sort((a, b) => {
      const wA = warehouseMap[a.warehouse_id] ?? a.warehouse_id;
      const wB = warehouseMap[b.warehouse_id] ?? b.warehouse_id;
      if (wA !== wB) return wA.localeCompare(wB);
      if (a.commodity !== b.commodity) return a.commodity.localeCompare(b.commodity);
      return a.ticker.localeCompare(b.ticker);
    });
  }, [snapshots, warehouseMap]);

  const rows = useMemo(() => {
    return allRows.filter((s) => {
      if (filterCommodity !== 'all' && s.commodity !== filterCommodity) return false;
      if (filterWarehouse !== 'all' && s.warehouse_id !== filterWarehouse) return false;
      if (filterTicker !== 'all' && s.ticker !== filterTicker) return false;
      return true;
    });
  }, [allRows, filterCommodity, filterWarehouse, filterTicker]);

  // Unique values for filter dropdowns
  const uniqueCommodities = useMemo(() => [...new Set(allRows.map((r) => r.commodity))], [allRows]);
  const uniqueWarehouses = useMemo(() => [...new Set(allRows.map((r) => r.warehouse_id))], [allRows]);
  const uniqueTickers = useMemo(() => [...new Set(allRows.map((r) => r.ticker))].sort(), [allRows]);

  const lastUpdated = snapshots?.[0] ? new Date(snapshots[0].created_at) : null;
  const loading = loadingSnapshots || loadingMarket;

  // Track which warehouse names have already been shown for row grouping
  let lastWarehouse = '';

  return (
    <div className="space-y-4">
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
            {(() => {
              const maxHoursAgo = marketData?.length
                ? Math.max(...marketData.map((m) => getHoursAgo(m.updated_at)))
                : 0;
              const color = maxHoursAgo < 12 ? 'text-green-400' : maxHoursAgo < 24 ? 'text-yellow-400' : 'text-red-400';
              const label = maxHoursAgo < 12
                ? 'Últimas atualizações: ok'
                : maxHoursAgo < 24
                  ? `Últimas atualizações: atenção (${Math.round(maxHoursAgo)}h)`
                  : `Últimas atualizações: desatualizado (${Math.round(maxHoursAgo)}h)`;
              return (
                <button
                  type="button"
                  className={`flex items-center gap-1.5 text-xs mt-1 cursor-pointer hover:opacity-80 ${color}`}
                  onClick={() => setTickersExpanded((v) => !v)}
                >
                  <span>●</span>
                  <span>{label}</span>
                  <span className="ml-1">{tickersExpanded ? '▾' : '▸'}</span>
                </button>
              );
            })()}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setExportOpen(true)} disabled={loading || rows.length === 0}>
              <Download className="mr-2 h-4 w-4" />
              Exportar
            </Button>
            <Button onClick={() => setModalOpen(true)} disabled={loading}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Gerar Tabela
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {tickersExpanded && marketData && (
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
          ) : rows.length === 0 ? (
            <p className="text-center text-muted-foreground py-12">Nenhum snapshot disponível. Clique em "Gerar Tabela".</p>
          ) : (
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Praça</TableHead>
                    <TableHead>Commodity</TableHead>
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
                  {rows.map((snap) => {
                    const wName = warehouseMap[snap.warehouse_id] ?? snap.warehouse_id;
                    const showWarehouse = wName !== lastWarehouse;
                    lastWarehouse = wName;

                    const outputs = snap.outputs_json as Record<string, any> | null;
                    const costs = outputs?.costs as Record<string, any> | null;
                    const totalCosts = costs?.total_brl ?? null;

                    return (
                      <TableRow key={snap.id} className={showWarehouse ? 'border-t-2 border-border' : ''}>
                        <TableCell className="font-medium">
                          {showWarehouse ? wName : ''}
                        </TableCell>
                        <TableCell>
                          <span className={`text-xs px-1.5 py-0.5 rounded ${snap.commodity === 'soybean' ? 'bg-primary/10 text-primary' : 'bg-amber-900/30 text-amber-500'}`}>
                            {snap.commodity === 'soybean' ? 'Soja' : 'Milho'}
                          </span>
                        </TableCell>
                        <TableCell className="font-mono text-xs">{snap.ticker}</TableCell>
                        <TableCell className="text-center text-xs">{formatDate(snap.grain_reception_date)}</TableCell>
                        <TableCell className="text-center text-xs">{formatDate(snap.payment_date)}</TableCell>
                        <TableCell className="text-center text-xs">{formatDate(snap.sale_date)}</TableCell>
                        <TableCell className="text-right tabular-nums">R$ {snap.target_basis_brl.toFixed(2)}</TableCell>
                        <TableCell className="text-right tabular-nums">R$ {snap.futures_price_brl.toFixed(2)}</TableCell>
                        <TableCell className="text-right tabular-nums">{snap.exchange_rate?.toFixed(4) ?? '-'}</TableCell>
                        <TableCell className="text-right">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button className="font-bold text-primary hover:underline cursor-pointer tabular-nums" onClick={(e) => { e.stopPropagation(); setDetailSnap(snap); }}>
                                R$ {snap.origination_price_brl.toFixed(2)}
                              </button>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs text-left space-y-1">
                              <p className="font-semibold">Breakdown de Custos</p>
                              {costs && (
                                <>
                                  {costs.financial_brl != null && <p>Financeiro: R$ {Number(costs.financial_brl).toFixed(2)}</p>}
                                  {costs.storage_brl != null && <p>Armazenagem: R$ {Number(costs.storage_brl).toFixed(2)}</p>}
                                  {costs.brokerage_brl != null && <p>Corretagem: R$ {Number(costs.brokerage_brl).toFixed(2)}</p>}
                                  {costs.desk_brl != null && <p>Mesa: R$ {Number(costs.desk_brl).toFixed(2)}</p>}
                                  {costs.reception_brl != null && <p>Recepção: R$ {Number(costs.reception_brl).toFixed(2)}</p>}
                                  {totalCosts != null && <p className="font-semibold border-t border-border pt-1">Total: R$ {Number(totalCosts).toFixed(2)}</p>}
                                </>
                              )}
                              <p className="border-t border-border pt-1">Basis alvo: R$ {snap.target_basis_brl.toFixed(2)}</p>
                              <p>Futuros: R$ {snap.futures_price_brl.toFixed(2)}</p>
                              <p>Câmbio: {snap.exchange_rate?.toFixed(4) ?? '-'}</p>
                              {snap.additional_discount_brl > 0 && <p>Desconto: R$ {snap.additional_discount_brl.toFixed(2)}</p>}
                            </TooltipContent>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {detailSnap && (() => {
        const outputs = detailSnap.outputs_json as Record<string, any> | null;
        const costs = outputs?.costs as Record<string, any> | null;
        const insurance = detailSnap.insurance_json as Record<string, any> | null;
        const insuranceLevels = [
          { key: 'atm', label: 'ATM' },
          { key: 'otm_5', label: 'OTM 5%' },
          { key: 'otm_10', label: 'OTM 10%' },
        ];
        const hasInsurance = insurance && insuranceLevels.some((l) => insurance[l.key]);

        const DetailRow = ({ label, value }: { label: string; value: string }) => (
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">{label}</span>
            <span>{value}</span>
          </div>
        );

        return (
          <Dialog open={!!detailSnap} onOpenChange={(o) => { if (!o) setDetailSnap(null); }}>
            <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  Detalhamento — {detailSnap.ticker} / {warehouseMap[detailSnap.warehouse_id] ?? detailSnap.warehouse_id}
                </DialogTitle>
              </DialogHeader>

              <h4 className="font-semibold text-sm mt-2">Identificação</h4>
              <DetailRow label="Praça" value={warehouseMap[detailSnap.warehouse_id] ?? '-'} />
              <DetailRow label="Commodity" value={detailSnap.commodity === 'soybean' ? 'Soja CBOT' : 'Milho B3'} />
              <DetailRow label="Ticker" value={detailSnap.ticker} />
              <DetailRow label="Trade date" value={formatDate(detailSnap.trade_date)} />

              <Separator />
              <h4 className="font-semibold text-sm">Datas</h4>
              <DetailRow label="Recepção do grão" value={formatDate(detailSnap.grain_reception_date)} />
              <DetailRow label="Pagamento" value={formatDate(detailSnap.payment_date)} />
              <DetailRow label="Venda" value={formatDate(detailSnap.sale_date)} />

              <Separator />
              <h4 className="font-semibold text-sm">Preços e Basis</h4>
              <DetailRow label="Futuros (BRL)" value={`R$ ${detailSnap.futures_price_brl.toFixed(2)}`} />
              <DetailRow label="Câmbio" value={detailSnap.exchange_rate?.toFixed(4) ?? '-'} />
              <DetailRow label="Basis alvo" value={`R$ ${detailSnap.target_basis_brl.toFixed(2)}`} />
              <DetailRow label="Purchased basis" value={(outputs?.purchased_basis_brl as number) != null ? `R$ ${(outputs!.purchased_basis_brl as number).toFixed(2)}` : '-'} />
              <DetailRow label="Breakeven basis" value={(outputs?.breakeven_basis_brl as number) != null ? `R$ ${(outputs!.breakeven_basis_brl as number).toFixed(2)}` : '-'} />
              <DetailRow label="Preço bruto" value={(outputs?.gross_price_brl as number) != null ? `R$ ${(outputs!.gross_price_brl as number).toFixed(2)}` : '-'} />
              <DetailRow label="Desconto adicional" value={`R$ ${detailSnap.additional_discount_brl.toFixed(2)}`} />
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Preço de originação</span>
                <span className="font-bold text-primary">R$ {detailSnap.origination_price_brl.toFixed(2)}</span>
              </div>

              <Separator />
              <h4 className="font-semibold text-sm">Custos</h4>
              {costs ? (
                <>
                  {costs.financial_brl != null && <DetailRow label="Financeiro" value={`R$ ${Number(costs.financial_brl).toFixed(2)}`} />}
                  {costs.storage_brl != null && <DetailRow label="Armazenagem" value={`R$ ${Number(costs.storage_brl).toFixed(2)}`} />}
                  {costs.brokerage_brl != null && <DetailRow label="Corretagem" value={`R$ ${Number(costs.brokerage_brl).toFixed(2)}`} />}
                  {costs.desk_cost_brl != null && <DetailRow label="Mesa" value={`R$ ${Number(costs.desk_cost_brl).toFixed(2)}`} />}
                  {costs.reception_brl != null && <DetailRow label="Recepção" value={`R$ ${Number(costs.reception_brl).toFixed(2)}`} />}
                  {costs.total_brl != null && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Total custos</span>
                      <span className="font-bold">R$ {Number(costs.total_brl).toFixed(2)}</span>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Sem dados de custos</p>
              )}

              {hasInsurance && (
                <>
                  <Separator />
                  <h4 className="font-semibold text-sm">Seguro</h4>
                  {insuranceLevels.map(({ key, label }) => {
                    const ins = insurance![key] as Record<string, any> | undefined;
                    if (!ins) return null;
                    return (
                      <div key={key} className="space-y-1 ml-2">
                        <p className="text-xs font-semibold text-muted-foreground">{label}</p>
                        {ins.strike_brl != null && <DetailRow label="Strike" value={`R$ ${Number(ins.strike_brl).toFixed(2)}`} />}
                        {ins.premium_brl != null && <DetailRow label="Prêmio" value={`R$ ${Number(ins.premium_brl).toFixed(2)}`} />}
                        {ins.carry_brl != null && <DetailRow label="Carry" value={`R$ ${Number(ins.carry_brl).toFixed(4)}`} />}
                        {ins.total_cost_brl != null && (
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Custo total</span>
                            <span className="font-bold">R$ {Number(ins.total_cost_brl).toFixed(2)}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </>
              )}
            </DialogContent>
          </Dialog>
        );
      })()}

      <GeneratePricingModal open={modalOpen} onOpenChange={setModalOpen} />
    </div>
  );
};

export default PricingTable;

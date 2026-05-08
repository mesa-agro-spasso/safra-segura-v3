import { useState, useMemo } from 'react';
import { useHedgeOrders } from '@/hooks/useHedgeOrders';
import { useMarketData } from '@/hooks/useMarketData';
import { useMtmSnapshots, useSaveMtmSnapshot } from '@/hooks/useMtmSnapshots';
import { useAuth } from '@/contexts/AuthContext';
import { callApi } from '@/lib/api';
import { usePricingParameters } from '@/hooks/usePricingParameters';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Calculator, Filter } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Switch } from '@/components/ui/switch';

const MTM = () => {
  const { data: orders, isLoading: loadingOrders } = useHedgeOrders({ status: 'EXECUTED' });
  const { data: marketData } = useMarketData();
  const { data: mtmSnapshots } = useMtmSnapshots();
  const saveMtm = useSaveMtmSnapshot();
  const { user } = useAuth();
  const { data: pricingParameters } = usePricingParameters();
  const [physicalPrices, setPhysicalPrices] = useState<Record<string, string>>(() => {
    try {
      const stored = sessionStorage.getItem('mtm_physical_prices');
      return stored ? JSON.parse(stored) : {};
    } catch { return {}; }
  });
  const [groupPrices, setGroupPrices] = useState<Record<string, string>>(() => {
    try {
      const stored = sessionStorage.getItem('mtm_group_prices');
      return stored ? JSON.parse(stored) : {};
    } catch { return {}; }
  });
  const [calculating, setCalculating] = useState(false);
  const [results, setResults] = useState<Record<string, unknown>[] | null>(null);
  const [detailResult, setDetailResult] = useState<Record<string, unknown> | null>(null);

  const [filterWarehouse, setFilterWarehouse] = useState('all');
  const [filterCommodity, setFilterCommodity] = useState('all');
  const [filtersExpanded, setFiltersExpanded] = useState(false);

  const lastMtmCalculated = useMemo(() => {
    if (!mtmSnapshots?.length) return null;
    return mtmSnapshots[0].calculated_at;
  }, [mtmSnapshots]);

  const lastMarketUpdate = useMemo(() => {
    if (!marketData?.length) return null;
    return marketData.reduce((latest, m) => {
      return !latest || m.updated_at > latest ? m.updated_at : latest;
    }, null as string | null);
  }, [marketData]);

  const uniqueWarehouses = useMemo(() => {
    if (!orders?.length) return [];
    return [...new Set(orders.map(o => o.operation?.warehouses?.display_name).filter(Boolean))] as string[];
  }, [orders]);

  const physicalGroups = useMemo(() => {
    if (!orders?.length) return [] as { key: string; warehouse: string; commodity: string; operationIds: string[] }[];
    const map = new Map<string, { key: string; warehouse: string; commodity: string; operationIds: string[] }>();
    for (const o of orders) {
      const warehouse = o.operation?.warehouses?.display_name ?? '—';
      const commodity = o.commodity;
      const key = `${warehouse}__${commodity}`;
      if (!map.has(key)) map.set(key, { key, warehouse, commodity, operationIds: [] });
      map.get(key)!.operationIds.push(o.operation_id);
    }
    return [...map.values()].sort((a, b) =>
      a.warehouse.localeCompare(b.warehouse) || a.commodity.localeCompare(b.commodity)
    );
  }, [orders]);

  const applyGroupPrice = (group: { key: string; operationIds: string[] }) => {
    const value = groupPrices[group.key];
    if (!value) {
      toast.error('Preencha o preço primeiro');
      return;
    }
    setPhysicalPrices((p) => {
      const updated = { ...p };
      for (const id of group.operationIds) updated[id] = value;
      try { sessionStorage.setItem('mtm_physical_prices', JSON.stringify(updated)); } catch {}
      return updated;
    });
    toast.success(`Aplicado a ${group.operationIds.length} operação(ões)`);
  };

  const filteredResults = useMemo(() => {
    if (!results) return results;
    return results.filter(r => {
      const matchedOrder = orders?.find(o => o.operation_id === r.operation_id);
      if (filterWarehouse !== 'all' && matchedOrder?.operation?.warehouses?.display_name !== filterWarehouse) return false;
      if (filterCommodity !== 'all' && matchedOrder?.commodity !== filterCommodity) return false;
      return true;
    });
  }, [results, orders, filterWarehouse, filterCommodity]);

  const summary = useMemo(() => {
    if (!results?.length) return null;
    const totalFisico = results.reduce((s, r) => s + ((r.mtm_physical_brl as number) ?? 0), 0);
    const totalFuturos = results.reduce((s, r) => s + ((r.mtm_futures_brl as number) ?? 0), 0);
    const totalNdf = results.reduce((s, r) => s + ((r.mtm_ndf_brl as number) ?? 0), 0);
    const totalOpcao = results.reduce((s, r) => s + ((r.mtm_option_brl as number) ?? 0), 0);
    const totalGeral = results.reduce((s, r) => s + ((r.mtm_total_brl as number) ?? 0), 0);
    const totalVolume = results.reduce((s, r) => s + ((r.volume_sacks as number) ?? 0), 0);
    const totalPerSack = totalVolume > 0 ? totalGeral / totalVolume : 0;
    return { totalFisico, totalFuturos, totalNdf, totalOpcao, totalGeral, totalVolume, totalPerSack };
  }, [results]);

  const [chartByOperation, setChartByOperation] = useState(false);

  const chartDataConsolidated = useMemo(() => {
    if (!summary) return [];
    return [
      { name: 'Físico', value: summary.totalFisico },
      { name: 'Futuros', value: summary.totalFuturos },
      { name: 'NDF', value: summary.totalNdf },
      { name: 'Opção', value: summary.totalOpcao },
      { name: 'Total', value: summary.totalGeral },
    ];
  }, [summary]);

  const chartDataByOperation = useMemo(() => {
    if (!results?.length) return [];
    return results.map(r => {
      const matchedOrder = orders?.find(o => o.operation_id === r.operation_id);
      const label = matchedOrder?.operation?.warehouses?.display_name ?? (r.operation_id as string)?.slice(0, 8);
      return {
        name: label,
        Físico: (r.mtm_physical_brl as number) ?? 0,
        Futuros: (r.mtm_futures_brl as number) ?? 0,
        NDF: (r.mtm_ndf_brl as number) ?? 0,
        Opção: (r.mtm_option_brl as number) ?? 0,
        Total: (r.mtm_total_brl as number) ?? 0,
      };
    });
  }, [results, orders]);

  const handleCalculate = async () => {
    if (!orders?.length || !marketData?.length) {
      toast.error('Dados insuficientes');
      return;
    }
    setCalculating(true);
    try {
      const spotFx = marketData.find((m) => m.commodity === 'FX')?.price ?? null;

      const sigmaMap: Record<string, number> = {};
      pricingParameters?.forEach((p) => { sigmaMap[p.id] = p.sigma; });

      const positions = await Promise.all(orders.map(async (o) => {
        const legs = o.legs as {
          leg_type: string;
          ticker: string;
          option_type?: string;
          strike?: number;
          expiration_date?: string;
        }[];

        const futuresLeg = legs.find((l) => l.leg_type === 'futures');
        const optionLeg = legs.find((l) => l.leg_type === 'option');

        const futuresPrice = futuresLeg
          ? (marketData.find((m) => m.ticker === futuresLeg.ticker)?.price ?? 0)
          : 0;

        const fxRate = spotFx ?? 5.0;
        const BUSHELS_PER_SACK = o.commodity === 'soybean' ? 2.20462 : 2.3622;
        const F_brl = o.commodity === 'soybean'
          ? futuresPrice * BUSHELS_PER_SACK * fxRate
          : futuresPrice;

        let optionPremiumCurrent: number | null = null;

        if (optionLeg?.strike && optionLeg?.expiration_date) {
          const today = new Date();
          const expDate = new Date(optionLeg.expiration_date);
          const T_days = Math.max(1, Math.round((expDate.getTime() - today.getTime()) / 86400000));
          const sigma = o.commodity === 'soybean'
            ? (sigmaMap['soybean_cbot'] ?? 0.35)
            : (sigmaMap['corn_b3'] ?? 0.17);
          const r = 0.149;

          try {
            const premiumResult = await callApi<{ premium: number }>('/pricing/option-premium', {
              F: F_brl,
              K: optionLeg.strike,
              T_days,
              r,
              sigma,
              option_type: optionLeg.option_type ?? 'call',
            });
            optionPremiumCurrent = premiumResult?.premium ?? null;
          } catch (optErr) {
            toast.error(`Erro ao calcular prêmio de opção: ${optErr instanceof Error ? optErr.message : JSON.stringify(optErr)}`);
          }
        }

        return {
          order: JSON.parse(JSON.stringify(o)),
          snapshot: {
            futures_price_current: futuresPrice,
            physical_price_current: parseFloat(physicalPrices[o.operation_id] || '0'),
            spot_rate_current: spotFx,
            option_premium_current: optionPremiumCurrent,
          },
        };
      }));

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

  const StatusDot = ({ date, label }: { date: string; label: string }) => {
    const d = new Date(date);
    const hoursAgo = Math.floor((Date.now() - d.getTime()) / 3_600_000);
    const color = hoursAgo < 12 ? 'text-green-400' : hoursAgo < 24 ? 'text-yellow-400' : 'text-red-400';
    const timeLabel = `${label}: ${d.toLocaleDateString('pt-BR')} ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}${hoursAgo >= 12 ? ` (${hoursAgo}h atrás)` : ''}`;
    return <p className={`text-xs ${color}`}>● {timeLabel}</p>;
  };

  return (
    <div className="space-y-4">
      {/* Header — outside tabs, always visible */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Mark-to-Market</h2>
          {lastMtmCalculated && <StatusDot date={lastMtmCalculated} label="Último MTM" />}
          {lastMarketUpdate && <StatusDot date={lastMarketUpdate} label="Mercado" />}
        </div>
        <Button onClick={handleCalculate} disabled={calculating || !orders?.length}>
          <Calculator className={`mr-2 h-4 w-4 ${calculating ? 'animate-spin' : ''}`} />
          {calculating ? 'Calculando...' : 'Calcular MTM'}
        </Button>
      </div>

      <Tabs defaultValue="marcacao" className="w-full">
        <TabsList>
          <TabsTrigger value="marcacao">Marcação</TabsTrigger>
          <TabsTrigger value="resumo">Resumo</TabsTrigger>
        </TabsList>

        {/* TAB 1 — Marcação */}
        <TabsContent value="marcacao">
          {/* Filters */}
          <div className="space-y-2">
            <button
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setFiltersExpanded(v => !v)}
            >
              <Filter className="h-4 w-4" />
              Filtros
              {(filterWarehouse !== 'all' || filterCommodity !== 'all') && (
                <Badge variant="secondary" className="text-xs">ativo</Badge>
              )}
              <span className="text-xs">{filtersExpanded ? '▾' : '▸'}</span>
            </button>
            {filtersExpanded && (
              <div className="flex flex-wrap gap-4 items-end">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Praça</label>
                  <Select value={filterWarehouse} onValueChange={setFilterWarehouse}>
                    <SelectTrigger className="w-40 h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas</SelectItem>
                      {uniqueWarehouses.map(w => <SelectItem key={w} value={w}>{w}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Commodity</label>
                  <Select value={filterCommodity} onValueChange={setFilterCommodity}>
                    <SelectTrigger className="w-40 h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas</SelectItem>
                      <SelectItem value="soybean">Soja</SelectItem>
                      <SelectItem value="corn">Milho</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {(filterWarehouse !== 'all' || filterCommodity !== 'all') && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs"
                    onClick={() => { setFilterWarehouse('all'); setFilterCommodity('all'); }}
                  >
                    Limpar filtros
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* Results table */}
          {filteredResults && (
            <Card className="mt-4">
              <CardHeader><CardTitle className="text-sm">Resultado MTM</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Operação</TableHead>
                      <TableHead>Commodity</TableHead>
                      <TableHead>Praça</TableHead>
                      <TableHead>Entrada</TableHead>
                      <TableHead>Saída</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Por Saca</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredResults.map((r, i) => {
                      const matchedOrder = orders?.find(o => o.operation_id === r.operation_id);
                      const ps = matchedOrder?.operation?.pricing_snapshots;
                      const wName = matchedOrder?.operation?.warehouses?.display_name ?? '—';
                      const fmtDate = (d?: string | null) => d ? new Date(d + 'T12:00:00').toLocaleDateString('pt-BR') : '—';
                      const total = (r.mtm_total_brl as number) ?? 0;
                      return (
                        <TableRow key={i} className="cursor-pointer hover:bg-muted/50" onClick={() => setDetailResult(r)}>
                          <TableCell className="font-mono text-xs">{(r.operation_id as string)?.slice(0, 8)}</TableCell>
                          <TableCell>{matchedOrder?.commodity === 'soybean' ? 'Soja' : matchedOrder?.commodity === 'corn' ? 'Milho' : matchedOrder?.commodity ?? '—'}</TableCell>
                          <TableCell>{wName}</TableCell>
                          <TableCell>{fmtDate(ps?.trade_date)}</TableCell>
                          <TableCell>{fmtDate(ps?.sale_date)}</TableCell>
                          <TableCell className={`font-bold ${total >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            R$ {total.toFixed(2)}
                          </TableCell>
                          <TableCell>R$ {((r.mtm_per_sack_brl as number) ?? 0).toFixed(2)}/sc</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* Active operations table */}
          {loading ? (
            <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>
          ) : !orders?.length ? (
            <p className="text-center text-muted-foreground py-12">Nenhuma ordem executada encontrada.</p>
          ) : (
            <Card className="mt-4">
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
        </TabsContent>

        {/* TAB 2 — Resumo */}
        <TabsContent value="resumo">
          {!summary ? (
            <p className="text-center text-muted-foreground py-12">Calcule o MTM primeiro para ver o resumo.</p>
          ) : (
            <>
              {/* Summary cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardContent className="pt-6">
                    <p className="text-xs text-muted-foreground">Operações Ativas</p>
                    <p className="text-2xl font-bold">{results?.length ?? 0}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <p className="text-xs text-muted-foreground">Resultado Total</p>
                    <p className={`text-2xl font-bold ${summary.totalGeral >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      R$ {summary.totalGeral.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <p className="text-xs text-muted-foreground">Resultado por Saca</p>
                    <p className={`text-2xl font-bold ${summary.totalPerSack >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      R$ {summary.totalPerSack.toFixed(2)}/sc
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Breakdown table */}
              <Card className="mt-4">
                <CardHeader><CardTitle className="text-sm">Resultado por Perna (Consolidado)</CardTitle></CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Perna</TableHead>
                        <TableHead>Valor (R$)</TableHead>
                        <TableHead>% do Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {[
                        { label: 'Físico', value: summary.totalFisico },
                        { label: 'Futuros', value: summary.totalFuturos },
                        { label: 'NDF', value: summary.totalNdf },
                        { label: 'Opção', value: summary.totalOpcao },
                      ].map(({ label, value }) => (
                        <TableRow key={label}>
                          <TableCell>{label}</TableCell>
                          <TableCell className={`font-bold ${value >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            R$ {value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell>
                            {summary.totalGeral !== 0 ? `${((value / Math.abs(summary.totalGeral)) * 100).toFixed(1)}%` : '—'}
                          </TableCell>
                        </TableRow>
                      ))}
                      <TableRow>
                        <TableCell className="font-bold">Total</TableCell>
                        <TableCell className={`font-bold ${summary.totalGeral >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          R$ {summary.totalGeral.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell>100%</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {/* Chart */}
              <Card className="mt-4">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm">Gráfico de Resultado</CardTitle>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>Por perna</span>
                      <Switch checked={chartByOperation} onCheckedChange={setChartByOperation} />
                      <span>Por operação</span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    {!chartByOperation ? (
                      <BarChart data={chartDataConsolidated}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis tickFormatter={(v: number) => `R$${(v/1000).toFixed(0)}k`} />
                        <Tooltip formatter={(v: number) => [`R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, '']} />
                        <Bar dataKey="value">
                          {chartDataConsolidated.map((entry, index) => (
                            <Cell key={index} fill={entry.value >= 0 ? 'hsl(var(--primary))' : 'hsl(var(--destructive))'} />
                          ))}
                        </Bar>
                      </BarChart>
                    ) : (
                      <BarChart data={chartDataByOperation}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis tickFormatter={(v: number) => `R$${(v/1000).toFixed(0)}k`} />
                        <Tooltip formatter={(v: number) => [`R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, '']} />
                        <Bar dataKey="Físico" fill="hsl(var(--primary))" />
                        <Bar dataKey="Futuros" fill="hsl(var(--accent))" />
                        <Bar dataKey="NDF" fill="hsl(var(--muted))" />
                        <Bar dataKey="Opção" fill="hsl(var(--secondary))" />
                        <Bar dataKey="Total" fill="hsl(var(--destructive))" />
                      </BarChart>
                    )}
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>

      {/* Detail dialog — outside tabs */}
      {detailResult && (() => {
        const matchedOrder = orders?.find(o => o.operation_id === detailResult.operation_id);
        const ps = matchedOrder?.operation?.pricing_snapshots;
        const wName = matchedOrder?.operation?.warehouses?.display_name ?? '—';
        const fmtDate = (d?: string | null) => d ? new Date(d + 'T12:00:00').toLocaleDateString('pt-BR') : '—';
        const snap = detailResult.market_snapshot as Record<string, number | null> | null;

        const DetailRow = ({ label, value }: { label: string; value: string }) => (
          <div className="flex justify-between py-1">
            <span className="text-muted-foreground text-sm">{label}</span>
            <span className="text-sm font-medium">{value}</span>
          </div>
        );

        const fmtBrl = (v: unknown) => `R$ ${((v as number) ?? 0).toFixed(2)}`;
        const total = (detailResult.mtm_total_brl as number) ?? 0;

        return (
          <Dialog open onOpenChange={(o) => { if (!o) setDetailResult(null); }}>
            <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  MTM — {(detailResult.operation_id as string)?.slice(0, 8)} / {wName}
                </DialogTitle>
              </DialogHeader>

              <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">Identificação</p>
              <DetailRow label="Operação" value={(detailResult.operation_id as string)?.slice(0, 8) ?? '—'} />
              <DetailRow label="Commodity" value={matchedOrder?.commodity ?? '—'} />
              <DetailRow label="Volume" value={`${matchedOrder?.volume_sacks?.toLocaleString() ?? '—'} sc`} />

              <Separator />

              <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">Datas</p>
              <DetailRow label="Entrada" value={fmtDate(ps?.trade_date)} />
              <DetailRow label="Pagamento" value={fmtDate(ps?.payment_date)} />
              <DetailRow label="Recepção" value={fmtDate(ps?.grain_reception_date)} />
              <DetailRow label="Saída" value={fmtDate(ps?.sale_date)} />

              <Separator />

              <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">Snapshot de Mercado</p>
              <DetailRow label="Futuros (atual)" value={snap?.futures_price_current != null ? `USD ${snap.futures_price_current.toFixed(4)}/bu` : '—'} />
              <DetailRow label="Físico (atual)" value={fmtBrl(snap?.physical_price_current)} />
              <DetailRow label="Câmbio spot" value={snap?.spot_rate_current != null ? `R$ ${snap.spot_rate_current.toFixed(4)}` : '—'} />
              <DetailRow label="Prêmio opção" value={snap?.option_premium_current != null ? fmtBrl(snap.option_premium_current) : '—'} />

              <Separator />

              <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">Resultado MTM</p>
              <DetailRow label="Físico" value={fmtBrl(detailResult.mtm_physical_brl)} />
              <DetailRow label="Futuros" value={fmtBrl(detailResult.mtm_futures_brl)} />
              <DetailRow label="NDF" value={fmtBrl(detailResult.mtm_ndf_brl)} />
              <DetailRow label="Opção" value={fmtBrl(detailResult.mtm_option_brl)} />
              <div className="flex justify-between py-1">
                <span className="text-sm font-bold">Total</span>
                <span className={`text-sm font-bold ${total >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {fmtBrl(detailResult.mtm_total_brl)}
                </span>
              </div>
              <DetailRow label="Por Saca" value={`${fmtBrl(detailResult.mtm_per_sack_brl)}/sc`} />
              <DetailRow label="Exposição Total" value={fmtBrl(detailResult.total_exposure_brl)} />
            </DialogContent>
          </Dialog>
        );
      })()}
    </div>
  );
};

export default MTM;

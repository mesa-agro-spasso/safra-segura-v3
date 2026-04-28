import { useState, useMemo, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useHedgeOrders } from '@/hooks/useHedgeOrders';
import { useMarketData } from '@/hooks/useMarketData';
import { useMtmSnapshots, useSaveMtmSnapshot } from '@/hooks/useMtmSnapshots';
import { useAuth } from '@/contexts/AuthContext';
import { callApi } from '@/lib/api';
import { usePricingParameters } from '@/hooks/usePricingParameters';
import { useOperationsWithDetails } from '@/hooks/useOperations';
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
import type { OperationWithDetails } from '@/types';

type MtmResult = Record<string, unknown>;

const STATUS_BADGE: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive'; className?: string }> = {
  RASCUNHO: { label: 'Rascunho', variant: 'secondary' },
  SUBMETIDA: { label: 'Submetida', variant: 'outline' },
  EM_APROVACAO: { label: 'Em Aprovação', variant: 'outline', className: 'border-yellow-500 text-yellow-500' },
  APROVADA: { label: 'Aprovada', variant: 'outline', className: 'border-blue-500 text-blue-500' },
  HEDGE_CONFIRMADO: { label: 'Hedge Confirmado', variant: 'default' },
  ENCERRAMENTO_SOLICITADO: { label: 'Enc. Solicitado', variant: 'outline', className: 'border-orange-500 text-orange-500' },
  ENCERRAMENTO_APROVADO: { label: 'Enc. Aprovado', variant: 'outline', className: 'border-blue-500 text-blue-500' },
  MONITORAMENTO: { label: 'Monitoramento', variant: 'outline', className: 'border-green-500 text-green-500' },
  ENCERRADA: { label: 'Encerrada', variant: 'secondary' },
  CANCELADA: { label: 'Cancelada', variant: 'destructive' },
};

const fmtDate = (d?: string | null) =>
  d ? new Date(d + 'T12:00:00').toLocaleDateString('pt-BR') : '—';

const OperationsMTM = () => {
  // MTM hooks
  const { data: orders, isLoading: loadingOrders } = useHedgeOrders({ status: 'EXECUTED' });
  const { data: marketData } = useMarketData();
  const { data: mtmSnapshots } = useMtmSnapshots();
  const saveMtm = useSaveMtmSnapshot();
  const { user } = useAuth();
  const { data: pricingParameters } = usePricingParameters();
  const queryClient = useQueryClient();

  // Operations hooks
  const { data: operations, isLoading: loadingOperations } = useOperationsWithDetails();
  const { data: allOrders } = useHedgeOrders();

  // MTM state
  const [physicalPrices, setPhysicalPrices] = useState<Record<string, string>>(() => {
    try {
      const stored = sessionStorage.getItem('mtm_physical_prices');
      return stored ? JSON.parse(stored) : {};
    } catch { return {}; }
  });
  const [calculating, setCalculating] = useState(false);
  const [results, setResults] = useState<Record<string, unknown>[] | null>(null);
  const [detailResult, setDetailResult] = useState<Record<string, unknown> | null>(null);

  // Operations state
  const [selectedOperation, setSelectedOperation] = useState<OperationWithDetails | null>(null);

  // Filters state
  const [filterWarehouse, setFilterWarehouse] = useState('all');
  const [filterCommodity, setFilterCommodity] = useState('all');
  const [filterStatus, setFilterStatus] = useState<'active' | 'closed' | 'all'>('active');
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [chartByOperation, setChartByOperation] = useState(false);

  // Closing state
  const [closingOperation, setClosingOperation] = useState<OperationWithDetails | null>(null);
  const [closingLegs, setClosingLegs] = useState<any[]>([]);
  const [closingPhysicalPrice, setClosingPhysicalPrice] = useState('');
  const [closingPhysicalVolume, setClosingPhysicalVolume] = useState('');
  const [closingOriginationPrice, setClosingOriginationPrice] = useState('');
  const [closingSubmitting, setClosingSubmitting] = useState(false);

  // Detail dialog collapsible sections
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    identificacao: false,
    datas: false,
    mercado: false,
    entrada: false,
    custos: false,
    basis: false,
    resultado: false,
  });

  // Converted execution prices for "Preço de Entrada (Executado)" section
  const [convertedLegPrices, setConvertedLegPrices] = useState<{
    status: 'idle' | 'loading' | 'ready' | 'error';
    values: Record<number, number | null>;
    fxMissing: Record<number, boolean>;
  }>({ status: 'idle', values: {}, fxMissing: {} });
  const toggleSection = (key: string) =>
    setExpandedSections(v => ({ ...v, [key]: !v[key] }));

  // Convert executed leg prices (USD/bu → BRL/sc) when MTM detail dialog opens
  const matchedOrderForDetail = useMemo(() => {
    if (!detailResult) return null;
    return orders?.find(o => o.operation_id === detailResult.operation_id) ?? null;
  }, [detailResult, orders]);

  useEffect(() => {
    if (!detailResult || !matchedOrderForDetail) {
      setConvertedLegPrices({ status: 'idle', values: {}, fxMissing: {} });
      return;
    }

    const order: any = matchedOrderForDetail;
    const executed = order.executed_legs as any[] | null | undefined;
    const legsSource = (executed?.length ? executed : (order.legs as any[])) ?? [];

    const ndfLeg = legsSource.find((l: any) => l.leg_type === 'ndf');
    const fallbackFx = order.operation?.pricing_snapshots?.outputs_json?.exchange_rate;
    const exchangeRate = ndfLeg?.ndf_rate ?? fallbackFx ?? null;

    const isB3 = String(order.exchange ?? '').toLowerCase() === 'b3';

    // Build conversion tasks for futures (price) and option (premium) legs
    type Task = { idx: number; value: number };
    const tasks: Task[] = [];
    const fxMissing: Record<number, boolean> = {};
    const values: Record<number, number | null> = {};

    legsSource.forEach((leg: any, i: number) => {
      if (leg.leg_type === 'futures') {
        if (isB3) return; // already in BRL/sc — handled at render
        if (typeof leg.price !== 'number') return;
        if (exchangeRate == null) { fxMissing[i] = true; values[i] = null; return; }
        tasks.push({ idx: i, value: leg.price });
      } else if (leg.leg_type === 'option') {
        if (isB3) return;
        if (typeof leg.premium !== 'number') return;
        if (exchangeRate == null) { fxMissing[i] = true; values[i] = null; return; }
        tasks.push({ idx: i, value: leg.premium });
      }
    });

    if (tasks.length === 0) {
      setConvertedLegPrices({ status: 'ready', values, fxMissing });
      return;
    }

    let cancelled = false;
    setConvertedLegPrices({ status: 'loading', values: {}, fxMissing: {} });

    (async () => {
      try {
        const results = await Promise.all(tasks.map(async (t) => {
          const { data, error } = await supabase.functions.invoke('api-proxy', {
            body: {
              endpoint: '/utils/convert-price',
              body: {
                value: t.value,
                from_unit: 'usd_per_bushel',
                to_unit: 'brl_per_sack',
                commodity: order.commodity === 'soybean' ? 'soybean' : 'corn',
                exchange_rate: exchangeRate,
              },
            },
          });
          if (error) throw new Error(error.message);
          if (data?.error) throw new Error(data.error);
          return { idx: t.idx, value: (data?.value_converted ?? data?.converted ?? data?.value) as number };
        }));
        if (cancelled) return;
        const finalValues = { ...values };
        results.forEach(r => { finalValues[r.idx] = r.value; });
        setConvertedLegPrices({ status: 'ready', values: finalValues, fxMissing });
      } catch (e) {
        if (cancelled) return;
        setConvertedLegPrices({ status: 'error', values: {}, fxMissing: {} });
        toast.error('Erro ao converter preços de entrada');
      }
    })();

    return () => { cancelled = true; };
  }, [detailResult, matchedOrderForDetail?.id]);

  // Derived data
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

  const ordersForSelectedOperation = useMemo(() => {
    if (!selectedOperation || !allOrders) return [];
    return allOrders.filter(o => o.operation_id === selectedOperation.id);
  }, [selectedOperation, allOrders]);

  const filteredOperations = useMemo(() => {
    if (!operations) return [];
    const STATUS_ORDER: Record<string, number> = {
      ENCERRAMENTO_APROVADO: 1,
      ENCERRAMENTO_SOLICITADO: 2,
      HEDGE_CONFIRMADO: 3,
      APROVADA: 4,
      EM_APROVACAO: 5,
      SUBMETIDA: 6,
      RASCUNHO: 7,
      ENCERRADA: 98,
      CANCELADA: 99,
      REPROVADA: 99,
    };
    const filtered = filterStatus === 'active'
      ? operations.filter(op => !['ENCERRADA', 'CANCELADA', 'REPROVADA'].includes(op.status))
      : filterStatus === 'closed'
      ? operations.filter(op => op.status === 'ENCERRADA')
      : operations;
    return [...filtered].sort((a, b) => {
      const orderA = STATUS_ORDER[a.status] ?? 50;
      const orderB = STATUS_ORDER[b.status] ?? 50;
      if (orderA !== orderB) return orderA - orderB;
      return new Date(b.created_at ?? '').getTime() - new Date(a.created_at ?? '').getTime();
    });
  }, [operations, filterStatus]);

  // Snapshot-based results (loaded from DB when no fresh calculation exists)
  const snapshotResults = useMemo(() => {
    if (!mtmSnapshots?.length || !orders?.length) return null;
    const latestByOperation: Record<string, typeof mtmSnapshots[0]> = {};
    for (const snap of mtmSnapshots) {
      if (!latestByOperation[snap.operation_id]) {
        latestByOperation[snap.operation_id] = snap;
      }
    }
    return Object.values(latestByOperation).map(snap => ({
      operation_id: snap.operation_id,
      mtm_physical_brl: snap.mtm_physical_brl,
      mtm_futures_brl: snap.mtm_futures_brl,
      mtm_ndf_brl: snap.mtm_ndf_brl,
      mtm_option_brl: snap.mtm_option_brl,
      mtm_total_brl: snap.mtm_total_brl,
      mtm_per_sack_brl: snap.mtm_per_sack_brl,
      total_exposure_brl: snap.total_exposure_brl,
      volume_sacks: snap.volume_sacks,
      calculated_at: snap.calculated_at,
      market_snapshot: {
        futures_price_current: snap.futures_price_current,
        physical_price_current: snap.physical_price_current,
        spot_rate_current: snap.spot_rate_current,
        option_premium_current: null,
      },
    }));
  }, [mtmSnapshots, orders]);

  const displayResults: MtmResult[] | null = results ?? (snapshotResults as MtmResult[] | null);

  const filteredResults = useMemo(() => {
    if (!displayResults) return displayResults;
    return displayResults.filter(r => {
      const matchedOrder = orders?.find(o => o.operation_id === r.operation_id);
      if (filterWarehouse !== 'all' && matchedOrder?.operation?.warehouses?.display_name !== filterWarehouse) return false;
      if (filterCommodity !== 'all' && matchedOrder?.commodity !== filterCommodity) return false;
      return true;
    });
  }, [displayResults, orders, filterWarehouse, filterCommodity]);

  const summary = useMemo(() => {
    if (!displayResults?.length) return null;
    const totalFisico = displayResults.reduce((s, r) => s + ((r.mtm_physical_brl as number) ?? 0), 0);
    const totalFuturos = displayResults.reduce((s, r) => s + ((r.mtm_futures_brl as number) ?? 0), 0);
    const totalNdf = displayResults.reduce((s, r) => s + ((r.mtm_ndf_brl as number) ?? 0), 0);
    const totalOpcao = displayResults.reduce((s, r) => s + ((r.mtm_option_brl as number) ?? 0), 0);
    const totalGeral = displayResults.reduce((s, r) => s + ((r.mtm_total_brl as number) ?? 0), 0);
    const totalVolume = displayResults.reduce((s, r) => s + ((r.volume_sacks as number) ?? 0), 0);
    const totalPerSack = totalVolume > 0 ? totalGeral / totalVolume : 0;
    return { totalFisico, totalFuturos, totalNdf, totalOpcao, totalGeral, totalVolume, totalPerSack };
  }, [displayResults]);

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
    if (!displayResults?.length) return [];
    return displayResults.map(r => {
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
  }, [displayResults, orders]);

  const targetProfitSoybean = pricingParameters?.find(p => p.id === 'soybean_cbot')?.target_profit_brl_per_sack ?? 2.0;
  const targetProfitCorn = pricingParameters?.find(p => p.id === 'corn_b3')?.target_profit_brl_per_sack ?? 2.0;
  const executionSpread = pricingParameters?.[0]?.execution_spread_pct ?? 0.05;

  const getTargetProfit = (r: Record<string, unknown>) => {
    const matchedOrder = orders?.find(o => o.operation_id === r.operation_id);
    return matchedOrder?.commodity === 'soybean' ? targetProfitSoybean : targetProfitCorn;
  };

  const calcBreakeven = (r: Record<string, unknown>) => {
    const operationId = r.operation_id as string;
    const physicalCurrent = parseFloat(physicalPrices[operationId] || '0');
    const mtmPerSack = (r.mtm_per_sack_brl as number) ?? 0;
    return (physicalCurrent - mtmPerSack) * (1 + executionSpread);
  };

  const calcTargetPhysical = (r: Record<string, unknown>) => {
    const operationId = r.operation_id as string;
    const physicalCurrent = parseFloat(physicalPrices[operationId] || '0');
    const mtmPerSack = (r.mtm_per_sack_brl as number) ?? 0;
    return (physicalCurrent - mtmPerSack + getTargetProfit(r)) * (1 + executionSpread);
  };

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

  const handleRequestClosing = async (operationId: string) => {
    try {
      await callApi(`/closing/${operationId}/request`, {
        notes: null,
        created_by: user?.id ?? null,
      });
      toast.success('Encerramento solicitado. Aguardando assinaturas.');
      queryClient.invalidateQueries({ queryKey: ['operations_with_details'] });
      queryClient.invalidateQueries({ queryKey: ['operations'] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao solicitar encerramento');
    }
  };

  const handleOpenClosingModal = async (op: OperationWithDetails) => {
    setClosingOperation(op);
    setClosingPhysicalPrice('');
    setClosingPhysicalVolume(String(op.volume_sacks));
    const ps = op.pricing_snapshots;
    setClosingOriginationPrice(ps?.origination_price_brl ? String(ps.origination_price_brl) : '');
    try {
      const { data } = await (supabase as any)
        .from('closing_orders')
        .select('legs')
        .eq('operation_id', op.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      setClosingLegs((data?.legs as any[]) ?? []);
    } catch {
      setClosingLegs([]);
    }
  };

  const handleExecuteClosing = async () => {
    if (!closingOperation || !user) return;
    setClosingSubmitting(true);
    try {
      await callApi(`/closing/${closingOperation.id}/execute`, {
        physical_price_brl: parseFloat(closingPhysicalPrice),
        physical_volume_sacks: parseFloat(closingPhysicalVolume),
        origination_price_brl: parseFloat(closingOriginationPrice),
        executed_legs: closingLegs,
        insurance_cost_brl: 0,
        executed_by: user.id,
      });
      toast.success('Operação encerrada com sucesso.');
      setClosingOperation(null);
      queryClient.invalidateQueries({ queryKey: ['operations_with_details'] });
      queryClient.invalidateQueries({ queryKey: ['operations'] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao encerrar operação');
    } finally {
      setClosingSubmitting(false);
    }
  };

  const StatusDot = ({ date, label }: { date: string; label: string }) => {
    const d = new Date(date);
    const hoursAgo = Math.floor((Date.now() - d.getTime()) / 3_600_000);
    const color = hoursAgo < 12 ? 'text-green-400' : hoursAgo < 24 ? 'text-yellow-400' : 'text-red-400';
    const timeLabel = `${label}: ${d.toLocaleDateString('pt-BR')} ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}${hoursAgo >= 12 ? ` (${hoursAgo}h atrás)` : ''}`;
    return <p className={`text-xs ${color}`}>● {timeLabel}</p>;
  };

  const DetailRow = ({ label, value }: { label: string; value: string }) => (
    <div className="flex justify-between py-1">
      <span className="text-muted-foreground text-sm">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Header — outside tabs */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Operações / MTM</h2>
          {lastMtmCalculated && <StatusDot date={lastMtmCalculated} label="Último MTM" />}
          {lastMarketUpdate && <StatusDot date={lastMarketUpdate} label="Mercado" />}
        </div>
      </div>

      <Tabs defaultValue="operacoes" className="w-full">
        <TabsList>
          <TabsTrigger value="operacoes">Operações</TabsTrigger>
          <TabsTrigger value="mtm">MTM</TabsTrigger>
          <TabsTrigger value="resumo">Resumo</TabsTrigger>
        </TabsList>

        {/* TAB 1 — Operações */}
        <TabsContent value="operacoes">
          {loadingOperations ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : !operations?.length ? (
            <p className="text-muted-foreground text-center py-12">Nenhuma operação encontrada.</p>
          ) : (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">Todas as Operações</CardTitle>
                  <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as 'active' | 'closed' | 'all')}>
                    <SelectTrigger className="w-32 h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Ativas</SelectItem>
                      <SelectItem value="closed">Encerradas</SelectItem>
                      <SelectItem value="all">Todas</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Praça</TableHead>
                      <TableHead>Commodity</TableHead>
                      <TableHead>Ticker</TableHead>
                      <TableHead>Volume</TableHead>
                      <TableHead>Preço Orig.</TableHead>
                      <TableHead>Entrada</TableHead>
                      <TableHead>Pagamento</TableHead>
                      <TableHead>Recepção</TableHead>
                      <TableHead>Saída</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredOperations.map((op) => {
                      const ps = op.pricing_snapshots;
                      const badge = STATUS_BADGE[op.status] ?? { label: op.status, variant: 'secondary' as const };
                      return (
                        <TableRow key={op.id} className="cursor-pointer" onClick={() => setSelectedOperation(op)}>
                          <TableCell>{op.warehouses?.display_name ?? '—'}</TableCell>
                          <TableCell>{op.commodity === 'soybean' ? 'Soja' : 'Milho'}</TableCell>
                          <TableCell>{ps?.ticker ?? '—'}</TableCell>
                          <TableCell>{op.volume_sacks.toLocaleString('pt-BR')} sc</TableCell>
                          <TableCell>{ps ? `R$ ${ps.origination_price_brl.toFixed(2)}` : '—'}</TableCell>
                          <TableCell>{fmtDate(ps?.trade_date)}</TableCell>
                          <TableCell>{fmtDate(ps?.payment_date)}</TableCell>
                          <TableCell>{fmtDate(ps?.grain_reception_date)}</TableCell>
                          <TableCell>{fmtDate(ps?.sale_date)}</TableCell>
                          <TableCell>
                            <Badge variant={badge.variant} className={badge.className}>
                              {badge.label}
                            </Badge>
                          </TableCell>
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            {op.status === 'HEDGE_CONFIRMADO' && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs"
                                onClick={() => handleRequestClosing(op.id)}
                              >
                                Solicitar Encerramento
                              </Button>
                            )}
                            {op.status === 'ENCERRAMENTO_APROVADO' && (
                              <Button
                                size="sm"
                                variant="default"
                                className="h-7 text-xs"
                                onClick={() => handleOpenClosingModal(op)}
                              >
                                Confirmar Encerramento
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* TAB 2 — MTM (merged marcação + resultado) */}
        <TabsContent value="mtm" className="space-y-4">
          {/* Results section — always first, always visible if data exists */}
          {filteredResults && filteredResults.length > 0 ? (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">Resultado MTM</CardTitle>
                  <button
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    onClick={() => setFiltersExpanded(v => !v)}
                  >
                    <Filter className="h-3.5 w-3.5" />
                    <span>Filtros</span>
                    {(filterWarehouse !== 'all' || filterCommodity !== 'all') && (
                      <span className="bg-primary/20 text-primary text-[10px] px-1.5 rounded-full font-medium">ativo</span>
                    )}
                    <span>{filtersExpanded ? '▾' : '▸'}</span>
                  </button>
                </div>
                {filtersExpanded && (
                  <div className="flex flex-wrap gap-3 mt-2">
                    <div className="space-y-1">
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Praça</span>
                      <Select value={filterWarehouse} onValueChange={setFilterWarehouse}>
                        <SelectTrigger className="w-40 h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todas</SelectItem>
                          {uniqueWarehouses.map(w => <SelectItem key={w} value={w}>{w}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Commodity</span>
                      <Select value={filterCommodity} onValueChange={setFilterCommodity}>
                        <SelectTrigger className="w-36 h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todas</SelectItem>
                          <SelectItem value="soybean">Soja</SelectItem>
                          <SelectItem value="corn">Milho</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {(filterWarehouse !== 'all' || filterCommodity !== 'all') && (
                      <div className="flex items-end">
                        <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => { setFilterWarehouse('all'); setFilterCommodity('all'); }}>
                          Limpar filtros
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </CardHeader>
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
                      <TableHead>Break-even</TableHead>
                      <TableHead>Físico Alvo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredResults.map((r, i) => {
                      const matchedOrder = orders?.find(o => o.operation_id === r.operation_id);
                      const ps = matchedOrder?.operation?.pricing_snapshots;
                      const wName = matchedOrder?.operation?.warehouses?.display_name ?? '—';
                      const total = (r.mtm_total_brl as number) ?? 0;
                      return (
                        <TableRow key={i} className="cursor-pointer hover:bg-muted/50" onClick={() => setDetailResult(r)}>
                          <TableCell className="font-mono text-xs">{(r.operation_id as string)?.slice(0, 8)}</TableCell>
                          <TableCell>{matchedOrder?.commodity === 'soybean' ? 'Soja' : matchedOrder?.commodity === 'corn' ? 'Milho' : '—'}</TableCell>
                          <TableCell>{wName}</TableCell>
                          <TableCell>{fmtDate(ps?.trade_date)}</TableCell>
                          <TableCell>{fmtDate(ps?.sale_date)}</TableCell>
                          <TableCell className={`font-bold ${total >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            R$ {total.toFixed(2)}
                          </TableCell>
                          <TableCell>R$ {((r.mtm_per_sack_brl as number) ?? 0).toFixed(2)}/sc</TableCell>
                          <TableCell className="text-xs tabular-nums">
                            R$ {calcBreakeven(r).toFixed(2)}/sc
                          </TableCell>
                          <TableCell className="text-xs tabular-nums">
                            R$ {calcTargetPhysical(r).toFixed(2)}/sc
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ) : (
            <p className="text-center text-muted-foreground py-8 text-sm">Nenhum resultado disponível.</p>
          )}

          {/* Active operations + calculate button — below results */}
          {loadingOrders ? (
            <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>
          ) : orders?.length ? (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">Operações Ativas</CardTitle>
                  <Button onClick={handleCalculate} disabled={calculating || !orders?.length} size="sm">
                    <Calculator className={`mr-2 h-4 w-4 ${calculating ? 'animate-spin' : ''}`} />
                    {calculating ? 'Calculando...' : 'Calcular MTM'}
                  </Button>
                </div>
              </CardHeader>
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
          ) : null}
        </TabsContent>

        {/* TAB 3 — Resumo */}
        <TabsContent value="resumo">
          {!summary ? (
            <p className="text-center text-muted-foreground py-12">Calcule o MTM primeiro para ver o resumo.</p>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardContent className="pt-6">
                    <p className="text-xs text-muted-foreground">Operações Ativas</p>
                    <p className="text-2xl font-bold">{displayResults?.length ?? 0}</p>
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

      {/* MTM Detail dialog — outside tabs */}
      {detailResult && (() => {
        const matchedOrder = orders?.find(o => o.operation_id === detailResult.operation_id);
        const ps = matchedOrder?.operation?.pricing_snapshots;
        const wName = matchedOrder?.operation?.warehouses?.display_name ?? '—';
        const snap = detailResult.market_snapshot as Record<string, number | null> | null;
        const fmtBrl = (v: unknown) => `R$ ${((v as number) ?? 0).toFixed(2)}`;
        const total = (detailResult.mtm_total_brl as number) ?? 0;

        const outputsJson = (ps?.outputs_json as Record<string, any>) ?? {};
        const costs = (outputsJson.costs as Record<string, any>) ?? {};
        const engineResult = (outputsJson.engine_result as Record<string, any>) ?? {};
        const fmt4 = (v: unknown) => typeof v === 'number' ? `R$ ${v.toFixed(4)}/sc` : '—';

        const CollapsibleSection = ({ sectionKey, label, children }: { sectionKey: string; label: string; children: React.ReactNode }) => (
          <>
            <Separator />
            <button
              type="button"
              className="flex items-center justify-between w-full py-1"
              onClick={() => toggleSection(sectionKey)}
            >
              <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">{label}</p>
              <span className="text-xs text-muted-foreground">{expandedSections[sectionKey] ? '▾' : '▸'}</span>
            </button>
            {expandedSections[sectionKey] && <>{children}</>}
          </>
        );

        return (
          <Dialog open onOpenChange={(o) => { if (!o) setDetailResult(null); }}>
            <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  MTM — {(detailResult.operation_id as string)?.slice(0, 8)} / {wName}
                </DialogTitle>
              </DialogHeader>

              <CollapsibleSection sectionKey="identificacao" label="Identificação">
                <DetailRow label="Operação" value={(detailResult.operation_id as string)?.slice(0, 8) ?? '—'} />
                <DetailRow label="Commodity" value={matchedOrder?.commodity ?? '—'} />
                <DetailRow label="Volume" value={`${matchedOrder?.volume_sacks?.toLocaleString() ?? '—'} sc`} />
              </CollapsibleSection>

              <CollapsibleSection sectionKey="datas" label="Datas">
                <DetailRow label="Entrada" value={fmtDate(ps?.trade_date)} />
                <DetailRow label="Pagamento" value={fmtDate(ps?.payment_date)} />
                <DetailRow label="Recepção" value={fmtDate(ps?.grain_reception_date)} />
                <DetailRow label="Saída" value={fmtDate(ps?.sale_date)} />
              </CollapsibleSection>

              <CollapsibleSection sectionKey="mercado" label="Snapshot de Mercado">
                <DetailRow label="Futuros (atual)" value={snap?.futures_price_current != null ? `USD ${snap.futures_price_current.toFixed(4)}/bu` : '—'} />
                <DetailRow label="Físico (atual)" value={fmtBrl(snap?.physical_price_current)} />
                <DetailRow label="Câmbio spot" value={snap?.spot_rate_current != null ? `R$ ${snap.spot_rate_current.toFixed(4)}` : '—'} />
                <DetailRow label="Prêmio opção" value={snap?.option_premium_current != null ? fmtBrl(snap.option_premium_current) : '—'} />
              </CollapsibleSection>

              <CollapsibleSection sectionKey="entrada" label="Preço de Entrada (Executado)">
                {(() => {
                  const order: any = matchedOrder;
                  const executed = order?.executed_legs as any[] | null | undefined;
                  const legsSource = (executed?.length ? executed : (order?.legs as any[])) ?? [];
                  const isFallback = !(executed && executed.length > 0);
                  const isB3 = String(order?.exchange ?? '').toLowerCase() === 'b3';
                  const validLegs = legsSource.filter((l: any) => ['futures', 'option', 'ndf'].includes(l.leg_type));

                  if (validLegs.length === 0) {
                    return <p className="text-sm text-muted-foreground">Nenhuma perna de hedge encontrada</p>;
                  }

                  const fmtMoney = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(v);
                  const fmtCt = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                  const fmtVol = (v: number) => v.toLocaleString('pt-BR', { maximumFractionDigits: 2 });

                  let anyFallback = false;
                  let anyFxMissing = false;

                  const buildSuffix = (i: number, isNdf: boolean) => {
                    const fb = isFallback;
                    const fx = !isNdf && !!convertedLegPrices.fxMissing[i];
                    if (fb) anyFallback = true;
                    if (fx) anyFxMissing = true;
                    const marks = [fb && '*', fx && '**'].filter(Boolean);
                    return marks.length ? ` ${marks.join(',')}` : '';
                  };

                  const rendered = legsSource.map((leg: any, i: number) => {
                    if (!['futures', 'option', 'ndf'].includes(leg.leg_type)) return null;

                    if (leg.leg_type === 'futures') {
                      const suffix = buildSuffix(i, false);
                      let priceLabel: string;
                      if (isB3) {
                        priceLabel = typeof leg.price === 'number' ? `${fmtMoney(leg.price)}/sc` : '—';
                      } else if (convertedLegPrices.fxMissing[i]) {
                        priceLabel = 'R$ —/sc';
                      } else if (convertedLegPrices.status === 'loading') {
                        priceLabel = 'carregando...';
                      } else if (convertedLegPrices.status === 'error') {
                        priceLabel = 'erro';
                      } else if (convertedLegPrices.status === 'ready' && convertedLegPrices.values[i] != null) {
                        priceLabel = `${fmtMoney(convertedLegPrices.values[i] as number)}/sc`;
                      } else {
                        priceLabel = '—';
                      }
                      return (
                        <div key={i} className="flex justify-between py-1">
                          <span className="text-muted-foreground text-sm">
                            Futuro {leg.ticker ?? '—'} · {leg.direction ?? '—'} · {fmtCt(Number(leg.contracts ?? 0))} ct
                          </span>
                          <span className="text-sm font-medium">{priceLabel}{suffix}</span>
                        </div>
                      );
                    }

                    if (leg.leg_type === 'option') {
                      const suffix = buildSuffix(i, false);
                      const optType = String(leg.option_type ?? '').toLowerCase() === 'put' ? 'Put' : 'Call';
                      const strikeLabel = isB3
                        ? (typeof leg.strike === 'number' ? fmtMoney(leg.strike) : '—')
                        : (typeof leg.strike === 'number' ? `USD ${leg.strike.toFixed(4)}/bu` : '—');
                      let premiumLabel: string;
                      if (isB3) {
                        premiumLabel = typeof leg.premium === 'number' ? `${fmtMoney(leg.premium)}/sc` : '—';
                      } else if (convertedLegPrices.fxMissing[i]) {
                        premiumLabel = 'R$ —/sc';
                      } else if (convertedLegPrices.status === 'loading') {
                        premiumLabel = 'carregando...';
                      } else if (convertedLegPrices.status === 'error') {
                        premiumLabel = 'erro';
                      } else if (convertedLegPrices.status === 'ready' && convertedLegPrices.values[i] != null) {
                        premiumLabel = `${fmtMoney(convertedLegPrices.values[i] as number)}/sc`;
                      } else {
                        premiumLabel = '—';
                      }
                      return (
                        <div key={i} className="flex justify-between py-1">
                          <span className="text-muted-foreground text-sm">
                            Opção {optType} K={strikeLabel} · {leg.direction ?? '—'} · {fmtCt(Number(leg.contracts ?? 0))} ct
                          </span>
                          <span className="text-sm font-medium">{premiumLabel}{suffix}</span>
                        </div>
                      );
                    }

                    // ndf
                    const suffix = buildSuffix(i, true);
                    return (
                      <div key={i} className="flex justify-between py-1">
                        <span className="text-muted-foreground text-sm">
                          Câmbio NDF · {leg.direction ?? '—'} · USD {fmtVol(Number(leg.volume_units ?? 0))}
                        </span>
                        <span className="text-sm font-medium">
                          {typeof leg.ndf_rate === 'number' ? fmtMoney(leg.ndf_rate) : '—'}{suffix}
                        </span>
                      </div>
                    );
                  });

                  return (
                    <>
                      {rendered}
                      {anyFallback && (
                        <p className="text-xs text-muted-foreground mt-2">* Preço da precificação original — ordem sem execução registrada</p>
                      )}
                      {anyFxMissing && (
                        <p className="text-xs text-muted-foreground mt-1">** Câmbio não disponível para conversão</p>
                      )}
                    </>
                  );
                })()}
              </CollapsibleSection>

              <CollapsibleSection sectionKey="custos" label="Custos de Originação">
                <DetailRow label="Financeiro" value={fmt4(costs.financial_brl ?? costs.financeiro_brl ?? costs.financial)} />
                <DetailRow label="Armazenagem" value={fmt4(costs.storage_brl ?? costs.armazenagem_brl ?? costs.storage)} />
                <DetailRow label="Corretagem" value={fmt4(costs.brokerage_brl ?? costs.corretagem_brl ?? costs.brokerage)} />
                <DetailRow label="Custo de mesa" value={fmt4(costs.desk_cost_brl ?? costs.desk_brl ?? costs.desk)} />
                <DetailRow label="Total" value={fmt4(costs.total_brl ?? costs.total)} />
              </CollapsibleSection>

              <CollapsibleSection sectionKey="basis" label="Basis">
                <DetailRow label="Target basis" value={fmt4(engineResult.target_basis ?? engineResult.target_basis_brl)} />
                <DetailRow label="Purchased basis" value={fmt4(engineResult.purchased_basis ?? engineResult.purchased_basis_brl)} />
                <DetailRow label="Breakeven basis" value={fmt4(engineResult.breakeven_basis ?? engineResult.breakeven_basis_brl)} />
              </CollapsibleSection>

              <CollapsibleSection sectionKey="resultado" label="Resultado MTM">
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
                <DetailRow label="Break-even físico" value={`R$ ${calcBreakeven(detailResult).toFixed(2)}/sc`} />
                <DetailRow label="Físico alvo" value={`R$ ${calcTargetPhysical(detailResult).toFixed(2)}/sc`} />
                <DetailRow label="Exposição Total" value={fmtBrl(detailResult.total_exposure_brl)} />
              </CollapsibleSection>
            </DialogContent>
          </Dialog>
        );
      })()}

      {/* Operations Detail dialog — outside tabs (tabbed) */}
      {selectedOperation && (() => {
        const ps = selectedOperation.pricing_snapshots;
        const opMtmSnapshot = mtmSnapshots?.find(s => s.operation_id === selectedOperation.id);
        const fmtBrl = (v: unknown) => `R$ ${((v as number) ?? 0).toFixed(2)}`;

        return (
          <Dialog open={!!selectedOperation} onOpenChange={(o) => { if (!o) setSelectedOperation(null); }}>
            <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {selectedOperation.warehouses?.display_name ?? '—'} — {selectedOperation.id.slice(0, 8)}
                </DialogTitle>
              </DialogHeader>
              <Tabs defaultValue="detalhes">
                <TabsList>
                  <TabsTrigger value="detalhes">Detalhes</TabsTrigger>
                  <TabsTrigger value="mtm_op">MTM</TabsTrigger>
                </TabsList>
                <TabsContent value="detalhes" className="space-y-2 mt-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Identificação</p>
                  <DetailRow label="Commodity" value={selectedOperation.commodity === 'soybean' ? 'Soja' : 'Milho'} />
                  <DetailRow label="Volume" value={`${selectedOperation.volume_sacks.toLocaleString('pt-BR')} sc`} />
                  <DetailRow label="Status" value={STATUS_BADGE[selectedOperation.status]?.label ?? selectedOperation.status} />
                  <DetailRow label="Criada em" value={fmtDate(selectedOperation.created_at?.slice(0, 10))} />
                  {selectedOperation.notes && <DetailRow label="Notas" value={selectedOperation.notes} />}
                  <Separator />
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Precificação</p>
                  <DetailRow label="Ticker" value={ps?.ticker ?? '—'} />
                  <DetailRow label="Preço Originação" value={ps ? `R$ ${ps.origination_price_brl.toFixed(2)}` : '—'} />
                  <DetailRow label="Preço Futuros (BRL)" value={ps ? `R$ ${ps.futures_price_brl.toFixed(2)}` : '—'} />
                  <DetailRow label="Câmbio" value={ps?.exchange_rate != null ? ps.exchange_rate.toFixed(4) : '—'} />
                  <Separator />
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Datas</p>
                  <DetailRow label="Entrada" value={fmtDate(ps?.trade_date)} />
                  <DetailRow label="Pagamento" value={fmtDate(ps?.payment_date)} />
                  <DetailRow label="Recepção" value={fmtDate(ps?.grain_reception_date)} />
                  <DetailRow label="Saída" value={fmtDate(ps?.sale_date)} />
                  {ordersForSelectedOperation.length > 0 && (
                    <>
                      <Separator />
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Ordens Vinculadas ({ordersForSelectedOperation.length})
                      </p>
                      {ordersForSelectedOperation.map((o) => (
                        <div key={o.id} className="rounded-md border p-3 space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">{o.display_code ?? o.id.slice(0, 8)}</span>
                            <Badge variant="outline">{o.status}</Badge>
                          </div>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <span>{(o.legs as any[])?.length ?? 0} pernas</span>
                            <span>{o.volume_sacks.toLocaleString('pt-BR')} sc</span>
                          </div>
                        </div>
                      ))}
                    </>
                  )}
                </TabsContent>
                <TabsContent value="mtm_op" className="space-y-2 mt-2">
                  {!opMtmSnapshot ? (
                    <p className="text-center text-muted-foreground py-8 text-sm">Nenhum MTM calculado para esta operação.</p>
                  ) : (
                    <>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Snapshot de Mercado</p>
                      <DetailRow label="Futuros (atual)" value={`USD ${opMtmSnapshot.futures_price_current?.toFixed(4) ?? '—'}/bu`} />
                      <DetailRow label="Físico (atual)" value={fmtBrl(opMtmSnapshot.physical_price_current)} />
                      <DetailRow label="Câmbio spot" value={opMtmSnapshot.spot_rate_current != null ? `R$ ${opMtmSnapshot.spot_rate_current.toFixed(4)}` : '—'} />
                      <DetailRow label="Data cálculo" value={fmtDate(opMtmSnapshot.calculated_at?.slice(0, 10))} />
                      <Separator />
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Resultado MTM</p>
                      <DetailRow label="Físico" value={fmtBrl(opMtmSnapshot.mtm_physical_brl)} />
                      <DetailRow label="Futuros" value={fmtBrl(opMtmSnapshot.mtm_futures_brl)} />
                      <DetailRow label="NDF" value={fmtBrl(opMtmSnapshot.mtm_ndf_brl)} />
                      <DetailRow label="Opção" value={fmtBrl(opMtmSnapshot.mtm_option_brl)} />
                      <div className="flex justify-between py-1">
                        <span className="text-sm font-bold">Total</span>
                        <span className={`text-sm font-bold ${(opMtmSnapshot.mtm_total_brl ?? 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {fmtBrl(opMtmSnapshot.mtm_total_brl)}
                        </span>
                      </div>
                      <DetailRow label="Por Saca" value={`${fmtBrl(opMtmSnapshot.mtm_per_sack_brl)}/sc`} />
                      <DetailRow label="Exposição Total" value={fmtBrl(opMtmSnapshot.total_exposure_brl)} />
                    </>
                  )}
                </TabsContent>
              </Tabs>
            </DialogContent>
          </Dialog>
        );
      })()}

      {/* Closing modal */}
      {closingOperation && (
        <Dialog open onOpenChange={(o) => { if (!o) setClosingOperation(null); }}>
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                Confirmar Encerramento — {closingOperation.warehouses?.display_name ?? '—'}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">Preço Físico Venda (R$/sc)</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={closingPhysicalPrice}
                    onChange={(e) => setClosingPhysicalPrice(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Volume Vendido (sacas)</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={closingPhysicalVolume}
                    onChange={(e) => setClosingPhysicalVolume(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-muted-foreground">Preço Originação (R$/sc)</label>
                <Input
                  type="number"
                  step="0.01"
                  value={closingOriginationPrice}
                  onChange={(e) => setClosingOriginationPrice(e.target.value)}
                />
              </div>

              {closingLegs.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Pernas de Encerramento
                  </p>
                  {closingLegs.map((leg: any, i: number) => (
                    <div key={i} className="border rounded p-2 space-y-1">
                      <p className="text-xs font-medium">{leg.leg_type} · {leg.direction}</p>
                      {leg.leg_type === 'ndf' ? (
                        <div>
                          <label className="text-xs text-muted-foreground">Taxa NDF (BRL/USD)</label>
                          <Input
                            type="number"
                            step="0.0001"
                            value={leg.ndf_rate ?? ''}
                            onChange={(e) => {
                              const updated = [...closingLegs];
                              updated[i] = { ...updated[i], ndf_rate: parseFloat(e.target.value) || null };
                              setClosingLegs(updated);
                            }}
                          />
                        </div>
                      ) : (
                        <div>
                          <label className="text-xs text-muted-foreground">
                            Preço {leg.currency === 'USD' ? '(USD/bu)' : '(R$/sc)'}
                          </label>
                          <Input
                            type="number"
                            step="0.0001"
                            value={leg.price ?? ''}
                            onChange={(e) => {
                              const updated = [...closingLegs];
                              updated[i] = { ...updated[i], price: parseFloat(e.target.value) || null };
                              setClosingLegs(updated);
                            }}
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => setClosingOperation(null)} disabled={closingSubmitting}>
                Cancelar
              </Button>
              <Button onClick={handleExecuteClosing} disabled={closingSubmitting}>
                {closingSubmitting ? 'Encerrando...' : 'Confirmar Encerramento'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

export default OperationsMTM;

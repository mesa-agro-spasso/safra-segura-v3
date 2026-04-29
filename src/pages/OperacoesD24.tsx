import React, { useState, useMemo, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOperations, useOperationsWithDetails } from '@/hooks/useOperations';
import { useHedgeOrders } from '@/hooks/useHedgeOrders';
import { useMtmSnapshots, useSaveMtmSnapshot } from '@/hooks/useMtmSnapshots';
import { useMarketData } from '@/hooks/useMarketData';
import { usePricingParameters } from '@/hooks/usePricingParameters';
import { useActiveArmazens } from '@/hooks/useWarehouses';
import { useAuth } from '@/contexts/AuthContext';
import { usePricingSnapshots } from '@/hooks/usePricingSnapshots';
import { callApi } from '@/lib/api';
import {
  buildHedgePlan,
  allocateClosingBatch,
  type BuildHedgePlanResponse,
} from '@/services/d24Api';
import type {
  OperationIn,
  HedgePlanItemIn,
  PricingSnapshotIn,
  AllocateBatchResponse,
  OperationSummaryIn,
  OrderIn,
} from '@/types/d24';
import type { OperationWithDetails, HedgeOrder, PricingSnapshot } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Columns, Calculator, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

// ───────────────────────── helpers (replicated, no cross-page imports) ─────────────────────────

const STATUS_BADGE: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive'; className?: string }> = {
  RASCUNHO: { label: 'Rascunho', variant: 'secondary' },
  DRAFT: { label: 'Rascunho', variant: 'secondary' },
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

const STATUS_ORDER: Record<string, number> = {
  ENCERRAMENTO_APROVADO: 1,
  ENCERRAMENTO_SOLICITADO: 2,
  HEDGE_CONFIRMADO: 3,
  APROVADA: 4,
  EM_APROVACAO: 5,
  SUBMETIDA: 6,
  RASCUNHO: 7,
  DRAFT: 7,
  ENCERRADA: 98,
  CANCELADA: 99,
  REPROVADA: 99,
};

const fmtDate = (d?: string | null) =>
  d ? new Date(d + 'T12:00:00').toLocaleDateString('pt-BR') : '—';

const fmtDateTime = (s?: string | null) =>
  s ? new Date(s).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—';

const fmtBrl = (v: unknown) => `R$ ${((v as number) ?? 0).toFixed(2)}`;

// ───────────────────────── ColumnSelector (persisted in localStorage) ─────────────────────────

interface Col { key: string; label: string; }

function usePersistedColumns(storageKey: string, columns: Col[], defaultKeys?: string[]) {
  const allKeys = useMemo(() => columns.map(c => c.key), [columns]);
  const [visible, setVisible] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) return new Set(JSON.parse(raw) as string[]);
    } catch { /* noop */ }
    return new Set(defaultKeys ?? allKeys);
  });
  const update = (next: Set<string>) => {
    setVisible(next);
    try { localStorage.setItem(storageKey, JSON.stringify([...next])); } catch { /* noop */ }
  };
  return { visible, setVisible: update };
}

const ColumnSelector: React.FC<{
  columns: Col[];
  visible: Set<string>;
  onChange: (next: Set<string>) => void;
}> = ({ columns, visible, onChange }) => {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8">
          <Columns className="h-4 w-4 mr-1" />
          Colunas
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-2 w-56" align="end">
        <div className="flex gap-2 mb-2">
          <Button size="sm" variant="ghost" className="h-7 text-xs flex-1"
            onClick={() => onChange(new Set(columns.map(c => c.key)))}>Todas</Button>
          <Button size="sm" variant="ghost" className="h-7 text-xs flex-1"
            onClick={() => onChange(new Set())}>Nenhuma</Button>
        </div>
        <div className="space-y-1 max-h-[260px] overflow-auto">
          {columns.map(c => (
            <label key={c.key} className="flex items-center gap-2 px-1 py-1 rounded hover:bg-accent cursor-pointer">
              <Checkbox
                checked={visible.has(c.key)}
                onCheckedChange={(v) => {
                  const next = new Set(visible);
                  if (v) next.add(c.key); else next.delete(c.key);
                  onChange(next);
                }}
              />
              <span className="text-xs">{c.label}</span>
            </label>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
};

// ───────────────────────── column definitions ─────────────────────────

const OP_COLUMNS: Col[] = [
  { key: 'praca', label: 'Praça' },
  { key: 'commodity', label: 'Commodity' },
  { key: 'ticker', label: 'Ticker' },
  { key: 'volume', label: 'Volume (sc)' },
  { key: 'preco_orig', label: 'Preço Orig.' },
  { key: 'trade_date', label: 'Entrada' },
  { key: 'payment_date', label: 'Pagamento' },
  { key: 'reception_date', label: 'Recepção' },
  { key: 'sale_date', label: 'Saída' },
  { key: 'status', label: 'Status' },
];

const MTM_COLUMNS: Col[] = [
  { key: 'operacao',     label: 'Operação' },
  { key: 'commodity',    label: 'Commodity' },
  { key: 'praca',        label: 'Praça' },
  { key: 'volume',       label: 'Volume (sc)' },
  { key: 'trade_date',   label: 'Data Entrada' },
  { key: 'sale_date',    label: 'Data Saída' },
  { key: 'fisico_atual', label: 'Físico Atual (R$/sc)' },
  { key: 'mtm_fisico',   label: 'MTM Físico' },
  { key: 'mtm_futuros',  label: 'MTM Futuros' },
  { key: 'mtm_ndf',      label: 'MTM NDF' },
  { key: 'mtm_opcao',    label: 'MTM Opção' },
  { key: 'mtm_total',    label: 'Total MTM' },
  { key: 'mtm_per_sack', label: 'Por Saca' },
  { key: 'breakeven',    label: 'Break-even' },
  { key: 'fisico_alvo',  label: 'Físico Alvo' },
  { key: 'exposicao',    label: 'Exposição Total' },
  { key: 'calculado_em', label: 'Calculado em' },
];

const MTM_DEFAULT_VISIBLE = [
  'operacao','commodity','praca','trade_date','sale_date',
  'mtm_total','mtm_per_sack','breakeven','fisico_alvo',
];

const SUMMARY_COLUMNS: Col[] = [
  { key: 'perna', label: 'Perna' },
  { key: 'valor', label: 'Valor (R$)' },
  { key: 'pct', label: '% do Total' },
];

// ───────────────────────── main page ─────────────────────────

const OperacoesD24: React.FC = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { data: operations, isLoading: loadingOperations } = useOperationsWithDetails();
  const { data: rawOperations } = useOperations();
  const { data: orders } = useHedgeOrders({ status: 'EXECUTED' });
  const { data: allOrders } = useHedgeOrders();
  const { data: warehouses = [] } = useActiveArmazens();
  const { data: marketData } = useMarketData();
  const { data: mtmSnapshots } = useMtmSnapshots();
  const saveMtm = useSaveMtmSnapshot();
  const { data: pricingParameters } = usePricingParameters();
  const { data: pricingSnapshots = [] } = usePricingSnapshots();

  // Tab + column states
  const opCols = usePersistedColumns('cols_operacoes', OP_COLUMNS);
  const mtmCols = usePersistedColumns('cols_mtm', MTM_COLUMNS, MTM_DEFAULT_VISIBLE);
  const sumCols = usePersistedColumns('cols_resumo', SUMMARY_COLUMNS);

  // Operations tab state
  const [filterStatus, setFilterStatus] = useState<'active' | 'closed' | 'all'>('active');
  const [selectedOperation, setSelectedOperation] = useState<OperationWithDetails | null>(null);
  const [newOpModal, setNewOpModal] = useState(false);
  const [closingOp, setClosingOp] = useState<OperationWithDetails | null>(null);

  // MTM tab state (mirrors OperationsMTM)
  const [physicalPrices, setPhysicalPrices] = useState<Record<string, string>>(() => {
    try {
      const stored = sessionStorage.getItem('mtm_physical_prices');
      return stored ? JSON.parse(stored) : {};
    } catch { return {}; }
  });
  const [calculating, setCalculating] = useState(false);
  const [results, setResults] = useState<Record<string, unknown>[] | null>(null);
  const [detailResult, setDetailResult] = useState<Record<string, unknown> | null>(null);
  const [chartByOperation, setChartByOperation] = useState(false);

  // Detail dialog collapsible sections
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    identificacao: false, datas: false, mercado: false, entrada: false,
    custos: false, basis: false, resultado: false,
  });
  const toggleSection = (k: string) => setExpandedSections(v => ({ ...v, [k]: !v[k] }));

  // ── Status dots
  const lastMtmCalculated = useMemo(() => mtmSnapshots?.[0]?.calculated_at ?? null, [mtmSnapshots]);
  const lastMarketUpdate = useMemo(() => {
    if (!marketData?.length) return null;
    return marketData.reduce((latest, m) => (!latest || m.updated_at > latest ? m.updated_at : latest), null as string | null);
  }, [marketData]);

  const StatusDot = ({ date, label }: { date: string; label: string }) => {
    const d = new Date(date);
    const hoursAgo = Math.floor((Date.now() - d.getTime()) / 3_600_000);
    const color = hoursAgo < 12 ? 'text-green-400' : hoursAgo < 24 ? 'text-yellow-400' : 'text-red-400';
    const timeLabel = `${label}: ${d.toLocaleDateString('pt-BR')} ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}${hoursAgo >= 12 ? ` (${hoursAgo}h atrás)` : ''}`;
    return <p className={`text-xs ${color}`}>● {timeLabel}</p>;
  };

  // ── Filtered operations
  const filteredOperations = useMemo(() => {
    if (!operations) return [];
    const filtered = filterStatus === 'active'
      ? operations.filter(op => !['ENCERRADA', 'CANCELADA', 'REPROVADA'].includes(op.status))
      : filterStatus === 'closed'
      ? operations.filter(op => op.status === 'ENCERRADA')
      : operations;
    return [...filtered].sort((a, b) => {
      const oa = STATUS_ORDER[a.status] ?? 50;
      const ob = STATUS_ORDER[b.status] ?? 50;
      if (oa !== ob) return oa - ob;
      return new Date(b.created_at ?? '').getTime() - new Date(a.created_at ?? '').getTime();
    });
  }, [operations, filterStatus]);

  const ordersForSelectedOperation = useMemo(() => {
    if (!selectedOperation || !allOrders) return [];
    return allOrders.filter(o => o.operation_id === selectedOperation.id);
  }, [selectedOperation, allOrders]);

  // ── Snapshot results derivation (cache-first like OperationsMTM)
  const snapshotResults = useMemo(() => {
    if (!mtmSnapshots?.length || !orders?.length) return null;
    const latestByOperation: Record<string, typeof mtmSnapshots[0]> = {};
    for (const snap of mtmSnapshots) {
      if (!latestByOperation[snap.operation_id]) latestByOperation[snap.operation_id] = snap;
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

  const displayResults = results ?? (snapshotResults as Record<string, unknown>[] | null);

  // ── D20 formulas (authorized exception)
  const targetProfitSoybean = pricingParameters?.find(p => p.id === 'soybean_cbot')?.target_profit_brl_per_sack ?? 2.0;
  const targetProfitCorn = pricingParameters?.find(p => p.id === 'corn_b3')?.target_profit_brl_per_sack ?? 2.0;
  const executionSpread = pricingParameters?.[0]?.execution_spread_pct ?? 0.05;

  const getTargetProfit = (r: Record<string, unknown>) => {
    const matched = orders?.find(o => o.operation_id === r.operation_id);
    return matched?.commodity === 'soybean' ? targetProfitSoybean : targetProfitCorn;
  };

  const getPhysicalForCalc = (r: Record<string, unknown>): number => {
    const opId = r.operation_id as string;
    const fromInput = parseFloat(physicalPrices[opId] || '');
    if (!isNaN(fromInput) && fromInput > 0) return fromInput;
    const snap = (r.market_snapshot as Record<string, number | null> | null) ?? null;
    return snap?.physical_price_current ?? 0;
  };

  const calcBreakeven = (r: Record<string, unknown>) => {
    const physical = getPhysicalForCalc(r);
    const mtmPerSack = (r.mtm_per_sack_brl as number) ?? 0;
    return (physical - mtmPerSack) * (1 + executionSpread);
  };

  const calcTargetPhysical = (r: Record<string, unknown>) => {
    const physical = getPhysicalForCalc(r);
    const mtmPerSack = (r.mtm_per_sack_brl as number) ?? 0;
    return (physical - mtmPerSack + getTargetProfit(r)) * (1 + executionSpread);
  };

  // ── Summary
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
      const matched = orders?.find(o => o.operation_id === r.operation_id);
      const label = matched?.operation?.warehouses?.display_name ?? (r.operation_id as string)?.slice(0, 8);
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

  // ── handleCalculate (replicated from OperationsMTM, no simplification)
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
          leg_type: string; ticker: string;
          option_type?: string; strike?: number; expiration_date?: string;
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
              F: F_brl, K: optionLeg.strike, T_days, r, sigma,
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

      const result = await callApi<{ results: Record<string, unknown>[] }>('/mtm/run', { positions });

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

  const DetailRow = ({ label, value }: { label: string; value: string }) => (
    <div className="flex justify-between py-1">
      <span className="text-muted-foreground text-sm">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Operações D24</h1>
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
          {/* Header sempre visível */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <ColumnSelector columns={OP_COLUMNS} visible={opCols.visible} onChange={opCols.setVisible} />
              <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as 'active' | 'closed' | 'all')}>
                <SelectTrigger className="w-32 h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Ativas</SelectItem>
                  <SelectItem value="closed">Encerradas</SelectItem>
                  <SelectItem value="all">Todas</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button size="sm" onClick={() => setNewOpModal(true)}>Nova Operação</Button>
          </div>

          {loadingOperations ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : !filteredOperations.length ? (
            <p className="text-muted-foreground text-center py-12">Nenhuma operação encontrada.</p>
          ) : (
            <Card>
              <CardContent className="pt-6">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {opCols.visible.has('praca') && <TableHead>Praça</TableHead>}
                      {opCols.visible.has('commodity') && <TableHead>Commodity</TableHead>}
                      {opCols.visible.has('ticker') && <TableHead>Ticker</TableHead>}
                      {opCols.visible.has('volume') && <TableHead>Volume</TableHead>}
                      {opCols.visible.has('preco_orig') && <TableHead>Preço Orig.</TableHead>}
                      {opCols.visible.has('trade_date') && <TableHead>Entrada</TableHead>}
                      {opCols.visible.has('payment_date') && <TableHead>Pagamento</TableHead>}
                      {opCols.visible.has('reception_date') && <TableHead>Recepção</TableHead>}
                      {opCols.visible.has('sale_date') && <TableHead>Saída</TableHead>}
                      {opCols.visible.has('status') && <TableHead>Status</TableHead>}
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredOperations.map(op => {
                      const ps = op.pricing_snapshots;
                      const badge = STATUS_BADGE[op.status] ?? { label: op.status, variant: 'secondary' as const };
                      return (
                        <TableRow key={op.id} className="cursor-pointer" onClick={() => setSelectedOperation(op)}>
                          {opCols.visible.has('praca') && <TableCell>{op.warehouses?.display_name ?? '—'}</TableCell>}
                          {opCols.visible.has('commodity') && <TableCell>{op.commodity === 'soybean' ? 'Soja' : 'Milho'}</TableCell>}
                          {opCols.visible.has('ticker') && <TableCell>{ps?.ticker ?? '—'}</TableCell>}
                          {opCols.visible.has('volume') && <TableCell>{op.volume_sacks.toLocaleString('pt-BR')} sc</TableCell>}
                          {opCols.visible.has('preco_orig') && <TableCell>{ps ? `R$ ${ps.origination_price_brl.toFixed(2)}` : '—'}</TableCell>}
                          {opCols.visible.has('trade_date') && <TableCell>{fmtDate(ps?.trade_date)}</TableCell>}
                          {opCols.visible.has('payment_date') && <TableCell>{fmtDate(ps?.payment_date)}</TableCell>}
                          {opCols.visible.has('reception_date') && <TableCell>{fmtDate(ps?.grain_reception_date)}</TableCell>}
                          {opCols.visible.has('sale_date') && <TableCell>{fmtDate(ps?.sale_date)}</TableCell>}
                          {opCols.visible.has('status') && (
                            <TableCell>
                              <Badge variant={badge.variant} className={badge.className}>{badge.label}</Badge>
                            </TableCell>
                          )}
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            {op.status === 'HEDGE_CONFIRMADO' && (
                              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setClosingOp(op)}>
                                Encerrar
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

        {/* TAB 2 — MTM */}
        <TabsContent value="mtm" className="space-y-4">
          <Card className="border-yellow-500/50 bg-yellow-500/5">
            <CardContent className="pt-4 pb-4 flex gap-2 items-start">
              <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5 shrink-0" />
              <p className="text-xs text-yellow-200">
                Os valores de break-even e físico alvo são estimativas teóricas calculadas a partir do MTM mais recente.
                Use como referência, não como garantia de execução.
              </p>
            </CardContent>
          </Card>

          {displayResults && displayResults.length > 0 ? (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">Resultado MTM</CardTitle>
                  <div className="flex gap-2">
                    <ColumnSelector columns={MTM_COLUMNS} visible={mtmCols.visible} onChange={mtmCols.setVisible} />
                    <Button onClick={handleCalculate} disabled={calculating || !orders?.length} size="sm">
                      <Calculator className={`mr-2 h-4 w-4 ${calculating ? 'animate-spin' : ''}`} />
                      {calculating ? 'Calculando...' : 'Calcular MTM'}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      {mtmCols.visible.has('operacao')     && <TableHead>Operação</TableHead>}
                      {mtmCols.visible.has('commodity')    && <TableHead>Commodity</TableHead>}
                      {mtmCols.visible.has('praca')        && <TableHead>Praça</TableHead>}
                      {mtmCols.visible.has('volume')       && <TableHead>Volume (sc)</TableHead>}
                      {mtmCols.visible.has('trade_date')   && <TableHead>Data Entrada</TableHead>}
                      {mtmCols.visible.has('sale_date')    && <TableHead>Data Saída</TableHead>}
                      {mtmCols.visible.has('fisico_atual') && <TableHead>Físico Atual</TableHead>}
                      {mtmCols.visible.has('mtm_fisico')   && <TableHead>MTM Físico</TableHead>}
                      {mtmCols.visible.has('mtm_futuros')  && <TableHead>MTM Futuros</TableHead>}
                      {mtmCols.visible.has('mtm_ndf')      && <TableHead>MTM NDF</TableHead>}
                      {mtmCols.visible.has('mtm_opcao')    && <TableHead>MTM Opção</TableHead>}
                      {mtmCols.visible.has('mtm_total')    && <TableHead>Total</TableHead>}
                      {mtmCols.visible.has('mtm_per_sack') && <TableHead>Por Saca</TableHead>}
                      {mtmCols.visible.has('breakeven')    && <TableHead>Break-even</TableHead>}
                      {mtmCols.visible.has('fisico_alvo')  && <TableHead>Físico Alvo</TableHead>}
                      {mtmCols.visible.has('exposicao')    && <TableHead>Exposição Total</TableHead>}
                      {mtmCols.visible.has('calculado_em') && <TableHead>Calculado em</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {displayResults.map((r, i) => {
                      const matched = orders?.find(o => o.operation_id === r.operation_id);
                      const ps = matched?.operation?.pricing_snapshots;
                      const wName = matched?.operation?.warehouses?.display_name ?? '—';
                      const total = (r.mtm_total_brl as number) ?? 0;
                      const physInput = physicalPrices[r.operation_id as string];
                      const physVal = physInput
                        ? parseFloat(physInput)
                        : (r as any).market_snapshot?.physical_price_current;
                      return (
                        <TableRow key={i} className="cursor-pointer hover:bg-muted/50" onClick={() => setDetailResult(r)}>
                          {mtmCols.visible.has('operacao')     && <TableCell className="font-mono text-xs">{(r.operation_id as string)?.slice(0, 8)}</TableCell>}
                          {mtmCols.visible.has('commodity')    && <TableCell>{matched?.commodity === 'soybean' ? 'Soja' : matched?.commodity === 'corn' ? 'Milho' : '—'}</TableCell>}
                          {mtmCols.visible.has('praca')        && <TableCell>{wName}</TableCell>}
                          {mtmCols.visible.has('volume')       && <TableCell>{((matched?.volume_sacks ?? (r as any).volume_sacks ?? 0) as number).toLocaleString('pt-BR')}</TableCell>}
                          {mtmCols.visible.has('trade_date')   && <TableCell>{fmtDate(ps?.trade_date)}</TableCell>}
                          {mtmCols.visible.has('sale_date')    && <TableCell>{fmtDate(ps?.sale_date)}</TableCell>}
                          {mtmCols.visible.has('fisico_atual') && <TableCell>{physVal != null ? `R$ ${Number(physVal).toFixed(2)}` : '—'}</TableCell>}
                          {mtmCols.visible.has('mtm_fisico')   && <TableCell>{fmtBrl((r as any).mtm_physical_brl)}</TableCell>}
                          {mtmCols.visible.has('mtm_futuros')  && <TableCell>{fmtBrl((r as any).mtm_futures_brl)}</TableCell>}
                          {mtmCols.visible.has('mtm_ndf')      && <TableCell>{fmtBrl((r as any).mtm_ndf_brl)}</TableCell>}
                          {mtmCols.visible.has('mtm_opcao')    && <TableCell>{fmtBrl((r as any).mtm_option_brl)}</TableCell>}
                          {mtmCols.visible.has('mtm_total')    && (
                            <TableCell className={`font-bold ${total >= 0 ? 'text-green-400' : 'text-red-400'}`}>R$ {total.toFixed(2)}</TableCell>
                          )}
                          {mtmCols.visible.has('mtm_per_sack') && <TableCell>R$ {((r.mtm_per_sack_brl as number) ?? 0).toFixed(2)}/sc</TableCell>}
                          {mtmCols.visible.has('breakeven')    && <TableCell className="text-xs tabular-nums">R$ {calcBreakeven(r).toFixed(2)}/sc</TableCell>}
                          {mtmCols.visible.has('fisico_alvo')  && <TableCell className="text-xs tabular-nums">R$ {calcTargetPhysical(r).toFixed(2)}/sc</TableCell>}
                          {mtmCols.visible.has('exposicao')    && <TableCell>{fmtBrl((r as any).total_exposure_brl)}</TableCell>}
                          {mtmCols.visible.has('calculado_em') && <TableCell className="text-xs">{fmtDateTime((r as any).calculated_at)}</TableCell>}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">Resultado MTM</CardTitle>
                  <div className="flex gap-2">
                    <ColumnSelector columns={MTM_COLUMNS} visible={mtmCols.visible} onChange={mtmCols.setVisible} />
                    <Button onClick={handleCalculate} disabled={calculating || !orders?.length} size="sm">
                      <Calculator className={`mr-2 h-4 w-4 ${calculating ? 'animate-spin' : ''}`} />
                      {calculating ? 'Calculando...' : 'Calcular MTM'}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-center text-muted-foreground py-8 text-sm">Nenhum resultado disponível.</p>
              </CardContent>
            </Card>
          )}

          {orders?.length ? (
            <Card>
              <CardHeader><CardTitle className="text-sm">Operações Ativas — Inputs</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Operação</TableHead>
                      <TableHead>Praça</TableHead>
                      <TableHead>Commodity</TableHead>
                      <TableHead>Volume</TableHead>
                      <TableHead>Preço Orig.</TableHead>
                      <TableHead>Preço Físico Atual (R$/sc)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orders.map(o => (
                      <TableRow key={o.id}>
                        <TableCell className="font-mono text-xs">{o.operation_id.slice(0, 8)}</TableCell>
                        <TableCell>{o.operation?.warehouses?.display_name ?? '—'}</TableCell>
                        <TableCell>{o.commodity}</TableCell>
                        <TableCell>{o.volume_sacks.toLocaleString()}</TableCell>
                        <TableCell>R$ {o.origination_price_brl.toFixed(2)}</TableCell>
                        <TableCell>
                          <Input
                            type="number" step="0.01" className="h-8 w-28" placeholder="0.00"
                            value={physicalPrices[o.operation_id] || ''}
                            onChange={(e) => setPhysicalPrices(p => {
                              const updated = { ...p, [o.operation_id]: e.target.value };
                              try { sessionStorage.setItem('mtm_physical_prices', JSON.stringify(updated)); } catch { /* noop */ }
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
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm">Resultado por Perna (Consolidado)</CardTitle>
                    <ColumnSelector columns={SUMMARY_COLUMNS} visible={sumCols.visible} onChange={sumCols.setVisible} />
                  </div>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {sumCols.visible.has('perna') && <TableHead>Perna</TableHead>}
                        {sumCols.visible.has('valor') && <TableHead>Valor (R$)</TableHead>}
                        {sumCols.visible.has('pct') && <TableHead>% do Total</TableHead>}
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
                          {sumCols.visible.has('perna') && <TableCell>{label}</TableCell>}
                          {sumCols.visible.has('valor') && (
                            <TableCell className={`font-bold ${value >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                              R$ {value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </TableCell>
                          )}
                          {sumCols.visible.has('pct') && (
                            <TableCell>
                              {summary.totalGeral !== 0 ? `${((value / Math.abs(summary.totalGeral)) * 100).toFixed(1)}%` : '—'}
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                      <TableRow>
                        {sumCols.visible.has('perna') && <TableCell className="font-bold">Total</TableCell>}
                        {sumCols.visible.has('valor') && (
                          <TableCell className={`font-bold ${summary.totalGeral >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            R$ {summary.totalGeral.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </TableCell>
                        )}
                        {sumCols.visible.has('pct') && <TableCell>100%</TableCell>}
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
                        <YAxis tickFormatter={(v: number) => `R$${(v / 1000).toFixed(0)}k`} />
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
                        <YAxis tickFormatter={(v: number) => `R$${(v / 1000).toFixed(0)}k`} />
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

      {/* ── Detail Sheet for Operations ── */}
      <Sheet open={!!selectedOperation} onOpenChange={(o) => { if (!o) setSelectedOperation(null); }}>
        <SheetContent side="right" className="sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>
              {selectedOperation
                ? `${selectedOperation.warehouses?.display_name ?? '—'} — ${selectedOperation.id.slice(0, 8)}`
                : ''}
            </SheetTitle>
          </SheetHeader>
          {selectedOperation && (() => {
            const ps = selectedOperation.pricing_snapshots;
            const opMtmSnapshot = mtmSnapshots?.find(s => s.operation_id === selectedOperation.id);
            return (
              <Tabs defaultValue="detalhes" className="mt-4">
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
                      {ordersForSelectedOperation.map(o => (
                        <div key={o.id} className="rounded-md border p-3 space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">{o.display_code ?? o.id.slice(0, 8)}</span>
                            <Badge variant="outline">{o.status}</Badge>
                          </div>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <span>{(o.legs as unknown[])?.length ?? 0} pernas</span>
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
            );
          })()}
        </SheetContent>
      </Sheet>

      {/* ── MTM Detail Dialog ── */}
      {detailResult && (() => {
        const matched = orders?.find(o => o.operation_id === detailResult.operation_id);
        const ps = matched?.operation?.pricing_snapshots;
        const wName = matched?.operation?.warehouses?.display_name ?? '—';
        const snap = detailResult.market_snapshot as Record<string, number | null> | null;
        const total = (detailResult.mtm_total_brl as number) ?? 0;
        const outputsJson = (ps?.outputs_json as Record<string, unknown>) ?? {};
        const costs = (outputsJson.costs as Record<string, unknown>) ?? {};
        const engineResult = (outputsJson.engine_result as Record<string, unknown>) ?? {};
        const fmt4 = (v: unknown) => typeof v === 'number' ? `R$ ${v.toFixed(4)}/sc` : '—';

        const Section: React.FC<{ k: string; label: string; children: React.ReactNode }> = ({ k, label, children }) => (
          <>
            <Separator />
            <button type="button" className="flex items-center justify-between w-full py-1" onClick={() => toggleSection(k)}>
              <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">{label}</p>
              <span className="text-xs text-muted-foreground">{expandedSections[k] ? '▾' : '▸'}</span>
            </button>
            {expandedSections[k] && <>{children}</>}
          </>
        );

        return (
          <Dialog open onOpenChange={(o) => { if (!o) setDetailResult(null); }}>
            <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>MTM — {(detailResult.operation_id as string)?.slice(0, 8)} / {wName}</DialogTitle>
              </DialogHeader>

              <Section k="identificacao" label="Identificação">
                <DetailRow label="Operação" value={(detailResult.operation_id as string)?.slice(0, 8) ?? '—'} />
                <DetailRow label="Commodity" value={matched?.commodity ?? '—'} />
                <DetailRow label="Volume" value={`${matched?.volume_sacks?.toLocaleString() ?? '—'} sc`} />
              </Section>

              <Section k="datas" label="Datas">
                <DetailRow label="Entrada" value={fmtDate(ps?.trade_date)} />
                <DetailRow label="Pagamento" value={fmtDate(ps?.payment_date)} />
                <DetailRow label="Recepção" value={fmtDate(ps?.grain_reception_date)} />
                <DetailRow label="Saída" value={fmtDate(ps?.sale_date)} />
              </Section>

              <Section k="mercado" label="Snapshot de Mercado">
                <DetailRow label="Futuros (atual)" value={snap?.futures_price_current != null ? `USD ${snap.futures_price_current.toFixed(4)}/bu` : '—'} />
                <DetailRow label="Físico (atual)" value={fmtBrl(snap?.physical_price_current)} />
                <DetailRow label="Câmbio spot" value={snap?.spot_rate_current != null ? `R$ ${snap.spot_rate_current.toFixed(4)}` : '—'} />
                <DetailRow label="Prêmio opção" value={snap?.option_premium_current != null ? fmtBrl(snap.option_premium_current) : '—'} />
              </Section>

              <Section k="entrada" label="Preço de Entrada (Executado)">
                <p className="text-xs text-muted-foreground py-1">Ver pernas executadas em "Ordens Vinculadas" no detalhe da operação.</p>
              </Section>

              <Section k="custos" label="Custos de Originação">
                <DetailRow label="Financeiro" value={fmt4((costs as any).financial_brl ?? (costs as any).financeiro_brl ?? (costs as any).financial)} />
                <DetailRow label="Armazenagem" value={fmt4((costs as any).storage_brl ?? (costs as any).armazenagem_brl ?? (costs as any).storage)} />
                <DetailRow label="Corretagem" value={fmt4((costs as any).brokerage_brl ?? (costs as any).corretagem_brl ?? (costs as any).brokerage)} />
                <DetailRow label="Custo de mesa" value={fmt4((costs as any).desk_cost_brl ?? (costs as any).desk_brl ?? (costs as any).desk)} />
                <DetailRow label="Total" value={fmt4((costs as any).total_brl ?? (costs as any).total)} />
              </Section>

              <Section k="basis" label="Basis">
                <DetailRow label="Target basis" value={fmt4((engineResult as any).target_basis ?? (engineResult as any).target_basis_brl)} />
                <DetailRow label="Purchased basis" value={fmt4((engineResult as any).purchased_basis ?? (engineResult as any).purchased_basis_brl)} />
                <DetailRow label="Breakeven basis" value={fmt4((engineResult as any).breakeven_basis ?? (engineResult as any).breakeven_basis_brl)} />
              </Section>

              <Section k="resultado" label="Resultado MTM">
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
              </Section>
            </DialogContent>
          </Dialog>
        );
      })()}

      {/* ── New Operation Modal ── */}
      <NewOperationModal
        open={newOpModal}
        onClose={() => setNewOpModal(false)}
        warehouses={warehouses}
        pricingSnapshots={pricingSnapshots}
        userId={user?.id ?? null}
        onCreated={() => {
          queryClient.invalidateQueries({ queryKey: ['operations_with_details'] });
          queryClient.invalidateQueries({ queryKey: ['operations'] });
          setNewOpModal(false);
        }}
      />

      {/* ── Closing Modal ── */}
      <ClosingModal
        operation={closingOp}
        operations={(rawOperations ?? []) as unknown as { id: string; warehouse_id: string; commodity: string; volume_sacks: number; status: string; display_code?: string | null }[]}
        allOrders={allOrders ?? []}
        mtmSnapshots={mtmSnapshots ?? []}
        onClose={() => setClosingOp(null)}
      />
    </div>
  );
};

export default OperacoesD24;

// ───────────────────────── New Operation Modal ─────────────────────────

interface NewOpModalProps {
  open: boolean;
  onClose: () => void;
  warehouses: { id: string; display_name: string }[];
  pricingSnapshots: PricingSnapshot[];
  userId: string | null;
  onCreated: () => void;
}

const NewOperationModal: React.FC<NewOpModalProps> = ({ open, onClose, warehouses, pricingSnapshots, userId, onCreated }) => {
  const [warehouseId, setWarehouseId] = useState('');
  const [commodityKey, setCommodityKey] = useState<'soybean|cbot' | 'corn|b3' | ''>('');
  const [volume, setVolume] = useState('');
  const [originPrice, setOriginPrice] = useState('');
  const [snapshotId, setSnapshotId] = useState('');
  const [tradeDate, setTradeDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [paymentDate, setPaymentDate] = useState('');
  const [receptionDate, setReceptionDate] = useState('');
  const [saleDate, setSaleDate] = useState('');
  const [notes, setNotes] = useState('');
  const [planResp, setPlanResp] = useState<BuildHedgePlanResponse | null>(null);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);

  // Reset on open
  useEffect(() => {
    if (open) {
      setWarehouseId(''); setCommodityKey(''); setVolume(''); setOriginPrice('');
      setSnapshotId(''); setTradeDate(new Date().toISOString().slice(0, 10));
      setPaymentDate(''); setReceptionDate(''); setSaleDate(''); setNotes('');
      setPlanResp(null);
    }
  }, [open]);

  const [commodity, exchange] = commodityKey ? commodityKey.split('|') : ['', ''];

  const filteredSnapshots = useMemo(() => {
    if (!commodity) return [];
    return pricingSnapshots.filter(s =>
      s.commodity === commodity && s.benchmark.toLowerCase() === exchange.toLowerCase(),
    );
  }, [pricingSnapshots, commodity, exchange]);

  const selectedSnapshot = useMemo(() => filteredSnapshots.find(s => s.id === snapshotId), [filteredSnapshots, snapshotId]);

  // Auto-fill dates from snapshot
  useEffect(() => {
    if (selectedSnapshot) {
      setPaymentDate(selectedSnapshot.payment_date);
      setReceptionDate(selectedSnapshot.grain_reception_date);
      setSaleDate(selectedSnapshot.sale_date);
    }
  }, [selectedSnapshot]);

  const canGenerate = warehouseId && commodity && exchange && volume && originPrice && selectedSnapshot && tradeDate && paymentDate && receptionDate && saleDate;

  const handleGenerate = async () => {
    if (!canGenerate || !selectedSnapshot) return;
    setGenerating(true);
    try {
      const op: OperationIn = {
        warehouse_id: warehouseId,
        commodity,
        exchange,
        volume_sacks: parseFloat(volume),
        origination_price_brl: parseFloat(originPrice),
        trade_date: tradeDate,
        payment_date: paymentDate,
        grain_reception_date: receptionDate,
        sale_date: saleDate,
        status: 'DRAFT',
        hedge_plan: [],
        notes: notes || undefined,
      };
      const outputs = (selectedSnapshot.outputs_json ?? {}) as Record<string, unknown>;
      const ps: PricingSnapshotIn = {
        ticker: selectedSnapshot.ticker,
        payment_date: selectedSnapshot.payment_date,
        futures_price_usd: typeof outputs.futures_price_usd === 'number' ? outputs.futures_price_usd as number : undefined,
        futures_price_brl: selectedSnapshot.futures_price_brl,
        exchange_rate: selectedSnapshot.exchange_rate ?? (typeof outputs.exchange_rate === 'number' ? outputs.exchange_rate as number : undefined),
      };
      const resp = await buildHedgePlan(op, ps);
      setPlanResp(resp);
      toast.success('Plano gerado');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao gerar plano');
    } finally {
      setGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!planResp || !userId || !selectedSnapshot) return;
    setSaving(true);
    try {
      const payload = {
        warehouse_id: warehouseId,
        commodity,
        exchange,
        volume_sacks: parseFloat(volume),
        origination_price_brl: parseFloat(originPrice),
        trade_date: tradeDate,
        payment_date: paymentDate,
        grain_reception_date: receptionDate,
        sale_date: saleDate,
        status: 'DRAFT',
        pricing_snapshot_id: selectedSnapshot.id,
        notes: notes || null,
        hedge_plan: planResp.plan,
        created_by: userId,
      };
      const { data, error } = await (supabase as any)
        .from('operations')
        .insert(payload as never)
        .select('id, display_code')
        .single();
      if (error) throw error;
      const code = (data as any)?.display_code ?? ((data as any)?.id as string)?.slice(0, 8) ?? 'nova';
      toast.success(`Operação criada: ${code}`);
      onCreated();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao salvar operação');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova Operação</DialogTitle>
        </DialogHeader>

        <div className="border border-yellow-500/50 bg-yellow-500/5 rounded p-3 text-xs text-yellow-200 flex gap-2 items-start">
          <AlertTriangle className="h-4 w-4 shrink-0 text-yellow-500 mt-0.5" />
          O plano gerado é uma estimativa teórica baseada nos preços de referência selecionados. Preços reais de execução podem diferir.
        </div>

        <div className="grid grid-cols-2 gap-3 mt-2">
          <div className="space-y-1">
            <Label className="text-xs">Praça</Label>
            <Select value={warehouseId} onValueChange={setWarehouseId}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {warehouses.map(w => <SelectItem key={w.id} value={w.id}>{w.display_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Commodity</Label>
            <Select value={commodityKey} onValueChange={(v) => setCommodityKey(v as 'soybean|cbot' | 'corn|b3')}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="soybean|cbot">Soja CBOT</SelectItem>
                <SelectItem value="corn|b3">Milho B3</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Volume (sacas)</Label>
            <Input type="number" inputMode="decimal" value={volume} onChange={e => setVolume(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Preço Originação (R$/sc)</Label>
            <Input type="number" inputMode="decimal" step="0.01" value={originPrice} onChange={e => setOriginPrice(e.target.value)} />
          </div>
          <div className="col-span-2 space-y-1">
            <Label className="text-xs">Snapshot de Referência</Label>
            <Select value={snapshotId} onValueChange={setSnapshotId} disabled={!commodity}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder={commodity ? 'Selecione um snapshot' : 'Escolha commodity primeiro'} />
              </SelectTrigger>
              <SelectContent>
                {filteredSnapshots.length === 0 && (
                  <div className="text-xs text-muted-foreground px-2 py-2">Nenhum snapshot disponível</div>
                )}
                {filteredSnapshots.map(s => (
                  <SelectItem key={s.id} value={s.id}>
                    {fmtDate(s.payment_date)} · {fmtDate(s.sale_date)} · R$ {s.origination_price_brl.toFixed(2)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Trade date</Label>
            <Input type="date" value={tradeDate} onChange={e => setTradeDate(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Pagamento</Label>
            <Input type="date" value={paymentDate} onChange={e => setPaymentDate(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Recepção</Label>
            <Input type="date" value={receptionDate} onChange={e => setReceptionDate(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Saída</Label>
            <Input type="date" value={saleDate} onChange={e => setSaleDate(e.target.value)} />
          </div>
          <div className="col-span-2 space-y-1">
            <Label className="text-xs">Notas</Label>
            <Textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} />
          </div>
        </div>

        {planResp && (
          <div className="mt-3 space-y-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Plano de Hedge</p>
              <div className="space-y-2">
                {planResp.plan.map((leg: HedgePlanItemIn, i: number) => (
                  <div key={i} className="border rounded p-2 text-xs">
                    <div className="flex flex-wrap gap-x-3 gap-y-1">
                      <span><b>{leg.instrument_type}</b></span>
                      <span>{leg.direction}</span>
                      <span>{leg.currency}</span>
                      {leg.ticker && <span className="font-mono">{leg.ticker}</span>}
                      {leg.contracts != null && <span>{leg.contracts} ct</span>}
                      {leg.price_estimated != null && <span>~ {leg.price_estimated}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Mensagem da Ordem</p>
              <Textarea readOnly value={planResp.order_message} rows={4} className="text-xs font-mono" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Confirmação</p>
              <Textarea readOnly value={planResp.confirmation_message} rows={3} className="text-xs font-mono" />
            </div>
          </div>
        )}

        <DialogFooter className="mt-4 gap-2">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button variant="secondary" onClick={handleGenerate} disabled={!canGenerate || generating}>
            {generating ? 'Gerando...' : 'Gerar Plano'}
          </Button>
          <Button onClick={handleSave} disabled={!planResp || saving}>
            {saving ? 'Salvando...' : 'Confirmar e Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ───────────────────────── Closing Modal ─────────────────────────

interface ClosingModalProps {
  operation: OperationWithDetails | null;
  operations: { id: string; warehouse_id: string; commodity: string; volume_sacks: number; status: string; display_code?: string | null }[];
  allOrders: HedgeOrder[];
  mtmSnapshots: { operation_id: string; mtm_total_brl: number; calculated_at: string }[];
  onClose: () => void;
}

const ClosingModal: React.FC<ClosingModalProps> = ({ operation, operations, allOrders, mtmSnapshots, onClose }) => {
  const [volumeStr, setVolumeStr] = useState('');
  const [strategy, setStrategy] = useState<'PROPORTIONAL' | 'MAX_PROFIT' | 'MAX_LOSS'>('PROPORTIONAL');
  const [calculating, setCalculating] = useState(false);
  const [proposal, setProposal] = useState<AllocateBatchResponse | null>(null);

  useEffect(() => {
    if (operation) {
      setVolumeStr(String(operation.volume_sacks));
      setStrategy('PROPORTIONAL');
      setProposal(null);
    }
  }, [operation]);

  if (!operation) return null;

  // Derive exchange from any executed hedge order on this op (paridade com OrdensD24)
  const opOrders = allOrders.filter(o => o.operation_id === operation.id);
  const exchange = opOrders[0]?.exchange ?? 'cbot';

  const handleCalculate = async () => {
    setCalculating(true);
    try {
      // Filter HEDGE_CONFIRMADO ops with same warehouse + commodity
      const candidates = operations.filter(op =>
        op.warehouse_id === operation.warehouse_id &&
        op.commodity === operation.commodity &&
        op.status === 'HEDGE_CONFIRMADO',
      );

      // Latest MTM by operation_id
      const latestMtm: Record<string, number | undefined> = {};
      for (const s of mtmSnapshots) {
        if (latestMtm[s.operation_id] == null) latestMtm[s.operation_id] = s.mtm_total_brl;
      }

      const summaries: OperationSummaryIn[] = candidates.map(op => {
        const hedgeOrdersExec = allOrders.filter(o =>
          o.operation_id === op.id && o.status === 'EXECUTED',
        );
        // ─ Conversão correta: explodir cada leg de executed_legs em OrderIn
        const existingOrders: OrderIn[] = hedgeOrdersExec.flatMap(ho =>
          ((ho.executed_legs ?? ho.legs) as any[]).map((leg: any) => ({
            operation_id: ho.operation_id,
            instrument_type: leg.leg_type,
            direction: leg.direction,
            currency: leg.currency ?? 'USD',
            contracts: leg.contracts ?? 0,
            volume_units: leg.volume_units ?? 0,
            executed_at: ho.executed_at ?? new Date().toISOString(),
            executed_by: ho.executed_by ?? '',
            is_closing: false,
            ticker: leg.ticker,
            price: leg.price,
            ndf_rate: leg.ndf_rate,
          }))
        );
        return {
          operation_id: op.id,
          display_code: op.display_code ?? op.id.slice(0, 8),
          volume_sacks: op.volume_sacks,
          existing_orders: existingOrders,
          mtm_total_brl: latestMtm[op.id],
        };
      });

      const resp = await allocateClosingBatch({
        warehouse_id: operation.warehouse_id,
        commodity: operation.commodity,
        exchange,
        target_volume_sacks: parseFloat(volumeStr),
        strategy,
        operations: summaries,
      });
      setProposal(resp);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao calcular proposta');
    } finally {
      setCalculating(false);
    }
  };

  const handleConfirm = () => {
    toast.message('Funcionalidade de persistência do encerramento será implementada na Fase 5.');
    onClose();
  };

  return (
    <Dialog open={!!operation} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Encerramento por Bloco — {operation.warehouses?.display_name ?? '—'} / {operation.commodity === 'soybean' ? 'Soja' : 'Milho'}
          </DialogTitle>
        </DialogHeader>

        <div className="border border-yellow-500/50 bg-yellow-500/5 rounded p-3 text-xs text-yellow-200 flex gap-2 items-start">
          <AlertTriangle className="h-4 w-4 shrink-0 text-yellow-500 mt-0.5" />
          Os valores de MTM usados na alocação são teóricos. A proposta é uma estimativa e pode diferir da execução real.
        </div>

        <div className="grid grid-cols-2 gap-3 mt-2">
          <div className="space-y-1">
            <Label className="text-xs">Volume a encerrar (sacas)</Label>
            <Input type="number" inputMode="decimal" value={volumeStr} onChange={e => setVolumeStr(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Estratégia</Label>
            <Select value={strategy} onValueChange={(v) => setStrategy(v as 'PROPORTIONAL' | 'MAX_PROFIT' | 'MAX_LOSS')}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="PROPORTIONAL">Proporcional</SelectItem>
                <SelectItem value="MAX_PROFIT">Máximo Lucro</SelectItem>
                <SelectItem value="MAX_LOSS">Máxima Perda</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex justify-end mt-2">
          <Button onClick={handleCalculate} disabled={!volumeStr || calculating} variant="secondary">
            {calculating ? 'Calculando...' : 'Calcular Proposta'}
          </Button>
        </div>

        {proposal && (
          <div className="mt-3 space-y-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                Proposta · {proposal.strategy_used} · {proposal.total_volume_allocated_sacks} sc
              </p>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Operação</TableHead>
                    <TableHead>Volume a encerrar</TableHead>
                    <TableHead>Razão</TableHead>
                    <TableHead>MTM</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {proposal.proposals.map(p => (
                    <TableRow key={p.operation_id}>
                      <TableCell className="font-mono text-xs">{p.display_code}</TableCell>
                      <TableCell>{p.volume_to_close_sacks.toLocaleString('pt-BR')} sc</TableCell>
                      <TableCell className="text-xs">{p.allocation_reason}</TableCell>
                      <TableCell className="text-xs">{p.mtm_at_allocation != null ? fmtBrl(p.mtm_at_allocation) : '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {proposal.warnings.length > 0 && (
              <div className="space-y-1">
                {proposal.warnings.map((w, i) => (
                  <div key={i} className="border border-yellow-500/50 bg-yellow-500/10 rounded p-2 text-xs text-yellow-200 flex gap-2">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-yellow-500" />
                    {w}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <DialogFooter className="mt-4 gap-2">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleConfirm} disabled={!proposal}>
            Confirmar Encerramento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWarehouses, useActiveArmazens } from '@/hooks/useWarehouses';
import { useOperationsWithDetails } from '@/hooks/useOperations';
import { useMtmSnapshots } from '@/hooks/useMtmSnapshots';
import { usePricingParameters } from '@/hooks/usePricingParameters';
import { useMarketData } from '@/hooks/useMarketData';
import { useLatestPhysicalPrices } from '@/hooks/usePhysicalPrices';
import type { Warehouse, OperationWithDetails, MtmSnapshot } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ChevronDown, ExternalLink, MapPin, Columns, Calculator, AlertTriangle, List, Plus, Send, X, ChevronRight, Copy, Pencil, Check } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import type { AllocateBatchResponse } from '@/types/d24';
import { buildHedgePlan } from '@/services/d24Api';
import { getSuggestedExecutionPrices, resolveExecutionBatch, toExecutionProposals } from '@/lib/blockTradeExecution';

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

const ARMAZEM_COLUMNS: Col[] = [
  { key: 'commodity', label: 'Commodity' },
  { key: 'op_ativas', label: 'Op. ativas' },
  { key: 'volume_soja', label: 'Volume Soja (sc)' },
  { key: 'volume_milho', label: 'Volume Milho (sc)' },
  { key: 'mtm_total', label: 'MTM Total' },
  { key: 'breakeven', label: 'Break-even' },
  { key: 'mtm_sc', label: 'MTM/sc' },
  { key: 'fisico_alvo', label: 'Físico Alvo' },
  { key: 'prox_venc', label: 'Próx. venc.' },
  { key: 'status_mix', label: 'Status mix' },
];

// ───────────────────────── helpers (replicated locally) ─────────────────────────

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
  REPROVADA: { label: 'Reprovada', variant: 'destructive' },
  ACTIVE: { label: 'Ativa', variant: 'default', className: 'bg-green-600 text-white' },
  PARTIALLY_CLOSED: { label: 'Parcial. Encerrada', variant: 'outline', className: 'border-orange-500 text-orange-500' },
  CLOSED: { label: 'Encerrada', variant: 'secondary' },
  CANCELLED: { label: 'Cancelada', variant: 'destructive' },
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
  MONITORAMENTO: 8,
  ENCERRADA: 98,
  CANCELADA: 99,
  REPROVADA: 99,
  ACTIVE: 3,
  PARTIALLY_CLOSED: 4,
  CLOSED: 98,
  CANCELLED: 99,
};

const ACTIVE_STATUSES = new Set([
  'RASCUNHO', 'DRAFT', 'SUBMETIDA', 'EM_APROVACAO', 'APROVADA',
  'HEDGE_CONFIRMADO', 'ENCERRAMENTO_SOLICITADO', 'ENCERRAMENTO_APROVADO',
  'MONITORAMENTO', 'ACTIVE', 'PARTIALLY_CLOSED',
]);

const fmtDate = (d?: string | null) =>
  d ? new Date(d + 'T12:00:00').toLocaleDateString('pt-BR') : '—';

const fmtBrl = (v: unknown) => {
  const n = (v as number);
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  return `R$ ${n.toFixed(2)}`;
};

const fmtSc = (v: unknown) => {
  const n = (v as number) ?? 0;
  return n.toLocaleString('pt-BR');
};

const fmtPct = (v: number | null | undefined) => {
  if (v === null || v === undefined) return '—';
  return `${(v * 100).toFixed(2)}%`;
};

const fmtNum = (v: number | null | undefined, suffix = '') => {
  if (v === null || v === undefined) return '—';
  return `${v}${suffix ? ' ' + suffix : ''}`;
};

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const cfg = STATUS_BADGE[status] ?? { label: status, variant: 'outline' as const };
  return <Badge variant={cfg.variant} className={cfg.className}>{cfg.label}</Badge>;
};

const BtStatusDot: React.FC<{ date: string; label: string }> = ({ date, label }) => {
  const d = new Date(date);
  const hoursAgo = Math.floor((Date.now() - d.getTime()) / 3_600_000);
  const color =
    hoursAgo < 12 ? 'text-green-400' :
    hoursAgo < 24 ? 'text-yellow-400' :
    'text-red-400';
  const timeLabel = `${label}: ${d.toLocaleDateString('pt-BR')} ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}${hoursAgo >= 12 ? ` (${hoursAgo}h atrás)` : ''}`;
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <span className={color}>●</span>
      <span>{timeLabel}</span>
    </div>
  );
};

// ───────────────────────── BatchConsolidatedPlanPanel ─────────────────────────

interface BatchConsolidatedPlanPanelProps {
  batch: any;
  operationIds: string[];
}

const copyToClipboardHelper = (text: string) => {
  navigator.clipboard.writeText(text);
  toast.success('Copiado');
};

const BatchConsolidatedPlanPanel: React.FC<BatchConsolidatedPlanPanelProps> = ({ batch, operationIds }) => {
  const queryClient = useQueryClient();
  const hasSavedMessage = !!(batch.order_message && batch.order_message.length > 0);

  const { data: ops = [], isLoading: opsLoading } = useQuery({
    queryKey: ['batch-operations', batch.id],
    queryFn: async () => {
      if (operationIds.length === 0) return [];
      const { data, error } = await supabase
        .from('operations')
        .select('*, display_code, exchange, warehouses(display_name), pricing_snapshots(*)')
        .in('id', operationIds);
      if (error) throw error;
      return (data ?? []) as any[];
    },
    enabled: operationIds.length > 0 && !hasSavedMessage,
  });

  const representative = (ops as any[])[0];
  const canBuild = !hasSavedMessage && !!representative && !!representative.pricing_snapshots;

  const { data: planResp, isLoading: planLoading, error: planError } = useQuery({
    queryKey: ['batch-consolidated-plan', batch.id],
    queryFn: async () => {
      const snap = representative.pricing_snapshots as any;
      const operation = {
        warehouse_id: batch.warehouse_id,
        commodity: batch.commodity,
        exchange: batch.exchange,
        volume_sacks: Number(batch.total_volume_sacks),
        origination_price_brl: 0,
        trade_date: new Date().toISOString().slice(0, 10),
        payment_date: representative.payment_date ?? snap?.payment_date,
        grain_reception_date: representative.grain_reception_date ?? snap?.grain_reception_date,
        sale_date: representative.sale_date ?? snap?.sale_date,
        status: 'DRAFT',
        hedge_plan: [],
      };
      const pricingSnap = {
        ticker: snap.ticker,
        payment_date: snap.payment_date,
        futures_price_usd: snap.futures_price_usd ?? undefined,
        futures_price_brl: snap.futures_price_brl ?? undefined,
        exchange_rate: snap.exchange_rate ?? undefined,
      };
      return await buildHedgePlan(operation as any, pricingSnap as any);
    },
    enabled: canBuild,
    staleTime: 60_000,
    retry: false,
  });

  // Persist generated message to the batch (one-shot, only if not already saved)
  useEffect(() => {
    if (hasSavedMessage || !planResp) return;
    (async () => {
      const { error } = await supabase
        .from('warehouse_closing_batches')
        .update({
          order_message: planResp.order_message ?? null,
          confirmation_message: planResp.confirmation_message ?? null,
        })
        .eq('id', batch.id)
        .is('order_message', null);
      if (!error) {
        queryClient.invalidateQueries({ queryKey: ['warehouse-closing-batches'] });
      }
    })();
  }, [planResp, hasSavedMessage, batch.id, queryClient]);

  const orderMessage = hasSavedMessage ? batch.order_message : planResp?.order_message;
  const confirmationMessage = hasSavedMessage ? batch.confirmation_message : planResp?.confirmation_message;
  const planLegs: any[] = (planResp?.plan ?? []) as any[];

  const isLoading = opsLoading || planLoading;

  return (
    <div className="space-y-4">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        Plano consolidado & Mensagem da ordem
      </p>

      {isLoading && (
        <p className="text-xs text-muted-foreground">Gerando plano consolidado…</p>
      )}

      {planError && !hasSavedMessage && (
        <p className="text-xs text-destructive">
          Erro ao gerar plano: {(planError as Error).message}
        </p>
      )}

      {planLegs.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground">Pernas consolidadas (read-only)</p>
          {planLegs.map((leg: any, i: number) => (
            <div key={i} className="rounded-md border p-2 text-xs flex flex-wrap gap-2">
              <Badge variant="outline">{leg.instrument_type}</Badge>
              <Badge variant="secondary">{leg.direction}</Badge>
              <Badge>{leg.currency}</Badge>
              {leg.ticker && <span>· {leg.ticker}</span>}
              {leg.contracts != null && <span>· {leg.contracts} ct</span>}
              {leg.volume_units != null && <span>· {leg.volume_units} un</span>}
              {leg.ndf_rate && <span>· NDF {leg.ndf_rate}</span>}
              {leg.strike && <span>· strike {leg.strike}</span>}
            </div>
          ))}
        </div>
      )}

      {orderMessage && (
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-muted-foreground">Mensagem da Ordem</span>
            <Button size="sm" variant="ghost" onClick={() => copyToClipboardHelper(orderMessage)}>
              <Copy className="h-3 w-3" />
            </Button>
          </div>
          <pre className="whitespace-pre-wrap text-xs font-mono bg-muted p-2 rounded-md">{orderMessage}</pre>
        </div>
      )}

      {confirmationMessage && (
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-muted-foreground">Confirmação</span>
            <Button size="sm" variant="ghost" onClick={() => copyToClipboardHelper(confirmationMessage)}>
              <Copy className="h-3 w-3" />
            </Button>
          </div>
          <pre className="whitespace-pre-wrap text-xs font-mono bg-muted p-2 rounded-md">{confirmationMessage}</pre>
        </div>
      )}
    </div>
  );
};


// ───────────────────────── main page ─────────────────────────

const ArmazensD24: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: allWarehousesRaw = [] } = useWarehouses();
  const { data: activeArmazens = [] } = useActiveArmazens();
  const { data: operations = [] } = useOperationsWithDetails();
  const { data: snapshots = [] } = useMtmSnapshots();
  const { data: pricingParameters } = usePricingParameters();
  const { data: latestPhysicalPrices = [] } = useLatestPhysicalPrices();

  const operationsById = useMemo(() => {
    const map: Record<string, OperationWithDetails> = {};
    for (const op of (operations ?? [])) map[op.id] = op;
    return map;
  }, [operations]);

  const [tab, setTab] = useState<'posicao' | 'block_trade' | 'config'>('posicao');
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string | null>(null);
  const [filterWarehouse, setFilterWarehouse] = useState<string>('all');
  const [filterCommodity, setFilterCommodity] = useState<string>('all');
  const armazemCols = usePersistedColumns('cols_armazens', ARMAZEM_COLUMNS);

  // Block Trade — UI state (Lote 2A: visual only)
  const [btWarehouse, setBtWarehouse] = useState('');
  const [btCommodity, setBtCommodity] = useState<'soybean' | 'corn' | ''>('');
  const [btExchange, setBtExchange] = useState<'cbot' | 'b3' | ''>('');
  const [btVolume, setBtVolume] = useState('');
  const [btStrategy, setBtStrategy] = useState<'MAX_PROFIT' | 'MAX_LOSS' | 'PROPORTIONAL' | ''>('');
  const [btProposals, setBtProposals] = useState<AllocateBatchResponse | null>(null);
  const [btWarnings, setBtWarnings] = useState<string[]>([]);
  const [btLoading, setBtLoading] = useState(false);
  const [btExecutionOpen, setBtExecutionOpen] = useState(false);
  const [btExecutionBatch, setBtExecutionBatch] = useState<any>(null);
  const [btView, setBtView] = useState<'list' | 'new'>('list');
  const [btSelectedBatch, setBtSelectedBatch] = useState<any>(null);
  const [btCancelTarget, setBtCancelTarget] = useState<any>(null);
  const [btCancelReason, setBtCancelReason] = useState('');
  const [btSubmitting, setBtSubmitting] = useState(false);
  const [btEditedVolumes, setBtEditedVolumes] = useState<Record<string, number | ''>>({});
  const [btEditingBatchId, setBtEditingBatchId] = useState<string | null>(null);

  useEffect(() => {
    if (!btProposals) {
      setBtEditedVolumes({});
      return;
    }
    const init: Record<string, number | ''> = {};
    btProposals.proposals.forEach(p => {
      init[p.operation_id] = p.volume_to_close_sacks;
    });
    setBtEditedVolumes(init);
  }, [btProposals]);

  const btTotalEdited = Object.values(btEditedVolumes).reduce<number>((s, v) => s + (Number(v) || 0), 0);
  const btTotalExpected = btProposals?.total_volume_allocated_sacks ?? 0;
  const btVolumeOk = Math.abs(btTotalEdited - btTotalExpected) < 0.01;

  useEffect(() => {
    if (btCommodity === 'soybean') setBtExchange('cbot');
    else if (btCommodity === 'corn') setBtExchange('b3');
    else setBtExchange('');
  }, [btCommodity]);

  useEffect(() => {
    if (btView !== 'new') return;
    setBtProposals(null);
    setBtWarnings([]);
    setBtExecutionBatch(null);
  }, [btWarehouse, btCommodity, btView]);

  const executionSpread = pricingParameters?.[0]?.execution_spread_pct ?? 0.05;

  // Active, non-HQ warehouses
  const warehouses = useMemo(
    () => (allWarehousesRaw ?? []).filter(w => w.type !== 'HQ' && w.active),
    [allWarehousesRaw],
  );

  // Latest snapshot per operation
  const latestByOpId = useMemo(() => {
    const map: Record<string, MtmSnapshot> = {};
    for (const s of snapshots ?? []) {
      const cur = map[s.operation_id];
      if (!cur || (s.calculated_at ?? '') > (cur.calculated_at ?? '')) {
        map[s.operation_id] = s;
      }
    }
    return map;
  }, [snapshots]);

  // Block Trade — most recent MTM date for selected warehouse
  const btLatestMtmDate = useMemo(() => {
    if (!btWarehouse) return null;
    const opsInWarehouse = (operations ?? []).filter(op => op.warehouse_id === btWarehouse);
    const dates = opsInWarehouse
      .map(op => latestByOpId[op.id]?.calculated_at)
      .filter((d): d is string => !!d);
    if (!dates.length) return null;
    return dates.sort((a, b) => b.localeCompare(a))[0];
  }, [btWarehouse, operations, latestByOpId]);

  // Block Trade — orders for eligible operations of selected warehouse+commodity
  const { data: btD24Orders = [] } = useQuery({
    queryKey: ['d24-orders-for-bt', btWarehouse, btCommodity],
    enabled: !!btWarehouse && !!btCommodity,
    queryFn: async () => {
      const eligibleOpIds = (operations ?? [])
        .filter(op =>
          op.warehouse_id === btWarehouse &&
          op.commodity === btCommodity &&
          (op.status === 'ACTIVE' || op.status === 'PARTIALLY_CLOSED')
        )
        .map(op => op.id);
      if (!eligibleOpIds.length) return [];
      const { data, error } = await (supabase as unknown as { from: (t: string) => { select: (s: string) => { in: (col: string, ids: string[]) => { order: (c: string, opts: { ascending: boolean }) => Promise<{ data: unknown; error: unknown }> } } } })
        .from('orders')
        .select('*')
        .in('operation_id', eligibleOpIds)
        .order('executed_at', { ascending: true });
      if (error) throw error;
      return (data ?? []) as Record<string, unknown>[];
    },
  });

  const handleBtAllocate = async () => {
    if (!btWarehouse || !btCommodity || !btExchange || !btVolume || !btStrategy) {
      toast.error('Preencha todos os campos antes de calcular');
      return;
    }
    const targetVolume = parseFloat(btVolume);
    if (!(targetVolume > 0)) {
      toast.error('Volume inválido');
      return;
    }

    const eligibleOps = (operations ?? []).filter(op =>
      op.warehouse_id === btWarehouse &&
      op.commodity === btCommodity &&
      (op.status === 'ACTIVE' || op.status === 'PARTIALLY_CLOSED')
    );

    if (!eligibleOps.length) {
      toast.error('Nenhuma operação ativa para este armazém e commodity');
      return;
    }

    setBtLoading(true);
    setBtProposals(null);
    setBtWarnings([]);

    try {
      const operationSummaries = eligibleOps.map(op => {
        const opOrders = (btD24Orders as Record<string, unknown>[]).filter(o => o.operation_id === op.id);
        const snap = latestByOpId[op.id];
        return {
          operation_id: op.id,
          display_code: (op as { display_code?: string }).display_code ?? op.id.slice(0, 8),
          volume_sacks: op.volume_sacks,
          mtm_total_brl: snap?.mtm_total_brl ?? undefined,
          existing_orders: opOrders.map((o) => ({
            operation_id: o.operation_id,
            instrument_type: o.instrument_type,
            direction: o.direction,
            currency: o.currency,
            contracts: o.contracts,
            volume_units: o.volume_units,
            is_closing: o.is_closing ?? false,
            executed_at: o.executed_at,
            executed_by: o.executed_by,
            ticker: o.ticker ?? undefined,
            price: o.price ?? undefined,
            ndf_rate: o.ndf_rate ?? undefined,
            ndf_maturity: o.ndf_maturity ?? undefined,
            option_type: o.option_type ?? undefined,
            strike: o.strike ?? undefined,
            premium: o.premium ?? undefined,
            expiration_date: o.expiration_date ?? undefined,
            is_counterparty_insurance: o.is_counterparty_insurance ?? false,
          })),
        };
      });

      const { data, error } = await supabase.functions.invoke('api-proxy', {
        body: {
          endpoint: '/closing-batches/allocate',
          body: {
            warehouse_id: btWarehouse,
            commodity: btCommodity,
            exchange: btExchange,
            target_volume_sacks: targetVolume,
            strategy: btStrategy,
            operations: operationSummaries,
          },
        },
      });

      if (error) throw new Error(error.message ?? JSON.stringify(error));
      const resp = data as AllocateBatchResponse;
      if (resp?.warnings?.length) setBtWarnings(resp.warnings);
      setBtProposals(resp);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error('Erro ao calcular proposta: ' + msg);
    } finally {
      setBtLoading(false);
    }
  };

  // Block Trade — list of batches
  const { data: btBatches = [] } = useQuery({
    queryKey: ['warehouse-closing-batches'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('warehouse_closing_batches')
        .select('*, warehouses(display_name)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const { data: btSignedBatchIds = new Set<string>() } = useQuery({
    queryKey: ['batch-signatures-set'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('signatures')
        .select('batch_id')
        .not('batch_id', 'is', null);
      if (error) throw error;
      return new Set<string>((data ?? []).map((r: any) => r.batch_id));
    },
  });

  const handleBtSaveDraft = async () => {
    if (!btProposals || !user?.id) return;
    setBtSubmitting(true);
    try {
      const mtmDates = btProposals.proposals
        .map(p => latestByOpId[p.operation_id]?.calculated_at)
        .filter((d): d is string => !!d);
      const oldestMtm = mtmDates.length
        ? mtmDates.sort((a, b) => a.localeCompare(b))[0]
        : null;
      const mtmAgeHours = oldestMtm
        ? Math.floor((Date.now() - new Date(oldestMtm).getTime()) / 3_600_000)
        : null;
      const stalenessWarning = mtmAgeHours === null ? null
        : mtmAgeHours < 4 ? null
        : mtmAgeHours < 24 ? 'yellow'
        : 'red';

      // Build allocation_snapshot with edited volumes
      const snapshotRows = btProposals.proposals.map(p => ({
        ...p,
        volume_to_close_sacks: Number(btEditedVolumes[p.operation_id] ?? p.volume_to_close_sacks),
      }));

      // Build closing-order message client-side, proportionally to each operation's open orders.
      const ordersList = btD24Orders as any[];
      const commodityLabel = btCommodity === 'soybean' ? 'SOJA' : btCommodity === 'corn' ? 'MILHO' : btCommodity.toUpperCase();
      const warehouseName = warehouses.find(w => w.id === btWarehouse)?.display_name ?? btWarehouse;
      const fmtNum = (n: number, d = 2) => Number(n).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });

      const orderLines: string[] = [];
      const confirmLines: string[] = [];
      for (const p of snapshotRows) {
        const opOrders = ordersList.filter(o => o.operation_id === p.operation_id && !o.is_closing);
        const proporcao = (Number(p.volume_to_close_sacks) || 0) / (p.current_volume_sacks || 1);
        const seen = new Set<string>();
        const legParts: string[] = [];
        for (const o of opOrders) {
          if (seen.has(o.instrument_type)) continue;
          seen.add(o.instrument_type);
          const closingDirection = o.direction === 'buy' ? 'COMPRAR' : 'VENDER';
          const contracts = Math.round((Number(o.contracts) * proporcao) * 100) / 100;
          const volume_units = Math.round((Number(o.volume_units) * proporcao) * 100) / 100;
          if (o.instrument_type === 'futures') {
            legParts.push(`${closingDirection} ${fmtNum(contracts)} cts ${o.ticker ?? ''}`.trim());
          } else if (o.instrument_type === 'ndf') {
            const closeNdfDir = o.direction === 'buy' ? 'VENDER' : 'COMPRAR';
            legParts.push(`NDF ${closeNdfDir} USD ${fmtNum(volume_units)}${o.ndf_maturity ? ` venc ${o.ndf_maturity}` : ''}`);
          } else if (o.instrument_type === 'option') {
            legParts.push(`${closingDirection} ${fmtNum(contracts)} ${(o.option_type ?? '').toUpperCase()} strike ${fmtNum(Number(o.strike) || 0, 4)}`);
          }
        }
        orderLines.push(`• ${p.display_code} (${fmtNum(Number(p.volume_to_close_sacks), 2)} sc): ${legParts.join(' | ')}`);
        confirmLines.push(`• ${p.display_code}: ${fmtNum(Number(p.volume_to_close_sacks), 2)} sc`);
      }

      const orderMessage = [
        `🚨 *ORDEM DE ENCERRAMENTO (BLOCK TRADE)* 🚨`,
        `Praça: ${warehouseName}`,
        `Commodity: ${commodityLabel}`,
        `Volume Total: ${fmtNum(btTotalEdited, 2)} sc`,
        `Estratégia: ${btStrategy}`,
        ``,
        `Operações afetadas:`,
        ...orderLines,
        ``,
        `Favor confirmar execução e repassar os preços médios.`,
      ].join('\n');

      const confirmationMessage = [
        `✅ *ENCERRAMENTO ESTRUTURADO* ✅`,
        `Praça: ${warehouseName}`,
        `Commodity: ${commodityLabel}`,
        `Volume Total: ${fmtNum(btTotalEdited, 2)} sc`,
        ``,
        `Operações encerradas:`,
        ...confirmLines,
      ].join('\n');

      const latestPhysical = latestPhysicalPrices.find(
        p => p.warehouse_id === btWarehouse && p.commodity === btCommodity
      );
      const physicalEstimated = latestPhysical?.price_brl_per_sack ?? null;

      const payload: any = {
        warehouse_id: btWarehouse,
        commodity: btCommodity,
        exchange: btExchange,
        total_volume_sacks: btTotalEdited,
        allocation_strategy: btStrategy,
        mtm_snapshot_used_at: oldestMtm ?? null,
        mtm_staleness_warning: stalenessWarning,
        allocation_snapshot: snapshotRows,
        affected_operations_count: btProposals.proposals.length,
        generated_orders_count: 0,
        status: 'DRAFT',
        order_message: orderMessage,
        confirmation_message: confirmationMessage,
        physical_sale_price_estimated_brl_per_sack: physicalEstimated,
      };
      if (btEditingBatchId) {
        const { error } = await (supabase as any)
          .from('warehouse_closing_batches')
          .update(payload)
          .eq('id', btEditingBatchId);
        if (error) throw new Error(error.message);
        toast.success('Rascunho atualizado');
      } else {
        const { error } = await (supabase as any)
          .from('warehouse_closing_batches')
          .insert({ ...payload, created_by: user.id });
        if (error) throw new Error(error.message);
        toast.success('Rascunho salvo');
      }
      queryClient.invalidateQueries({ queryKey: ['warehouse-closing-batches'] });
      setBtView('list');
      setBtProposals(null);
      setBtWarnings([]);
      setBtVolume('');
      setBtStrategy('');
      setBtEditingBatchId(null);
    } catch (e: any) {
      toast.error('Erro ao salvar rascunho: ' + (e?.message ?? String(e)));
    } finally {
      setBtSubmitting(false);
    }
  };

  const handleBtSendForSignature = async (batch: any) => {
    if (!user?.id) return;
    setBtSubmitting(true);
    try {
      const proposals = (batch.allocation_snapshot ?? []) as any[];
      const firstOpId = proposals[0]?.operation_id;
      if (!firstOpId) throw new Error('Batch sem operações para assinar');
      const { error: sigError } = await (supabase as any)
        .from('signatures')
        .insert({
          operation_id: firstOpId,
          batch_id: batch.id,
          flow_type: 'CLOSING',
          user_id: user.id,
          role_used: 'mesa',
          decision: 'APPROVE',
          signed_at: new Date().toISOString(),
        });
      if (sigError) throw new Error(sigError.message);
      toast.success('Enviado para assinatura');
      queryClient.invalidateQueries({ queryKey: ['warehouse-closing-batches'] });
      queryClient.invalidateQueries({ queryKey: ['signature-events'] });
      queryClient.invalidateQueries({ queryKey: ['pending-approvals-count'] });
      queryClient.invalidateQueries({ queryKey: ['batch-signatures-set'] });
    } catch (e: any) {
      toast.error('Erro ao enviar para assinatura: ' + (e?.message ?? String(e)));
    } finally {
      setBtSubmitting(false);
    }
  };

  const handleBtCancel = async () => {
    if (!btCancelTarget || !btCancelReason.trim()) return;
    setBtSubmitting(true);
    try {
      const { error } = await (supabase as any)
        .from('warehouse_closing_batches')
        .update({
          status: 'CANCELLED',
          cancellation_reason: btCancelReason.trim(),
        })
        .eq('id', btCancelTarget.id);
      if (error) throw new Error(error.message);
      toast.success('Batch cancelado');
      queryClient.invalidateQueries({ queryKey: ['warehouse-closing-batches'] });
      setBtCancelTarget(null);
      setBtCancelReason('');
    } catch (e: any) {
      toast.error('Erro ao cancelar: ' + (e?.message ?? String(e)));
    } finally {
      setBtSubmitting(false);
    }
  };


  const rows = useMemo(() => {
    return warehouses.map(w => {
      const ops = (operations ?? []).filter(
        o => o.warehouse_id === w.id && ACTIVE_STATUSES.has(o.status),
      );
      const commodities = Array.from(new Set(ops.map(o => o.commodity)));
      const volumeTotal = ops.reduce((acc, o) => acc + (o.volume_sacks ?? 0), 0);
      const volumeSoja = ops.filter(o => o.commodity === 'soybean').reduce((acc, o) => acc + (o.volume_sacks ?? 0), 0);
      const volumeMilho = ops.filter(o => o.commodity === 'corn').reduce((acc, o) => acc + (o.volume_sacks ?? 0), 0);
      const mtmTotal = ops.reduce((acc, o) => acc + (latestByOpId[o.id]?.mtm_total_brl ?? 0), 0);

      let beNum = 0;
      let beVol = 0;
      for (const o of ops) {
        const snap = latestByOpId[o.id];
        if (!snap) continue;
        const physical = snap.physical_price_current ?? 0;
        const mtmPerSack = snap.mtm_per_sack_brl ?? 0;
        const be = (physical - mtmPerSack) * (1 + executionSpread);
        const v = o.volume_sacks ?? 0;
        beNum += be * v;
        beVol += v;
      }
      const breakevenMedio = beVol > 0 ? beNum / beVol : null;

      // MTM por saca médio ponderado
      let mtmSackNum = 0;
      let mtmSackVol = 0;
      for (const o of ops) {
        const snap = latestByOpId[o.id];
        if (!snap?.mtm_per_sack_brl) continue;
        const v = o.volume_sacks ?? 0;
        mtmSackNum += snap.mtm_per_sack_brl * v;
        mtmSackVol += v;
      }
      const mtmPerSackMedio = mtmSackVol > 0 ? mtmSackNum / mtmSackVol : null;

      // Físico alvo médio ponderado
      let fisicoAlvoNum = 0;
      let fisicoAlvoVol = 0;
      for (const o of ops) {
        const snap = latestByOpId[o.id];
        if (!snap) continue;
        const physical = snap.physical_price_current ?? 0;
        const mtmPerSack = snap.mtm_per_sack_brl ?? 0;
        const targetProfit = 2.0;
        const fisicoAlvo = (physical - mtmPerSack + targetProfit) * (1 + executionSpread);
        const v = o.volume_sacks ?? 0;
        fisicoAlvoNum += fisicoAlvo * v;
        fisicoAlvoVol += v;
      }
      const fisicoAlvoMedio = fisicoAlvoVol > 0 ? fisicoAlvoNum / fisicoAlvoVol : null;

      const dates = ops
        .map(o => o.pricing_snapshots?.sale_date)
        .filter((d): d is string => !!d);
      const proximoVencimento = dates.length
        ? dates.sort((a, b) => a.localeCompare(b))[0]
        : null;

      const mix = { rascunho: 0, active: 0, partial: 0, outros: 0 };
      for (const o of ops) {
        if (o.status === 'RASCUNHO' || o.status === 'DRAFT') mix.rascunho++;
        else if (o.status === 'ACTIVE') mix.active++;
        else if (o.status === 'PARTIALLY_CLOSED') mix.partial++;
        else mix.outros++;
      }

      return {
        warehouse: w,
        ops,
        commodities,
        volumeTotal,
        volumeSoja,
        volumeMilho,
        mtmTotal,
        breakevenMedio,
        mtmPerSackMedio,
        fisicoAlvoMedio,
        proximoVencimento,
        mix,
      };
    });
  }, [warehouses, operations, latestByOpId, executionSpread]);

  const filteredRows = useMemo(() => rows.filter(r => {
    if (filterWarehouse !== 'all' && r.warehouse.id !== filterWarehouse) return false;
    if (filterCommodity !== 'all' && !r.commodities.includes(filterCommodity)) return false;
    return true;
  }), [rows, filterWarehouse, filterCommodity]);

  const selected = useMemo(
    () => rows.find(r => r.warehouse.id === selectedWarehouseId) ?? null,
    [rows, selectedWarehouseId],
  );

  const selectedOpsSorted = useMemo(() => {
    if (!selected) return [];
    return [...selected.ops].sort((a, b) => {
      const sa = STATUS_ORDER[a.status] ?? 50;
      const sb = STATUS_ORDER[b.status] ?? 50;
      if (sa !== sb) return sa - sb;
      return (b.created_at ?? '').localeCompare(a.created_at ?? '');
    });
  }, [selected]);

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Armazéns</h1>
          <p className="text-sm text-muted-foreground">
            Posição consolidada e configuração por armazém.
          </p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as 'posicao' | 'config')}>
        <TabsList>
          <TabsTrigger value="posicao">Posição</TabsTrigger>
          <TabsTrigger value="block_trade">Block Trade</TabsTrigger>
          <TabsTrigger value="config">Configuração</TabsTrigger>
        </TabsList>

        {/* ───────────── Aba Posição ───────────── */}
        <TabsContent value="posicao" className="space-y-4">
          {/* Filtros */}
          <div className="flex gap-3 flex-wrap">
            <Select value={filterWarehouse} onValueChange={setFilterWarehouse}>
              <SelectTrigger className="w-40 h-8 text-xs"><SelectValue placeholder="Praça" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as praças</SelectItem>
                {warehouses.map(w => (
                  <SelectItem key={w.id} value={w.id}>{w.display_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterCommodity} onValueChange={setFilterCommodity}>
              <SelectTrigger className="w-36 h-8 text-xs"><SelectValue placeholder="Commodity" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="soybean">Soja</SelectItem>
                <SelectItem value="corn">Milho</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Resumo consolidado */}
          {(() => {
            const totalVolume = filteredRows.reduce((s, r) => s + r.volumeTotal, 0);
            const totalMtm = filteredRows.reduce((s, r) => s + r.mtmTotal, 0);
            const mtmPerSackGeral = totalVolume > 0 ? totalMtm / totalVolume : 0;
            return (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Card>
                  <CardContent className="pt-4 pb-4">
                    <p className="text-xs text-muted-foreground">Armazéns Ativos</p>
                    <p className="text-2xl font-bold">{filteredRows.filter(r => r.ops.length > 0).length}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4 pb-4">
                    <p className="text-xs text-muted-foreground">Volume Total</p>
                    <p className="text-2xl font-bold">{totalVolume.toLocaleString('pt-BR')} <span className="text-sm text-muted-foreground">sc</span></p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4 pb-4">
                    <p className="text-xs text-muted-foreground">MTM Total</p>
                    <p className={`text-2xl font-bold ${totalMtm >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                      {fmtBrl(totalMtm)}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4 pb-4">
                    <p className="text-xs text-muted-foreground">MTM por Saca</p>
                    <p className={`text-2xl font-bold ${mtmPerSackGeral >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                      {fmtBrl(mtmPerSackGeral)}/sc
                    </p>
                  </CardContent>
                </Card>
              </div>
            );
          })()}

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Posição por armazém</CardTitle>
                <ColumnSelector
                  columns={ARMAZEM_COLUMNS}
                  visible={armazemCols.visible}
                  onChange={armazemCols.setVisible}
                />
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Armazém</TableHead>
                    {armazemCols.visible.has('commodity') && <TableHead>Commodity</TableHead>}
                    {armazemCols.visible.has('op_ativas') && <TableHead className="text-right">Op. ativas</TableHead>}
                    {armazemCols.visible.has('volume_soja') && <TableHead className="text-right">Volume Soja (sc)</TableHead>}
                    {armazemCols.visible.has('volume_milho') && <TableHead className="text-right">Volume Milho (sc)</TableHead>}
                    {armazemCols.visible.has('mtm_total') && <TableHead className="text-right">MTM Total (R$)</TableHead>}
                    {armazemCols.visible.has('breakeven') && <TableHead className="text-right">Break-even médio</TableHead>}
                    {armazemCols.visible.has('mtm_sc') && <TableHead className="text-right">MTM/sc</TableHead>}
                    {armazemCols.visible.has('fisico_alvo') && <TableHead className="text-right">Físico Alvo</TableHead>}
                    {armazemCols.visible.has('prox_venc') && <TableHead>Próx. venc.</TableHead>}
                    {armazemCols.visible.has('status_mix') && <TableHead>Status mix</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRows.map(r => (
                    <TableRow
                      key={r.warehouse.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => setSelectedWarehouseId(r.warehouse.id)}
                    >
                      <TableCell>
                        <div className="font-medium">{r.warehouse.display_name}</div>
                        <div className="text-xs text-muted-foreground">{r.warehouse.abbr}</div>
                      </TableCell>
                      {armazemCols.visible.has('commodity') && (
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {r.commodities.length === 0
                              ? <span className="text-muted-foreground">—</span>
                              : r.commodities.map(c => (
                                  <Badge key={c} variant="outline" className="text-[10px]">{c}</Badge>
                                ))}
                          </div>
                        </TableCell>
                      )}
                      {armazemCols.visible.has('op_ativas') && (
                        <TableCell className="text-right">{r.ops.length}</TableCell>
                      )}
                      {armazemCols.visible.has('volume_soja') && (
                        <TableCell className="text-right">{fmtSc(r.volumeSoja)}</TableCell>
                      )}
                      {armazemCols.visible.has('volume_milho') && (
                        <TableCell className="text-right">{fmtSc(r.volumeMilho)}</TableCell>
                      )}
                      {armazemCols.visible.has('mtm_total') && (
                        <TableCell className={`text-right ${r.mtmTotal >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                          {fmtBrl(r.mtmTotal)}
                        </TableCell>
                      )}
                      {armazemCols.visible.has('breakeven') && (
                        <TableCell className="text-right">
                          {r.breakevenMedio === null ? '—' : fmtBrl(r.breakevenMedio)}
                        </TableCell>
                      )}
                      {armazemCols.visible.has('mtm_sc') && (
                        <TableCell className={`text-right ${(r.mtmPerSackMedio ?? 0) >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                          {r.mtmPerSackMedio === null ? '—' : `${fmtBrl(r.mtmPerSackMedio)}/sc`}
                        </TableCell>
                      )}
                      {armazemCols.visible.has('fisico_alvo') && (
                        <TableCell className="text-right">
                          {r.fisicoAlvoMedio === null ? '—' : `${fmtBrl(r.fisicoAlvoMedio)}/sc`}
                        </TableCell>
                      )}
                      {armazemCols.visible.has('prox_venc') && (
                        <TableCell>{fmtDate(r.proximoVencimento)}</TableCell>
                      )}
                      {armazemCols.visible.has('status_mix') && (
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {r.mix.rascunho > 0 && (
                              <Badge variant="secondary" className="text-[10px]">Rasc {r.mix.rascunho}</Badge>
                            )}
                            {r.mix.active > 0 && (
                              <Badge className="text-[10px] bg-green-600 text-white">Ativa {r.mix.active}</Badge>
                            )}
                            {r.mix.partial > 0 && (
                              <Badge variant="outline" className="text-[10px] border-orange-500 text-orange-500">Parcial {r.mix.partial}</Badge>
                            )}
                            {r.mix.outros > 0 && (
                              <Badge variant="outline" className="text-[10px]">Outros {r.mix.outros}</Badge>
                            )}
                            {r.ops.length === 0 && <span className="text-muted-foreground text-xs">—</span>}
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                  {filteredRows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={1 + armazemCols.visible.size} className="text-center text-muted-foreground py-8">
                        Nenhum armazém ativo.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ───────────── Aba Block Trade ───────────── */}
        <TabsContent value="block_trade" className="space-y-4">
          {/* Header com toggle */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {btView === 'new' && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { setBtView('list'); setBtProposals(null); setBtWarnings([]); setBtEditingBatchId(null); setBtExecutionBatch(null); }}
                >
                  ← Voltar
                </Button>
              )}
              <h2 className="text-lg font-semibold">
                {btView === 'list' ? 'Block Trades' : (btEditingBatchId ? 'Editar Rascunho' : 'Novo Batch')}
              </h2>
            </div>
            {btView === 'list' && (
              <Button onClick={() => { setBtView('new'); setBtExecutionBatch(null); }}>
                <Plus className="h-4 w-4 mr-1" />
                Novo Batch
              </Button>
            )}
          </div>

          {/* ══════════ SUB-VIEW: LISTA ══════════ */}
          {btView === 'list' && (
            <Card>
              <CardContent className="p-0">
                {btBatches.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 space-y-3 text-center">
                    <div className="rounded-full bg-muted p-4">
                      <List className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <p className="text-sm text-muted-foreground max-w-xs">
                      Nenhum batch criado ainda. Clique em "Novo Batch" para começar.
                    </p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Armazém</TableHead>
                        <TableHead>Commodity</TableHead>
                        <TableHead className="text-right">Volume (sc)</TableHead>
                        <TableHead>Estratégia</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {btBatches.map((batch: any) => {
                        const isDraft = batch.status === 'DRAFT';
                        const isSigned = btSignedBatchIds.has(batch.id);
                        const isPendingSignature = isDraft && isSigned;
                        const isAwaitingSend = isDraft && !isSigned;
                        const statusBadge = ({
                          DRAFT: isSigned
                            ? { label: 'Aguardando execução', className: 'border-blue-500 text-blue-500' }
                            : { label: 'Rascunho', className: 'border-yellow-500 text-yellow-500' },
                          EXECUTED: { label: 'Executado', className: 'bg-green-600 text-white' },
                          CANCELLED: { label: 'Cancelado', className: '' },
                        } as Record<string, { label: string; className: string }>)[batch.status] ?? { label: batch.status, className: '' };

                        return (
                          <TableRow
                            key={batch.id}
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => setBtSelectedBatch(batch)}
                          >
                            <TableCell className="text-xs">
                              {fmtDate(batch.created_at?.slice(0, 10))}
                            </TableCell>
                            <TableCell>{batch.warehouses?.display_name ?? batch.warehouse_id}</TableCell>
                            <TableCell>{batch.commodity}</TableCell>
                            <TableCell className="text-right">
                              {Number(batch.total_volume_sacks).toLocaleString('pt-BR')}
                            </TableCell>
                            <TableCell className="text-xs">{batch.allocation_strategy}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className={`text-[10px] ${statusBadge.className}`}>
                                {statusBadge.label}
                              </Badge>
                            </TableCell>
                            <TableCell onClick={(e) => e.stopPropagation()} className="text-right">
                              <div className="flex justify-end gap-1">
                                {isDraft && (
                                  <>
                                    {isAwaitingSend && (
                                      <>
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() => {
                                            setBtEditingBatchId(batch.id);
                                            setBtWarehouse(batch.warehouse_id);
                                            setBtCommodity(batch.commodity);
                                            setBtExchange(batch.exchange);
                                            setBtVolume(String(batch.total_volume_sacks));
                                            setBtStrategy(batch.allocation_strategy);
                                            setBtProposals(toExecutionProposals(batch));
                                            setBtWarnings([]);
                                            setBtView('new');
                                          }}
                                        >
                                          Editar
                                        </Button>
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          disabled={btSubmitting}
                                          onClick={() => handleBtSendForSignature(batch)}
                                        >
                                          <Send className="h-3 w-3 mr-1" />
                                          Enviar p/ Assinatura
                                        </Button>
                                      </>
                                    )}
                                    {isPendingSignature && (
                                      <Button
                                        variant="default"
                                        size="sm"
                                        onClick={() => {
                                          // Ensure btD24Orders refetches for THIS batch's warehouse+commodity
                                          setBtWarehouse(batch.warehouse_id);
                                          setBtCommodity(batch.commodity);
                                          setBtExchange(batch.exchange);
                                          setBtExecutionBatch(batch);
                                          setBtProposals(toExecutionProposals(batch));
                                          setBtExecutionOpen(true);
                                        }}
                                      >
                                        Executar
                                      </Button>
                                    )}
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => { setBtCancelTarget(batch); setBtCancelReason(''); }}
                                    >
                                      <X className="h-3 w-3" />
                                    </Button>
                                  </>
                                )}
                                {!isDraft && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          )}

          {/* ══════════ SUB-VIEW: NOVO BATCH ══════════ */}
          {btView === 'new' && (
            <>
              {btLatestMtmDate && (
                <div className="px-1">
                  <BtStatusDot date={btLatestMtmDate} label="MTM mais recente" />
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* ── Painel esquerdo — configuração ── */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Configurar Batch</CardTitle>
                <p className="text-xs text-muted-foreground">
                  Defina os parâmetros do fechamento em bloco.
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Armazém */}
                <div className="space-y-1.5">
                  <Label className="text-xs">Armazém</Label>
                  <Select value={btWarehouse} onValueChange={(v) => { setBtWarehouse(v); setBtCommodity(''); }}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="Selecione um armazém" /></SelectTrigger>
                    <SelectContent>
                      {warehouses.map(w => (
                        <SelectItem key={w.id} value={w.id}>{w.display_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Commodity */}
                <div className="space-y-1.5">
                  <Label className="text-xs">Commodity</Label>
                  <Select
                    value={btCommodity}
                    onValueChange={(v) => setBtCommodity(v as 'soybean' | 'corn')}
                    disabled={!btWarehouse}
                  >
                    <SelectTrigger className="h-9"><SelectValue placeholder="Selecione a commodity" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="soybean">Soja CBOT</SelectItem>
                      <SelectItem value="corn">Milho B3</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Exchange — derivado, read-only */}
                {btExchange && (
                  <div className="space-y-1.5">
                    <Label className="text-xs">Benchmark (derivado)</Label>
                    <div className="h-9 flex items-center px-3 rounded-md border border-input bg-muted text-sm">
                      {btExchange.toUpperCase()}
                    </div>
                  </div>
                )}

                {/* Volume */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">Volume a fechar (sacas)</Label>
                    {btWarehouse && btCommodity && (() => {
                      const available = (operations ?? [])
                        .filter(o => o.warehouse_id === btWarehouse && o.commodity === btCommodity && ACTIVE_STATUSES.has(o.status))
                        .reduce((s, o) => s + (o.volume_sacks ?? 0), 0);
                      return (
                        <button
                          type="button"
                          onClick={() => setBtVolume(String(available))}
                          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                          title="Clique para usar o total disponível"
                        >
                          Disponível: <span className="font-medium text-foreground">{available.toLocaleString('pt-BR')} sc</span>
                        </button>
                      );
                    })()}
                  </div>
                  <Input
                    type="number"
                    placeholder="Ex.: 5000"
                    value={btVolume}
                    onChange={(e) => setBtVolume(e.target.value)}
                    disabled={!btCommodity}
                    className="h-9"
                  />
                </div>

                {/* Estratégia */}
                <div className="space-y-1.5">
                  <Label className="text-xs">Estratégia de alocação</Label>
                  <Select
                    value={btStrategy}
                    onValueChange={(v) => setBtStrategy(v as 'MAX_PROFIT' | 'MAX_LOSS' | 'PROPORTIONAL')}
                    disabled={!btCommodity}
                  >
                    <SelectTrigger className="h-9"><SelectValue placeholder="Selecione a estratégia" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PROPORTIONAL">Proporcional</SelectItem>
                      <SelectItem value="MAX_PROFIT">Maior Lucro (MAX_PROFIT)</SelectItem>
                      <SelectItem value="MAX_LOSS">Maior Prejuízo (MAX_LOSS)</SelectItem>
                    </SelectContent>
                  </Select>
                  {btStrategy === 'MAX_PROFIT' && (
                    <p className="text-xs text-muted-foreground">
                      Fecha primeiro as operações com maior MTM positivo.
                    </p>
                  )}
                  {btStrategy === 'MAX_LOSS' && (
                    <p className="text-xs text-muted-foreground">
                      Fecha primeiro as operações com maior prejuízo (menor MTM).
                    </p>
                  )}
                  {btStrategy === 'PROPORTIONAL' && (
                    <p className="text-xs text-muted-foreground">
                      Distribui o volume proporcionalmente entre todas as operações ativas.
                    </p>
                  )}
                </div>

                {/* Link Ver MTM */}
                <div>
                  <Button
                    variant="link"
                    className="h-auto p-0 text-xs"
                    onClick={() => navigate('/operacoes-d24')}
                  >
                    Ver MTM das operações →
                  </Button>
                </div>

                {/* Botão calcular */}
                <Button
                  className="w-full"
                  disabled={!btWarehouse || !btCommodity || !btVolume || !btStrategy || btLoading}
                  onClick={handleBtAllocate}
                >
                  {btLoading
                    ? <><span className="animate-spin mr-2">⟳</span>Calculando...</>
                    : 'Calcular Proposta'
                  }
                </Button>
              </CardContent>
            </Card>

            {/* ── Painel direito — resultado ── */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Proposta de Alocação</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Estado vazio */}
                {!btProposals && (
                  <div className="flex flex-col items-center justify-center py-12 space-y-3 text-center">
                    <div className="rounded-full bg-muted p-4">
                      <Calculator className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <p className="text-sm text-muted-foreground max-w-xs">
                      Configure os parâmetros e clique em "Calcular Proposta" para ver a distribuição sugerida.
                    </p>
                  </div>
                )}

                {/* Warnings */}
                {btWarnings.length > 0 && (
                  <div className="rounded-md border border-yellow-500/50 bg-yellow-500/10 p-3 space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium text-yellow-600 dark:text-yellow-400">
                      <AlertTriangle className="h-4 w-4" />
                      Avisos da alocação — revise antes de executar
                    </div>
                    {btWarnings.map((w, i) => (
                      <p key={i} className="text-xs text-muted-foreground">{w}</p>
                    ))}
                  </div>
                )}

                {/* Tabela de propostas */}
                {btProposals && (
                  <>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">
                        {btProposals.proposals.length} operação(ões) · estratégia{' '}
                        <span className="font-medium text-foreground">{btProposals.strategy_used}</span>
                      </span>
                    </div>

                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Operação</TableHead>
                          <TableHead className="text-right">Disponível (sc)</TableHead>
                          <TableHead className="text-right">A fechar (sc)</TableHead>
                          <TableHead className="text-right">MTM usado</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {btProposals.proposals.map((p, i) => (
                          <TableRow key={`${p.operation_id}-${i}`}>
                            <TableCell className="font-mono text-xs">{p.display_code}</TableCell>
                            <TableCell className="text-right text-xs">
                              {p.current_volume_sacks.toLocaleString('pt-BR')}
                            </TableCell>
                            <TableCell className="text-right">
                              <Input
                                type="number"
                                min="0"
                                step="0.0001"
                                className="h-7 w-28 text-right text-xs ml-auto"
                                value={btEditedVolumes[p.operation_id] ?? ''}
                                onChange={(e) => setBtEditedVolumes(prev => ({
                                  ...prev,
                                  [p.operation_id]: e.target.value === '' ? '' : parseFloat(e.target.value),
                                }))}
                              />
                            </TableCell>
                            <TableCell className="text-right text-xs">
                              {p.mtm_at_allocation !== null && p.mtm_at_allocation !== undefined
                                ? fmtBrl(p.mtm_at_allocation)
                                : '—'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>

                    {(() => {
                      const totalMtm = btProposals.proposals.reduce((s, p) => {
                        const edited = Number(btEditedVolumes[p.operation_id] ?? p.volume_to_close_sacks) || 0;
                        const current = Number(p.current_volume_sacks) || 0;
                        const mtm = p.mtm_at_allocation;
                        if (mtm === null || mtm === undefined || current <= 0) return s;
                        return s + (Number(mtm) * (edited / current));
                      }, 0);
                      return (
                        <div className={`flex items-center justify-between text-xs font-medium px-1 ${totalMtm >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                          <span>Resultado estimado (MTM a realizar)</span>
                          <span>{fmtBrl(totalMtm)}</span>
                        </div>
                      );
                    })()}

                    <div className={`flex items-center justify-between text-xs font-medium px-1 ${btVolumeOk ? 'text-green-500' : 'text-red-500'}`}>
                      <span>Total alocado</span>
                      <span>
                        {btTotalEdited.toLocaleString('pt-BR', { maximumFractionDigits: 4 })} sc
                        {' / '}
                        {btTotalExpected.toLocaleString('pt-BR', { maximumFractionDigits: 4 })} sc
                      </span>
                    </div>

                    {btProposals.proposals.some(p => p.allocation_reason?.includes('Warning')) && (
                      <div className="rounded-md border border-yellow-500/50 bg-yellow-500/10 p-3 space-y-1">
                        {btProposals.proposals.map((p, i) =>
                          p.allocation_reason?.includes('Warning') ? (
                            <p key={`warn-${i}`} className="text-xs text-yellow-700 dark:text-yellow-300">
                              ⚠ <span className="font-mono">{p.display_code}</span>: {p.allocation_reason}
                            </p>
                          ) : null
                        )}
                      </div>
                    )}

                    <Button
                      className="w-full"
                      disabled={btSubmitting || !btVolumeOk}
                      onClick={handleBtSaveDraft}
                    >
                      {btSubmitting ? 'Salvando...' : (btEditingBatchId ? 'Atualizar Rascunho' : 'Salvar Rascunho')}
                    </Button>
                    {!btVolumeOk && (
                      <p className="text-xs text-red-500 text-center">
                        Ajuste os volumes para que o total bata com o valor calculado.
                      </p>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
              </div>
            </>
          )}
        </TabsContent>

        {/* ───────────── Aba Configuração ───────────── */}
        <TabsContent value="config" className="space-y-4">
          {warehouses.map(w => (
            <ConfigCard
              key={w.id}
              warehouse={w}
              allWarehouses={allWarehousesRaw}
              onEdit={() => navigate('/configuracoes')}
            />
          ))}
          {warehouses.length === 0 && (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                Nenhum armazém ativo.
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* ───────────── Sheet de detalhe ───────────── */}
      <Sheet
        open={!!selectedWarehouseId}
        onOpenChange={(open) => { if (!open) setSelectedWarehouseId(null); }}
      >
        <SheetContent className="sm:max-w-2xl w-full overflow-y-auto">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle>
                  <div className="flex items-center gap-2">
                    <span>{selected.warehouse.display_name}</span>
                    <Badge variant={selected.warehouse.active ? 'default' : 'secondary'} className="text-[10px]">
                      {selected.warehouse.active ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </div>
                </SheetTitle>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <MapPin className="h-3 w-3" />
                  {selected.warehouse.city ?? '—'}{selected.warehouse.state ? ` / ${selected.warehouse.state}` : ''}
                </div>
              </SheetHeader>

              <div className="grid grid-cols-3 gap-3 mt-4">
                <Card>
                  <CardContent className="p-3">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Volume Total</p>
                    <p className="text-lg font-semibold">{fmtSc(selected.volumeTotal)}<span className="text-xs text-muted-foreground ml-1">sc</span></p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">MTM Total</p>
                    <p className={`text-lg font-semibold ${selected.mtmTotal >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                      {fmtBrl(selected.mtmTotal)}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Operações</p>
                    <p className="text-lg font-semibold">{selected.ops.length}</p>
                  </CardContent>
                </Card>
              </div>

              <Separator className="my-4" />

              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                  Operações ativas
                </p>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Código</TableHead>
                      <TableHead>Commodity</TableHead>
                      <TableHead className="text-right">Volume</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Pagamento</TableHead>
                      <TableHead>Saída</TableHead>
                      <TableHead className="text-right">MTM (R$/sc)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedOpsSorted.map(o => {
                      const snap = latestByOpId[o.id];
                      const mtmPerSack = snap?.mtm_per_sack_brl;
                      const code = (o as any).display_code ?? o.id.slice(0, 8);
                      return (
                        <TableRow key={o.id}>
                          <TableCell className="font-mono text-xs">{code}</TableCell>
                          <TableCell>{o.commodity}</TableCell>
                          <TableCell className="text-right">{fmtSc(o.volume_sacks)}</TableCell>
                          <TableCell><StatusBadge status={o.status} /></TableCell>
                          <TableCell className="text-xs">{fmtDate(o.pricing_snapshots?.payment_date)}</TableCell>
                          <TableCell className="text-xs">{fmtDate(o.pricing_snapshots?.sale_date)}</TableCell>
                          <TableCell className={`text-right ${(mtmPerSack ?? 0) >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                            {mtmPerSack === undefined || mtmPerSack === null ? '—' : fmtBrl(mtmPerSack)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {selectedOpsSorted.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground py-6">
                          Nenhuma operação ativa.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* ── Sheet de detalhe do batch ── */}
      <Sheet
        open={!!btSelectedBatch}
        onOpenChange={(o) => { if (!o) setBtSelectedBatch(null); }}
      >
        <SheetContent className="sm:max-w-2xl w-full overflow-y-auto">
          {btSelectedBatch && (
            <>
              <SheetHeader>
                <SheetTitle>
                  <div className="flex items-center gap-2">
                    <span>Batch — {btSelectedBatch.warehouses?.display_name ?? btSelectedBatch.warehouse_id}</span>
                    <Badge variant="outline" className="text-[10px]">{btSelectedBatch.status}</Badge>
                  </div>
                </SheetTitle>
                <p className="text-xs text-muted-foreground">
                  {fmtDate(btSelectedBatch.created_at?.slice(0, 10))} · {btSelectedBatch.commodity} · {btSelectedBatch.allocation_strategy}
                </p>
              </SheetHeader>

              <div className="grid grid-cols-2 gap-3 mt-4">
                <Card>
                  <CardContent className="p-3">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Volume Total</p>
                    <p className="text-lg font-semibold">
                      {Number(btSelectedBatch.total_volume_sacks).toLocaleString('pt-BR')} <span className="text-xs text-muted-foreground">sc</span>
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Operações</p>
                    <p className="text-lg font-semibold">{btSelectedBatch.affected_operations_count ?? 0}</p>
                  </CardContent>
                </Card>
              </div>

              {btSelectedBatch.cancellation_reason && (
                <div className="mt-3 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-xs">
                  <span className="font-medium">Motivo do cancelamento:</span> {btSelectedBatch.cancellation_reason}
                </div>
              )}

              {btSelectedBatch.mtm_staleness_warning && (
                <div className="mt-3 rounded-md border border-yellow-500/50 bg-yellow-500/10 p-3 text-xs text-yellow-700 dark:text-yellow-300">
                  ⚠ MTM com dados desatualizados no momento da criação do batch.
                </div>
              )}

              <Separator className="my-4" />

              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                Operações afetadas
              </p>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Operação</TableHead>
                    <TableHead className="text-right">Volume total (sc)</TableHead>
                    <TableHead className="text-right">A fechar (sc)</TableHead>
                    <TableHead className="text-right">MTM usado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(btSelectedBatch.allocation_snapshot ?? []).map((p: any, i: number) => (
                    <TableRow key={`${p.operation_id}-${i}`}>
                      <TableCell className="font-mono text-xs">{p.display_code}</TableCell>
                      <TableCell className="text-right">
                        {Number(p.current_volume_sacks).toLocaleString('pt-BR')}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {Number(p.volume_to_close_sacks).toLocaleString('pt-BR', { maximumFractionDigits: 4 })}
                      </TableCell>
                      <TableCell className="text-right">
                        {p.mtm_at_allocation !== null && p.mtm_at_allocation !== undefined
                          ? fmtBrl(p.mtm_at_allocation)
                          : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <Separator className="my-4" />

              <BatchConsolidatedPlanPanel
                batch={btSelectedBatch}
                operationIds={(btSelectedBatch.allocation_snapshot ?? []).map((p: any) => p.operation_id).filter(Boolean)}
              />
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* ── Dialog de cancelamento ── */}
      <Dialog
        open={!!btCancelTarget}
        onOpenChange={(o) => { if (!o) { setBtCancelTarget(null); setBtCancelReason(''); } }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancelar Batch</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Armazém: <span className="font-medium text-foreground">{btCancelTarget?.warehouses?.display_name}</span> ·{' '}
              Volume: <span className="font-medium text-foreground">{Number(btCancelTarget?.total_volume_sacks ?? 0).toLocaleString('pt-BR')} sc</span>
            </p>
            <div className="space-y-1.5">
              <Label className="text-xs">Motivo (obrigatório)</Label>
              <Textarea
                value={btCancelReason}
                onChange={(e) => setBtCancelReason(e.target.value)}
                placeholder="Descreva o motivo do cancelamento..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setBtCancelTarget(null); setBtCancelReason(''); }} disabled={btSubmitting}>
              Voltar
            </Button>
            <Button variant="destructive" onClick={handleBtCancel} disabled={!btCancelReason.trim() || btSubmitting}>
              {btSubmitting ? 'Cancelando...' : 'Confirmar Cancelamento'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <BlockTradeExecutionModal
        open={btExecutionOpen}
        onClose={() => {
          setBtExecutionOpen(false);
          setBtExecutionBatch(null);
        }}
        batch={resolveExecutionBatch(btExecutionBatch, btBatches as any[])}
        proposals={btProposals}
        d24Orders={btD24Orders as any[]}
        userId={user?.id ?? null}
        operationsById={operationsById}
        latestPhysicalPrices={latestPhysicalPrices}
        onExecuted={() => {
          setBtExecutionOpen(false);
          setBtExecutionBatch(null);
          queryClient.invalidateQueries({ queryKey: ['warehouse-closing-batches'] });
          queryClient.invalidateQueries({ queryKey: ['operations_with_details'] });
          queryClient.invalidateQueries({ queryKey: ['d24-orders-for-bt'] });
        }}
      />
    </div>
  );
};

// ───────────────────────── ConfigCard ─────────────────────────

const ConfigCard: React.FC<{
  warehouse: Warehouse;
  allWarehouses: Warehouse[];
  onEdit: () => void;
}> = ({ warehouse: w, allWarehouses, onEdit }) => {
  const [basisOpen, setBasisOpen] = useState(true);
  const [costsOpen, setCostsOpen] = useState(false);

  const basisCfg = (w.basis_config ?? {}) as any;

  const renderBasis = (commodity: 'soybean' | 'corn', label: string) => {
    const cfg = basisCfg?.[commodity];
    if (cfg?.mode === 'reference_delta') {
      const ref = allWarehouses.find(x => x.id === cfg.reference_warehouse_id);
      const delta = cfg.delta_brl ?? 0;
      const sign = delta >= 0 ? '+' : '';
      return (
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">{label}</span>
          <span>
            Referência: {ref?.display_name ?? '—'} {sign}R$ {Number(delta).toFixed(2)}
          </span>
        </div>
      );
    }
    const value = cfg?.value;
    return (
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span>{value === null || value === undefined ? '—' : `R$ ${Number(value).toFixed(2)}/sc`}</span>
      </div>
    );
  };

  const costRow = (label: string, value: React.ReactNode) => (
    <div className="flex justify-between text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span>{value}</span>
    </div>
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CardTitle className="text-base">{w.display_name}</CardTitle>
            <Badge variant="secondary" className="text-[10px]">{w.abbr}</Badge>
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="h-3 w-3" />
            {w.city ?? '—'}{w.state ? ` / ${w.state}` : ''}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Basis */}
        <Collapsible open={basisOpen} onOpenChange={setBasisOpen}>
          <CollapsibleTrigger className="flex items-center justify-between w-full text-xs font-semibold text-muted-foreground uppercase tracking-wide hover:text-foreground">
            <span>Basis por commodity</span>
            <ChevronDown className={`h-3 w-3 transition-transform ${basisOpen ? 'rotate-180' : ''}`} />
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2 space-y-1.5">
            {renderBasis('soybean', 'Soja CBOT')}
            {renderBasis('corn', 'Milho B3')}
          </CollapsibleContent>
        </Collapsible>

        <Separator />

        {/* Custos */}
        <Collapsible open={costsOpen} onOpenChange={setCostsOpen}>
          <CollapsibleTrigger className="flex items-center justify-between w-full text-xs font-semibold text-muted-foreground uppercase tracking-wide hover:text-foreground">
            <span>Custos</span>
            <ChevronDown className={`h-3 w-3 transition-transform ${costsOpen ? 'rotate-180' : ''}`} />
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2">
            <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
              {costRow(
                'Armazenagem',
                w.storage_cost === null
                  ? '—'
                  : `R$ ${Number(w.storage_cost).toFixed(2)}${w.storage_cost_type ? ` (${w.storage_cost_type})` : ''}`,
              )}
              {costRow(
                'Juros',
                w.interest_rate === null
                  ? '—'
                  : (() => {
                      const rate = Number(w.interest_rate);
                      const pct = rate > 1 ? rate : rate * 100;
                      return `${pct.toFixed(2)}%${w.interest_rate_period ? ` (${w.interest_rate_period})` : ''}`;
                    })(),
              )}
              {costRow(
                'Corretagem CBOT',
                w.brokerage_per_contract_cbot === null
                  ? '—'
                  : `US$ ${Number(w.brokerage_per_contract_cbot).toFixed(2)}/contrato`,
              )}
              {costRow(
                'Corretagem B3',
                w.brokerage_per_contract_b3 === null
                  ? '—'
                  : `R$ ${Number(w.brokerage_per_contract_b3).toFixed(2)}/contrato`,
              )}
              {costRow('Custo mesa', fmtPct(w.desk_cost_pct))}
              {costRow('Quebra mensal', fmtPct(w.shrinkage_rate_monthly))}
              {costRow(
                'Recepção',
                w.reception_cost === null ? '—' : `R$ ${Number(w.reception_cost).toFixed(2)}/sc`,
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>

        <div className="border-t pt-3 flex justify-end">
          <Button variant="outline" size="sm" onClick={onEdit}>
            <ExternalLink className="h-3 w-3 mr-1" />
            Editar em Configurações
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

interface BlockTradeExecutionModalProps {
  open: boolean;
  onClose: () => void;
  batch: any | null;
  proposals: AllocateBatchResponse | null;
  d24Orders: any[];
  userId: string | null;
  operationsById: Record<string, OperationWithDetails>;
  latestPhysicalPrices: { warehouse_id: string; commodity: string; price_brl_per_sack: number }[];
  onExecuted: () => void;
}

const BlockTradeExecutionModal: React.FC<BlockTradeExecutionModalProps> = ({
  open, onClose, batch, proposals, d24Orders, userId, operationsById, latestPhysicalPrices, onExecuted,
}) => {
  const [step, setStep] = useState<1 | 2>(1);
  const [prices, setPrices] = useState<Record<string, number | ''>>({});
  const [physicalPrice, setPhysicalPrice] = useState<number | ''>('');
  const [isEditingPhysical, setIsEditingPhysical] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [executedSummary, setExecutedSummary] = useState<{ display_code: string; volume_closed: number }[] | null>(null);
  const [executedPhysicalAvg, setExecutedPhysicalAvg] = useState<number | null>(null);
  const [executedPhysicalRevenue, setExecutedPhysicalRevenue] = useState<number | null>(null);

  useEffect(() => {
    if (!open) return;
    setPrices({});
    setStep(1);
    setIsEditingPhysical(false);
    setExecutedSummary(null);
    setExecutedPhysicalAvg(null);
    setExecutedPhysicalRevenue(null);
    // Pre-fill physical price for the whole batch with cascade fallback:
    //   1) batch.physical_sale_price_estimated (set when draft was saved)
    //   2) latest physical_prices for the warehouse+commodity (most recent reference)
    //   3) weighted avg of operation.origination_price_brl (last-resort sane default)
    const estimated = batch?.physical_sale_price_estimated_brl_per_sack;
    const ref = batch
      ? latestPhysicalPrices.find(
          (p) => p.warehouse_id === batch.warehouse_id && p.commodity === batch.commodity,
        )?.price_brl_per_sack ?? null
      : null;
    const weightedOrigination = (proposals?.proposals ?? []).reduce(
      (acc, p) => {
        const op = operationsById[p.operation_id];
        const orig = Number(op?.origination_price_brl ?? 0);
        const volume = Number(p.volume_to_close_sacks) || 0;
        if (orig > 0 && volume > 0) {
          acc.total += orig * volume;
          acc.volume += volume;
        }
        return acc;
      },
      { total: 0, volume: 0 },
    );
    const fallback = estimated != null
      ? Number(estimated)
      : ref != null
        ? Number(ref)
        : weightedOrigination.volume > 0
          ? weightedOrigination.total / weightedOrigination.volume
          : '';
    setPhysicalPrice(fallback);
  }, [open, batch, proposals, latestPhysicalPrices, operationsById]);


  const openOrdersByOpId = useMemo(() => {
    const map: Record<string, any[]> = {};
    for (const p of (proposals?.proposals ?? [])) {
      map[p.operation_id] = d24Orders
        .filter((o: any) => o.operation_id === p.operation_id && !o.is_closing)
        .sort((a: any, b: any) => String(a.executed_at ?? '').localeCompare(String(b.executed_at ?? '')));
    }
    return map;
  }, [proposals, d24Orders]);

  const batchInstruments = useMemo(() => {
    const set = new Set<string>();
    for (const orders of Object.values(openOrdersByOpId)) {
      orders.forEach((o: any) => set.add(o.instrument_type));
    }
    return Array.from(set);
  }, [openOrdersByOpId]);

  // First ticker per instrument (representative for the batch)
  const tickerByInstrument = useMemo(() => {
    const map: Record<string, string> = {};
    for (const orders of Object.values(openOrdersByOpId)) {
      for (const o of orders) {
        if (!map[o.instrument_type] && o.ticker) {
          map[o.instrument_type] = o.ticker;
        }
      }
    }
    return map;
  }, [openOrdersByOpId]);

  const { data: marketData } = useMarketData();

  // Suggested price per instrument from market_data
  const suggestedPrices = useMemo(() => {
    return getSuggestedExecutionPrices(batchInstruments, tickerByInstrument, marketData);
  }, [marketData, batchInstruments, tickerByInstrument]);

  // Pre-fill empty price slots when suggestions become available
  useEffect(() => {
    if (!open) return;
    setPrices(prev => {
      const next = { ...prev };
      let changed = false;
      for (const instrument of batchInstruments) {
        const cur = next[instrument];
        const isEmpty = cur === '' || cur == null;
        const sug = suggestedPrices[instrument];
        if (isEmpty && sug) {
          next[instrument] = sug.value;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [open, batchInstruments, suggestedPrices]);

  const pricesOk = batchInstruments.every(i => Number(prices[i]) > 0);
  const physicalOk = Number(physicalPrice) > 0;
  const canReview = pricesOk && physicalOk;

  // Market reference for the batch's warehouse + commodity (may be null for new warehouses)
  const marketRefPrice = useMemo(() => {
    if (!batch) return null;
    const found = latestPhysicalPrices.find(
      p => p.warehouse_id === batch.warehouse_id && p.commodity === batch.commodity
    );
    return found?.price_brl_per_sack ?? null;
  }, [batch, latestPhysicalPrices]);

  // Physical rows for review (margin vs origination, revenue)
  // TEMPORARY — physical P&L is calculated client-side for now.
  // Must be moved to backend engine in next refactor. Source data
  // (origination_price_brl, physical_sale_price_brl_per_sack) is
  // persisted in operations + physical_sales for reconstruction.
  const physicalRows = useMemo(() => {
    if (!proposals) return [];
    return proposals.proposals.map(p => {
      const op = operationsById[p.operation_id];
      // Read origination price from operations (canonical source — preço pago ao
      // produtor é propriedade intrínseca da operação). pricing_snapshots tem
      // uma cópia coincidente, mas é fotografia de mercado, não a fonte de verdade.
      const orig = Number(op?.origination_price_brl ?? 0);
      const venda = Number(physicalPrice) || 0;
      const volume = Number(p.volume_to_close_sacks) || 0;
      const receita = venda * volume;
      const margem = (venda - orig) * volume;
      const origDeviation = orig > 0 ? Math.abs((venda - orig) / orig) : 0;
      const marketDeviation = marketRefPrice != null && marketRefPrice > 0
        ? Math.abs((venda - marketRefPrice) / marketRefPrice)
        : null;
      return {
        operation_id: p.operation_id,
        display_code: p.display_code,
        volume,
        orig,
        venda,
        receita,
        margem,
        origDeviation,
        marketDeviation,
      };
    });
  }, [proposals, operationsById, physicalPrice, marketRefPrice]);

  const totalPhysicalMargin = useMemo(
    () => physicalRows.reduce((s, r) => s + r.margem, 0),
    [physicalRows],
  );
  const totalPhysicalRevenue = useMemo(
    () => physicalRows.reduce((s, r) => s + r.receita, 0),
    [physicalRows],
  );

  // FX (USD/BRL) for converting USD-denominated futures P&L to BRL
  const fxRate = useMemo(() => {
    const fx = marketData?.find((m: any) => m.ticker === 'USD/BRL');
    return fx?.price != null ? Number(fx.price) : null;
  }, [marketData]);

  // Build preview rows for step 2 (pre-execution summary), including BRL P&L per leg
  const previewRows = useMemo(() => {
    if (!proposals) return [];
    const rows: {
      display_code: string;
      instrument: string;
      direction: string;
      contracts: number;
      volume_units: number;
      notional_usd: number | null;
      price: number | '';
      open_price: number | null;
      pnl_brl: number | null;
    }[] = [];
    for (const p of proposals.proposals) {
      const opOrders = openOrdersByOpId[p.operation_id] ?? [];
      const proporção = (Number(p.volume_to_close_sacks) || 0) / (p.current_volume_sacks || 1);

      // Total USD notional from futures legs in this operation (used to size NDF P&L)
      const futuresUsdNotional = opOrders
        .filter((o: any) => o.instrument_type === 'futures' && o.price != null)
        .reduce((s: number, o: any) => {
          const isCBOT = /^Z[SCWLM]/.test(String(o.ticker ?? ''));
          const contractSize = isCBOT ? 5000 : 450;
          return s + Number(o.price) * Number(o.contracts) * contractSize;
        }, 0);

      const seen = new Set<string>();
      for (const o of opOrders) {
        if (seen.has(o.instrument_type)) continue;
        seen.add(o.instrument_type);
        const contracts = Math.round((Number(o.contracts) * proporção) * 100) / 100;
        const volume_units = Math.round((Number(o.volume_units) * proporção) * 100) / 100;
        const closeDir = o.direction === 'buy' ? 'sell' : 'buy';
        const closePrice = prices[o.instrument_type];
        const openPrice = o.instrument_type === 'ndf'
          ? (o.ndf_rate != null ? Number(o.ndf_rate) : null)
          : (o.price != null ? Number(o.price) : null);

        // P&L sign: profit when (close - open) * (open=buy ? +1 : -1) > 0
        const sign = o.direction === 'buy' ? 1 : -1;
        let pnl_brl: number | null = null;
        let notional_usd: number | null = null;

        if (openPrice != null && typeof closePrice === 'number' && closePrice > 0) {
          if (o.instrument_type === 'futures') {
            const isCBOT = /^Z[SCWLM]/.test(String(o.ticker ?? ''));
            const contractSize = isCBOT ? 5000 : 450;
            const pnlNative = sign * (closePrice - openPrice) * contractSize * contracts;
            if (o.currency === 'USD') {
              pnl_brl = fxRate != null ? pnlNative * fxRate : null;
            } else {
              pnl_brl = pnlNative;
            }
          } else if (o.instrument_type === 'ndf') {
            // For NDFs the stored `volume_units` is in sacks (currency=BRL) or USD (currency=USD).
            // When sacks, derive USD notional from futures leg of the same operation, sized by close proportion.
            if (o.currency === 'USD') {
              notional_usd = volume_units;
            } else if (futuresUsdNotional > 0) {
              notional_usd = Math.round(futuresUsdNotional * proporção * 100) / 100;
            }
            if (notional_usd != null) {
              // Rate is BRL/USD → result is already in BRL
              pnl_brl = sign * (closePrice - openPrice) * notional_usd;
            }
          }
        }

        rows.push({
          display_code: p.display_code,
          instrument: o.instrument_type,
          direction: closeDir,
          contracts,
          volume_units,
          notional_usd,
          price: closePrice ?? '',
          open_price: openPrice,
          pnl_brl,
        });
      }
    }
    return rows;
  }, [proposals, openOrdersByOpId, prices, fxRate]);


  const totalPnlDerivativesBRL = useMemo(
    () => previewRows.reduce((s, r) => s + (r.pnl_brl ?? 0), 0),
    [previewRows],
  );
  const totalPnlBRL = totalPnlDerivativesBRL + totalPhysicalMargin;
  const fmtBRL = (v: number) =>
    v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 2 });

  const handleExecute = async () => {
    if (!batch || !proposals || !userId) return;
    setSubmitting(true);
    try {
      const now = new Date().toISOString();
      let totalOrdersInserted = 0;

      for (const p of proposals.proposals) {
        const opOrders = openOrdersByOpId[p.operation_id] ?? [];
        const volumeToClose = Number(p.volume_to_close_sacks) || 0;
        if (volumeToClose <= 0) continue;
        const proporção = volumeToClose / (p.current_volume_sacks || 1);

        const byInstrument: Record<string, any> = {};
        for (const o of opOrders) {
          if (!byInstrument[o.instrument_type]) byInstrument[o.instrument_type] = o;
        }

        for (const [instrument, openOrder] of Object.entries(byInstrument)) {
          const contracts = Math.round((Number(openOrder.contracts) * proporção) * 100) / 100;
          const volume_units = Math.round((Number(openOrder.volume_units) * proporção) * 100) / 100;
          const direction = openOrder.direction === 'buy' ? 'sell' : 'buy';
          const priceVal = instrument === 'futures' ? (Number(prices[instrument]) || null) : null;
          const ndfRate = instrument === 'ndf' ? (Number(prices[instrument]) || null) : null;
          const premium = instrument === 'option' ? (Number(prices[instrument]) || null) : null;

          const { error } = await (supabase as any)
            .from('orders')
            .insert({
              operation_id: p.operation_id,
              batch_id: batch.id,
              instrument_type: instrument,
              direction,
              currency: openOrder.currency,
              contracts,
              volume_units,
              price: priceVal,
              ndf_rate: ndfRate,
              ndf_maturity: openOrder.ndf_maturity ?? null,
              option_type: openOrder.option_type ?? null,
              strike: openOrder.strike ?? null,
              expiration_date: openOrder.expiration_date ?? null,
              ticker: openOrder.ticker ?? null,
              is_counterparty_insurance: false,
              is_closing: true,
              closes_order_id: openOrder.id,
              executed_at: now,
              executed_by: userId,
              premium,
            });
          if (error) throw new Error(error.message);
          totalOrdersInserted++;
        }
      }

      // Atomic physical writes via RPC (physical_sales + operations + batch.physical_executed)
      const totalVol = proposals.proposals.reduce((s, p) => s + (Number(p.volume_to_close_sacks) || 0), 0);
      const weightedPrice = totalVol > 0
        ? proposals.proposals.reduce(
            (s, p) => s + (Number(physicalPrices[p.operation_id]) || 0) * (Number(p.volume_to_close_sacks) || 0), 0
          ) / totalVol
        : 0;

      const salesPayload = proposals.proposals.map(p => ({
        operation_id: p.operation_id,
        volume_sacks: Number(p.volume_to_close_sacks) || 0,
        price_brl_per_sack: Number(physicalPrices[p.operation_id]) || 0,
        current_volume_sacks: Number(p.current_volume_sacks) || 0,
      }));

      const { error: rpcError } = await (supabase as any).rpc('execute_block_trade_physical', {
        p_batch_id: batch.id,
        p_user_id: userId,
        p_sales: salesPayload,
        p_weighted_price: weightedPrice,
      });
      if (rpcError) throw new Error(rpcError.message);

      const { error: batchError } = await (supabase as any)
        .from('warehouse_closing_batches')
        .update({ status: 'EXECUTED', generated_orders_count: totalOrdersInserted })
        .eq('id', batch.id);
      if (batchError) throw new Error(batchError.message);

      const totalRevenue = proposals.proposals.reduce(
        (s, p) => s + (Number(physicalPrices[p.operation_id]) || 0) * (Number(p.volume_to_close_sacks) || 0), 0
      );
      setExecutedPhysicalAvg(weightedPrice);
      setExecutedPhysicalRevenue(totalRevenue);
      setExecutedSummary(proposals.proposals.map(p => ({
        display_code: p.display_code,
        volume_closed: Number(p.volume_to_close_sacks) || 0,
      })));
      toast.success('Batch executado com sucesso');
    } catch (e: any) {
      toast.error('Erro ao executar batch: ' + (e?.message ?? String(e)));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className={`${step === 2 ? 'max-w-4xl' : 'max-w-2xl'} max-h-[90vh] overflow-y-auto`}>
        <DialogHeader>
          <DialogTitle>
            {executedSummary ? 'Execução Concluída' : step === 1 ? 'Ajustar Volumes e Preços' : 'Revisar Execução'}
          </DialogTitle>
        </DialogHeader>

        {!proposals || !batch ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            Nenhum batch selecionado.
          </div>
        ) : executedSummary ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-green-500">
              <span className="text-lg">✓</span>
              <span className="font-medium">Batch executado com sucesso</span>
            </div>
            {executedPhysicalAvg != null && executedPhysicalRevenue != null && (
              <div className="rounded-md border border-border bg-muted/40 px-4 py-3 text-sm">
                <span className="font-medium">Físico vendido</span> — preço médio{' '}
                <span className="font-semibold">{fmtBRL(executedPhysicalAvg)}/sc</span>{' '}
                · receita total <span className="font-semibold">{fmtBRL(executedPhysicalRevenue)}</span>
              </div>
            )}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Operação</TableHead>
                  <TableHead className="text-right">Volume fechado (sc)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {executedSummary.map((s, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-mono text-xs">{s.display_code}</TableCell>
                    <TableCell className="text-right">
                      {Number(s.volume_closed).toLocaleString('pt-BR', { maximumFractionDigits: 4 })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Button className="w-full" onClick={() => { onExecuted(); onClose(); }}>
              Fechar
            </Button>
          </div>
        ) : step === 1 ? (
          <div className="space-y-4">
            {batchInstruments.length === 0 && (
              <p className="text-xs text-muted-foreground">Nenhum instrumento encontrado nas operações do batch.</p>
            )}

            {/* Um card por instrumento (preço único do batch) */}
            {batchInstruments.map(instrument => {
              const isNdf = instrument === 'ndf';
              const ticker = tickerByInstrument[instrument];
              const sug = suggestedPrices[instrument];
              const label = isNdf ? 'Taxa NDF (R$/USD)'
                : instrument === 'futures' ? 'Preço (USD/bushel)'
                : `${instrument} (premium)`;
              return (
                <Card key={instrument}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline">{instrument}</Badge>
                      <Badge variant="secondary">sell (fechamento)</Badge>
                      <Badge>{isNdf ? 'BRL' : 'USD'}</Badge>
                      {ticker && <span className="font-mono text-xs text-muted-foreground">{ticker}</span>}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div>
                      <Label className="text-xs">{label}</Label>
                      <Input
                        type="number"
                        step="0.0001"
                        placeholder="Preço real executado"
                        value={prices[instrument] ?? ''}
                        onChange={(e) => setPrices(prev => ({ ...prev, [instrument]: e.target.value === '' ? '' : parseFloat(e.target.value) }))}
                        className="h-9"
                      />
                      {sug && (
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          Sugerido: {sug.value.toLocaleString('pt-BR', { maximumFractionDigits: 4 })} ({sug.ticker})
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}

            {/* Card único para físico — preço por operação */}
            <Card className="border-primary/30">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline">físico</Badge>
                  <Badge variant="secondary">venda</Badge>
                  <Badge>BRL</Badge>
                  {marketRefPrice != null && (
                    <span className="text-xs text-muted-foreground">
                      Mercado da praça: R$ {marketRefPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/sc
                    </span>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="space-y-1.5">
                  {proposals.proposals.map((p) => {
                    const op = operationsById[p.operation_id];
                    const orig = Number(op?.origination_price_brl ?? 0);
                    const isEditing = editingPhysical.has(p.operation_id);
                    const value = physicalPrices[p.operation_id];
                    const numericValue = typeof value === 'number' ? value : (value === '' ? null : parseFloat(value as any));
                    const toggleEdit = () => {
                      setEditingPhysical(prev => {
                        const next = new Set(prev);
                        if (next.has(p.operation_id)) next.delete(p.operation_id);
                        else next.add(p.operation_id);
                        return next;
                      });
                    };
                    return (
                      <div key={p.operation_id} className="flex items-center gap-3 rounded-md border border-border/60 bg-muted/20 px-3 py-2">
                        <span className="font-mono text-xs flex-1 truncate">{p.display_code}</span>
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {Number(p.volume_to_close_sacks).toLocaleString('pt-BR', { maximumFractionDigits: 0 })} sc
                        </span>
                        <span className="text-xs text-muted-foreground tabular-nums">
                          orig. {orig > 0 ? `R$ ${orig.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}
                        </span>
                        <div className="flex items-center gap-1.5">
                          {isEditing ? (
                            <>
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                placeholder="0,00"
                                value={value ?? ''}
                                onChange={(e) => setPhysicalPrices(prev => ({
                                  ...prev,
                                  [p.operation_id]: e.target.value === '' ? '' : parseFloat(e.target.value),
                                }))}
                                autoFocus
                                className="h-7 w-24 text-right text-xs"
                              />
                              <Button type="button" size="icon" variant="ghost" className="h-6 w-6" onClick={toggleEdit}>
                                <Check className="h-3.5 w-3.5" />
                              </Button>
                            </>
                          ) : (
                            <>
                              <span className={`text-sm font-medium tabular-nums w-24 text-right ${numericValue && numericValue > 0 ? '' : 'text-muted-foreground'}`}>
                                {numericValue && numericValue > 0
                                  ? `R$ ${numericValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                                  : '—'}
                              </span>
                              <Button type="button" size="icon" variant="ghost" className="h-6 w-6" onClick={toggleEdit}>
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  * Preço de venda do físico — obrigatório por operação. Pré-preenchido com{' '}
                  {batch?.physical_sale_price_estimated_brl_per_sack != null
                    ? <>estimativa do batch (R$ {Number(batch.physical_sale_price_estimated_brl_per_sack).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/sc)</>
                    : marketRefPrice != null
                      ? <>último preço da praça (R$ {marketRefPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/sc)</>
                      : <>preço de originação (fallback)</>}
                  .
                </p>
              </CardContent>
            </Card>

            <div className="flex items-center justify-between gap-3 pt-2">
              <div className="text-xs text-muted-foreground">
                Resultado estimado:{' '}
                <span className={`font-semibold ${totalPnlBRL >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {fmtBRL(totalPnlBRL)}
                </span>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={onClose}>Cancelar</Button>
                <Button disabled={!canReview} onClick={() => setStep(2)}>
                  Revisar →
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {(() => {
              const futuresRows = previewRows.filter(r => r.instrument === 'futures');
              const ndfRows = previewRows.filter(r => r.instrument === 'ndf');
              const otherRows = previewRows.filter(r => r.instrument !== 'futures' && r.instrument !== 'ndf');
              return (
                <>
                  {futuresRows.length > 0 && (
                    <div className="space-y-2">
                      <h3 className="text-sm font-semibold">Futures</h3>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Operação</TableHead>
                            <TableHead>Direção</TableHead>
                            <TableHead className="text-right">Contratos</TableHead>
                            <TableHead className="text-right">Volume (sc)</TableHead>
                            <TableHead className="text-right">Preço aberto</TableHead>
                            <TableHead className="text-right">Preço fech.</TableHead>
                            <TableHead className="text-right">Resultado (R$)</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {futuresRows.map((r, i) => (
                            <TableRow key={`f-${i}`}>
                              <TableCell className="font-mono text-xs">{r.display_code}</TableCell>
                              <TableCell className="text-xs uppercase">{r.direction}</TableCell>
                              <TableCell className="text-right">{r.contracts.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}</TableCell>
                              <TableCell className="text-right">{r.volume_units.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}</TableCell>
                              <TableCell className="text-right">{r.open_price == null ? '—' : r.open_price.toLocaleString('pt-BR', { maximumFractionDigits: 4 })}</TableCell>
                              <TableCell className="text-right">{r.price === '' ? '—' : Number(r.price).toLocaleString('pt-BR', { maximumFractionDigits: 4 })}</TableCell>
                              <TableCell className={`text-right font-medium ${r.pnl_brl == null ? '' : r.pnl_brl >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                {r.pnl_brl == null ? '—' : fmtBRL(r.pnl_brl)}
                              </TableCell>
                            </TableRow>
                          ))}
                          <TableRow>
                            <TableCell colSpan={6} className="text-right text-xs font-semibold">Subtotal Futures</TableCell>
                            <TableCell className={`text-right font-semibold ${futuresRows.reduce((s, r) => s + (r.pnl_brl ?? 0), 0) >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                              {fmtBRL(futuresRows.reduce((s, r) => s + (r.pnl_brl ?? 0), 0))}
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>
                  )}

                  {ndfRows.length > 0 && (
                    <div className="space-y-2">
                      <h3 className="text-sm font-semibold">NDF</h3>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Operação</TableHead>
                            <TableHead>Direção</TableHead>
                            <TableHead className="text-right">Contratos</TableHead>
                            <TableHead className="text-right">Notional (USD)</TableHead>
                            <TableHead className="text-right">Taxa aberta</TableHead>
                            <TableHead className="text-right">Taxa fech.</TableHead>
                            <TableHead className="text-right">Resultado (R$)</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {ndfRows.map((r, i) => (
                            <TableRow key={`n-${i}`}>
                              <TableCell className="font-mono text-xs">{r.display_code}</TableCell>
                              <TableCell className="text-xs uppercase">{r.direction}</TableCell>
                              <TableCell className="text-right">{r.contracts.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}</TableCell>
                              <TableCell className="text-right">{r.notional_usd == null ? '—' : r.notional_usd.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</TableCell>
                              <TableCell className="text-right">{r.open_price == null ? '—' : r.open_price.toLocaleString('pt-BR', { maximumFractionDigits: 4 })}</TableCell>
                              <TableCell className="text-right">{r.price === '' ? '—' : Number(r.price).toLocaleString('pt-BR', { maximumFractionDigits: 4 })}</TableCell>
                              <TableCell className={`text-right font-medium ${r.pnl_brl == null ? '' : r.pnl_brl >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                {r.pnl_brl == null ? '—' : fmtBRL(r.pnl_brl)}
                              </TableCell>
                            </TableRow>
                          ))}
                          <TableRow>
                            <TableCell colSpan={6} className="text-right text-xs font-semibold">Subtotal NDF</TableCell>
                            <TableCell className={`text-right font-semibold ${ndfRows.reduce((s, r) => s + (r.pnl_brl ?? 0), 0) >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                              {fmtBRL(ndfRows.reduce((s, r) => s + (r.pnl_brl ?? 0), 0))}
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>
                  )}

                  {physicalRows.length > 0 && (
                    <div className="space-y-2">
                      <h3 className="text-sm font-semibold">Físico</h3>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Operação</TableHead>
                            <TableHead className="text-right">Volume (sc)</TableHead>
                            <TableHead className="text-right">Preço orig.</TableHead>
                            <TableHead className="text-right">Preço venda</TableHead>
                            <TableHead className="text-right">Receita (R$)</TableHead>
                            <TableHead className="text-right">Margem física (R$)</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {physicalRows.map((r, i) => (
                            <TableRow key={`ph-${i}`}>
                              <TableCell className="font-mono text-xs">{r.display_code}</TableCell>
                              <TableCell className="text-right">{r.volume.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}</TableCell>
                              <TableCell className="text-right">{r.orig > 0 ? r.orig.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}</TableCell>
                              <TableCell className="text-right">{r.venda.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                              <TableCell className="text-right">{fmtBRL(r.receita)}</TableCell>
                              <TableCell className={`text-right font-medium ${r.margem >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                {fmtBRL(r.margem)}
                              </TableCell>
                            </TableRow>
                          ))}
                          <TableRow>
                            <TableCell colSpan={4} className="text-right text-xs font-semibold">Subtotal Físico</TableCell>
                            <TableCell className="text-right text-xs font-semibold">{fmtBRL(totalPhysicalRevenue)}</TableCell>
                            <TableCell className={`text-right font-semibold ${totalPhysicalMargin >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                              {fmtBRL(totalPhysicalMargin)}
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                      {/* Guardrails */}
                      {physicalRows.filter(r => r.origDeviation > 0.30).map(r => (
                        <p key={`warn-orig-${r.operation_id}`} className="text-xs text-amber-500">
                          ⚠ {r.display_code}: margem física fora do padrão (variação &gt; 30% sobre originação).
                        </p>
                      ))}
                      {marketRefPrice != null
                        ? physicalRows.filter(r => r.marketDeviation != null && r.marketDeviation > 0.10).map(r => (
                            <p key={`warn-mkt-${r.operation_id}`} className="text-xs text-amber-500">
                              ⚠ {r.display_code}: preço diverge mais de 10% do mercado da praça (ref. R$ {marketRefPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/sc).
                            </p>
                          ))
                        : (
                          <p className="text-xs text-blue-400">
                            ℹ Sem preço de mercado de referência para esta praça/commodity — guardrail de divergência de mercado desabilitado.
                          </p>
                        )}
                    </div>
                  )}

                  {otherRows.length > 0 && (
                    <div className="space-y-2">
                      <h3 className="text-sm font-semibold">Outros</h3>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Operação</TableHead>
                            <TableHead>Instrumento</TableHead>
                            <TableHead>Direção</TableHead>
                            <TableHead className="text-right">Contratos</TableHead>
                            <TableHead className="text-right">Volume</TableHead>
                            <TableHead className="text-right">Preço</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {otherRows.map((r, i) => (
                            <TableRow key={`o-${i}`}>
                              <TableCell className="font-mono text-xs">{r.display_code}</TableCell>
                              <TableCell className="text-xs">{r.instrument}</TableCell>
                              <TableCell className="text-xs uppercase">{r.direction}</TableCell>
                              <TableCell className="text-right">{r.contracts.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}</TableCell>
                              <TableCell className="text-right">{r.volume_units.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}</TableCell>
                              <TableCell className="text-right">{r.price === '' ? '—' : Number(r.price).toLocaleString('pt-BR', { maximumFractionDigits: 4 })}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </>
              );
            })()}
            <div className="flex items-center justify-between rounded-md border border-border bg-muted/40 px-4 py-3">
              <span className="text-sm font-semibold">Resultado total estimado</span>
              <span className={`text-lg font-bold ${totalPnlBRL >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {fmtBRL(totalPnlBRL)}
              </span>
            </div>
            {fxRate == null && previewRows.some(r => r.instrument === 'futures') && (
              <p className="text-xs text-muted-foreground">
                Taxa USD/BRL não encontrada em market_data — resultado de futures USD não convertido.
              </p>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setStep(1)} disabled={submitting}>← Voltar</Button>
              <Button variant="destructive" onClick={handleExecute} disabled={submitting}>
                {submitting ? 'Executando...' : 'Confirmar Execução'}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ArmazensD24;

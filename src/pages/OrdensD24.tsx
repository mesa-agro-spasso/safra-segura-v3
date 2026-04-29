import React, { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useActiveArmazens } from '@/hooks/useWarehouses';
import { useOperations } from '@/hooks/useOperations';
import { useMarketData } from '@/hooks/useMarketData';
import { useAuth } from '@/contexts/AuthContext';
import { validateExecution, type ValidateExecutionResponse } from '@/services/d24Api';
import type { HedgePlanItemIn, OperationIn, OrderIn } from '@/types/d24';
import type { HedgeOrder, Operation } from '@/types';
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
import { ChevronDown, AlertCircle, CheckCircle2, Info, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

// ───────────────────────── helpers ─────────────────────────

const STATUS_ORDER: Record<string, number> = {
  SENT: 1, APPROVED: 2, GENERATED: 3, EXECUTED: 4, CANCELLED: 5,
};

const STATUS_OPTIONS = ['GENERATED', 'SENT', 'APPROVED', 'EXECUTED', 'CANCELLED'] as const;

const COMMODITY_OPTIONS: { value: string; label: string }[] = [
  { value: 'soybean|cbot', label: 'Soja CBOT' },
  { value: 'corn|b3', label: 'Milho B3' },
];

function formatDateBR(iso: string | null | undefined): string {
  if (!iso) return '--';
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

function formatNumberBR(n: number | null | undefined, fractionDigits = 0): string {
  if (n == null || isNaN(Number(n))) return '--';
  return Number(n).toLocaleString('pt-BR', {
    minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits,
  });
}

function commodityLabel(c: string): string {
  if (c === 'soybean') return 'Soja';
  if (c === 'corn') return 'Milho';
  return c;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    GENERATED: 'bg-muted text-muted-foreground',
    SENT: 'border border-blue-500 text-blue-500 bg-transparent',
    APPROVED: 'border border-yellow-500 text-yellow-500 bg-transparent',
    EXECUTED: 'bg-green-600 text-white',
    CANCELLED: 'bg-red-600 text-white',
  };
  const labels: Record<string, string> = {
    GENERATED: 'Gerada', SENT: 'Enviada', APPROVED: 'Aprovada', EXECUTED: 'Executada', CANCELLED: 'Cancelada',
  };
  return <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${map[status] ?? ''}`}>{labels[status] ?? status}</span>;
}

function CommodityBadge({ commodity }: { commodity: string }) {
  return <Badge variant="outline">{commodityLabel(commodity)}</Badge>;
}

function priceUnitLabel(legType: string, exchange: string): string {
  if (legType === 'ndf') return 'BRL/USD';
  if (exchange.toLowerCase() === 'cbot') return 'USD/bushel';
  if (exchange.toLowerCase() === 'b3') return 'BRL/sc';
  return '';
}

function contractSizeFor(exchange: string): number {
  return exchange.toLowerCase() === 'b3' ? 450 : 5000;
}

// ───────────────────────── MultiSelect ─────────────────────────

interface MultiSelectProps {
  label: string;
  options: { value: string; label: string }[];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
  placeholder?: string;
}

function MultiSelect({ label, options, selected, onChange, placeholder = 'Todas' }: MultiSelectProps) {
  const [open, setOpen] = useState(false);
  const triggerLabel =
    selected.size === 0 ? placeholder
    : selected.size === 1 ? options.find(o => o.value === [...selected][0])?.label ?? '1 selecionada'
    : `${selected.size} selecionadas`;

  const toggle = (value: string) => {
    const next = new Set(selected);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    onChange(next);
  };

  return (
    <div className="flex flex-col gap-1 min-w-[180px]">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" className="justify-between font-normal">
            <span className="truncate">{triggerLabel}</span>
            <ChevronDown className="h-4 w-4 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="p-2 w-[260px] max-h-[320px] overflow-auto" align="start">
          {options.length === 0 && <div className="text-xs text-muted-foreground px-2 py-1">Nenhuma opção</div>}
          {options.map(opt => (
            <label key={opt.value} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent cursor-pointer">
              <Checkbox checked={selected.has(opt.value)} onCheckedChange={() => toggle(opt.value)} />
              <span className="text-sm">{opt.label}</span>
            </label>
          ))}
        </PopoverContent>
      </Popover>
    </div>
  );
}

// ───────────────────────── execution modal types ─────────────────────────

type ExecutionLeg = {
  leg_type: string;
  direction: string;
  ticker?: string;
  contracts?: number;
  volume_units?: number;
  currency: string;
  _price: string;
  _qty: string;
  _notes: string;
};

type LegValidation = {
  status: 'idle' | 'loading' | 'done' | 'error';
  result?: ValidateExecutionResponse;
  errorMsg?: string;
};

// Bridge between legacy Operation type (no D24 columns declared) and runtime row.
type OperationRow = Operation & {
  exchange?: string;
  origination_price_brl?: number;
  trade_date?: string;
  payment_date?: string;
  grain_reception_date?: string;
  sale_date?: string;
  hedge_plan?: unknown;
  display_code?: string;
};

// ───────────────────────── main page ─────────────────────────

const OrdensD24: React.FC = () => {
  const queryClient = useQueryClient();
  const { data: orders = [] } = useQuery({
    queryKey: ['d24-orders-all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders' as any)
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });
  const { data: warehouses = [] } = useActiveArmazens();
  const { data: operationsRaw = [] } = useOperations();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: marketData = [] } = useMarketData();
  const [closingOrder, setClosingOrder] = useState<any | null>(null);

  const operations = operationsRaw as OperationRow[];

  // ── Filter state
  const [praca, setPraca] = useState<Set<string>>(new Set());
  const [commodity, setCommodity] = useState<Set<string>>(new Set());
  const [operacao, setOperacao] = useState<Set<string>>(new Set());
  const [filtersOpen, setFiltersOpen] = useState(false);

  // ── Maps
  const opById = useMemo(() => {
    const m = new Map<string, OperationRow>();
    operations.forEach(o => m.set(o.id, o));
    return m;
  }, [operations]);

  const warehouseNameById = useMemo(() => {
    const m = new Map<string, string>();
    warehouses.forEach(w => m.set(w.id, w.display_name));
    return m;
  }, [warehouses]);

  const operationOptions = useMemo(
    () => operations
      .filter(o => o.display_code)
      .map(o => ({ value: o.id, label: o.display_code! })),
    [operations],
  );

  const pracaOptions = useMemo(
    () => warehouses.map(w => ({ value: w.id, label: w.display_name })),
    [warehouses],
  );

  // ── Filtering + sort
  const filtered = useMemo(() => {
    const list = (orders as any[]).filter((order: any) => {
      const op = opById.get(order.operation_id);
      // Praça
      if (praca.size > 0) {
        if (!op || !praca.has(op.warehouse_id)) return false;
      }
      // Commodity (commodity|exchange) — derived from operation
      if (commodity.size > 0) {
        const key = `${op?.commodity}|${((op as any)?.exchange ?? 'cbot').toLowerCase()}`;
        if (!commodity.has(key)) return false;
      }
      // Operação
      if (operacao.size > 0) {
        if (!operacao.has(order.operation_id)) return false;
      }
      return true;
    });

    return [...list].sort((a: any, b: any) => {
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [orders, opById, praca, commodity, operacao]);

  // ── Filter actions
  const selectAll = () => {
    setPraca(new Set(pracaOptions.map(o => o.value)));
    setCommodity(new Set(COMMODITY_OPTIONS.map(o => o.value)));
    setOperacao(new Set(operationOptions.map(o => o.value)));
  };
  const clearAll = () => {
    setPraca(new Set()); setCommodity(new Set()); setOperacao(new Set());
  };

  // D24: ordens são imutáveis — sem ações de transição.
  const renderActions = (_order: any) => null;

  const legsSummary = (order: any): string => {
    return `${order.instrument_type}(${order.direction})`;
  };

  const activeFiltersCount =
    (praca.size > 0 ? 1 : 0) +
    (commodity.size > 0 ? 1 : 0) +
    (operacao.size > 0 ? 1 : 0);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Ordens D24</h1>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader className="pb-3">
          <button
            type="button"
            onClick={() => setFiltersOpen(o => !o)}
            className="flex items-center justify-between w-full gap-3 text-left"
          >
            <div className="flex items-center gap-2">
              <ChevronDown className={`h-4 w-4 transition-transform ${filtersOpen ? '' : '-rotate-90'}`} />
              <CardTitle className="text-base">Filtros</CardTitle>
              {!filtersOpen && activeFiltersCount > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {activeFiltersCount} {activeFiltersCount === 1 ? 'filtro ativo' : 'filtros ativos'}
                </Badge>
              )}
            </div>
            {filtersOpen && (
              <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                <Button size="sm" variant="outline" onClick={selectAll}>Selecionar Todos</Button>
                <Button size="sm" variant="outline" onClick={clearAll}>Limpar Filtros</Button>
              </div>
            )}
          </button>
        </CardHeader>
        {filtersOpen && (
          <CardContent>
            <div className="flex flex-wrap gap-3">
              <MultiSelect label="Praça" options={pracaOptions} selected={praca} onChange={setPraca} />
              <MultiSelect label="Commodity" options={COMMODITY_OPTIONS} selected={commodity} onChange={setCommodity} />
              <MultiSelect label="Operação" options={operationOptions} selected={operacao} onChange={setOperacao} />
              
            </div>
          </CardContent>
        )}
      </Card>

      {/* Tabela */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Praça</TableHead>
                <TableHead>ID Operação</TableHead>
                <TableHead>Commodity</TableHead>
                <TableHead className="text-right">Volume (sc)</TableHead>
                <TableHead className="text-right">Preço orig.</TableHead>
                <TableHead>Pernas</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Data</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground py-8">Nenhuma ordem</TableCell>
                </TableRow>
              )}
              {filtered.map((order: any) => {
                const op = opById.get(order.operation_id);
                const pracaName = op ? warehouseNameById.get(op.warehouse_id) ?? op.warehouse_id : '--';
                const opCode = op?.display_code ?? `${order.id.slice(0, 8)}…`;
                const orderCommodity = op?.commodity ?? '--';
                const volumeSacks = op?.volume_sacks ?? null;
                const originationPrice = (op as any)?.origination_price_brl ?? null;
                return (
                  <TableRow key={order.id}>
                    <TableCell>{pracaName}</TableCell>
                    <TableCell className="font-mono text-xs">{opCode}</TableCell>
                    <TableCell><CommodityBadge commodity={orderCommodity} /></TableCell>
                    <TableCell className="text-right">{formatNumberBR(volumeSacks)}</TableCell>
                    <TableCell className="text-right">R$ {formatNumberBR(originationPrice, 2)}</TableCell>
                    <TableCell className="text-xs">{legsSummary(order)}</TableCell>
                    <TableCell><StatusBadge status="EXECUTED" /></TableCell>
                    <TableCell className="text-xs">{formatDateBR(order.created_at)}</TableCell>
                    <TableCell className="text-right">{renderActions(order)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default OrdensD24;

// ───────────────────────── Detail Sheet ─────────────────────────

const DetailSheet: React.FC<{ order: HedgeOrder | null; onClose: () => void }> = ({ order, onClose }) => {
  return (
    <Sheet open={!!order} onOpenChange={open => { if (!open) onClose(); }}>
      <SheetContent side="right" className="sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Detalhe da ordem</SheetTitle>
        </SheetHeader>
        {order && (
          <div className="space-y-4 mt-4 text-sm">
            <section>
              <h3 className="font-semibold mb-2">Identificação</h3>
              <dl className="grid grid-cols-2 gap-y-1">
                <dt className="text-muted-foreground">Código</dt><dd className="font-mono text-xs">{order.display_code ?? order.id}</dd>
                <dt className="text-muted-foreground">Commodity</dt><dd>{commodityLabel(order.commodity)}</dd>
                <dt className="text-muted-foreground">Exchange</dt><dd>{order.exchange}</dd>
                <dt className="text-muted-foreground">Status</dt><dd><StatusBadge status={order.status} /></dd>
                <dt className="text-muted-foreground">Criada em</dt><dd>{formatDateBR(order.created_at)}</dd>
                {order.notes && (<><dt className="text-muted-foreground">Observações</dt><dd>{order.notes}</dd></>)}
              </dl>
            </section>
            <Separator />
            <section>
              <h3 className="font-semibold mb-2">Volume e preço</h3>
              <dl className="grid grid-cols-2 gap-y-1">
                <dt className="text-muted-foreground">Volume</dt><dd>{formatNumberBR(order.volume_sacks)} sc</dd>
                <dt className="text-muted-foreground">Preço origem</dt><dd>R$ {formatNumberBR(order.origination_price_brl, 2)}/sc</dd>
              </dl>
            </section>
            <Separator />
            <section>
              {(() => {
                const executedLegs = (order.executed_legs ?? []) as Array<Record<string, unknown>>;
                const useExecuted =
                  order.status === 'EXECUTED' && executedLegs.length > 0;
                const legsToShow = useExecuted
                  ? executedLegs
                  : ((order.legs ?? []) as Array<Record<string, unknown>>);
                const label = useExecuted ? 'Pernas executadas' : 'Pernas planejadas';
                return (
                  <>
                    <h3 className="font-semibold mb-2">{label}</h3>
                    <div className="space-y-3">
                      {legsToShow.map((leg, i) => (
                        <div key={i} className="border border-border rounded p-2">
                          <dl className="grid grid-cols-2 gap-y-1">
                            {Object.entries(leg)
                              .filter(([, v]) => v !== null && v !== undefined && v !== '')
                              .map(([k, v]) => (
                                <React.Fragment key={k}>
                                  <dt className="text-muted-foreground text-xs">{k}</dt>
                                  <dd className="text-xs">{typeof v === 'object' ? JSON.stringify(v) : String(v)}</dd>
                                </React.Fragment>
                              ))}
                          </dl>
                        </div>
                      ))}
                      {legsToShow.length === 0 && <div className="text-muted-foreground text-xs">Sem legs</div>}
                    </div>
                  </>
                );
              })()}
            </section>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
};

// ───────────────────────── Execution Modal ─────────────────────────

interface ExecutionModalProps {
  order: HedgeOrder | null;
  operation: OperationRow | null;
  userId: string | null;
  onClose: () => void;
  onExecuted: (updates: Record<string, unknown>) => Promise<void>;
}

const ExecutionModal: React.FC<ExecutionModalProps> = ({ order, operation, userId, onClose, onExecuted }) => {
  const [legs, setLegs] = useState<ExecutionLeg[]>([]);
  const [validations, setValidations] = useState<LegValidation[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // Initialize on open
  React.useEffect(() => {
    if (!order) {
      setLegs([]); setValidations([]); return;
    }
    const rawLegs = (order.legs ?? []) as Array<Record<string, unknown>>;
    const initial: ExecutionLeg[] = rawLegs.map(l => ({
      leg_type: String(l.leg_type ?? l.instrument_type ?? 'futures'),
      direction: String(l.direction ?? 'sell'),
      ticker: l.ticker ? String(l.ticker) : undefined,
      contracts: typeof l.contracts === 'number' ? l.contracts : undefined,
      volume_units: typeof l.volume_units === 'number' ? l.volume_units : undefined,
      currency: String(l.currency ?? (String(l.leg_type) === 'ndf' ? 'BRL' : 'USD')),
      _price: '',
      _qty: '',
      _notes: '',
    }));
    setLegs(initial);
    setValidations(initial.map(() => ({ status: 'idle' })));
  }, [order]);

  if (!order) return null;

  const updateLeg = (i: number, patch: Partial<ExecutionLeg>) => {
    setLegs(prev => prev.map((l, j) => j === i ? { ...l, ...patch } : l));
    setValidations(prev => prev.map((v, j) => j === i ? { status: 'idle' } : v));
  };

  const buildOperationIn = (): { ok: true; op: OperationIn } | { ok: false; reason: string } => {
    if (!operation) return { ok: false, reason: 'Operação não encontrada.' };
    const required: Array<keyof OperationRow> = [
      'warehouse_id', 'commodity', 'volume_sacks',
    ];
    for (const k of required) {
      if (operation[k] == null) return { ok: false, reason: `Campo obrigatório ausente em operations: ${String(k)}` };
    }
    const exchange = operation.exchange ?? order.exchange;
    const trade_date = operation.trade_date;
    const payment_date = operation.payment_date;
    const grain_reception_date = operation.grain_reception_date;
    const sale_date = operation.sale_date;
    const origination_price_brl = operation.origination_price_brl ?? order.origination_price_brl;
    if (!trade_date || !payment_date || !grain_reception_date || !sale_date) {
      return { ok: false, reason: 'Datas da operação ausentes (trade/payment/grain_reception/sale).' };
    }
    if (origination_price_brl == null) {
      return { ok: false, reason: 'origination_price_brl ausente na operação.' };
    }
    return {
      ok: true,
      op: {
        id: operation.id,
        warehouse_id: operation.warehouse_id,
        commodity: operation.commodity,
        exchange,
        volume_sacks: operation.volume_sacks,
        origination_price_brl,
        trade_date,
        payment_date,
        grain_reception_date,
        sale_date,
        status: operation.status,
        hedge_plan: (operation.hedge_plan as HedgePlanItemIn[] | undefined) ?? [],
      },
    };
  };

  const validateLeg = async (i: number) => {
    if (!userId) {
      toast.error('Usuário não autenticado.');
      return;
    }
    const leg = legs[i];
    const qty = parseFloat(leg._qty);
    const price = parseFloat(leg._price);
    if (isNaN(qty) || qty <= 0) {
      setValidations(prev => prev.map((v, j) => j === i ? { status: 'error', errorMsg: 'Quantidade inválida' } : v));
      return;
    }
    if (isNaN(price) || price <= 0) {
      setValidations(prev => prev.map((v, j) => j === i ? { status: 'error', errorMsg: 'Preço inválido' } : v));
      return;
    }

    const opBuild: { ok: true; op: OperationIn } | { ok: false; reason: string } = buildOperationIn();
    if (opBuild.ok === false) {
      const reason = opBuild.reason;
      setValidations(prev => prev.map((v, j) => j === i ? { status: 'error', errorMsg: reason } : v));
      return;
    }

    const isNdf = leg.leg_type === 'ndf';
    const exchange = opBuild.op.exchange;
    const CONTRACT_SIZE = contractSizeFor(exchange);

    const newOrder: OrderIn = {
      operation_id: order.operation_id,
      instrument_type: leg.leg_type,
      direction: leg.direction,
      currency: leg.currency,
      contracts: qty,
      volume_units: isNdf ? qty : qty * CONTRACT_SIZE,
      executed_at: new Date().toISOString(),
      executed_by: userId,
      is_closing: false,
      ticker: leg.ticker,
      price: !isNdf ? price : undefined,
      ndf_rate: isNdf ? price : undefined,
      notes: leg._notes || undefined,
    };

    setValidations(prev => prev.map((v, j) => j === i ? { status: 'loading' } : v));
    try {
      const res = await validateExecution(opBuild.op, [], newOrder);
      setValidations(prev => prev.map((v, j) => j === i ? { status: 'done', result: res } : v));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setValidations(prev => prev.map((v, j) => j === i ? { status: 'error', errorMsg: msg } : v));
    }
  };

  const allValidatedOk = legs.length > 0 && validations.every(v =>
    v.status === 'done' &&
    v.result?.is_valid === true &&
    !(v.result?.business_alerts ?? []).some(a => a.level === 'ERROR')
  );

  const validatedCount = validations.filter(v => v.status === 'done').length;

  const handleConfirm = async () => {
    if (!allValidatedOk || !userId) return;
    setSubmitting(true);
    try {
      const exchange = operation?.exchange ?? order.exchange;
      const CONTRACT_SIZE = contractSizeFor(exchange);
      const executed_legs = legs.map(leg => {
        const qty = parseFloat(leg._qty);
        const price = parseFloat(leg._price);
        const isNdf = leg.leg_type === 'ndf';
        return {
          leg_type: leg.leg_type,
          direction: leg.direction,
          ticker: leg.ticker,
          contracts: qty,
          volume_units: isNdf ? qty : qty * CONTRACT_SIZE,
          currency: leg.currency,
          price: !isNdf ? price : undefined,
          ndf_rate: isNdf ? price : undefined,
          notes: leg._notes || undefined,
        };
      });
      await onExecuted({
        status: 'EXECUTED',
        executed_legs,
        executed_at: new Date().toISOString(),
        executed_by: userId,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const exchange = operation?.exchange ?? order.exchange;

  return (
    <Dialog open={!!order} onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Executar ordem {order.display_code ?? order.id.slice(0, 8)}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {legs.length === 0 && <div className="text-muted-foreground text-sm">Esta ordem não possui legs.</div>}
          {legs.map((leg, i) => {
            const v = validations[i];
            const isNdf = leg.leg_type === 'ndf';
            const qtyLabel = isNdf ? 'Volume USD' : 'Contratos';
            const priceLabel = priceUnitLabel(leg.leg_type, exchange);
            return (
              <div key={i} className="border border-border rounded-lg p-3 space-y-3">
                <div className="text-sm font-medium flex items-center gap-2">
                  <Badge variant="outline">{leg.leg_type}</Badge>
                  {leg.ticker && <span className="font-mono text-xs">{leg.ticker}</span>}
                  <span className="text-muted-foreground">·</span>
                  <span className="text-xs uppercase">{leg.direction}</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">{qtyLabel}</Label>
                    <Input value={leg._qty} onChange={e => updateLeg(i, { _qty: e.target.value })} inputMode="decimal" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Preço</Label>
                    <Input value={leg._price} onChange={e => updateLeg(i, { _price: e.target.value })} inputMode="decimal" />
                    <span className="text-[10px] text-muted-foreground">{priceLabel}</span>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Obs.</Label>
                    <Input value={leg._notes} onChange={e => updateLeg(i, { _notes: e.target.value })} />
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <Button size="sm" variant="outline" onClick={() => validateLeg(i)} disabled={v.status === 'loading'}>
                    {v.status === 'loading' ? 'Validando...' : 'Validar leg'}
                  </Button>
                  {v.status === 'done' && v.result?.is_valid && !(v.result.business_alerts ?? []).some(a => a.level === 'ERROR') && (
                    <span className="inline-flex items-center gap-1 text-green-500 text-xs">
                      <CheckCircle2 className="h-3 w-3" /> Leg válida
                    </span>
                  )}
                </div>

                {v.status === 'error' && (
                  <div className="border border-red-500 bg-red-500/10 rounded p-2 text-xs flex gap-2 text-red-400">
                    <AlertCircle className="h-4 w-4 shrink-0" /> {v.errorMsg}
                  </div>
                )}

                {v.status === 'done' && v.result && (
                  <div className="space-y-2">
                    {(v.result.structural_errors ?? []).map((err, k) => (
                      <div key={`s-${k}`} className="border border-red-500 bg-red-500/10 rounded p-2 text-xs flex gap-2 text-red-400">
                        <AlertCircle className="h-4 w-4 shrink-0" /> {err}
                      </div>
                    ))}
                    {(v.result.business_alerts ?? []).map((a, k) => {
                      const cls = a.level === 'ERROR'
                        ? 'border-red-500 bg-red-500/10 text-red-400'
                        : a.level === 'WARNING'
                          ? 'border-yellow-500 bg-yellow-500/10 text-yellow-400'
                          : 'border-blue-500 bg-blue-500/10 text-blue-400';
                      const Icon = a.level === 'ERROR' ? AlertCircle : a.level === 'WARNING' ? AlertTriangle : Info;
                      return (
                        <div key={`b-${k}`} className={`border rounded p-2 text-xs flex gap-2 ${cls}`}>
                          <Icon className="h-4 w-4 shrink-0" />
                          <div>
                            <div className="font-medium">{a.code}</div>
                            <div>{a.message}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <DialogFooter className="flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <span className="text-xs text-muted-foreground">{validatedCount} / {legs.length} legs validadas</span>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            <Button onClick={handleConfirm} disabled={!allValidatedOk || submitting}>
              {submitting ? 'Confirmando...' : 'Confirmar Execução'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

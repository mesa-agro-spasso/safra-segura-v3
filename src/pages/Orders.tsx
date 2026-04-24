import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useHedgeOrders, useCreateHedgeOrder, useUpdateHedgeOrder } from '@/hooks/useHedgeOrders';
import { useActiveArmazens } from '@/hooks/useWarehouses';
import { usePricingSnapshots } from '@/hooks/usePricingSnapshots';
import { useCreateOperation, useOperations } from '@/hooks/useOperations';
import { useAuth } from '@/contexts/AuthContext';
import { callApi } from '@/lib/api';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Copy, Plus, AlertTriangle, Trash2, Filter, Send, Check, X as XIcon, CalendarIcon } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format, parse } from 'date-fns';
import type { HedgeOrder } from '@/types';

type Leg = {
  leg_type: 'futures' | 'ndf' | 'option' | 'seguro';
  direction: 'buy' | 'sell';
  ticker: string;
  contracts: string;
  price: string;
  currency?: string;
  ndf_rate?: string;
  strike?: string;
  premium?: string;
  option_type?: string;
  expiration_date?: string;
  notes?: string;
  volume_units?: number;
  unit_label?: string;
};

function formatDate(d: string | null | undefined): string {
  if (!d) return '--/--';
  const date = new Date(d + 'T00:00:00');
  return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}`;
}

const STATUS_ORDER: Record<string, number> = { SENT: 1, APPROVED: 2, GENERATED: 3, EXECUTED: 4, CANCELLED: 5 };
const STATUS_BADGE: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; className?: string }> = {
  GENERATED: { label: 'Gerada', variant: 'secondary' },
  SENT: { label: 'Enviada', variant: 'outline', className: 'border-blue-500 text-blue-500' },
  APPROVED: { label: 'Aprovada', variant: 'outline', className: 'border-yellow-500 text-yellow-500' },
  EXECUTED: { label: 'Executada', variant: 'default' },
  CANCELLED: { label: 'Cancelada', variant: 'destructive' },
};

function isSoybeanCbot(commodity: string, exchange: string) {
  return commodity === 'soybean' && exchange.toLowerCase() === 'cbot';
}

const CONTRACT_SIZE_BY_COMMODITY: Record<string, Record<string, number>> = {
  soybean: { cbot: 5000 },
  corn: { cbot: 5000, b3: 450 },
};

function getContractSize(commodity: string, exchange: string): number {
  const size = CONTRACT_SIZE_BY_COMMODITY[commodity]?.[exchange.toLowerCase()];
  if (!size) throw new Error(`Contract size unknown for ${commodity}/${exchange}`);
  return size;
}

function getExecutionPriceLabel(leg_type: string, commodity: string, exchange: string): string {
  if (leg_type === 'ndf') return 'BRL/USD';
  if (exchange.toLowerCase() === 'cbot') return 'USD/bushel';
  if (exchange.toLowerCase() === 'b3') return 'BRL/sc';
  return '';
}

const Orders = () => {
  const [commodityFilter, setCommodityFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [warehouseFilter, setWarehouseFilter] = useState('all');
  const [listFiltersExpanded, setListFiltersExpanded] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<HedgeOrder | null>(null);

  const { data: ordersRaw, isLoading } = useHedgeOrders({
    commodity: commodityFilter !== 'all' ? commodityFilter : undefined,
    status: statusFilter !== 'all' ? statusFilter : undefined,
  });
  const { data: warehouses } = useActiveArmazens();
  const { data: snapshots } = usePricingSnapshots();
  const { data: operations } = useOperations();
  const createOrder = useCreateHedgeOrder();
  const updateOrder = useUpdateHedgeOrder();
  const createOperation = useCreateOperation();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: currentUserData } = useQuery({
    queryKey: ['current-user-roles', user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('users').select('roles').eq('id', user!.id).single();
      return data;
    },
    enabled: !!user?.id,
  });
  const userRoles: string[] = (currentUserData?.roles as string[] | undefined) ?? [];

  const { data: orderSignatures } = useQuery({
    queryKey: ['signatures', selectedOrder?.operation_id],
    queryFn: async () => {
      const { data } = await supabase
        .from('signatures')
        .select('*, signer:users(full_name)')
        .eq('operation_id', selectedOrder!.operation_id)
        .order('signed_at', { ascending: true });
      return data ?? [];
    },
    enabled: !!selectedOrder?.operation_id,
  });

  const { data: operationStatusData } = useQuery({
    queryKey: ['operation-status', selectedOrder?.operation_id],
    queryFn: async () => {
      const { data } = await supabase
        .from('operations')
        .select('status')
        .eq('id', selectedOrder!.operation_id)
        .single();
      return data;
    },
    enabled: !!selectedOrder?.operation_id,
  });
  const operationStatus = operationStatusData?.status;

  const handleSubmitForApproval = async () => {
    if (!selectedOrder) return;
    const { error } = await supabase
      .from('operations')
      .update({ status: 'EM_APROVACAO' })
      .eq('id', selectedOrder.operation_id);
    if (error) {
      toast.error('Erro ao submeter: ' + error.message);
      return;
    }
    toast.success('Operação submetida para aprovação');
    setSelectedOrder(null);
    queryClient.invalidateQueries({ queryKey: ['operations'] });
    queryClient.invalidateQueries({ queryKey: ['hedge-orders'] });
    queryClient.invalidateQueries({ queryKey: ['operation-status'] });
  };

  // Filtered + sorted orders
  const orders = useMemo(() => {
    if (!ordersRaw) return [];
    let filtered = ordersRaw;
    if (warehouseFilter !== 'all') {
      const warehouseOps = new Set(operations?.filter(op => op.warehouse_id === warehouseFilter).map(op => op.id) ?? []);
      filtered = filtered.filter(o => o.operation_id && warehouseOps.has(o.operation_id));
    }
    return [...filtered].sort((a, b) => {
      const diff = (STATUS_ORDER[a.status] ?? 99) - (STATUS_ORDER[b.status] ?? 99);
      if (diff !== 0) return diff;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [ordersRaw, warehouseFilter, operations]);

  const operationIds = useMemo(
    () => [...new Set((orders ?? []).map(o => o.operation_id).filter(Boolean))],
    [orders]
  );
  const { data: operationStatusMap } = useQuery({
    queryKey: ['operation-statuses', operationIds],
    enabled: operationIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from('operations')
        .select('id, status')
        .in('id', operationIds);
      const map: Record<string, string> = {};
      (data ?? []).forEach((op: any) => { map[op.id] = op.status; });
      return map;
    },
  });

  const operationWarehouseMap = useMemo(() => {
    const map: Record<string, string> = {};
    operations?.forEach(op => {
      const name = warehouses?.find(w => w.id === op.warehouse_id)?.display_name ?? op.warehouse_id;
      map[op.id] = name;
    });
    return map;
  }, [operations, warehouses]);

  // Vinculação map: order.operation_id → parent order display_code
  const vinculacaoMap = useMemo(() => {
    const map: Record<string, string> = {};
    if (!operations || !ordersRaw) return map;
    for (const order of ordersRaw) {
      const op = operations.find(o => o.id === order.operation_id);
      if (!op?.parent_operation_id) continue;
      // Find hedge orders linked to parent operation
      const parentOrders = ordersRaw
        .filter(ho => ho.operation_id === op.parent_operation_id)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      const nonCancelled = parentOrders.filter(ho => ho.status !== 'CANCELLED');
      const best = nonCancelled[0] ?? parentOrders[0];
      if (best?.display_code) {
        map[order.operation_id] = best.display_code;
      }
    }
    return map;
  }, [operations, ordersRaw]);

  // === Create order form ===
  const [selectedWarehouse, setSelectedWarehouseRaw] = useState(() => sessionStorage.getItem('order_warehouse') ?? '');
  const [selectedSnapshot, setSelectedSnapshotRaw] = useState(() => sessionStorage.getItem('order_snapshot') ?? '');
  const [volume, setVolumeRaw] = useState(() => sessionStorage.getItem('order_volume') ?? '');
  const [building, setBuilding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [buildResult, setBuildResult] = useState<Record<string, unknown> | null>(() => {
    const saved = sessionStorage.getItem('order_buildResult');
    return saved ? JSON.parse(saved) : null;
  });
  const [apiOrder, setApiOrder] = useState<Record<string, unknown> | null>(() => {
    const saved = sessionStorage.getItem('order_apiOrder');
    return saved ? JSON.parse(saved) : null;
  });
  const [orderNotes, setOrderNotes] = useState(() => sessionStorage.getItem('order_notes') ?? '');
  const [commodityType, setCommodityTypeRaw] = useState(() => sessionStorage.getItem('order_commodity') ?? '');
  const [legs, setLegs] = useState<Leg[]>(() => {
    const saved = sessionStorage.getItem('order_legs');
    return saved ? JSON.parse(saved) : [];
  });
  const [linkedOperationId, setLinkedOperationIdRaw] = useState(() => sessionStorage.getItem('order_linked') ?? '');

  // Clear API response when form inputs change
  const clearApiOrder = () => {
    setApiOrder(null); setBuildResult(null);
    sessionStorage.removeItem('order_apiOrder');
    sessionStorage.removeItem('order_buildResult');
  };
  const setSelectedWarehouse = (v: string) => { setSelectedWarehouseRaw(v); sessionStorage.setItem('order_warehouse', v); clearApiOrder(); };
  const setCommodityType = (v: string) => { setCommodityTypeRaw(v); sessionStorage.setItem('order_commodity', v); setSelectedSnapshotRaw(''); sessionStorage.setItem('order_snapshot', ''); clearApiOrder(); };
  const setSelectedSnapshot = (v: string) => { setSelectedSnapshotRaw(v); sessionStorage.setItem('order_snapshot', v); clearApiOrder(); };
  const setVolume = (v: string) => { setVolumeRaw(v); sessionStorage.setItem('order_volume', v); clearApiOrder(); };
  const setLinkedOperationId = (v: string) => { setLinkedOperationIdRaw(v); sessionStorage.setItem('order_linked', v); };

  // Sync build state to sessionStorage
  useEffect(() => {
    if (apiOrder) sessionStorage.setItem('order_apiOrder', JSON.stringify(apiOrder));
    else sessionStorage.removeItem('order_apiOrder');
  }, [apiOrder]);
  useEffect(() => {
    sessionStorage.setItem('order_legs', JSON.stringify(legs));
  }, [legs]);
  useEffect(() => {
    sessionStorage.setItem('order_notes', orderNotes);
  }, [orderNotes]);
  useEffect(() => {
    if (buildResult) sessionStorage.setItem('order_buildResult', JSON.stringify(buildResult));
    else sessionStorage.removeItem('order_buildResult');
  }, [buildResult]);

  // Manual order form
  const [manualForm, setManualForm] = useState({
    commodity: 'SOJA',
    exchange: 'CBOT',
    volume_sacks: '',
    origination_price_brl: '',
    status: 'EXECUTED',
  });

  const [com, bench] = commodityType ? commodityType.split('|') : ['', ''];

  const latestDate = snapshots?.[0]?.created_at;
  const filteredSnapshots = useMemo(() => {
    if (!com || !bench || !latestDate) return [];
    return snapshots?.filter(s =>
      s.created_at === latestDate && s.commodity === com && s.benchmark === bench &&
      (!selectedWarehouse || s.warehouse_id === selectedWarehouse)
    ) ?? [];
  }, [snapshots, latestDate, com, bench, selectedWarehouse]);

  const selectedSnapshotData = useMemo(
    () => filteredSnapshots.find((s) => s.id === selectedSnapshot),
    [filteredSnapshots, selectedSnapshot]
  );

  const [insuranceModalLegIndex, setInsuranceModalLegIndex] = useState<number | null>(null);
  const [previousLegType, setPreviousLegType] = useState<Leg['leg_type'] | null>(null);

  const updateLeg = (index: number, field: keyof Leg, value: any) => {
    setLegs(prev => prev.map((l, i) => i === index ? { ...l, [field]: value } : l));
    setBuildResult(null);
  };
  const addLeg = () => {
    setLegs(prev => [...prev, { leg_type: 'futures', direction: 'sell', ticker: '', contracts: '', price: '', notes: '' }]);
    setBuildResult(null);
  };
  const removeLeg = (index: number) => {
    setLegs(prev => prev.filter((_, i) => i !== index));
    setBuildResult(null);
  };

  const BUSHELS_PER_SACK_SOYBEAN = 2.20462;
  const brlSackToDisplayUnit = (brlSack: number): number => {
    const isCbotSoy = com === 'soybean' && bench === 'cbot';
    if (!isCbotSoy) return brlSack;
    const outputsJson = (selectedSnapshotData?.outputs_json as Record<string, unknown>) ?? {};
    const rate = (outputsJson.exchange_rate as number) ?? 0;
    if (!rate) return 0;
    return (brlSack / rate / BUSHELS_PER_SACK_SOYBEAN) * 100;
  };

  const handleLegTypeChange = (index: number, value: string) => {
    if (value === 'seguro') {
      if (!selectedSnapshotData) {
        toast.error('Selecione um preço de referência primeiro');
        return;
      }
      setPreviousLegType(legs[index].leg_type);
      updateLeg(index, 'leg_type', 'seguro');
      setInsuranceModalLegIndex(index);
    } else {
      updateLeg(index, 'leg_type', value);
    }
  };

  const handleInsuranceSelect = (insuranceOption: Record<string, unknown>) => {
    if (insuranceModalLegIndex === null) return;
    const strike = brlSackToDisplayUnit((insuranceOption.strike_brl as number) ?? 0);
    const premium = brlSackToDisplayUnit((insuranceOption.premium_brl as number) ?? 0);
    setLegs(prev => prev.map((l, i) => i === insuranceModalLegIndex ? {
      ...l,
      leg_type: 'option' as const,
      direction: 'buy' as const,
      option_type: 'call',
      strike: String(strike),
      premium: String(premium),
      expiration_date: (() => {
        const ij = (selectedSnapshotData?.inputs_json as Record<string, unknown>) ?? {};
        const oj = (selectedSnapshotData?.outputs_json as Record<string, unknown>) ?? {};
        return (ij.exp_date as string) ?? (oj.exp_date as string) ?? '';
      })(),
    } : l));
    setInsuranceModalLegIndex(null);
    setPreviousLegType(null);
  };

  const handleInsuranceModalClose = (open: boolean) => {
    if (!open && insuranceModalLegIndex !== null) {
      const revertType = previousLegType ?? 'futures';
      setLegs(prev => prev.map((l, i) => i === insuranceModalLegIndex ? {
        ...l,
        leg_type: revertType,
      } : l));
      setInsuranceModalLegIndex(null);
      setPreviousLegType(null);
    }
  };

  // Click 1: Build order via API (no DB writes)
  // Stage 1: Auto-populate legs silently when form fields are filled
  const autoPopulateLegs = async () => {
    setBuilding(true);
    setBuildResult(null);
    setApiOrder(null);
    try {
      const snap = selectedSnapshotData;
      const outputsJson = (snap?.outputs_json as Record<string, unknown>) ?? {};
      const futuresPriceUsd = outputsJson.futures_price_usd as number | undefined;
      const isCbotSoy = com === 'soybean' && bench === 'cbot';
      const futuresPriceForApi = isCbotSoy
        ? (futuresPriceUsd ?? 0)
        : (snap?.futures_price_brl ?? 0);

      const result = await callApi<Record<string, unknown>>('/orders/build', {
        pricing_id: snap?.id ?? null,
        commodity: com,
        exchange: bench,
        origination_price_brl: snap?.origination_price_brl ?? 0,
        futures_price: futuresPriceForApi,
        exchange_rate: snap?.exchange_rate ?? (outputsJson.exchange_rate as number) ?? null,
        ticker: snap?.ticker ?? '',
        payment_date: snap?.payment_date ?? '',
        sale_date: snap?.sale_date ?? '',
        grain_reception_date: snap?.grain_reception_date ?? snap?.payment_date ?? '',
        volume_sacks: parseFloat(volume),
        operation_id: null,
        use_custom_structure: false,
        legs: [],
      });

      const apiOrderData = (result.order as Record<string, unknown>) ?? {};
      setApiOrder(apiOrderData);

      const apiLegs = (apiOrderData.legs as any[]) ?? [];
      setLegs(apiLegs.map((l: any) => {
        const mul = (isCbotSoy && (l.leg_type === 'futures' || l.leg_type === 'option')) ? 100 : 1;
        return {
          leg_type: l.leg_type ?? 'futures',
          direction: l.direction ?? 'sell',
          ticker: l.ticker ?? '',
          contracts: l.contracts != null ? String(l.contracts) : '',
          price: l.price != null ? String(l.price * mul) : '',
          ndf_rate: l.ndf_rate != null ? String(l.ndf_rate) : undefined,
          strike: l.strike != null ? String(l.strike * mul) : undefined,
          premium: l.premium != null ? String(l.premium * mul) : undefined,
          option_type: l.option_type ?? undefined,
          expiration_date: l.expiration_date ?? (() => {
            if (l.leg_type === 'option') {
              const ij = (snap?.inputs_json as Record<string, unknown>) ?? {};
              const oj = (snap?.outputs_json as Record<string, unknown>) ?? {};
              return (ij.exp_date as string) ?? (oj.exp_date as string) ?? undefined;
            }
            return undefined;
          })(),
          notes: '',
          currency: l.currency ?? undefined,
          volume_units: l.volume_units ?? undefined,
          unit_label: l.unit_label ?? undefined,
        };
      }));
      // No toast, no buildResult
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao carregar pernas');
    } finally {
      setBuilding(false);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!selectedWarehouse || !commodityType || !selectedSnapshot || !volume) return;
    if (!selectedSnapshotData) return;
    const volNum = parseFloat(volume);
    if (!volNum || volNum <= 0) return;
    autoPopulateLegs();
  }, [selectedSnapshot, selectedWarehouse, commodityType, volume]);

  // Stage 2: Validate order (does NOT replace legs)
  const handleBuildOrder = async () => {
    if (!apiOrder || !legs.length) {
      toast.error('Selecione um preço de referência primeiro');
      return;
    }
    setBuilding(true);
    try {
      const snap = selectedSnapshotData;
      const outputsJson = (snap?.outputs_json as Record<string, unknown>) ?? {};
      const futuresPriceUsd = outputsJson.futures_price_usd as number | undefined;
      const isCbotSoy = com === 'soybean' && bench === 'cbot';
      const futuresPriceForApi = isCbotSoy
        ? (futuresPriceUsd ?? 0)
        : (snap?.futures_price_brl ?? 0);

      // Convert legs from display units to canonical units for API
      const legsForApi = legs.filter(l => l.leg_type !== 'seguro').map(l => {
        const div = (isCbotSoy && (l.leg_type === 'futures' || l.leg_type === 'option')) ? 100 : 1;
        return {
          leg_type: l.leg_type,
          direction: l.direction,
          ticker: l.ticker || undefined,
          contracts: l.contracts ? parseFloat(l.contracts) : undefined,
          price: l.price ? parseFloat(l.price) / div : undefined,
          ndf_rate: l.ndf_rate ? parseFloat(l.ndf_rate) : undefined,
          strike: l.strike ? parseFloat(l.strike) / div : undefined,
          premium: l.premium ? parseFloat(l.premium) / div : undefined,
          option_type: l.option_type || undefined,
          expiration_date: l.expiration_date || undefined,
          currency: l.currency || undefined,
          notes: l.notes || undefined,
        };
      });

      const result = await callApi<Record<string, unknown>>('/orders/build', {
        pricing_id: snap?.id ?? null,
        commodity: com,
        exchange: bench,
        origination_price_brl: snap?.origination_price_brl ?? 0,
        futures_price: futuresPriceForApi,
        exchange_rate: snap?.exchange_rate ?? (outputsJson.exchange_rate as number) ?? null,
        ticker: snap?.ticker ?? '',
        payment_date: snap?.payment_date ?? '',
        sale_date: snap?.sale_date ?? '',
        grain_reception_date: snap?.grain_reception_date ?? snap?.payment_date ?? '',
        volume_sacks: parseFloat(volume),
        operation_id: null,
        use_custom_structure: true,
        legs: legsForApi,
      });

      const apiOrderData = (result.order as Record<string, unknown>) ?? {};
      setApiOrder(prev => ({
        ...(prev ?? {}),
        order_message: apiOrderData.order_message,
        confirmation_message: apiOrderData.confirmation_message,
        commodity: apiOrderData.commodity,
        exchange: apiOrderData.exchange,
      }));
      setBuildResult({
        alerts: (result.alerts as unknown[]) ?? [],
        has_errors: result.has_errors as boolean,
      });

      const hasErrors = result.has_errors as boolean;
      if (hasErrors) {
        toast.error('Ordem tem erros de validação — revise antes de salvar');
      } else {
        toast.success('Ordem validada — pode salvar');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao validar ordem');
    } finally {
      setBuilding(false);
    }
  };

  // Click 2: Save order to DB
  const handleSaveOrder = async () => {
    if (!apiOrder) return;
    setSaving(true);
    let operationId: string | null = null;
    try {
      const snap = selectedSnapshotData;
      const commodity = com === 'soybean' ? 'soybean' : 'corn';

      // Step 1: Create operation
      const opPayload: Record<string, unknown> = {
        warehouse_id: selectedWarehouse,
        commodity,
        volume_sacks: parseFloat(volume),
        status: 'RASCUNHO',
        pricing_snapshot_id: selectedSnapshot,
        notes: null,
        created_by: user?.id ?? null,
      };
      if (linkedOperationId && linkedOperationId !== 'none') {
        opPayload.parent_operation_id = linkedOperationId;
      }
      const operation = await createOperation.mutateAsync(opPayload as never);
      operationId = (operation as { id: string }).id;

      // Build legs with user notes merged
      const legsPayload = legs.filter(l => l.leg_type !== 'seguro').map(l => {
        const isCbotSoy = (apiOrder?.commodity === 'soybean' &&
          (apiOrder?.exchange as string)?.toLowerCase() === 'cbot');
        const div = (isCbotSoy && (l.leg_type === 'futures' || l.leg_type === 'option')) ? 100 : 1;
        return {
          leg_type: l.leg_type,
          direction: l.direction,
          ticker: l.ticker || undefined,
          contracts: l.contracts ? parseFloat(l.contracts) : undefined,
          price: l.price ? parseFloat(l.price) / div : undefined,
          ndf_rate: l.ndf_rate ? parseFloat(l.ndf_rate) : undefined,
          strike: l.strike ? parseFloat(l.strike) / div : undefined,
          premium: l.premium ? parseFloat(l.premium) / div : undefined,
          option_type: l.option_type || undefined,
          expiration_date: l.expiration_date || undefined,
          currency: l.currency || undefined,
          notes: l.notes || undefined,
          volume_units: l.volume_units ?? undefined,
          unit_label: l.unit_label ?? undefined,
        };
      });

      // Step 2: Insert hedge_order
      try {
        await createOrder.mutateAsync({
          operation_id: operationId,
          commodity: apiOrder.commodity as string,
          exchange: apiOrder.exchange as string,
          volume_sacks: parseFloat(volume),
          origination_price_brl: snap?.origination_price_brl ?? 0,
          legs: legsPayload as unknown[],
          status: 'GENERATED',
          order_message: (apiOrder.order_message as string) ?? null,
          confirmation_message: (apiOrder.confirmation_message as string) ?? null,
          stonex_confirmation_text: null,
          notes: orderNotes || null,
          created_by: user?.id ?? null,
        });
      } catch (err) {
        // Compensation: delete orphan operation
        if (operationId) {
          await supabase.from('operations').delete().eq('id', operationId);
        }
        throw err;
      }

      // Step 3: Fetch display_code
      const { data: insertedOrders } = await supabase
        .from('hedge_orders')
        .select('display_code')
        .eq('operation_id', operationId)
        .order('created_at', { ascending: false })
        .limit(1);
      const displayCode = (insertedOrders as any)?.[0]?.display_code ?? operationId?.slice(0, 8);

      // Step 4: Create payment event (non-blocking)
      try {
        await supabase.from('payment_events').insert({
          operation_id: operationId,
          scheduled_date: selectedSnapshotData?.payment_date,
          amount_brl: (selectedSnapshotData?.origination_price_brl ?? 0) * parseFloat(volume),
          status: 'pending',
          registered_by: user?.id ?? null,
        } as never);
      } catch (payErr) {
        console.error('Failed to insert payment_event:', payErr);
        toast.warning('Ordem salva, mas evento de pagamento não foi registrado');
      }

      toast.success(`Ordem criada: ${displayCode}`);

      // Reset
      clearApiOrder();
      setSelectedSnapshotRaw(''); setVolumeRaw(''); setCommodityTypeRaw(''); setLinkedOperationIdRaw('');
      setOrderNotes('');
      sessionStorage.removeItem('order_warehouse');
      sessionStorage.removeItem('order_commodity');
      sessionStorage.removeItem('order_snapshot');
      sessionStorage.removeItem('order_volume');
      sessionStorage.removeItem('order_linked');
      sessionStorage.removeItem('order_apiOrder');
      sessionStorage.removeItem('order_buildResult');
      sessionStorage.removeItem('order_legs');
      sessionStorage.removeItem('order_notes');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar ordem');
    } finally {
      setSaving(false);
    }
  };

  const handleManualSave = async () => {
    const { commodity, exchange, volume_sacks, origination_price_brl, status } = manualForm;
    if (!volume_sacks || !origination_price_brl) {
      toast.error('Preencha os campos obrigatórios');
      return;
    }
    try {
      const operation = await createOperation.mutateAsync({
        warehouse_id: 'hq',
        commodity,
        volume_sacks: parseFloat(volume_sacks),
        status: 'RASCUNHO',
        pricing_snapshot_id: null,
        notes: null,
        created_by: user?.id ?? null,
      });

      await createOrder.mutateAsync({
        commodity,
        exchange,
        volume_sacks: parseFloat(volume_sacks),
        origination_price_brl: parseFloat(origination_price_brl),
        operation_id: (operation as { id: string }).id,
        status,
        legs: [],
        order_message: null,
        confirmation_message: null,
        stonex_confirmation_text: null,
        notes: null,
        created_by: user?.id ?? null,
      });
      toast.success('Ordem registrada');
      setManualForm({ ...manualForm, volume_sacks: '', origination_price_brl: '' });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copiado');
  };

  // === Status transition handlers ===
  const [cancelModal, setCancelModal] = useState<{ order: HedgeOrder; action: 'cancel' | 'reject' } | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [executionModal, setExecutionModal] = useState<HedgeOrder | null>(null);
  const [executionLegs, setExecutionLegs] = useState<any[]>([]);

  // Closing (encerramento) state
  const [closingOrderModal, setClosingOrderModal] = useState<HedgeOrder | null>(null);
  const [closingOrderLegs, setClosingOrderLegs] = useState<any[]>([]);
  const [closingOrderPhysicalPrice, setClosingOrderPhysicalPrice] = useState('');
  const [closingOrderPhysicalVolume, setClosingOrderPhysicalVolume] = useState('');
  const [closingOrderOriginationPrice, setClosingOrderOriginationPrice] = useState('');
  const [closingOrderSubmitting, setClosingOrderSubmitting] = useState(false);

  const handleSimpleTransition = async (orderId: string, newStatus: string) => {
    try {
      await updateOrder.mutateAsync({ id: orderId, status: newStatus } as any);
      toast.success(`Status atualizado para ${STATUS_BADGE[newStatus]?.label ?? newStatus}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao atualizar status');
    }
  };

  const handleCancelConfirm = async () => {
    if (!cancelModal || !cancelReason.trim()) return;
    try {
      await updateOrder.mutateAsync({
        id: cancelModal.order.id,
        status: 'CANCELLED',
        cancellation_reason: cancelReason.trim(),
        cancelled_at: new Date().toISOString(),
        cancelled_by: user?.id ?? null,
      } as any);
      toast.success('Ordem cancelada');
      setCancelModal(null);
      setCancelReason('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao cancelar');
    }
  };

  const openExecutionModal = (order: HedgeOrder) => {
    const orderLegs = ((order.legs as any[]) ?? []).filter((l: any) => l.leg_type !== 'seguro');
    setExecutionLegs(orderLegs.map((l: any) => {
      const isNdf = l.leg_type === 'ndf';
      return {
        ...l,
        _displayQty: isNdf ? String(l.volume_units ?? '') : String(l.contracts ?? ''),
        _displayPrice: isNdf ? String(l.ndf_rate ?? '') : String(l.price ?? ''),
        _notes: l.notes ?? '',
      };
    }));
    setExecutionModal(order);
  };

  const handleExecutionConfirm = async () => {
    if (!executionModal) return;
    // Validate
    for (const leg of executionLegs) {
      const qty = parseFloat(leg._displayQty);
      const price = parseFloat(leg._displayPrice);
      if (!qty || qty <= 0 || !price || price <= 0) {
        toast.error('Todas as pernas devem ter quantidade e preço > 0');
        return;
      }
    }
    try {
      const executedLegs: any[] = [];
      for (const leg of executionLegs) {
        const qty = parseFloat(leg._displayQty);
        const priceVal = parseFloat(leg._displayPrice);

        // Strip helper UI fields
        const { _displayPrice, _displayQty, _notes, ...rest } = leg;

        if (leg.leg_type === 'ndf') {
          const merged: any = {
            ...rest,
            volume_units: qty,
            ndf_rate: priceVal,
            notes: _notes || undefined,
          };
          // Ensure no residual price is persisted on NDF legs
          delete merged.price;
          executedLegs.push(merged);
        } else {
          // futures / option
          let contractSize: number;
          try {
            contractSize = getContractSize(executionModal.commodity, executionModal.exchange);
          } catch (e) {
            toast.error('Tamanho de contrato desconhecido', {
              description: e instanceof Error ? e.message : String(e),
            });
            return;
          }
          executedLegs.push({
            ...rest,
            contracts: qty,
            volume_units: qty * contractSize,
            price: priceVal,
            notes: _notes || undefined,
          });
        }
      }

      await updateOrder.mutateAsync({
        id: executionModal.id,
        status: 'EXECUTED',
        executed_legs: executedLegs,
        executed_at: new Date().toISOString(),
        executed_by: user?.id ?? null,
      } as any);

      // Advance operation to HEDGE_CONFIRMADO
      const { error: opError } = await supabase
        .from('operations')
        .update({ status: 'HEDGE_CONFIRMADO' })
        .eq('id', executionModal.operation_id);
      if (opError) {
        toast.error('Ordem executada, mas falha ao atualizar status da operação: ' + opError.message);
      } else {
        queryClient.invalidateQueries({ queryKey: ['operations'] });
        queryClient.invalidateQueries({ queryKey: ['operation-status'] });
        queryClient.invalidateQueries({ queryKey: ['operations_with_details'] });
        queryClient.invalidateQueries({ queryKey: ['financial_calendar_data'] });
      }

      toast.success(`Ordem ${executionModal.display_code ?? executionModal.id.slice(0, 8)} marcada como executada`);
      setExecutionModal(null);
      setExecutionLegs([]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao confirmar execução');
    }
  };

  // === Closing (encerramento) handlers ===
  const handleRequestClosingFromOrder = async (order: HedgeOrder) => {
    if (!order.operation_id) return;
    try {
      await callApi(`/closing/${order.operation_id}/request`, {});
      toast.success('Encerramento solicitado');
      queryClient.invalidateQueries({ queryKey: ['operations'] });
      queryClient.invalidateQueries({ queryKey: ['operation-statuses'] });
      queryClient.invalidateQueries({ queryKey: ['hedge-orders'] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao solicitar encerramento');
    }
  };

  const handleOpenClosingOrderModal = async (order: HedgeOrder) => {
    if (!order.operation_id) return;
    try {
      const { data, error } = await supabase
        .from('closing_orders')
        .select('id, legs, physical_price_brl, physical_volume_sacks')
        .eq('operation_id', order.operation_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      const rawLegs = ((data?.legs as any[]) ?? []).filter((l: any) => l.leg_type !== 'seguro');
      setClosingOrderLegs(rawLegs.map((l: any) => {
        const isNdf = l.leg_type === 'ndf';
        return {
          ...l,
          _displayPrice: isNdf ? String(l.ndf_rate ?? '') : String(l.price ?? ''),
        };
      }));
      setClosingOrderPhysicalPrice(data?.physical_price_brl != null ? String(data.physical_price_brl) : '');
      setClosingOrderPhysicalVolume(data?.physical_volume_sacks != null ? String(data.physical_volume_sacks) : '');
      setClosingOrderOriginationPrice(order.origination_price_brl != null ? String(order.origination_price_brl) : '');
      setClosingOrderModal(order);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao carregar dados de encerramento');
    }
  };

  const handleExecuteClosingFromOrder = async () => {
    if (!closingOrderModal?.operation_id) return;
    const physPrice = parseFloat(closingOrderPhysicalPrice);
    const physVol = parseFloat(closingOrderPhysicalVolume);
    const origPrice = parseFloat(closingOrderOriginationPrice);
    if (!physPrice || !physVol || !origPrice) {
      toast.error('Preencha preço físico, volume físico e preço de originação');
      return;
    }
    const legsPayload = closingOrderLegs.map((l: any) => {
      const { _displayPrice, ...rest } = l;
      const priceVal = parseFloat(_displayPrice);
      if (l.leg_type === 'ndf') {
        const merged: any = { ...rest, ndf_rate: priceVal };
        delete merged.price;
        return merged;
      }
      return { ...rest, price: priceVal };
    });
    setClosingOrderSubmitting(true);
    try {
      await callApi(`/closing/${closingOrderModal.operation_id}/execute`, {
        physical_price_brl: physPrice,
        physical_volume_sacks: physVol,
        origination_price_brl: origPrice,
        legs: legsPayload,
      });
      toast.success('Encerramento confirmado');
      setClosingOrderModal(null);
      setClosingOrderLegs([]);
      setClosingOrderPhysicalPrice('');
      setClosingOrderPhysicalVolume('');
      setClosingOrderOriginationPrice('');
      queryClient.invalidateQueries({ queryKey: ['operations'] });
      queryClient.invalidateQueries({ queryKey: ['operation-statuses'] });
      queryClient.invalidateQueries({ queryKey: ['hedge-orders'] });
      queryClient.invalidateQueries({ queryKey: ['operations_with_details'] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao executar encerramento');
    } finally {
      setClosingOrderSubmitting(false);
    }
  };

  const getLegPriceLabel = (leg: Leg): string => {
    if (leg.leg_type === 'ndf') return 'R$/USD';
    if (leg.leg_type === 'futures' && isSoybeanCbot(com, bench)) return 'USD cents/bushel';
    if (leg.leg_type === 'option' && isSoybeanCbot(com, bench)) return 'USD cents/bushel';
    if (leg.leg_type === 'futures' && bench === 'b3') return 'BRL/sc';
    return '';
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">Ordens</h2>

      <Tabs defaultValue="create">
        <TabsList>
          <TabsTrigger value="create">Criar Ordem</TabsTrigger>
          <TabsTrigger value="list">Ordens Existentes</TabsTrigger>
          <TabsTrigger value="manual">Registro Manual</TabsTrigger>
        </TabsList>

        {/* === CRIAR ORDEM === */}
        <TabsContent value="create" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-sm">Nova Ordem via API</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Praça</Label>
                  <Select value={selectedWarehouse} onValueChange={setSelectedWarehouse}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {warehouses?.map((w) => <SelectItem key={w.id} value={w.id}>{w.display_name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Commodity</Label>
                  <Select value={commodityType} onValueChange={setCommodityType}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="soybean|cbot">Soja CBOT</SelectItem>
                      <SelectItem value="corn|b3">Milho B3</SelectItem>
                      <SelectItem value="corn|cbot">Milho CBOT</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Volume (sacas)</Label>
                  <Input type="number" value={volume} onChange={(e) => setVolume(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Vinculada à operação</Label>
                  <Select value={linkedOperationId} onValueChange={setLinkedOperationId}>
                    <SelectTrigger><SelectValue placeholder="Nenhuma" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhuma</SelectItem>
                      {operations?.map(op => (
                        <SelectItem key={op.id} value={op.id}>{op.notes ?? op.id.slice(0, 8)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1 col-span-2">
                  <Label className="text-xs">Preço de Referência</Label>
                  <Select value={selectedSnapshot} onValueChange={setSelectedSnapshot} disabled={!commodityType || !volume || parseFloat(volume) <= 0}>
                    <SelectTrigger><SelectValue placeholder={!commodityType ? 'Selecione commodity primeiro' : (!volume || parseFloat(volume) <= 0) ? 'Informe o volume primeiro' : 'Selecione'} /></SelectTrigger>
                    <SelectContent>
                      {filteredSnapshots.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {formatDate(s.payment_date)} pgto · {formatDate(s.sale_date)} venda · R${s.origination_price_brl.toFixed(2)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* ID da Operação — será gerado ao salvar */}
                <div className="space-y-1 col-span-2">
                  <Label className="text-xs">ID da Operação (auto)</Label>
                  <div className="flex items-center h-10 px-3 rounded-md border border-input bg-muted text-xs font-mono text-muted-foreground">
                    Será gerado ao salvar
                  </div>
                </div>
              </div>

              {/* Editable Legs */}
              {(legs.length > 0 || apiOrder) && (
                <div className="space-y-2 pt-2 border-t border-border">
                  <Label className="text-xs font-semibold">Pernas da Operação</Label>
                  {legs.length > 0 && (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-[10px]">Tipo</TableHead>
                          <TableHead className="text-[10px]">Dir.</TableHead>
                          <TableHead className="text-[10px]">Ticker</TableHead>
                          <TableHead className="text-[10px]">Qtd</TableHead>
                          <TableHead className="text-[10px]">Preço</TableHead>
                          <TableHead className="text-[10px]">Obs.</TableHead>
                          <TableHead className="text-[10px] w-10"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {legs.map((leg, i) => (
                          <React.Fragment key={i}>
                            <TableRow>
                              <TableCell className="p-1">
                                <Select value={leg.leg_type} onValueChange={(v) => handleLegTypeChange(i, v)}>
                                  <SelectTrigger className="h-7 text-xs w-24"><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="futures">Futuro</SelectItem>
                                    <SelectItem value="ndf">NDF</SelectItem>
                                    <SelectItem value="option">Opção</SelectItem>
                                    <SelectItem value="seguro">Seguro</SelectItem>
                                  </SelectContent>
                                </Select>
                              </TableCell>
                              <TableCell className="p-1">
                                <Select value={leg.direction} onValueChange={(v) => updateLeg(i, 'direction', v)}>
                                  <SelectTrigger className="h-7 text-xs w-20"><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="buy">Buy</SelectItem>
                                    <SelectItem value="sell">Sell</SelectItem>
                                  </SelectContent>
                                </Select>
                              </TableCell>
                              <TableCell className="p-1">
                                <Input
                                  className="h-7 text-xs w-28 font-mono"
                                  value={leg.ticker}
                                  onChange={(e) => updateLeg(i, 'ticker', e.target.value)}
                                />
                              </TableCell>
                              <TableCell className="p-1">
                                {leg.leg_type === 'ndf' ? (
                                  <Input
                                    className="h-7 text-xs w-24"
                                    type="text"
                                    placeholder="USD"
                                    value={leg.volume_units != null ? String(leg.volume_units) : ''}
                                    onChange={(e) => updateLeg(i, 'volume_units', e.target.value ? parseFloat(e.target.value) : undefined)}
                                  />
                                ) : (
                                  <Input
                                    className="h-7 text-xs w-20"
                                    type="text"
                                    placeholder="ct"
                                    value={leg.contracts}
                                    onChange={(e) => updateLeg(i, 'contracts', e.target.value)}
                                  />
                                )}
                              </TableCell>
                              <TableCell className="p-1">
                                <div className="flex items-center gap-1">
                                  {leg.leg_type === 'ndf' ? (
                                    <Input
                                      className="h-7 text-xs w-24"
                                      type="text"
                                      value={leg.ndf_rate ?? ''}
                                      onChange={(e) => updateLeg(i, 'ndf_rate', e.target.value)}
                                    />
                                  ) : (
                                    <Input
                                      className="h-7 text-xs w-24"
                                      type="text"
                                      value={leg.price}
                                      onChange={(e) => updateLeg(i, 'price', e.target.value)}
                                    />
                                  )}
                                  <span className="text-[9px] text-muted-foreground whitespace-nowrap">{getLegPriceLabel(leg)}</span>
                                </div>
                              </TableCell>
                              <TableCell className="p-1">
                                <Input
                                  className="h-7 text-xs w-28"
                                  placeholder="Ex: rolagem"
                                  value={leg.notes ?? ''}
                                  onChange={(e) => updateLeg(i, 'notes', e.target.value)}
                                />
                              </TableCell>
                              <TableCell className="p-1">
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeLeg(i)}>
                                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                </Button>
                              </TableCell>
                            </TableRow>
                            {/* Option extra fields inline */}
                            {leg.leg_type === 'option' && (
                              <TableRow>
                                <TableCell colSpan={7} className="p-1 pl-6">
                                  <div className="flex gap-2 items-center">
                                    <Select value={leg.option_type ?? 'call'} onValueChange={(v) => updateLeg(i, 'option_type', v)}>
                                      <SelectTrigger className="h-7 text-xs w-20"><SelectValue /></SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="call">Call</SelectItem>
                                        <SelectItem value="put">Put</SelectItem>
                                      </SelectContent>
                                    </Select>
                                    <div className="flex items-center gap-1">
                                      <Label className="text-[10px] text-muted-foreground">Strike</Label>
                                      <Input
                                        className="h-7 text-xs w-24"
                                        type="text"
                                        value={leg.strike ?? ''}
                                        onChange={(e) => updateLeg(i, 'strike', e.target.value)}
                                      />
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <Label className="text-[10px] text-muted-foreground">Prêmio</Label>
                                      <Input
                                        className="h-7 text-xs w-24"
                                        type="text"
                                        value={leg.premium ?? ''}
                                        onChange={(e) => updateLeg(i, 'premium', e.target.value)}
                                      />
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <Label className="text-[10px] text-muted-foreground">Vencimento</Label>
                                      <Popover>
                                        <PopoverTrigger asChild>
                                          <Button variant="outline" className="h-7 text-xs w-36 justify-start font-normal px-2">
                                            <CalendarIcon className="mr-1 h-3 w-3" />
                                            {leg.expiration_date ? format(parse(leg.expiration_date, 'yyyy-MM-dd', new Date()), 'dd/MM/yyyy') : 'Selecionar'}
                                          </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0" align="start">
                                          <Calendar
                                            mode="single"
                                            selected={leg.expiration_date ? parse(leg.expiration_date, 'yyyy-MM-dd', new Date()) : undefined}
                                            onSelect={(date) => {
                                              if (date) {
                                                updateLeg(i, 'expiration_date', format(date, 'yyyy-MM-dd'));
                                              }
                                            }}
                                            initialFocus
                                          />
                                        </PopoverContent>
                                      </Popover>
                                    </div>
                                    <span className="text-[9px] text-muted-foreground">{getLegPriceLabel(leg)}</span>
                                  </div>
                                </TableCell>
                              </TableRow>
                            )}
                          </React.Fragment>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                  <Button variant="outline" size="sm" className="text-xs" onClick={addLeg}>
                    <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar Perna
                  </Button>
                </div>
              )}

              {/* Order-level notes */}
              {apiOrder && (
                <div className="space-y-1">
                  <Label className="text-xs">Observações da Ordem</Label>
                  <Textarea
                    value={orderNotes}
                    onChange={(e) => setOrderNotes(e.target.value)}
                    placeholder="Observações gerais sobre esta ordem..."
                    className="text-xs min-h-[60px]"
                  />
                </div>
              )}

              {/* Two buttons: Build + Save */}
              <div className="flex gap-2">
                <Button onClick={handleBuildOrder} disabled={building || !apiOrder || !legs.length} variant={buildResult ? 'outline' : 'default'} className="flex-1">
                  {building ? 'Validando...' : 'Validar Ordem'}
                </Button>
                <Button onClick={handleSaveOrder} disabled={!apiOrder || !buildResult || (buildResult.has_errors === true) || saving} className="flex-1">
                  {saving ? 'Salvando...' : 'Salvar Ordem'}
                </Button>
              </div>
            </CardContent>
          </Card>

          {buildResult && (
            <Card>
              <CardHeader><CardTitle className="text-sm">Resultado da Validação</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {(() => {
                  const alerts = buildResult.alerts as { level: string; message: string }[] | undefined;
                  if (!alerts || alerts.length === 0) {
                    return (
                      <div className="flex items-center gap-2 text-sm p-2 rounded bg-green-500/10 text-green-400">
                        ✓ Ordem válida — nenhum alerta
                      </div>
                    );
                  }
                  return alerts.map((alert, i) => (
                    <div key={i} className={`flex items-center gap-2 text-sm p-2 rounded ${alert.level === 'ERROR' ? 'bg-destructive/10 text-destructive' : 'bg-yellow-500/10 text-yellow-400'}`}>
                      <AlertTriangle className="h-4 w-4" /> {alert.message}
                    </div>
                  ));
                })()}
                {apiOrder?.order_message && (
                  <div className="space-y-1">
                    <Label className="text-xs">Mensagem de Ordem</Label>
                    <div className="flex gap-2">
                      <pre className="flex-1 bg-muted p-2 rounded text-xs overflow-auto">{apiOrder.order_message as string}</pre>
                      <Button size="icon" variant="ghost" onClick={() => copyToClipboard(apiOrder.order_message as string)}><Copy className="h-4 w-4" /></Button>
                    </div>
                  </div>
                )}
                {apiOrder?.confirmation_message && (
                  <div className="space-y-1">
                    <Label className="text-xs">Mensagem de Confirmação</Label>
                    <div className="flex gap-2">
                      <pre className="flex-1 bg-muted p-2 rounded text-xs overflow-auto">{apiOrder.confirmation_message as string}</pre>
                      <Button size="icon" variant="ghost" onClick={() => copyToClipboard(apiOrder.confirmation_message as string)}><Copy className="h-4 w-4" /></Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* === ORDENS EXISTENTES === */}
        <TabsContent value="list" className="space-y-4">
          <div className="mb-4">
            <button
              type="button"
              className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
              onClick={() => setListFiltersExpanded(v => !v)}
            >
              <Filter className="h-3.5 w-3.5" />
              <span>Filtros</span>
              {(commodityFilter !== 'all' || statusFilter !== 'all' || warehouseFilter !== 'all') && (
                <span className="bg-primary/20 text-primary text-[10px] px-1.5 rounded-full font-medium">
                  {[
                    commodityFilter !== 'all' ? (commodityFilter === 'soybean' ? 'Soja' : 'Milho') : null,
                    statusFilter !== 'all' ? (STATUS_BADGE[statusFilter]?.label ?? statusFilter) : null,
                    warehouseFilter !== 'all' ? (warehouses?.find(w => w.id === warehouseFilter)?.display_name ?? warehouseFilter) : null
                  ].filter(Boolean).join(' · ')}
                </span>
              )}
              <span className="ml-0.5">{listFiltersExpanded ? '▾' : '▸'}</span>
            </button>
            {listFiltersExpanded && (
              <div className="flex flex-wrap gap-3 mt-2 pl-5">
                <div className="space-y-1">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Commodity</span>
                  <Select value={commodityFilter} onValueChange={setCommodityFilter}>
                    <SelectTrigger className="w-36 h-8 text-xs"><SelectValue placeholder="Commodity" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas</SelectItem>
                      <SelectItem value="soybean">Soja</SelectItem>
                      <SelectItem value="corn">Milho</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Status</span>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-36 h-8 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="GENERATED">Gerada</SelectItem>
                      <SelectItem value="SENT">Enviada</SelectItem>
                      <SelectItem value="APPROVED">Aprovada</SelectItem>
                      <SelectItem value="EXECUTED">Executada</SelectItem>
                      <SelectItem value="CANCELLED">Cancelada</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Praça</span>
                  <Select value={warehouseFilter} onValueChange={setWarehouseFilter}>
                    <SelectTrigger className="w-40 h-8 text-xs"><SelectValue placeholder="Praça" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas</SelectItem>
                      {warehouses?.map(w => (
                        <SelectItem key={w.id} value={w.id}>{w.display_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {(commodityFilter !== 'all' || statusFilter !== 'all' || warehouseFilter !== 'all') && (
                  <div className="flex items-end">
                    <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => { setCommodityFilter('all'); setStatusFilter('all'); setWarehouseFilter('all'); }}>
                      Limpar filtros
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>

          {isLoading ? (
            <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>
          ) : !orders?.length ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhuma ordem encontrada.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Praça</TableHead>
                  <TableHead>ID Operação</TableHead>
                  <TableHead>Vinculação</TableHead>
                  <TableHead>Commodity</TableHead>
                  <TableHead>Volume (sc)</TableHead>
                  <TableHead>Preço orig.</TableHead>
                  <TableHead>Pernas</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((o) => {
                  const oLegs = (o.legs as any[]) ?? [];
                  const badge = STATUS_BADGE[o.status] ?? { label: o.status, variant: 'secondary' as const };
                  return (
                    <TableRow key={o.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelectedOrder(o)}>
                      <TableCell className="text-xs font-medium">
                        {o.operation_id ? (operationWarehouseMap[o.operation_id] ?? '-') : '-'}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{o.display_code ?? o.operation_id?.slice(0, 8) ?? '-'}</TableCell>
                      <TableCell className="text-xs">{vinculacaoMap[o.operation_id] ?? '—'}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px]">
                          {o.commodity === 'soybean' ? 'Soja' : 'Milho'}
                        </Badge>
                      </TableCell>
                      <TableCell>{o.volume_sacks?.toLocaleString('pt-BR') ?? '-'}</TableCell>
                      <TableCell>R$ {o.origination_price_brl?.toFixed(2) ?? '0.00'}</TableCell>
                      <TableCell className="text-xs">
                        {oLegs.length > 0 ? oLegs.map((l: any) => `${l.leg_type}(${l.direction})`).join(' + ') : '-'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={badge.variant} className={badge.className}>{badge.label}</Badge>
                      </TableCell>
                      <TableCell className="text-xs">{o.created_at ? new Date(o.created_at).toLocaleDateString('pt-BR') : '-'}</TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <div className="flex gap-1">
                          {o.status === 'GENERATED' && (
                            <>
                              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => handleSimpleTransition(o.id, 'SENT')}>
                                <Send className="h-3 w-3 mr-1" />Enviar
                              </Button>
                              <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive" onClick={() => { setCancelModal({ order: o, action: 'cancel' }); setCancelReason(''); }}>
                                <XIcon className="h-3 w-3 mr-1" />Cancelar
                              </Button>
                            </>
                          )}
                          {o.status === 'SENT' && (
                            <>
                              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => handleSimpleTransition(o.id, 'APPROVED')}>
                                <Check className="h-3 w-3 mr-1" />Aprovar
                              </Button>
                              <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive" onClick={() => { setCancelModal({ order: o, action: 'reject' }); setCancelReason(''); }}>
                                <XIcon className="h-3 w-3 mr-1" />Rejeitar
                              </Button>
                            </>
                          )}
                          {o.status === 'APPROVED' && (
                            <>
                              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => openExecutionModal(o)}>
                                <Check className="h-3 w-3 mr-1" />Executar
                              </Button>
                              <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive" onClick={() => { setCancelModal({ order: o, action: 'cancel' }); setCancelReason(''); }}>
                                <XIcon className="h-3 w-3 mr-1" />Cancelar
                              </Button>
                            </>
                          )}
                          {o.status === 'EXECUTED' && o.operation_id && operationStatusMap?.[o.operation_id] === 'HEDGE_CONFIRMADO' && (
                            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => handleRequestClosingFromOrder(o)}>
                              Solicitar Enc.
                            </Button>
                          )}
                          {o.status === 'EXECUTED' && o.operation_id && operationStatusMap?.[o.operation_id] === 'ENCERRAMENTO_APROVADO' && (
                            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => handleOpenClosingOrderModal(o)}>
                              Confirmar Enc.
                            </Button>
                          )}
              </TableBody>
            </Table>
          )}
        </TabsContent>

        {/* === REGISTRO MANUAL === */}
        <TabsContent value="manual" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-sm">Registrar Ordem Executada</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Commodity</Label>
                  <Select value={manualForm.commodity} onValueChange={(v) => setManualForm({ ...manualForm, commodity: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SOJA">Soja</SelectItem>
                      <SelectItem value="MILHO">Milho</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Exchange</Label>
                  <Select value={manualForm.exchange} onValueChange={(v) => setManualForm({ ...manualForm, exchange: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CBOT">CBOT</SelectItem>
                      <SelectItem value="B3">B3</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Volume (sacas)</Label>
                  <Input type="number" value={manualForm.volume_sacks} onChange={(e) => setManualForm({ ...manualForm, volume_sacks: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Preço originação (R$/sc)</Label>
                  <Input type="number" step="0.01" value={manualForm.origination_price_brl} onChange={(e) => setManualForm({ ...manualForm, origination_price_brl: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Status</Label>
                  <Select value={manualForm.status} onValueChange={(v) => setManualForm({ ...manualForm, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="EXECUTED">Executada</SelectItem>
                      <SelectItem value="GENERATED">Gerada</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button onClick={handleManualSave} className="w-full">
                <Plus className="mr-2 h-4 w-4" /> Registrar Ordem
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Drawer de detalhe da ordem */}
      {selectedOrder && (() => {
        const detailLegs = (selectedOrder.legs as any[]) ?? [];
        return (
          <Sheet open={!!selectedOrder} onOpenChange={(o) => { if (!o) setSelectedOrder(null); }}>
            <SheetContent className="w-[480px] sm:w-[540px] overflow-y-auto">
              <SheetHeader>
                <SheetTitle>Ordem — {selectedOrder.display_code ?? selectedOrder.operation_id?.slice(0, 8) ?? selectedOrder.id?.slice(0, 8)}</SheetTitle>
              </SheetHeader>

              <div className="mt-4 space-y-4">
                <Separator />
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Identificação</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                  <span className="text-muted-foreground">Commodity</span><span>{selectedOrder.commodity === 'soybean' ? 'Soja CBOT' : selectedOrder.exchange === 'b3' ? 'Milho B3' : 'Milho CBOT'}</span>
                  <span className="text-muted-foreground">Exchange</span><span>{selectedOrder.exchange?.toUpperCase() ?? '-'}</span>
                  <span className="text-muted-foreground">Status ordem</span><span><Badge variant={STATUS_BADGE[selectedOrder.status]?.variant ?? 'secondary'} className={STATUS_BADGE[selectedOrder.status]?.className}>{STATUS_BADGE[selectedOrder.status]?.label ?? selectedOrder.status}</Badge></span>
                  {operationStatus && (<><span className="text-muted-foreground">Status operação</span><span><Badge variant="outline">{operationStatus}</Badge></span></>)}
                  <span className="text-muted-foreground">Data criação</span><span>{selectedOrder.created_at ? new Date(selectedOrder.created_at).toLocaleDateString('pt-BR') : '-'}</span>
                  {selectedOrder.notes && <><span className="text-muted-foreground">Observações</span><span>{selectedOrder.notes}</span></>}
                  {selectedOrder.cancellation_reason && <><span className="text-muted-foreground">Motivo cancelamento</span><span className="text-destructive">{selectedOrder.cancellation_reason}</span></>}
                </div>

                <Separator />
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Volume e Preço</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                  <span className="text-muted-foreground">Volume</span><span>{selectedOrder.volume_sacks?.toLocaleString('pt-BR')} sacas</span>
                  <span className="text-muted-foreground">Preço originação</span><span>R$ {selectedOrder.origination_price_brl?.toFixed(2)}</span>
                </div>

                {detailLegs.length > 0 && (
                  <>
                    <Separator />
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Pernas ({detailLegs.length})</p>
                    {detailLegs.map((leg: any, i: number) => (
                      <div key={i} className="bg-muted/50 rounded p-2 space-y-1 text-sm">
                        <p className="font-medium text-xs">{leg.leg_type} · {leg.direction}</p>
                        {leg.ticker && <div className="grid grid-cols-2 gap-x-4"><span className="text-muted-foreground text-xs">Ticker</span><span className="text-xs">{leg.ticker}</span></div>}
                        {leg.contracts != null && <div className="grid grid-cols-2 gap-x-4"><span className="text-muted-foreground text-xs">Contratos</span><span className="text-xs">{leg.contracts}</span></div>}
                        {leg.volume_units != null && <div className="grid grid-cols-2 gap-x-4"><span className="text-muted-foreground text-xs">Quantidade</span><span className="text-xs">{leg.volume_units} {leg.unit_label ?? ''}</span></div>}
                        {leg.price != null && <div className="grid grid-cols-2 gap-x-4"><span className="text-muted-foreground text-xs">Preço</span><span className="text-xs">{leg.price}</span></div>}
                        {leg.ndf_rate != null && <div className="grid grid-cols-2 gap-x-4"><span className="text-muted-foreground text-xs">Taxa NDF</span><span className="text-xs">{leg.ndf_rate}</span></div>}
                        {leg.strike != null && <div className="grid grid-cols-2 gap-x-4"><span className="text-muted-foreground text-xs">Strike</span><span className="text-xs">{leg.strike}</span></div>}
                        {leg.premium != null && <div className="grid grid-cols-2 gap-x-4"><span className="text-muted-foreground text-xs">Prêmio</span><span className="text-xs">{leg.premium}</span></div>}
                        {leg.notes && <div className="grid grid-cols-2 gap-x-4"><span className="text-muted-foreground text-xs">Obs.</span><span className="text-xs">{leg.notes}</span></div>}
                      </div>
                    ))}
                  </>
                )}

                <Separator />
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Aprovações</p>
                {(!orderSignatures || orderSignatures.length === 0) ? (
                  <p className="text-sm text-muted-foreground">Nenhuma assinatura ainda.</p>
                ) : (
                  <div className="space-y-2">
                    {orderSignatures.map((sig: any) => (
                      <div key={sig.id} className="bg-muted/50 rounded p-2 text-sm">
                        <p className="font-medium">{sig.signer?.full_name ?? sig.user_id?.slice(0, 8)}</p>
                        <p className="text-xs text-muted-foreground">
                          {sig.role_used} · {new Date(sig.signed_at).toLocaleString('pt-BR')}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                {selectedOrder.order_message && (
                  <>
                    <Separator />
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Mensagem de Ordem</p>
                    <pre className="text-xs bg-muted p-2 rounded whitespace-pre-wrap">{selectedOrder.order_message}</pre>
                  </>
                )}
                {selectedOrder.confirmation_message && (
                  <>
                    <Separator />
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Mensagem de Confirmação</p>
                    <pre className="text-xs bg-muted p-2 rounded whitespace-pre-wrap">{selectedOrder.confirmation_message}</pre>
                  </>
                )}

                {operationStatus === 'RASCUNHO' && userRoles.includes('mesa') && (
                  <>
                    <Separator />
                    <Button onClick={handleSubmitForApproval} className="w-full">
                      Submeter para Aprovação
                    </Button>
                  </>
                )}
              </div>
            </SheetContent>
          </Sheet>
        );
      })()}

      {/* Cancel/Reject modal */}
      {cancelModal && (
        <Dialog open={!!cancelModal} onOpenChange={(o) => { if (!o) setCancelModal(null); }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{cancelModal.action === 'reject' ? 'Rejeitar Ordem' : 'Cancelar Ordem'}</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              Ordem: <span className="font-mono">{cancelModal.order.display_code ?? cancelModal.order.id.slice(0, 8)}</span>
            </p>
            <div className="space-y-1">
              <Label className="text-xs">Motivo (obrigatório)</Label>
              <Textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Descreva o motivo..."
                className="text-xs min-h-[60px]"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setCancelModal(null)}>Voltar</Button>
              <Button variant="destructive" disabled={!cancelReason.trim()} onClick={handleCancelConfirm}>
                Confirmar {cancelModal.action === 'reject' ? 'Rejeição' : 'Cancelamento'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Execution modal (Frente 3) */}
      {executionModal && (
        <Dialog open={!!executionModal} onOpenChange={(o) => { if (!o) { setExecutionModal(null); setExecutionLegs([]); } }}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Confirmar Execução</DialogTitle>
              <p className="text-sm text-muted-foreground font-mono">{executionModal.display_code ?? executionModal.id.slice(0, 8)}</p>
            </DialogHeader>
            <Separator />
            <p className="text-xs font-semibold text-muted-foreground uppercase">Pernas — edite com os valores reais</p>
            <div className="space-y-3">
              {executionLegs.map((leg: any, i: number) => {
                const isNdf = leg.leg_type === 'ndf';
                const qtyLabel = isNdf ? 'Volume USD' : 'Contratos';
                const priceUnit = getExecutionPriceLabel(leg.leg_type, executionModal.commodity, executionModal.exchange);
                return (
                  <div key={i} className="bg-muted/30 rounded p-3 space-y-2">
                    <div className="flex gap-3 text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">{leg.leg_type}</span>
                      <span>{leg.ticker}</span>
                      <span>{leg.direction}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="space-y-1">
                        <Label className="text-[10px]">{qtyLabel}</Label>
                        <Input
                          className="h-8 text-xs"
                          type="number"
                          step="0.01"
                          value={leg._displayQty}
                          onChange={(e) => {
                            const updated = [...executionLegs];
                            updated[i] = { ...updated[i], _displayQty: e.target.value };
                            setExecutionLegs(updated);
                          }}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px]">Preço</Label>
                        <Input
                          className="h-8 text-xs"
                          type="number"
                          step="0.01"
                          value={leg._displayPrice}
                          onChange={(e) => {
                            const updated = [...executionLegs];
                            updated[i] = { ...updated[i], _displayPrice: e.target.value };
                            setExecutionLegs(updated);
                          }}
                        />
                        {priceUnit && <p className="text-[10px] text-muted-foreground">{priceUnit}</p>}
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px]">Obs.</Label>
                        <Input
                          className="h-8 text-xs"
                          value={leg._notes ?? ''}
                          onChange={(e) => {
                            const updated = [...executionLegs];
                            updated[i] = { ...updated[i], _notes: e.target.value };
                            setExecutionLegs(updated);
                          }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" onClick={() => { setExecutionModal(null); setExecutionLegs([]); }}>Cancelar</Button>
              <Button onClick={handleExecutionConfirm}>Confirmar Execução</Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Insurance selection modal */}
      <Dialog open={insuranceModalLegIndex !== null} onOpenChange={handleInsuranceModalClose}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Selecionar Seguro</DialogTitle>
          </DialogHeader>
          {(() => {
            const ins = (selectedSnapshotData?.insurance_json as Record<string, any>) ?? {};
            const options = [
              { key: 'atm', label: 'ATM', data: ins.atm },
              { key: 'otm_5', label: 'OTM 5%', data: ins.otm_5 },
              { key: 'otm_10', label: 'OTM 10%', data: ins.otm_10 },
            ];
            const hasData = options.some(o => o.data);
            if (!hasData) {
              return <p className="text-sm text-muted-foreground py-4">Snapshot sem dados de seguro.</p>;
            }
            return (
              <div className="grid grid-cols-3 gap-3">
                {options.map(opt => opt.data ? (
                  <Card key={opt.key} className="cursor-pointer hover:border-primary transition-colors"
                    onClick={() => handleInsuranceSelect(opt.data)}>
                    <CardContent className="p-3 space-y-1 text-xs">
                      <p className="font-semibold text-sm">{opt.label}</p>
                      <p>Strike: R$ {(opt.data.strike_brl as number)?.toFixed(2)}</p>
                      <p>Prêmio: R$ {(opt.data.premium_brl as number)?.toFixed(2)}</p>
                      <p className="font-medium">Custo: R$ {(opt.data.total_cost_brl as number)?.toFixed(2)}</p>
                    </CardContent>
                  </Card>
                ) : null)}
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Orders;

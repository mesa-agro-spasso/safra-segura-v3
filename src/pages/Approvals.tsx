import React, { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { logActivity } from '@/lib/activityLog';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { AlertCircle, Columns, ArrowUp, ArrowDown, ChevronsUpDown } from 'lucide-react';

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

const APPROVAL_COLUMNS: Col[] = [
  { key: 'codigo',      label: 'Código' },
  { key: 'tipo',        label: 'Tipo' },
  { key: 'status',      label: 'Status' },
  { key: 'praca',       label: 'Praça' },
  { key: 'commodity',   label: 'Commodity' },
  { key: 'volume',      label: 'Volume (sc)' },
  { key: 'valor',       label: 'Valor' },
  { key: 'pagamento',   label: 'Data Pagamento' },
  { key: 'assinaturas', label: 'Assinaturas' },
];

const KG_PER_SACK = 60;

const ROLES_TIERS = {
  low: ['mesa', 'comercial_n1', 'comercial_n2', 'financeiro_n1'],
  mid: ['mesa', 'comercial_n1', 'comercial_n2', 'comercial_n2', 'financeiro_n1', 'financeiro_n2'],
  high: ['mesa', 'comercial_n1', 'presidencia', 'financeiro_n1', 'financeiro_n2'],
};

const countBy = (arr: string[]) =>
  arr.reduce<Record<string, number>>((acc, r) => ({ ...acc, [r]: (acc[r] ?? 0) + 1 }), {});

const getMissingRoles = (required: string[], collected: string[]) => {
  const req = countBy(required);
  const col = countBy(collected);
  const missing: string[] = [];
  for (const [role, n] of Object.entries(req)) {
    const remaining = n - (col[role] ?? 0);
    for (let i = 0; i < remaining; i++) missing.push(role);
  }
  return missing;
};

const allSigned = (required: string[], collected: string[]) =>
  getMissingRoles(required, collected).length === 0;

function getRequiredRoles(
  volumeTons: number,
  policy: { threshold_x_tons: number; threshold_y_tons: number },
) {
  if (volumeTons <= policy.threshold_x_tons) return ROLES_TIERS.low;
  if (volumeTons <= policy.threshold_x_tons + policy.threshold_y_tons) return ROLES_TIERS.mid;
  return ROLES_TIERS.high;
}

const formatBRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

const formatDate = (d: string | null | undefined) =>
  d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR') : '—';

interface SigningTarget {
  operationId: string;
  batchId: string | null;
  flowType: 'OPENING' | 'CLOSING';
  displayCode: string;
  available: string[];
  collected: string[];
  required: string[];
}

interface SignatureEvent {
  operationId: string;
  batchId: string | null;
  flowType: 'OPENING' | 'CLOSING';
  batch?: any;
  operation?: any;
}

export default function Approvals() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [signing, setSigning] = useState<SigningTarget | null>(null);
  const [selectedRole, setSelectedRole] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [rejecting, setRejecting] = useState<SigningTarget | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  // Filtros
  const [filterWarehouse, setFilterWarehouse] = useState<string>('all');
  const [filterCommodity, setFilterCommodity] = useState<string>('all');
  const [filterPaymentFrom, setFilterPaymentFrom] = useState<string>('');
  const [filterPaymentTo, setFilterPaymentTo] = useState<string>('');

  const pendingCols = usePersistedColumns('cols_approvals_pending', APPROVAL_COLUMNS);
  const signedCols = usePersistedColumns('cols_approvals_signed', APPROVAL_COLUMNS);

  const [tab, setTab] = useState<'pending' | 'history'>('pending');
  type SortDir = 'asc' | 'desc';
  type SortState = { key: string; dir: SortDir } | null;
  const [pendingSort, setPendingSort] = useState<SortState>(null);
  const [signedSort, setSignedSort] = useState<SortState>(null);

  const toggleSort = (current: SortState, key: string): SortState => {
    if (!current || current.key !== key) return { key, dir: 'asc' };
    if (current.dir === 'asc') return { key, dir: 'desc' };
    return null;
  };

  // 1. Roles do usuário logado
  const { data: userRoles = [] } = useQuery({
    queryKey: ['current-user-roles', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('users')
        .select('roles')
        .eq('id', user!.id)
        .maybeSingle();
      if (error) throw error;
      return (data?.roles ?? []) as string[];
    },
  });

  // 2. Policy ativa
  const { data: policy } = useQuery({
    queryKey: ['approval-policy'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('approval_policies')
        .select('*')
        .eq('is_active', true)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // 3. Eventos de assinatura: uma entrada por (operation_id, flow_type, batch_id)
  const { data: events = [] } = useQuery<SignatureEvent[]>({
    queryKey: ['signature-events'],
    queryFn: async () => {
      const { data: sigs, error: sigErr } = await (supabase as any)
        .from('signatures')
        .select('operation_id, flow_type, batch_id');
      if (sigErr) throw sigErr;

      const seen = new Set<string>();
      const groups: { operationId: string; flowType: 'OPENING' | 'CLOSING'; batchId: string | null }[] = [];
      for (const s of (sigs ?? []) as any[]) {
        const batchId = (s.batch_id ?? null) as string | null;
        const flowType = s.flow_type as 'OPENING' | 'CLOSING';
        const key = batchId
          ? `batch:${batchId}:${flowType}`
          : `${s.operation_id}:${flowType}:none`;
        if (seen.has(key)) continue;
        seen.add(key);
        groups.push({ operationId: s.operation_id, flowType, batchId });
      }
      if (!groups.length) return [];

      const opIds = [...new Set(groups.filter((g) => !g.batchId).map((g) => g.operationId))];
      const batchIds = [...new Set(groups.filter((g) => g.batchId).map((g) => g.batchId as string))];

      const [opsRes, batchesRes] = await Promise.all([
        opIds.length
          ? (supabase as any)
              .from('operations')
              .select('*, warehouses(display_name), pricing_snapshots(payment_date)')
              .in('id', opIds)
          : Promise.resolve({ data: [], error: null }),
        batchIds.length
          ? (supabase as any)
              .from('warehouse_closing_batches')
              .select('id, warehouse_id, commodity, total_volume_sacks, allocation_strategy, status, created_at, warehouses(display_name)')
              .in('id', batchIds)
          : Promise.resolve({ data: [], error: null }),
      ]);
      if (opsRes.error) throw opsRes.error;
      if (batchesRes.error) throw batchesRes.error;

      const opMap = new Map<string, any>((opsRes.data ?? []).map((o: any) => [o.id, o]));
      const batchMap = new Map<string, any>((batchesRes.data ?? []).map((b: any) => [b.id, b]));

      return groups.map((g) => ({
        operationId: g.operationId,
        flowType: g.flowType,
        batchId: g.batchId,
        operation: g.batchId ? undefined : opMap.get(g.operationId),
        batch: g.batchId ? batchMap.get(g.batchId) : undefined,
      })) as SignatureEvent[];
    },
    staleTime: 0,
  });

  const operationIds = useMemo(
    () => [...new Set(events.map((e) => e.operationId))],
    [events]
  );

  // 4. Signatures
  const { data: signatures = [] } = useQuery({
    queryKey: ['pending-signatures', operationIds],
    enabled: operationIds.length > 0,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('signatures')
        .select('*')
        .in('operation_id', operationIds);
      if (error) throw error;
      return data ?? [];
    },
  });

  const effectivePolicy = policy ?? { threshold_x_tons: Infinity, threshold_y_tons: 0 };

  const allRows = useMemo(() => {
    return events
      .map((ev) => {
        const isBatch = ev.batchId != null;
        const src = isBatch ? ev.batch : ev.operation;
        if (!src) return null;

        const opSignatures = signatures.filter(
          (s: any) =>
            s.operation_id === ev.operationId &&
            s.flow_type === ev.flowType &&
            (s.batch_id ?? null) === ev.batchId
        );
        const approveSigs = opSignatures.filter((s: any) => s.decision === 'APPROVE');
        const collected = approveSigs.map((s: any) => s.role_used);
        const userAlreadySigned = approveSigs.some((s: any) => s.user_id === user?.id);

        const volumeSacks = Number(
          (isBatch ? src.total_volume_sacks : src.volume_sacks) ?? 0
        );
        const volumeTons = (volumeSacks * KG_PER_SACK) / 1000;
        const required = getRequiredRoles(volumeTons, effectivePolicy as any);
        const missing = getMissingRoles(required, collected);
        const availableForUser = userRoles.filter((r) => missing.includes(r));

        const valueBRL = isBatch ? 0 : volumeSacks * Number(src.origination_price_brl ?? 0);

        return {
          eventKey: `${ev.operationId}:${ev.flowType}:${ev.batchId ?? 'none'}`,
          operationId: ev.operationId,
          batchId: ev.batchId,
          flowType: ev.flowType,
          isBatch,
          displayCode: isBatch
            ? `BATCH-${(ev.batchId as string).slice(0, 8)}`
            : (src.display_code ?? ev.operationId.slice(0, 8)),
          status: src.status as string,
          warehouse: src.warehouses?.display_name ?? '—',
          commodity: src.commodity as string,
          volumeSacks,
          valueBRL,
          paymentDate: isBatch ? null : ((src.pricing_snapshots?.payment_date ?? null) as string | null),
          collected,
          required,
          missing,
          availableForUser,
          userAlreadySigned,
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);
  }, [events, signatures, userRoles, effectivePolicy, user?.id]);

  const pendingRows = useMemo(
    () => allRows.filter((r) => !r.userAlreadySigned && r.availableForUser.length > 0),
    [allRows]
  );

  const signedRows = useMemo(
    () => allRows.filter((r) => r.userAlreadySigned),
    [allRows]
  );

  const warehouseOptions = useMemo(() => {
    const set = new Set<string>();
    allRows.forEach((r) => r.warehouse && set.add(r.warehouse));
    return Array.from(set).sort();
  }, [allRows]);

  const commodityOptions = useMemo(() => {
    const set = new Set<string>();
    allRows.forEach((r) => r.commodity && set.add(r.commodity));
    return Array.from(set).sort();
  }, [allRows]);

  const applyFilters = (list: typeof allRows) =>
    list.filter((r) => {
      if (filterWarehouse !== 'all' && r.warehouse !== filterWarehouse) return false;
      if (filterCommodity !== 'all' && r.commodity !== filterCommodity) return false;
      if (filterPaymentFrom && (!r.paymentDate || r.paymentDate < filterPaymentFrom)) return false;
      if (filterPaymentTo && (!r.paymentDate || r.paymentDate > filterPaymentTo)) return false;
      return true;
    });

  const sortRows = <T extends typeof allRows[number]>(list: T[], sort: SortState): T[] => {
    if (!sort) return list;
    const getValue = (r: T): string | number => {
      switch (sort.key) {
        case 'codigo': return r.displayCode ?? '';
        case 'tipo': return r.isBatch ? 'Block Trade' : (r.flowType === 'CLOSING' ? 'Encerramento' : 'Abertura');
        case 'status': return r.status ?? '';
        case 'praca': return r.warehouse ?? '';
        case 'commodity': return r.commodity ?? '';
        case 'volume': return Number(r.volumeSacks ?? 0);
        case 'valor': return Number(r.valueBRL ?? 0);
        case 'pagamento': return r.paymentDate ?? '';
        default: return '';
      }
    };
    const dir = sort.dir === 'asc' ? 1 : -1;
    return [...list].sort((a, b) => {
      const va = getValue(a); const vb = getValue(b);
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir;
      return String(va).localeCompare(String(vb), 'pt-BR') * dir;
    });
  };

  const filteredPending = useMemo(
    () => sortRows(applyFilters(pendingRows), pendingSort),
    [pendingRows, filterWarehouse, filterCommodity, filterPaymentFrom, filterPaymentTo, pendingSort],
  );
  const filteredSigned = useMemo(
    () => sortRows(applyFilters(signedRows), signedSort),
    [signedRows, filterWarehouse, filterCommodity, filterPaymentFrom, filterPaymentTo, signedSort],
  );

  const clearFilters = () => {
    setFilterWarehouse('all');
    setFilterCommodity('all');
    setFilterPaymentFrom('');
    setFilterPaymentTo('');
  };

  const openSign = (row: (typeof pendingRows)[number]) => {
    setSigning({
      operationId: row.operationId,
      batchId: row.batchId,
      flowType: row.flowType,
      displayCode: row.displayCode,
      available: row.availableForUser,
      collected: row.collected,
      required: row.required,
    });
    setSelectedRole(row.availableForUser[0] ?? '');
    setNotes('');
  };

  const openReject = (row: (typeof pendingRows)[number]) => {
    setRejecting({
      operationId: row.operationId,
      batchId: row.batchId,
      flowType: row.flowType,
      displayCode: row.displayCode,
      available: row.availableForUser,
      collected: row.collected,
      required: row.required,
    });
    setRejectReason('');
  };

  const handleReject = async () => {
    if (!rejecting || !rejectReason.trim() || !user) return;
    const isBatch = !!rejecting.batchId;
    if (!isBatch && rejecting.flowType !== 'OPENING') {
      toast.error('Apenas aberturas ou block trades podem ser recusados');
      return;
    }
    setSubmitting(true);
    try {
      const reason = rejectReason.trim();
      const nowIso = new Date().toISOString();

      if (isBatch) {
        const { error: batchError } = await (supabase as any)
          .from('warehouse_closing_batches')
          .update({
            status: 'CANCELLED',
            cancellation_reason: reason,
          })
          .eq('id', rejecting.batchId);
        if (batchError) throw batchError;
      } else {
        const { error: opError } = await (supabase as any)
          .from('operations')
          .update({
            status: 'CANCELLED',
            cancellation_reason: reason,
            cancelled_at: nowIso,
            cancelled_by: user.id,
          } as never)
          .eq('id', rejecting.operationId);
        if (opError) throw opError;
      }

      const { error: sigError } = await (supabase as any).from('signatures').insert({
        operation_id: rejecting.operationId,
        batch_id: rejecting.batchId ?? null,
        user_id: user.id,
        role_used: rejecting.available[0],
        flow_type: rejecting.flowType,
        decision: 'REJECT',
        notes: reason,
        signed_at: nowIso,
      } as never);
      if (sigError) throw sigError;

      void logActivity('approval.reject', isBatch ? 'warehouse_closing_batch' : 'operation',
        rejecting.batchId ?? rejecting.operationId, { reason, flow_type: rejecting.flowType });
      toast.success(isBatch ? 'Block trade recusado' : 'Operação recusada');
      queryClient.invalidateQueries({ queryKey: ['signature-events'] });
      queryClient.invalidateQueries({ queryKey: ['pending-signatures'] });
      queryClient.invalidateQueries({ queryKey: ['operations'] });
      queryClient.invalidateQueries({ queryKey: ['operations_with_details'] });
      queryClient.invalidateQueries({ queryKey: ['warehouse-closing-batches'] });
      queryClient.invalidateQueries({ queryKey: ['pending-approvals-count'] });
      setRejecting(null);
    } catch (e: any) {
      toast.error('Erro ao recusar', { description: e.message });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSign = async () => {
    if (!signing || !selectedRole || !user) return;
    setSubmitting(true);
    try {
      const { error: insertError } = await (supabase as any).from('signatures').insert({
        operation_id: signing.operationId,
        batch_id: signing.batchId ?? null,
        user_id: user.id,
        role_used: selectedRole,
        flow_type: signing.flowType,
        decision: 'APPROVE',
        notes: notes || null,
        signed_at: new Date().toISOString(),
      } as never);
      if (insertError) throw insertError;

      void logActivity('approval.sign', signing.batchId ? 'warehouse_closing_batch' : 'operation',
        signing.batchId ?? signing.operationId, { role: selectedRole, flow_type: signing.flowType });

      const newCollected = [...signing.collected, selectedRole];
      if (allSigned(signing.required, newCollected)) {
        toast.success('Todas as assinaturas coletadas — pode ser executada');
      } else {
        toast.success('Assinatura registrada');
      }

      queryClient.invalidateQueries({ queryKey: ['pending-signatures'] });
      queryClient.invalidateQueries({ queryKey: ['signature-events'] });
      queryClient.invalidateQueries({ queryKey: ['signatures-for-ops'] });
      queryClient.invalidateQueries({ queryKey: ['pending-approvals-count'] });
      setSigning(null);
    } catch (e: any) {
      toast.error('Erro ao assinar', { description: e.message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Aprovações</h1>
        <p className="text-muted-foreground">
          Operações aguardando sua assinatura para aprovação.
        </p>
        {!policy && (
          <div className="mt-3 flex items-center gap-2 text-sm text-yellow-600 dark:text-yellow-500">
            <AlertCircle className="h-4 w-4" />
            <span>
              Nenhuma política de aprovação ativa configurada — todas as operações estão usando o
              tier mínimo (low).
            </span>
          </div>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
            <div className="space-y-1">
              <Label className="text-xs">Praça</Label>
              <Select value={filterWarehouse} onValueChange={setFilterWarehouse}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {warehouseOptions.map((w) => (
                    <SelectItem key={w} value={w}>{w}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Commodity</Label>
              <Select value={filterCommodity} onValueChange={setFilterCommodity}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {commodityOptions.map((c) => (
                    <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Pagamento (de)</Label>
              <Input type="date" value={filterPaymentFrom} onChange={(e) => setFilterPaymentFrom(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Pagamento (até)</Label>
              <Input type="date" value={filterPaymentTo} onChange={(e) => setFilterPaymentTo(e.target.value)} />
            </div>
            <Button variant="outline" onClick={clearFilters}>Limpar</Button>
          </div>
        </CardContent>
      </Card>

      {(() => {
        const SortHead: React.FC<{
          sort: SortState;
          setSort: (s: SortState) => void;
          colKey: string;
          label: string;
          align?: 'left' | 'right';
        }> = ({ sort, setSort, colKey, label, align = 'left' }) => {
          const active = sort?.key === colKey;
          const Icon = !active ? ChevronsUpDown : sort?.dir === 'asc' ? ArrowUp : ArrowDown;
          return (
            <button
              type="button"
              onClick={() => setSort(toggleSort(sort, colKey))}
              className={`inline-flex items-center gap-1 hover:text-foreground transition-colors ${active ? 'text-foreground' : ''} ${align === 'right' ? 'flex-row-reverse w-full justify-start' : ''}`}
            >
              <span>{label}</span>
              <Icon className="h-3 w-3 opacity-60" />
            </button>
          );
        };

        const renderTable = (
          rows: typeof filteredPending,
          cols: typeof pendingCols,
          sort: SortState,
          setSort: (s: SortState) => void,
          isPending: boolean,
        ) => (
          <Table>
            <TableHeader>
              <TableRow>
                {cols.visible.has('codigo')      && <TableHead><SortHead sort={sort} setSort={setSort} colKey="codigo" label="Código" /></TableHead>}
                {cols.visible.has('tipo')        && <TableHead><SortHead sort={sort} setSort={setSort} colKey="tipo" label="Tipo" /></TableHead>}
                {cols.visible.has('status')      && <TableHead><SortHead sort={sort} setSort={setSort} colKey="status" label="Status" /></TableHead>}
                {cols.visible.has('praca')       && <TableHead><SortHead sort={sort} setSort={setSort} colKey="praca" label="Praça" /></TableHead>}
                {cols.visible.has('commodity')   && <TableHead><SortHead sort={sort} setSort={setSort} colKey="commodity" label="Commodity" /></TableHead>}
                {cols.visible.has('volume')      && <TableHead className="text-right"><SortHead sort={sort} setSort={setSort} colKey="volume" label="Volume (sc)" align="right" /></TableHead>}
                {cols.visible.has('valor')       && <TableHead className="text-right"><SortHead sort={sort} setSort={setSort} colKey="valor" label="Valor" align="right" /></TableHead>}
                {cols.visible.has('pagamento')   && <TableHead><SortHead sort={sort} setSort={setSort} colKey="pagamento" label="Data Pagamento" /></TableHead>}
                {cols.visible.has('assinaturas') && <TableHead>Assinaturas</TableHead>}
                {isPending && <TableHead className="text-right">Ação</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.eventKey} className={isPending ? '' : 'opacity-70'}>
                  {cols.visible.has('codigo') && (
                    <TableCell className="font-mono text-xs">{row.displayCode}</TableCell>
                  )}
                  {cols.visible.has('tipo') && (
                    <TableCell>
                      {row.isBatch ? (
                        <Badge variant="outline" className="border-purple-500 text-purple-500">Block Trade</Badge>
                      ) : row.flowType === 'CLOSING' ? (
                        <Badge variant="outline" className="border-orange-500 text-orange-500">Encerramento</Badge>
                      ) : (
                        <Badge variant="outline">Abertura</Badge>
                      )}
                    </TableCell>
                  )}
                  {cols.visible.has('status') && (
                    <TableCell><Badge variant="outline">{row.status}</Badge></TableCell>
                  )}
                  {cols.visible.has('praca') && (
                    <TableCell>{row.warehouse}</TableCell>
                  )}
                  {cols.visible.has('commodity') && (
                    <TableCell className="capitalize">{row.commodity}</TableCell>
                  )}
                  {cols.visible.has('volume') && (
                    <TableCell className="text-right">{row.volumeSacks.toLocaleString('pt-BR')}</TableCell>
                  )}
                  {cols.visible.has('valor') && (
                    <TableCell className="text-right">{formatBRL(row.valueBRL)}</TableCell>
                  )}
                  {cols.visible.has('pagamento') && (
                    <TableCell>{formatDate(row.paymentDate)}</TableCell>
                  )}
                  {cols.visible.has('assinaturas') && (
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {row.collected.map((r, i) => (
                          <Badge key={`c-${i}`} className="bg-emerald-600 hover:bg-emerald-600/90 text-primary-foreground">
                            {r}
                          </Badge>
                        ))}
                        {row.missing.map((r, i) => (
                          <Badge key={`m-${i}`} variant="outline" className="text-muted-foreground">
                            {r}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                  )}
                  {isPending && (
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button size="sm" onClick={() => openSign(row)}>
                          Assinar
                        </Button>
                        {(row.flowType === 'OPENING' || row.isBatch) && (
                          <Button size="sm" variant="destructive" onClick={() => openReject(row)}>
                            Recusar
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        );

        return (
          <Tabs value={tab} onValueChange={(v) => setTab(v as 'pending' | 'history')}>
            <TabsList>
              <TabsTrigger value="pending">Pendentes ({filteredPending.length})</TabsTrigger>
              <TabsTrigger value="history">Histórico ({filteredSigned.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="pending">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle>Pendentes ({filteredPending.length})</CardTitle>
                    <ColumnSelector
                      columns={APPROVAL_COLUMNS}
                      visible={pendingCols.visible}
                      onChange={pendingCols.setVisible}
                    />
                  </div>
                </CardHeader>
                <CardContent>
                  {filteredPending.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-8 text-center">
                      Nenhuma operação aguardando sua assinatura.
                    </p>
                  ) : (
                    renderTable(filteredPending, pendingCols, pendingSort, setPendingSort, true)
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="history">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle>Histórico — Assinadas por mim ({filteredSigned.length})</CardTitle>
                    <ColumnSelector
                      columns={APPROVAL_COLUMNS}
                      visible={signedCols.visible}
                      onChange={signedCols.setVisible}
                    />
                  </div>
                </CardHeader>
                <CardContent>
                  {filteredSigned.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-8 text-center">
                      Você ainda não assinou nenhuma operação.
                    </p>
                  ) : (
                    renderTable(filteredSigned, signedCols, signedSort, setSignedSort, false)
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        );
      })()}

      <Dialog open={!!signing} onOpenChange={(o) => !o && setSigning(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar assinatura</DialogTitle>
          </DialogHeader>
          {signing && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Assinando como{' '}
                <span className="font-semibold text-foreground">{selectedRole || '—'}</span> na
                operação{' '}
                <span className="font-mono text-foreground">{signing.displayCode}</span>
              </p>

              <div className="space-y-2">
                <Label>Papel</Label>
                <Select value={selectedRole} onValueChange={setSelectedRole}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o papel" />
                  </SelectTrigger>
                  <SelectContent>
                    {signing.available.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Observações (opcional)</Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Notas sobre esta assinatura..."
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSigning(null)} disabled={submitting}>
              Cancelar
            </Button>
            <Button onClick={handleSign} disabled={!selectedRole || submitting}>
              {submitting ? 'Assinando...' : 'Confirmar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!rejecting} onOpenChange={(o) => !o && setRejecting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Recusar Operação</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Operação:{' '}
              <span className="font-mono text-foreground">{rejecting?.displayCode}</span>
            </p>
            <div className="space-y-2">
              <Label>Motivo (obrigatório)</Label>
              <Textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Descreva o motivo da recusa..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejecting(null)} disabled={submitting}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={!rejectReason.trim() || submitting}
            >
              {submitting ? 'Recusando...' : 'Confirmar Recusa'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

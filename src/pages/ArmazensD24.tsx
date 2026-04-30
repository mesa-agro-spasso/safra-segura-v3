import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWarehouses, useActiveArmazens } from '@/hooks/useWarehouses';
import { useOperationsWithDetails } from '@/hooks/useOperations';
import { useMtmSnapshots } from '@/hooks/useMtmSnapshots';
import { usePricingParameters } from '@/hooks/usePricingParameters';
import type { Warehouse, OperationWithDetails, MtmSnapshot } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { ChevronDown, ExternalLink, MapPin, Columns, Calculator } from 'lucide-react';

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
  { key: 'volume', label: 'Volume (sc)' },
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

// ───────────────────────── main page ─────────────────────────

const ArmazensD24: React.FC = () => {
  const navigate = useNavigate();
  const { data: allWarehousesRaw = [] } = useWarehouses();
  const { data: activeArmazens = [] } = useActiveArmazens();
  const { data: operations = [] } = useOperationsWithDetails();
  const { data: snapshots = [] } = useMtmSnapshots();
  const { data: pricingParameters } = usePricingParameters();

  const [tab, setTab] = useState<'posicao' | 'block_trade' | 'config'>('posicao');
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string | null>(null);
  const [filterWarehouse, setFilterWarehouse] = useState<string>('all');
  const [filterCommodity, setFilterCommodity] = useState<string>('all');
  const armazemCols = usePersistedColumns('cols_armazens', ARMAZEM_COLUMNS);

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

  // Per-warehouse aggregates
  const rows = useMemo(() => {
    return warehouses.map(w => {
      const ops = (operations ?? []).filter(
        o => o.warehouse_id === w.id && ACTIVE_STATUSES.has(o.status),
      );
      const commodities = Array.from(new Set(ops.map(o => o.commodity)));
      const volumeTotal = ops.reduce((acc, o) => acc + (o.volume_sacks ?? 0), 0);
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
                    {armazemCols.visible.has('volume') && <TableHead className="text-right">Volume (sc)</TableHead>}
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
                      {armazemCols.visible.has('volume') && (
                        <TableCell className="text-right">{fmtSc(r.volumeTotal)}</TableCell>
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
        <TabsContent value="block_trade">
          <div className="flex flex-col items-center justify-center py-24 space-y-4 text-center">
            <div className="rounded-full bg-muted p-6">
              <Calculator className="h-10 w-10 text-muted-foreground" />
            </div>
            <h2 className="text-xl font-semibold">Block Trade</h2>
            <p className="text-muted-foreground max-w-sm">
              Encerramento em bloco por armazém. Esta funcionalidade está em desenvolvimento
              e será disponibilizada em breve.
            </p>
            <Badge variant="outline" className="border-yellow-500 text-yellow-500">
              Em desenvolvimento
            </Badge>
          </div>
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

export default ArmazensD24;

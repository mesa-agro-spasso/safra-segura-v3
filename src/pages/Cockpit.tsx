import { useEffect, useMemo, useState } from 'react';
import { RefreshCw, Upload, AlertTriangle, Plus, Save } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { callApi } from '@/lib/api';
import { useActiveArmazens } from '@/hooks/useWarehouses';
import { useMarketData } from '@/hooks/useMarketData';
import { usePricingCombinations, useUpsertPricingCombination } from '@/hooks/usePricingCombinations';
import { usePricingSnapshots, useSavePricingSnapshots } from '@/hooks/usePricingSnapshots';
import { useAuth } from '@/contexts/AuthContext';
import { DiscardedCombinationsList } from '@/components/DiscardedCombinationsList';
import { CockpitShell, type CockpitCardSpec } from '@/components/cockpit/CockpitShell';
import { PriceTableCard } from '@/components/cockpit/cards/PriceTableCard';
import { MarketCard } from '@/components/cockpit/cards/MarketCard';
import { PhysicalPricesCard } from '@/components/cockpit/cards/PhysicalPricesCard';
import { ParametersCard, type PendingMap } from '@/components/cockpit/cards/ParametersCard';
import {
  useCockpitLayout,
  useSaveCockpitLayout,
  DEFAULT_LAYOUT,
  type CockpitCardId,
  type CockpitLayout,
} from '@/hooks/useCockpitLayout';
import {
  buildCockpitPayload,
  buildCockpitSnapshots,
  getTradeDateBRT,
  EDITABLE_FIELDS,
  type CockpitOverrides,
  type OverridesMap,
} from '@/lib/cockpitPayload';
import type { Warehouse, MarketData, DiscardedCombination, PricingSnapshot } from '@/types';

const CARD_TITLES: Record<CockpitCardId, string> = {
  price_table: 'Tabela de preços',
  market: 'Mercado (bolsa)',
  physical_prices: 'Preços físicos',
  parameters: 'Parâmetros das combinações',
};

const Cockpit = () => {
  const { data: warehouses } = useActiveArmazens();
  const { data: marketData } = useMarketData();
  const { data: combinations, isLoading } = usePricingCombinations(true);
  const { data: snapshots } = usePricingSnapshots();
  const saveSnapshots = useSavePricingSnapshots();
  const upsertCombination = useUpsertPricingCombination();
  const { user } = useAuth();

  const { data: savedLayout } = useCockpitLayout(user?.id);
  const saveLayout = useSaveCockpitLayout();
  const [layout, setLayout] = useState<CockpitLayout>(DEFAULT_LAYOUT);

  useEffect(() => {
    if (savedLayout) setLayout(savedLayout);
  }, [savedLayout]);

  const [overrides, setOverrides] = useState<OverridesMap>({});
  const [pendingMap, setPendingMap] = useState<PendingMap>({});
  const [recalculating, setRecalculating] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [discarded, setDiscarded] = useState<DiscardedCombination[]>([]);
  const [skipped, setSkipped] = useState<{ comboId: string; label: string; reason: string }[]>([]);
  const [calcResults, setCalcResults] = useState<Record<string, Record<string, unknown>> | null>(null);
  const [partialFailure, setPartialFailure] = useState<{ labels: string[]; message: string } | null>(null);

  const warehouseMap = useMemo(() => {
    const m: Record<string, Warehouse> = {};
    warehouses?.forEach((w) => { m[w.id] = w; });
    return m;
  }, [warehouses]);

  const marketMap = useMemo(() => {
    const m: Record<string, MarketData> = {};
    marketData?.forEach((md) => { m[md.ticker] = md; });
    return m;
  }, [marketData]);

  const spotRate = useMemo(
    () => marketData?.find((m) => m.ticker === 'USD/BRL')?.price ?? null,
    [marketData],
  );

  /** Último lote publicado — mesma regra da Tabela de Preços. */
  const latestBatch = useMemo(() => {
    if (!snapshots?.length) return [] as PricingSnapshot[];
    const latest = snapshots[0].created_at;
    return snapshots.filter((s) => s.created_at === latest);
  }, [snapshots]);

  const snapshotByKey = useMemo(() => {
    const m: Record<string, PricingSnapshot> = {};
    latestBatch.forEach((s) => { m[`${s.warehouse_id}|${s.commodity}|${s.ticker}`] = s; });
    return m;
  }, [latestBatch]);

  const sortedCombos = useMemo(() => {
    if (!combinations) return [];
    return [...combinations].sort((a, b) => {
      const wA = warehouseMap[a.warehouse_id]?.display_name ?? a.warehouse_id;
      const wB = warehouseMap[b.warehouse_id]?.display_name ?? b.warehouse_id;
      if (wA !== wB) return wA.localeCompare(wB);
      if (a.commodity !== b.commodity) return a.commodity.localeCompare(b.commodity);
      return a.ticker.localeCompare(b.ticker);
    });
  }, [combinations, warehouseMap]);

  const skippedMap = useMemo(() => {
    const m: Record<string, string> = {};
    skipped.forEach((s) => { m[s.comboId] = s.reason; });
    return m;
  }, [skipped]);

  const pendingIds = useMemo(
    () => new Set(Object.entries(pendingMap).filter(([, f]) => Object.keys(f).length > 0).map(([id]) => id)),
    [pendingMap],
  );
  const dirty = pendingIds.size > 0;

  const handleChange = (comboId: string, field: keyof CockpitOverrides, value: number | string | null) => {
    setOverrides((prev) => ({ ...prev, [comboId]: { ...prev[comboId], [field]: value } }));
    setPendingMap((prev) => ({ ...prev, [comboId]: { ...prev[comboId], [field]: true } }));
  };

  const handleRecalculate = async () => {
    if (!combinations || !marketData || !warehouses) return;

    const { payload, comboIds, skipped: skippedRows } = buildCockpitPayload({
      combinations: sortedCombos,
      warehouseMap,
      marketMap,
      overrides,
    });

    setSkipped(skippedRows);

    if (payload.length === 0) {
      toast.error('Nenhuma combinação válida para calcular.');
      return;
    }

    setRecalculating(true);
    setDiscarded([]);
    try {
      const tradeDate = getTradeDateBRT();
      const result = await callApi<{
        results: Record<string, unknown>[];
        discarded?: DiscardedCombination[];
      }>('/pricing/table', {
        trade_date: tradeDate,
        spot_usd_brl: spotRate,
        combinations: payload,
      });

      const apiResults = result?.results ?? [];
      const apiDiscarded = result?.discarded ?? [];
      const discardedIdx = new Set(apiDiscarded.map((d) => d.index));
      const keptIndexes = payload.map((_, i) => i).filter((i) => !discardedIdx.has(i));

      const byCombo: Record<string, Record<string, unknown>> = {};
      apiResults.forEach((r, idx) => {
        const comboId = comboIds[keptIndexes[idx] ?? idx];
        if (comboId) byCombo[comboId] = r;
      });

      setCalcResults(byCombo);
      setDiscarded(apiDiscarded);
      setPendingMap({});

      if (apiDiscarded.length > 0) {
        toast.success(`${apiResults.length} preços calculados, ${apiDiscarded.length} descartada(s)`);
      } else {
        toast.success(`${apiResults.length} preços calculados — nada foi gravado`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Erro ao recalcular: ${msg}`);
    } finally {
      setRecalculating(false);
    }
  };

  const handlePublish = async () => {
    if (!calcResults || !combinations) return;

    const { payload, comboIds } = buildCockpitPayload({
      combinations: sortedCombos,
      warehouseMap,
      marketMap,
      overrides,
    });

    const orderedComboIds = comboIds.filter((id) => calcResults[id]);
    const apiResults = orderedComboIds.map((id) => calcResults[id]);
    const keptIndexes = orderedComboIds.map((id) => comboIds.indexOf(id));

    if (apiResults.length === 0) {
      toast.error('Nada para publicar — recalcule primeiro.');
      return;
    }

    setPublishing(true);
    setPartialFailure(null);
    try {
      // PRIMEIRO a tabela: é o que o comercial lê.
      const rows = buildCockpitSnapshots({
        apiResults,
        payload,
        keptIndexes,
        tradeDate: getTradeDateBRT(),
        spotRate,
        userId: user?.id ?? null,
      });
      await saveSnapshots.mutateAsync(rows);
    } catch (err) {
      setPublishing(false);
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`A tabela NÃO foi publicada: ${msg}. Nada foi alterado no cadastro.`);
      return;
    }

    // DEPOIS o cadastro. Se falhar, a tabela publicada continua correta.
    const failed: string[] = [];
    let lastError = '';
    for (const [comboId, ov] of Object.entries(overrides)) {
      const fields = Object.keys(ov) as (keyof CockpitOverrides)[];
      if (fields.length === 0) continue;
      const combo = combinations.find((c) => c.id === comboId);
      if (!combo) continue;
      const patch: Record<string, unknown> = { id: comboId };
      for (const f of fields) {
        if (EDITABLE_FIELDS.includes(f)) patch[f] = ov[f];
      }
      try {
        await upsertCombination.mutateAsync({ ...combo, ...patch } as never);
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
        const wh = warehouseMap[combo.warehouse_id]?.display_name ?? combo.warehouse_id;
        failed.push(`${wh} · ${combo.commodity === 'soybean' ? 'Soja' : 'Milho'} · ${combo.ticker}`);
      }
    }

    setPublishing(false);

    if (failed.length > 0) {
      setPartialFailure({ labels: failed, message: lastError });
    } else {
      setOverrides({});
      setPendingMap({});
      toast.success('Tabela publicada e cadastro atualizado.');
    }
  };

  const canPublish = !!calcResults && !dirty && !publishing && !recalculating;

  const recalcButton = (
    <Button variant="outline" size="sm" className="h-7 text-xs" onClick={handleRecalculate} disabled={recalculating || publishing}>
      <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${recalculating ? 'animate-spin' : ''}`} />
      Recalcular
    </Button>
  );

  const cardContent: Record<CockpitCardId, React.ReactNode> = {
    price_table: (
      <PriceTableCard
        combos={sortedCombos}
        warehouseMap={warehouseMap}
        snapshotByKey={snapshotByKey}
        calcResults={calcResults}
        pendingIds={pendingIds}
        skippedMap={skippedMap}
      />
    ),
    market: <MarketCard />,
    physical_prices: <PhysicalPricesCard warehouseMap={warehouseMap} />,
    parameters: (
      <ParametersCard
        combos={sortedCombos}
        warehouseMap={warehouseMap}
        overrides={overrides}
        pendingMap={pendingMap}
        onChange={handleChange}
      />
    ),
  };

  const cardActions: Partial<Record<CockpitCardId, React.ReactNode>> = {
    price_table: (
      <div className="flex items-center gap-2">
        {recalcButton}
        <Button size="sm" className="h-7 text-xs" onClick={handlePublish} disabled={!canPublish}>
          <Upload className="mr-1.5 h-3.5 w-3.5" />
          Publicar
        </Button>
      </div>
    ),
    parameters: recalcButton,
  };

  const cards: CockpitCardSpec[] = layout.cards.map((c) => ({
    id: c.id,
    title: CARD_TITLES[c.id],
    fixed: c.id === 'price_table',
    content: cardContent[c.id],
    actions: cardActions[c.id],
  }));

  const availableToAdd = (Object.keys(CARD_TITLES) as CockpitCardId[]).filter(
    (id) => !layout.cards.some((c) => c.id === id),
  );

  const handleReorder = (ids: CockpitCardId[]) => setLayout({ version: 1, cards: ids.map((id) => ({ id })) });
  const handleRemove = (id: CockpitCardId) =>
    setLayout((prev) => ({ version: 1, cards: prev.cards.filter((c) => c.id !== id) }));
  const handleAdd = (id: CockpitCardId) =>
    setLayout((prev) => ({ version: 1, cards: [...prev.cards, { id }] }));

  const handleSaveLayout = async () => {
    if (!user?.id) return;
    try {
      await saveLayout.mutateAsync({ userId: user.id, layout });
      toast.success('Layout salvo.');
    } catch (err) {
      toast.error(`Erro ao salvar layout: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-semibold">Cockpit de Precificação</h2>
          <p className="text-sm text-muted-foreground">
            Ajuste os parâmetros, recalcule e publique. Nada é gravado até publicar.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" disabled={availableToAdd.length === 0}>
                <Plus className="mr-1.5 h-4 w-4" />
                Adicionar card
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {availableToAdd.map((id) => (
                <DropdownMenuItem key={id} onClick={() => handleAdd(id)}>
                  {CARD_TITLES[id]}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="outline" size="sm" onClick={handleSaveLayout} disabled={saveLayout.isPending || !user?.id}>
            <Save className="mr-1.5 h-4 w-4" />
            Salvar layout
          </Button>
        </div>
      </div>

      {dirty && (
        <div className="rounded border border-amber-500/50 bg-amber-500/10 p-3 text-sm flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          Há edições não recalculadas ({pendingIds.size} linha(s)). Publicar está travado até recalcular.
        </div>
      )}

      {!dirty && !calcResults && (
        <p className="text-xs text-muted-foreground">
          Preços do último lote publicado. Recalcule para ver o efeito de ajustes.
        </p>
      )}

      {discarded.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Combinações descartadas pela API</CardTitle>
          </CardHeader>
          <CardContent>
            <DiscardedCombinationsList items={discarded} />
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando combinações…</p>
      ) : (
        <CockpitShell cards={cards} onReorder={handleReorder} onRemove={handleRemove} />
      )}

      <Dialog open={!!partialFailure} onOpenChange={(o) => { if (!o) setPartialFailure(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Tabela publicada, cadastro pendente</DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-3 text-sm">
                <p className="text-foreground">A tabela foi publicada e já está valendo para o comercial.</p>
                <div>
                  <p>O cadastro destas combinações NÃO foi alterado:</p>
                  <ul className="list-disc pl-5 mt-1">
                    {partialFailure?.labels.map((l) => <li key={l}>{l}</li>)}
                  </ul>
                </div>
                <p className="text-foreground font-medium">
                  Publique de novo pelo cockpit. Não gere a tabela novamente.
                </p>
                {partialFailure?.message && (
                  <p className="text-xs text-muted-foreground">Detalhe técnico: {partialFailure.message}</p>
                )}
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setPartialFailure(null)}>Entendi</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Cockpit;

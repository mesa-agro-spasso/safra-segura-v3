import { useEffect, useMemo, useState } from 'react';
import { RefreshCw, Upload, AlertTriangle, Plus, Save, Calculator } from 'lucide-react';
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
import { usePricingCombinations, useUpsertPricingCombination, useTogglePricingCombinationActive } from '@/hooks/usePricingCombinations';
import { usePricingSnapshots, useSavePricingSnapshots } from '@/hooks/usePricingSnapshots';
import { useAuth } from '@/contexts/AuthContext';
import { DiscardedCombinationsList } from '@/components/DiscardedCombinationsList';
import { useLatestOptionQuotes } from '@/hooks/useInsuranceOptions';
import {
  InsuranceFields,
  validateInsuranceTrio,
  insurancePatch,
  type InsuranceValue,
} from '@/components/pricing/InsuranceFields';
import { InsuranceOptionsCard } from '@/components/cockpit/cards/InsuranceOptionsCard';
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
import type { Warehouse, MarketData, DiscardedCombination, PricingSnapshot, PricingCombination } from '@/types';

const CARD_TITLES: Record<CockpitCardId, string> = {
  price_table: 'Tabela de preços',
  market: 'Mercado (bolsa)',
  physical_prices: 'Preços físicos',
  parameters: 'Parâmetros das combinações',
  insurance_options: 'Opções de seguro',
};

const Cockpit = () => {
  const { data: warehouses } = useActiveArmazens();
  const { data: marketData } = useMarketData();
  const { data: allCombinations, isLoading } = usePricingCombinations();
  const { data: snapshots } = usePricingSnapshots();
  const { data: latestQuotes } = useLatestOptionQuotes();
  const saveSnapshots = useSavePricingSnapshots();
  const upsertCombination = useUpsertPricingCombination();
  const toggleCombinationActive = useTogglePricingCombinationActive();
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
  /** Linhas com seguro não gravadas por falta de costs.insurance_brl na resposta. */
  const [insuranceFailures, setInsuranceFailures] = useState<string[]>([]);
  /** Combinação cujo seguro está sendo editado no modal. */
  const [insuranceEditing, setInsuranceEditing] = useState<PricingCombination | null>(null);
  const [insuranceDraft, setInsuranceDraft] = useState<InsuranceValue>({});
  const [savingInsurance, setSavingInsurance] = useState(false);
  /** Cotações gravadas desde o último recálculo — trava o Publicar junto com os parâmetros. */
  const [quotesDirty, setQuotesDirty] = useState(false);
  const [quoteCount, setQuoteCount] = useState(0);
  const [recalcNonce, setRecalcNonce] = useState(0);
  /** Falso enquanto algum campo numérico do card de parâmetros estiver inválido. */
  const [paramsValid, setParamsValid] = useState(true);

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

  /** Só as ativas alimentam tabela, payload e publicação. */
  const combinations = useMemo(
    () => (allCombinations ?? []).filter((c) => c.active),
    [allCombinations],
  );

  const inactiveCombos = useMemo(
    () => (allCombinations ?? []).filter((c) => !c.active),
    [allCombinations],
  );

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
  const dirty = pendingIds.size > 0 || quotesDirty;

  const handleQuoteChanged = (tickers: string[]) => {
    setQuotesDirty(true);
    setQuoteCount((n) => n + tickers.length);
  };

  const handleChange = (comboId: string, field: keyof CockpitOverrides, value: number | string | boolean | null) => {
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
      tradeDate: getTradeDateBRT(),
      latestQuotes,
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
      setQuotesDirty(false);
      setQuoteCount(0);
      setRecalcNonce((n) => n + 1);

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

    const { payload, comboIds, insuranceByIndex } = buildCockpitPayload({
      combinations: sortedCombos,
      warehouseMap,
      marketMap,
      overrides,
      tradeDate: getTradeDateBRT(),
      latestQuotes,
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
    setInsuranceFailures([]);
    try {
      // PRIMEIRO a tabela: é o que o comercial lê.
      const { rows, notSaved } = buildCockpitSnapshots({
        apiResults,
        payload,
        keptIndexes,
        tradeDate: getTradeDateBRT(),
        spotRate,
        userId: user?.id ?? null,
        insuranceByIndex,
      });
      if (notSaved.length > 0) setInsuranceFailures(notSaved);
      if (rows.length > 0) await saveSnapshots.mutateAsync(rows);
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

  const openInsurance = (combo: PricingCombination) => {
    setInsuranceEditing(combo);
    setInsuranceDraft({
      insurance_option_id: combo.insurance_option_id ?? null,
      insurance_coverage_pct: combo.insurance_coverage_pct ?? null,
      insurance_carry_until: combo.insurance_carry_until ?? null,
    });
  };

  const handleSaveInsurance = async () => {
    if (!insuranceEditing) return;
    const error = validateInsuranceTrio(insuranceDraft);
    if (error) { toast.error(error); return; }
    setSavingInsurance(true);
    try {
      await upsertCombination.mutateAsync({
        ...insuranceEditing,
        ...insurancePatch(insuranceDraft),
      } as never);
      // Seguro é cadastro, não override de sessão: marca a linha como não recalculada.
      setPendingMap((prev) => ({
        ...prev,
        [insuranceEditing.id]: { ...prev[insuranceEditing.id], insurance: true } as never,
      }));
      toast.success('Seguro da combinação salvo.');
      setInsuranceEditing(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar seguro');
    } finally {
      setSavingInsurance(false);
    }
  };

  const canPublish = !!calcResults && !dirty && !publishing && !recalculating && paramsValid;

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
        staleAll={quotesDirty}
      />
    ),
    market: <MarketCard onQuoteChanged={handleQuoteChanged} clearMarksKey={recalcNonce} />,
    physical_prices: <PhysicalPricesCard warehouseMap={warehouseMap} />,
    parameters: (
      <ParametersCard
        onValidityChange={setParamsValid}
        combos={sortedCombos}
        warehouseMap={warehouseMap}
        overrides={overrides}
        pendingMap={pendingMap}
        onChange={handleChange}
        onEditInsurance={openInsurance}
        inactive={inactiveCombos}
        onToggleActive={(id, active) => toggleCombinationActive.mutate({ id, active })}
      />
    ),
    insurance_options: <InsuranceOptionsCard onQuoteRegistered={() => handleQuoteChanged(['seguro'])} />,
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
            Ajuste os parâmetros, recalcule e publique. Custos e datas só são gravados ao publicar —
            cotações gravam na hora.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setSimOpen(true)}>
            <Calculator className="mr-1.5 h-4 w-4" />
            Simulação livre
          </Button>
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
          {[
            pendingIds.size > 0 ? `${pendingIds.size} linha(s) com parâmetro editado` : null,
            quotesDirty ? `cotação alterada (${quoteCount} gravação(ões), já valendo para todos)` : null,
          ].filter(Boolean).join(' · ')}. Publicar está travado até recalcular.
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

      {insuranceFailures.length > 0 && (
        <Card className="border-destructive">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-destructive">
              Linhas com seguro NÃO gravadas
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              A API não devolveu o custo do seguro nestas linhas. Gravar sem esse registro produziria
              um preço menor sem explicação, então elas ficaram de fora da tabela publicada:
            </p>
            <ul className="list-disc pl-5">
              {insuranceFailures.map((l) => <li key={l}>{l}</li>)}
            </ul>
            <Button variant="outline" size="sm" onClick={() => setInsuranceFailures([])}>Entendi</Button>
          </CardContent>
        </Card>
      )}

      <Dialog open={!!insuranceEditing} onOpenChange={(o) => { if (!o) setInsuranceEditing(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Seguro da combinação</DialogTitle>
            <DialogDescription>
              {insuranceEditing
                ? `${warehouseMap[insuranceEditing.warehouse_id]?.display_name ?? insuranceEditing.warehouse_id} · ${insuranceEditing.ticker}`
                : ''}
              {' '}— grava direto no cadastro da combinação.
            </DialogDescription>
          </DialogHeader>
          {insuranceEditing && (
            <InsuranceFields
              value={insuranceDraft}
              commodity={insuranceEditing.commodity as 'soybean' | 'corn'}
              benchmark={insuranceEditing.benchmark as 'cbot' | 'b3'}
              onChange={setInsuranceDraft}
            />
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setInsuranceEditing(null)}>Cancelar</Button>
            <Button onClick={handleSaveInsurance} disabled={savingInsurance}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

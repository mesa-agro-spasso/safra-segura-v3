import { useMemo, useState } from 'react';
import { RefreshCw, Upload, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { callApi } from '@/lib/api';
import { useActiveArmazens } from '@/hooks/useWarehouses';
import { useMarketData } from '@/hooks/useMarketData';
import { usePricingCombinations, useUpsertPricingCombination } from '@/hooks/usePricingCombinations';
import { usePricingSnapshots, useSavePricingSnapshots } from '@/hooks/usePricingSnapshots';
import { useAuth } from '@/contexts/AuthContext';
import { DiscardedCombinationsList } from '@/components/DiscardedCombinationsList';
import { CockpitRow } from '@/components/cockpit/CockpitRow';
import {
  buildCockpitPayload,
  buildCockpitSnapshots,
  getTradeDateBRT,
  readOriginMap,
  EDITABLE_FIELDS,
  type CockpitOverrides,
  type OverridesMap,
} from '@/lib/cockpitPayload';
import type { Warehouse, MarketData, DiscardedCombination, PricingSnapshot } from '@/types';

const Cockpit = () => {
  const { data: warehouses } = useActiveArmazens();
  const { data: marketData } = useMarketData();
  const { data: combinations, isLoading } = usePricingCombinations(true);
  const { data: snapshots } = usePricingSnapshots();
  const saveSnapshots = useSavePricingSnapshots();
  const upsertCombination = useUpsertPricingCombination();
  const { user } = useAuth();

  const [overrides, setOverrides] = useState<OverridesMap>({});
  const [recalculating, setRecalculating] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [dirty, setDirty] = useState(false);
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

  /** Chave praça+commodity+ticker → snapshot do lote vigente. */
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

  const handleChange = (comboId: string, field: keyof CockpitOverrides, value: number | string | null) => {
    setOverrides((prev) => ({ ...prev, [comboId]: { ...prev[comboId], [field]: value } }));
    setDirty(true);
  };

  const editedCount = useMemo(
    () => Object.values(overrides).filter((o) => Object.keys(o).length > 0).length,
    [overrides],
  );

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
      setDirty(false);

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

    // Reconstrói o payload da mesma forma do recálculo para montar os snapshots.
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
      setDirty(false);
      toast.success('Tabela publicada e cadastro atualizado.');
    }
  };

  const canPublish = !!calcResults && !dirty && !publishing && !recalculating;

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
          <Button variant="outline" onClick={handleRecalculate} disabled={recalculating || publishing}>
            <RefreshCw className={`mr-2 h-4 w-4 ${recalculating ? 'animate-spin' : ''}`} />
            Recalcular
          </Button>
          <Button onClick={handlePublish} disabled={!canPublish}>
            <Upload className="mr-2 h-4 w-4" />
            Publicar
          </Button>
        </div>
      </div>

      {dirty && (
        <div className="rounded border border-primary/40 bg-primary/10 p-3 text-sm flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-primary" />
          Há edições não recalculadas ({editedCount} linha(s)). Os preços na tela ainda não refletem essas mudanças.
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

      <div className="space-y-2">
        {isLoading && <p className="text-sm text-muted-foreground">Carregando combinações…</p>}
        {!isLoading && sortedCombos.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Nenhuma combinação ativa. Cadastre em Configurações → Combinações.
          </p>
        )}
        {sortedCombos.map((combo) => {
          const snap = snapshotByKey[`${combo.warehouse_id}|${combo.commodity}|${combo.ticker}`];
          const calc = calcResults?.[combo.id];
          const price = calc
            ? ((calc.origination_price_brl as number | null) ?? null)
            : (snap?.origination_price_brl ?? null);
          return (
            <CockpitRow
              key={combo.id}
              combo={combo}
              warehouse={warehouseMap[combo.warehouse_id]}
              price={price}
              priceStale={!calc || dirty}
              issue={skippedMap[combo.id] ?? null}
              origin={readOriginMap((calc ?? snap?.outputs_json) as Record<string, unknown> | undefined)}
              overrides={overrides[combo.id]}
              onChange={handleChange}
            />
          );
        })}
      </div>

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

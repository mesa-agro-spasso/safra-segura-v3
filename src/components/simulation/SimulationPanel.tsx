import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  Calculator,
  FileDown,
  Save,
  Trash2,
  RefreshCw,
  FolderOpen,
  Info,
  ChevronDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { NumericInput } from '@/components/ui/numeric-input';
import { DateInput } from '@/components/ui/date-input';
import { DiscardedCombinationsList } from '@/components/DiscardedCombinationsList';
import { InsuranceFields, validateInsuranceTrio } from '@/components/pricing/InsuranceFields';
import { DreView } from '@/components/simulation/DreView';
import { exportDrePdf } from '@/lib/dreExport';
import { callApi } from '@/lib/api';
import { getTradeDateBRT } from '@/lib/cockpitPayload';
import {
  buildSimulationRequest,
  buildSimulationSnapshot,
  combinationFromSimulation,
  costsFromCombinations,
  emptySimulationForm,
  formFromCombination,
  marketCommodityKey,
  validateSimulationFields,
  type SimulationForm,
} from '@/lib/simulationPayload';
import { useActiveArmazens } from '@/hooks/useWarehouses';
import { useMarketData } from '@/hooks/useMarketData';
import { usePricingCombinations, useUpsertPricingCombination } from '@/hooks/usePricingCombinations';
import { useLatestOptionQuotes } from '@/hooks/useInsuranceOptions';
import { useInsertPricingSnapshot } from '@/hooks/usePricingSnapshots';
import {
  useSimulationDrafts,
  useSaveSimulationDraft,
  useDeleteSimulationDraft,
} from '@/hooks/useSimulationDrafts';
import { useQuoteAuthors } from '@/hooks/usePhysicalPrices';
import { useAuth } from '@/contexts/AuthContext';
import type { DiscardedCombination, Warehouse } from '@/types';

export interface SimulationPanelProps {
  /** created_at do lote exibido hoje — usado por "Adicionar à tabela". */
  currentBatchCreatedAt?: string | null;
  /** 'card' colapsa as seções por padrão e não mostra o rodapé de fechar. */
  variant?: 'dialog' | 'card';
  /** Só no diálogo: fechar depois da confirmação. */
  onClose?: () => void;
  /** Só no diálogo: usado para carregar os rascunhos. */
  active?: boolean;
}

const F = ({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) => (
  <div className="space-y-1">
    <Label className="text-xs">{label}</Label>
    {children}
    {error && <p className="text-[11px] text-destructive">{error}</p>}
  </div>
);

/** Seção do formulário: plana no diálogo, colapsável no card do cockpit. */
function Section({
  title,
  collapsible,
  defaultOpen,
  children,
}: {
  title: string;
  collapsible: boolean;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(!!defaultOpen);
  if (!collapsible) {
    return (
      <div className="space-y-3">
        <Separator />
        <p className="text-xs font-medium text-muted-foreground">{title}</p>
        {children}
      </div>
    );
  }
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="rounded border border-border">
      <CollapsibleTrigger className="flex w-full items-center justify-between px-3 py-2 text-xs font-medium">
        <span>{title}</span>
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-3 border-t border-border p-3">{children}</CollapsibleContent>
    </Collapsible>
  );
}

export function SimulationPanel({
  currentBatchCreatedAt,
  variant = 'dialog',
  onClose,
  active = true,
}: SimulationPanelProps) {
  const isCard = variant === 'card';
  const { user } = useAuth();
  const { data: warehouses } = useActiveArmazens();
  const { data: marketData } = useMarketData();
  const { data: combinations } = usePricingCombinations();
  const { data: latestQuotes } = useLatestOptionQuotes();
  const upsertCombination = useUpsertPricingCombination();
  const insertSnapshot = useInsertPricingSnapshot();
  const { data: drafts } = useSimulationDrafts(active);
  const saveDraft = useSaveSimulationDraft();
  const deleteDraft = useDeleteSimulationDraft();
  const { data: authors } = useQuoteAuthors((drafts ?? []).map((d) => d.created_by));

  const spotRate = useMemo(
    () => marketData?.find((m) => m.ticker === 'USD/BRL')?.price ?? null,
    [marketData],
  );

  const [form, setForm] = useState<SimulationForm>(() => emptySimulationForm(getTradeDateBRT()));
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [discarded, setDiscarded] = useState<DiscardedCombination[]>([]);
  const [sentRequest, setSentRequest] = useState<Record<string, unknown> | null>(null);
  const [sentRow, setSentRow] = useState<Record<string, unknown> | null>(null);
  const [insuranceUsed, setInsuranceUsed] = useState<ReturnType<typeof buildSimulationRequest>['insuranceUsed']>(null);
  const [calculating, setCalculating] = useState(false);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [draftLabel, setDraftLabel] = useState('');
  const [confirmClose, setConfirmClose] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [numericValid, setNumericValid] = useState(true);
  /** Câmbio digitado à mão vira override; sem edição o payload sai como sempre. */
  const [fxTouched, setFxTouched] = useState(false);

  useEffect(() => {
    if (active && !fxTouched) {
      setForm((f) => ({ ...f, spot_usd_brl: f.spot_usd_brl ?? spotRate }));
    }
  }, [active, spotRate, fxTouched]);

  const warehouseMap = useMemo(() => {
    const m: Record<string, Warehouse> = {};
    warehouses?.forEach((w) => { m[w.id] = w; });
    return m;
  }, [warehouses]);

  const warehouse = form.warehouse_id ? warehouseMap[form.warehouse_id] : undefined;
  const quote = form.insurance.insurance_option_id
    ? latestQuotes?.[form.insurance.insurance_option_id] ?? null
    : null;

  const patch = (p: Partial<SimulationForm>) => setForm((f) => ({ ...f, ...p }));

  /** Tickers disponíveis no mercado para a commodity + bolsa escolhidas. */
  const tickerOptions = useMemo(() => {
    const key = marketCommodityKey(form.commodity, form.benchmark);
    if (!key) return [];
    const today = new Date().toISOString().split('T')[0];
    return (marketData ?? [])
      .filter((m) => m.commodity === key && (!m.exp_date || m.exp_date >= today))
      .sort((a, b) => (a.exp_date ?? '').localeCompare(b.exp_date ?? '') || a.ticker.localeCompare(b.ticker));
  }, [marketData, form.commodity, form.benchmark]);

  const applyTicker = (ticker: string) => {
    const m = marketData?.find((x) => x.ticker === ticker);
    patch({
      ticker,
      futures_price: m?.price ?? null,
      exp_date: m?.exp_date ?? null,
    });
  };

  /** Troca de commodity/bolsa: limpa o ticker e herda custos de uma combinação compatível. */
  const applyMarketScope = (p: Partial<SimulationForm>) => {
    setForm((f) => {
      const next = { ...f, ...p };
      const costs = costsFromCombinations(
        combinations,
        next.commodity,
        next.benchmark,
        next.warehouse_id,
        next.warehouse_id ? warehouseMap[next.warehouse_id] : undefined,
      );
      return {
        ...next,
        ticker: '',
        futures_price: null,
        exp_date: null,
        manual: costs ?? next.manual,
      };
    });
  };

  const resetAll = () => {
    setForm(emptySimulationForm(getTradeDateBRT()));
    setResult(null);
    setDiscarded([]);
    setSentRequest(null);
    setSentRow(null);
    setInsuranceUsed(null);
    setSaved(false);
    setDraftLabel('');
    setFxTouched(false);
  };

  const applyCombination = (comboId: string) => {
    const combo = combinations?.find((c) => c.id === comboId);
    if (!combo) return;
    const market = marketData?.find((m) => m.ticker === combo.ticker);
    setForm(
      formFromCombination(
        combo,
        warehouseMap[combo.warehouse_id],
        getTradeDateBRT(),
        market?.price ?? null,
        market?.exp_date ?? null,
        combo.benchmark === 'cbot' ? market?.ndf_override ?? null : null,
        spotRate,
      ),
    );
    setFxTouched(false);
    setResult(null);
    setSaved(false);
  };

  const runCalculation = async (request: Record<string, unknown>) => {
    const response = await callApi<{
      results: Record<string, unknown>[];
      discarded?: DiscardedCombination[];
    }>('/pricing/table', request);
    const results = response?.results ?? [];
    setDiscarded(response?.discarded ?? []);
    setResult(results[0] ?? null);
    setSaved(false);
    return results[0] ?? null;
  };

  const fieldErrors = validateSimulationFields(form, quote);
  const trioError = validateInsuranceTrio(form.insurance);
  const formValid = Object.keys(fieldErrors).length === 0 && !trioError && numericValid;

  const handleCalculate = async () => {
    if (!formValid) return;
    const { request, row, insuranceUsed: ins } = buildSimulationRequest(form, warehouse, quote);
    setCalculating(true);
    try {
      const first = await runCalculation(request);
      setSentRequest(request);
      setSentRow(row);
      setInsuranceUsed(ins);
      if (!first) toast.error('A API não devolveu resultado para esta simulação.');
      else toast.success('Simulação calculada — nada foi gravado.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao calcular');
    } finally {
      setCalculating(false);
    }
  };

  const handleSaveDraft = async () => {
    if (!result || !sentRequest) return;
    setBusy(true);
    try {
      await saveDraft.mutateAsync({
        label: draftLabel.trim() || null,
        request_json: sentRequest,
        response_json: result,
        created_by: user?.id ?? null,
      });
      setSaved(true);
      setDraftLabel('');
      toast.success('Rascunho salvo (expira em 3 dias).');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar rascunho');
    } finally {
      setBusy(false);
    }
  };

  const handlePdf = async () => {
    try {
      await exportDrePdf({
        outputs: result,
        warehouseName: warehouse?.display_name ?? null,
        fileTag: form.ticker || undefined,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao gerar PDF');
    }
  };

  const snapshotRow = (createdAt?: string | null) =>
    buildSimulationSnapshot({
      form,
      row: sentRow ?? {},
      result: result ?? {},
      insuranceUsed,
      userId: user?.id ?? null,
      createdAt: createdAt ?? null,
    });

  const handleMontarOperacao = async () => {
    if (!result || !form.warehouse_id) return;
    setBusy(true);
    try {
      await insertSnapshot.mutateAsync(snapshotRow());
      setSaved(true);
      setInfoOpen(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar snapshot');
    } finally {
      setBusy(false);
    }
  };

  const handleAdicionarTabela = async () => {
    if (!result || !form.warehouse_id) return;
    if (!currentBatchCreatedAt) {
      toast.error('Não há lote publicado para receber esta linha.');
      return;
    }
    setBusy(true);
    try {
      await upsertCombination.mutateAsync(combinationFromSimulation(form) as never);
      await insertSnapshot.mutateAsync(snapshotRow(currentBatchCreatedAt));
      setSaved(true);
      toast.success('Combinação criada e linha adicionada ao lote atual da tabela.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao adicionar à tabela');
    } finally {
      setBusy(false);
    }
  };

  const requestClose = () => {
    if (result && !saved) { setConfirmClose(true); return; }
    onClose?.();
    resetAll();
  };

  const openDraft = (responseJson: Record<string, unknown> | null) => {
    setResult(responseJson ?? null);
    setDiscarded([]);
    setSaved(true);
    toast.success('Rascunho aberto (sem recalcular).');
  };

  const recalcDraft = async (request: Record<string, unknown>) => {
    setCalculating(true);
    try {
      await runCalculation(request);
      setSentRequest(request);
      setSentRow(((request.combinations as Record<string, unknown>[]) ?? [])[0] ?? {});
      toast.success('Rascunho recalculado.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao recalcular');
    } finally {
      setCalculating(false);
    }
  };

  const hasWarehouse = !!form.warehouse_id;
  const canAct = !!result && !busy && !calculating;

  const tickerSelectValue = form.ticker || '';
  const tickerMissing = !!form.ticker && !tickerOptions.some((t) => t.ticker === form.ticker);

  return (
    <>
      <Tabs defaultValue="sim">
        <TabsList>
          <TabsTrigger value="sim">Simulação</TabsTrigger>
          <TabsTrigger value="drafts">Rascunhos {drafts?.length ? `(${drafts.length})` : ''}</TabsTrigger>
        </TabsList>

        <TabsContent value="sim" className="mt-3">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* ---------- Formulário ---------- */}
            <div className="space-y-4 min-w-0">
              <div className="flex flex-wrap items-end gap-2">
                <div className="flex-1 min-w-[200px]">
                  <F label="Partir de uma combinação">
                    <Select onValueChange={applyCombination}>
                      <SelectTrigger><SelectValue placeholder="Selecione (opcional)" /></SelectTrigger>
                      <SelectContent className="max-h-72">
                        {(combinations ?? []).map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {(warehouseMap[c.warehouse_id]?.display_name ?? c.warehouse_id)} · {c.ticker}
                            {c.active ? '' : ' (inativa)'}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </F>
                </div>
                <Button variant="outline" size="sm" onClick={resetAll}>Do zero</Button>
              </div>

              <Section title="Identidade" collapsible={isCard} defaultOpen>
                <div className="grid grid-cols-2 gap-3">
                  <F label="Praça (só para gravar)">
                    <Select
                      value={form.warehouse_id ?? ''}
                      onValueChange={(v) => patch({ warehouse_id: v })}
                    >
                      <SelectTrigger><SelectValue placeholder="Sem praça" /></SelectTrigger>
                      <SelectContent className="max-h-72">
                        {(warehouses ?? []).map((w) => (
                          <SelectItem key={w.id} value={w.id}>{w.display_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </F>
                  <F label="Método">
                    <Select
                      value={form.pricing_method}
                      onValueChange={(v) => patch({ pricing_method: v as SimulationForm['pricing_method'] })}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="LONG_BASIS">Long Basis</SelectItem>
                        <SelectItem value="TARGET_PRICE">Target Price</SelectItem>
                      </SelectContent>
                    </Select>
                  </F>
                  <F label="Commodity">
                    <Select
                      value={form.commodity}
                      onValueChange={(v) => applyMarketScope({ commodity: v as SimulationForm['commodity'] })}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="soybean">Soja</SelectItem>
                        <SelectItem value="corn">Milho</SelectItem>
                      </SelectContent>
                    </Select>
                  </F>
                  <F label="Bolsa">
                    <Select
                      value={form.benchmark}
                      onValueChange={(v) => applyMarketScope({ benchmark: v as SimulationForm['benchmark'] })}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cbot">CBOT</SelectItem>
                        <SelectItem value="b3">B3</SelectItem>
                      </SelectContent>
                    </Select>
                  </F>
                  <F label="Ticker" error={fieldErrors.ticker}>
                    <Select value={tickerSelectValue} onValueChange={applyTicker}>
                      <SelectTrigger>
                        <SelectValue placeholder={tickerOptions.length ? 'Selecione' : 'Sem cotação'} />
                      </SelectTrigger>
                      <SelectContent className="max-h-72">
                        {tickerMissing && (
                          <SelectItem value={form.ticker}>{form.ticker}</SelectItem>
                        )}
                        {tickerOptions.map((t) => (
                          <SelectItem key={t.ticker} value={t.ticker}>{t.ticker}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </F>
                  <F label="Preço de futuros" error={fieldErrors.futures_price}>
                    <NumericInput
                      precision={4}
                      value={form.futures_price}
                      onChange={(v) => patch({ futures_price: v })}
                      onValidityChange={setNumericValid}
                    />
                  </F>
                </div>
              </Section>

              <Section title="Datas" collapsible={isCard}>
                <div className="grid grid-cols-2 gap-3">
                  <F label="Data de negócio" error={fieldErrors.trade_date}>
                    <DateInput value={form.trade_date} onChange={(v) => patch({ trade_date: v })} />
                  </F>
                  <F label="Vencimento do contrato">
                    <DateInput value={form.exp_date} onChange={(v) => patch({ exp_date: v || null })} />
                  </F>
                  <F label="Venda" error={fieldErrors.sale_date}>
                    <DateInput value={form.sale_date} onChange={(v) => patch({ sale_date: v || null })} />
                  </F>
                  <F label="Recepção do grão">
                    <DateInput
                      value={form.grain_reception_date}
                      onChange={(v) => patch({ grain_reception_date: v || null })}
                    />
                  </F>
                  <F label="Pagamento" error={fieldErrors.payment_date}>
                    <DateInput
                      disabled={form.is_spot}
                      value={form.payment_date}
                      onChange={(v) => patch({ payment_date: v || null })}
                    />
                  </F>
                  <div className="flex items-center gap-2 pt-6">
                    <Switch checked={form.is_spot} onCheckedChange={(v) => patch({ is_spot: v })} />
                    <span className="text-xs">Pagamento à vista</span>
                  </div>
                </div>
              </Section>

              <Section title="Preço e ajustes" collapsible={isCard} defaultOpen>
                <div className="grid grid-cols-2 gap-3">
                  {form.pricing_method === 'LONG_BASIS' ? (
                    <F label="Basis alvo (R$/sc)" error={fieldErrors.target_basis}>
                      <NumericInput precision={2} value={form.target_basis} onChange={(v) => patch({ target_basis: v })} />
                    </F>
                  ) : (
                    <F label="Preço líquido alvo (R$/sc)" error={fieldErrors.origination_price_net_brl}>
                      <NumericInput
                        precision={2}
                        value={form.origination_price_net_brl}
                        onChange={(v) => patch({ origination_price_net_brl: v })}
                      />
                    </F>
                  )}
                  <F label="Desconto adicional (R$/sc)">
                    <NumericInput
                      precision={2}
                      value={form.additional_discount_brl}
                      onChange={(v) => patch({ additional_discount_brl: v })}
                    />
                  </F>
                  <F label="Dólar à vista" error={fieldErrors.spot_usd_brl}>
                    <NumericInput
                      precision={4}
                      value={form.spot_usd_brl}
                      onChange={(v) => {
                        setFxTouched(true);
                        patch({ spot_usd_brl: v, exchange_rate_override: v });
                      }}
                    />
                  </F>
                </div>
              </Section>

              <Section title="Custos" collapsible={isCard}>
                <div className="grid grid-cols-2 gap-3">
                  <F label="Taxa de juros">
                    <NumericInput
                      precision={4}
                      value={form.manual.interest_rate}
                      onChange={(v) => patch({ manual: { ...form.manual, interest_rate: v } })}
                    />
                  </F>
                  <F label="Período da taxa">
                    <Select
                      value={form.manual.interest_rate_period ?? ''}
                      onValueChange={(v) => patch({ manual: { ...form.manual, interest_rate_period: v } })}
                    >
                      <SelectTrigger><SelectValue placeholder="Herdar" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="monthly">Mensal</SelectItem>
                        <SelectItem value="yearly">Anual</SelectItem>
                      </SelectContent>
                    </Select>
                  </F>
                  <F label="Armazenagem">
                    <NumericInput
                      precision={2}
                      value={form.manual.storage_cost}
                      onChange={(v) => patch({ manual: { ...form.manual, storage_cost: v } })}
                    />
                  </F>
                  <F label="Tipo de armazenagem">
                    <Select
                      value={form.manual.storage_cost_type ?? ''}
                      onValueChange={(v) => patch({ manual: { ...form.manual, storage_cost_type: v } })}
                    >
                      <SelectTrigger><SelectValue placeholder="Herdar" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="fixed">Fixo</SelectItem>
                        <SelectItem value="monthly">Mensal</SelectItem>
                      </SelectContent>
                    </Select>
                  </F>
                  <F label="Recepção">
                    <NumericInput
                      precision={2}
                      value={form.manual.reception_cost}
                      onChange={(v) => patch({ manual: { ...form.manual, reception_cost: v } })}
                    />
                  </F>
                  <F label="Corretagem por contrato">
                    <NumericInput
                      precision={2}
                      value={form.manual.brokerage_per_contract}
                      onChange={(v) => patch({ manual: { ...form.manual, brokerage_per_contract: v } })}
                    />
                  </F>
                  <F label="Desk (%)">
                    <NumericInput
                      precision={4}
                      value={form.manual.desk_cost_pct}
                      onChange={(v) => patch({ manual: { ...form.manual, desk_cost_pct: v } })}
                    />
                  </F>
                  <F label="Quebra técnica mensal">
                    <NumericInput
                      precision={4}
                      value={form.manual.shrinkage_rate_monthly}
                      onChange={(v) => patch({ manual: { ...form.manual, shrinkage_rate_monthly: v } })}
                    />
                  </F>
                </div>
              </Section>

              <Section title="Seguro" collapsible={isCard}>
                <InsuranceFields
                  value={form.insurance}
                  commodity={form.commodity}
                  benchmark={form.benchmark}
                  onChange={(v) => patch({ insurance: v })}
                />
                {(trioError || fieldErrors.insurance) && (
                  <p className="text-[11px] text-destructive">{trioError ?? fieldErrors.insurance}</p>
                )}
              </Section>

              <Button className="w-full" onClick={handleCalculate} disabled={calculating || !formValid}>
                <Calculator className={`mr-2 h-4 w-4 ${calculating ? 'animate-pulse' : ''}`} />
                Calcular
              </Button>
            </div>

            {/* ---------- Resultado ---------- */}
            <div className="space-y-4 min-w-0">
              <h4 className="text-sm font-semibold">Resultado</h4>
              {result ? (
                <DreView outputs={result} warehouseName={warehouse?.display_name ?? null} />
              ) : (
                <p className="text-sm text-muted-foreground">
                  Preencha os parâmetros e clique em Calcular.
                </p>
              )}

              {discarded.length > 0 && (
                <div className="rounded border border-destructive/50 p-3">
                  <p className="mb-2 text-sm font-medium text-destructive">Descartada pela API</p>
                  <DiscardedCombinationsList items={discarded} />
                </div>
              )}

              {result && (
                <div className="space-y-3 rounded border border-border p-3">
                  <div className="flex gap-2">
                    <Input
                      placeholder="Nome do rascunho (opcional)"
                      value={draftLabel}
                      onChange={(e) => setDraftLabel(e.target.value)}
                      className="h-9"
                    />
                    <Button variant="outline" size="sm" onClick={handleSaveDraft} disabled={!canAct}>
                      <Save className="mr-1.5 h-4 w-4" />
                      Salvar rascunho
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={handlePdf} disabled={!canAct}>
                      <FileDown className="mr-1.5 h-4 w-4" />
                      Gerar PDF
                    </Button>
                    <Button size="sm" onClick={handleMontarOperacao} disabled={!canAct || !hasWarehouse}>
                      Montar operação
                    </Button>
                    <Button size="sm" onClick={handleAdicionarTabela} disabled={!canAct || !hasWarehouse}>
                      Adicionar à tabela
                    </Button>
                  </div>
                  {!hasWarehouse && (
                    <p className="text-xs text-muted-foreground">
                      Montar operação e Adicionar à tabela exigem uma praça selecionada.
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="drafts" className="mt-3 space-y-2">
          <p className="text-xs text-muted-foreground">
            Rascunhos são apagados automaticamente após 3 dias.
          </p>
          {(drafts ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum rascunho salvo.</p>
          ) : (
            (drafts ?? []).map((d) => (
              <div key={d.id} className="flex items-center justify-between gap-3 rounded border border-border p-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{d.label ?? 'Sem nome'}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(d.created_at).toLocaleString('pt-BR')}
                    {d.created_by ? ` · ${authors?.[d.created_by] ?? '—'}` : ''}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button variant="ghost" size="sm" onClick={() => openDraft(d.response_json)}>
                    <FolderOpen className="mr-1.5 h-4 w-4" />
                    Abrir
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => recalcDraft(d.request_json)}
                    disabled={calculating}
                  >
                    <RefreshCw className="mr-1.5 h-4 w-4" />
                    Recalcular
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => deleteDraft.mutate(d.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </TabsContent>
      </Tabs>

      {!isCard && (
        <div className="mt-4 flex justify-end">
          <Button variant="outline" onClick={requestClose}>Fechar</Button>
        </div>
      )}

      <AlertDialog open={confirmClose} onOpenChange={setConfirmClose}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Fechar simulação?</AlertDialogTitle>
            <AlertDialogDescription>
              A simulação será perdida. Deseja continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { setConfirmClose(false); onClose?.(); resetAll(); }}
            >
              OK
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={infoOpen} onOpenChange={setInfoOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Info className="h-4 w-4" />
              Snapshot salvo
            </AlertDialogTitle>
            <AlertDialogDescription>
              Snapshot salvo no histórico. O registro de operações ainda não está disponível na plataforma.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setInfoOpen(false)}>Entendi</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

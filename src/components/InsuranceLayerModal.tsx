import { useEffect, useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { callApi } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useInsuranceSnapshots, useApplyInsuranceLayer } from '@/hooks/useInsuranceSnapshots';

interface Row {
  id: string;
  ticker: string;
  commodity: string;
  warehouse_id: string;
  origination_price_brl: number;
  insurance_json?: Record<string, any> | null;
  trade_date?: string | null;
  payment_date?: string | null;
  grain_reception_date?: string | null;
  inputs_json?: Record<string, any> | null;
}

interface RowState {
  enabled: boolean;
  premiumStr: string;
  coverageStr: string;
  carryEnabled: boolean;
  paymentReceiptDateStr: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rows: Row[];
  warehouseMap?: Record<string, string>;
  warehouseInterestMap?: Record<string, { rate: number | null; period: string | null }>;
}

interface InsuranceResult {
  pricing_snapshot_id: string;
  enabled: boolean;
  premium_brl: number;
  coverage_pct: number;
  insurance_cost_brl: number;
  adjusted_price_brl: number;
  carry_enabled?: boolean;
  carry_cost_brl?: number;
  total_insurance_cost_brl?: number;
}

// Normalize any date input (ISO timestamp, Date, or YYYY-MM-DD) to YYYY-MM-DD
const toIsoDate = (v: unknown): string => {
  if (!v) return '';
  if (v instanceof Date) {
    if (isNaN(v.getTime())) return '';
    return v.toISOString().slice(0, 10);
  }
  const s = String(v);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s);
  if (isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
};

export function InsuranceLayerModal({ open, onOpenChange, rows, warehouseMap = {}, warehouseInterestMap = {} }: Props) {
  const { user } = useAuth();
  const snapshotIds = useMemo(() => rows.map((r) => r.id), [rows]);
  const { data: existing } = useInsuranceSnapshots(snapshotIds);
  const applyMutation = useApplyInsuranceLayer();

  const [globalPremiumSoja, setGlobalPremiumSoja] = useState('');
  const [globalPremiumMilho, setGlobalPremiumMilho] = useState('');
  const [globalCoverage, setGlobalCoverage] = useState('25');
  const [globalCarryEnabled, setGlobalCarryEnabled] = useState(true);
  const [globalReceiptDateStr, setGlobalReceiptDateStr] = useState('');
  const [perRow, setPerRow] = useState<Record<string, RowState>>({});
  const [perRowExpanded, setPerRowExpanded] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [lastResults, setLastResults] = useState<Record<string, InsuranceResult>>({});

  // Resolve effective rate/period for a row (front só seleciona fonte; sem cálculo)
  const resolveCarrySource = (r: Row) => {
    const inputsRate = r.inputs_json?.interest_rate;
    const whInfo = warehouseInterestMap[r.warehouse_id];
    const rate = inputsRate != null ? Number(inputsRate) : (whInfo?.rate != null ? Number(whInfo.rate) : null);
    const period = whInfo?.period ?? 'monthly';
    return { rate, period, available: rate != null };
  };

  const defaultReceiptFor = (r: Row): string =>
    toIsoDate(r.grain_reception_date) || toIsoDate(r.payment_date) || '';

  // Initialize state per row when modal opens or existing data loads
  useEffect(() => {
    if (!open) return;
    const next: Record<string, RowState> = {};
    let firstDate = '';
    rows.forEach((r) => {
      const ex = existing?.[r.id];
      const { available } = resolveCarrySource(r);
      const defaultReceipt = defaultReceiptFor(r);
      if (!firstDate && defaultReceipt) firstDate = defaultReceipt;
      if (ex) {
        next[r.id] = {
          enabled: ex.enabled,
          premiumStr: String(ex.premium_brl ?? ''),
          coverageStr: String((ex.coverage_pct ?? 0) * 100),
          carryEnabled: available && (ex.carry_enabled ?? true),
          paymentReceiptDateStr: toIsoDate(ex.payment_receipt_date as string) || defaultReceipt,
        };
      } else {
        const atmPremium = r.insurance_json?.atm?.premium_brl;
        next[r.id] = {
          enabled: true,
          premiumStr: atmPremium != null ? String(atmPremium) : '',
          coverageStr: globalCoverage,
          carryEnabled: available,
          paymentReceiptDateStr: defaultReceipt,
        };
      }
    });
    setPerRow(next);
    setGlobalReceiptDateStr(firstDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, existing, rows]);

  const updateRow = (id: string, patch: Partial<RowState>) => {
    setPerRow((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  };

  const applyGlobalPremium = (commodity: 'soybean' | 'corn', value: string) => {
    if (commodity === 'soybean') setGlobalPremiumSoja(value);
    else setGlobalPremiumMilho(value);
    if (value === '') return;
    setPerRow((prev) => {
      const next = { ...prev };
      rows.forEach((r) => {
        if (r.commodity === commodity && next[r.id]) {
          next[r.id] = { ...next[r.id], premiumStr: value };
        }
      });
      return next;
    });
  };

  const applyGlobalCoverage = (value: string) => {
    setGlobalCoverage(value);
    if (value === '') return;
    setPerRow((prev) => {
      const next = { ...prev };
      rows.forEach((r) => {
        if (next[r.id]) next[r.id] = { ...next[r.id], coverageStr: value };
      });
      return next;
    });
  };

  const applyGlobalCarry = (value: boolean) => {
    setGlobalCarryEnabled(value);
    setPerRow((prev) => {
      const next = { ...prev };
      rows.forEach((r) => {
        if (!next[r.id]) return;
        const { available } = resolveCarrySource(r);
        next[r.id] = { ...next[r.id], carryEnabled: value && available };
      });
      return next;
    });
  };

  const applyGlobalReceiptDate = (value: string) => {
    setGlobalReceiptDateStr(value);
    if (!value) return;
    setPerRow((prev) => {
      const next = { ...prev };
      rows.forEach((r) => {
        if (next[r.id]) next[r.id] = { ...next[r.id], paymentReceiptDateStr: value };
      });
      return next;
    });
  };

  const handleApply = async () => {
    if (!user) {
      toast.error('Usuário não autenticado');
      return;
    }
    setSubmitting(true);
    try {
      type ItemMeta = { rate: number | null; period: string; carryEffective: boolean; receiptDate: string };
      const meta: Record<string, ItemMeta> = {};
      const items: any[] = [];

      for (const r of rows) {
        const s = perRow[r.id];
        if (!s) continue;
        const { rate, period, available } = resolveCarrySource(r);
        const tradeDate = toIsoDate(r.trade_date);
        // Auto-fill the receipt date: user input → row default (grain_reception/payment) → global
        const receiptDate =
          toIsoDate(s.paymentReceiptDateStr) ||
          defaultReceiptFor(r) ||
          toIsoDate(globalReceiptDateStr);

        // Carry is effective only if everything required by backend is present
        const carryEffective =
          s.enabled && s.carryEnabled && available && !!tradeDate && !!receiptDate;

        meta[r.id] = { rate, period, carryEffective, receiptDate };
        const item: Record<string, unknown> = {
          pricing_snapshot_id: r.id,
          base_price_brl: r.origination_price_brl,
          premium_brl: Number(s.premiumStr || 0),
          coverage_pct: Number(s.coverageStr || 0) / 100,
          enabled: s.enabled,
          carry_enabled: carryEffective,
        };
        if (carryEffective) {
          item.interest_rate = rate;
          item.interest_rate_period = period;
          item.trade_date = tradeDate;
          item.payment_receipt_date = receiptDate;
        } else {
          // include trade_date when known (harmless) but omit carry-required fields
          if (tradeDate) item.trade_date = tradeDate;
        }
        items.push(item);
      }

      const resp = await callApi<{ results: InsuranceResult[] }>('/pricing/insurance-layer', { items });
      const results = resp.results ?? [];

      const resultsMap: Record<string, InsuranceResult> = {};
      results.forEach((r) => { resultsMap[r.pricing_snapshot_id] = r; });
      setLastResults(resultsMap);

      const upsertRows = results
        .map((result) => {
          const r = rows.find((row) => row.id === result.pricing_snapshot_id);
          if (!r) return null;
          const m = meta[r.id];
          const atmPremium = Number(r.insurance_json?.atm?.premium_brl);
          const carryEnabled = result.carry_enabled ?? false;
          return {
            pricing_snapshot_id: result.pricing_snapshot_id,
            enabled: result.enabled,
            premium_brl: result.premium_brl,
            coverage_pct: result.coverage_pct,
            insurance_cost_brl: result.insurance_cost_brl,
            adjusted_price_brl: result.adjusted_price_brl,
            premium_source: result.premium_brl === atmPremium ? 'theoretical' : 'manual',
            carry_enabled: carryEnabled,
            carry_cost_brl: result.carry_cost_brl ?? 0,
            carry_interest_rate: carryEnabled ? (m?.rate ?? null) : null,
            carry_interest_rate_period: carryEnabled ? (m?.period ?? null) : null,
            payment_receipt_date: carryEnabled ? (m?.receiptDate || null) : null,
            created_by: user.id,
            created_at: new Date().toISOString(),
          };
        })
        .filter(Boolean) as Record<string, unknown>[];

      if (upsertRows.length === 0) {
        toast.error('Nenhuma linha para aplicar');
        return;
      }

      await applyMutation.mutateAsync(upsertRows);
      toast.success(`Seguro aplicado em ${upsertRows.length} linha(s)`);
      onOpenChange(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao aplicar seguro';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Aplicar Seguro</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Preço seguro Soja (BRL/sc)</Label>
              <Input
                type="text"
                inputMode="decimal"
                placeholder="opcional"
                value={globalPremiumSoja}
                onChange={(e) => applyGlobalPremium('soybean', e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Preço seguro Milho (BRL/sc)</Label>
              <Input
                type="text"
                inputMode="decimal"
                placeholder="opcional"
                value={globalPremiumMilho}
                onChange={(e) => applyGlobalPremium('corn', e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Cobertura %</Label>
              <Input
                type="text"
                inputMode="decimal"
                value={globalCoverage}
                onChange={(e) => applyGlobalCoverage(e.target.value)}
              />
            </div>
          </div>

          <div className="rounded-md border border-border/50 px-3 py-2 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm">Aplicar carrego financeiro do prêmio</Label>
                <p className="text-[11px] text-muted-foreground">
                  Capitaliza o prêmio entre a data de trade e a de recebimento.
                </p>
              </div>
              <Switch checked={globalCarryEnabled} onCheckedChange={applyGlobalCarry} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Data de recebimento (fim do carrego)</Label>
              <Input
                type="date"
                value={globalReceiptDateStr}
                disabled={!globalCarryEnabled}
                onChange={(e) => applyGlobalReceiptDate(e.target.value)}
                className="h-8 text-xs max-w-[200px]"
              />
            </div>
          </div>

          <Collapsible open={perRowExpanded} onOpenChange={setPerRowExpanded}>
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
              >
                {perRowExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                Ajustar por linha ({rows.length})
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2 space-y-2">
              <div className="grid grid-cols-[1fr_60px_80px_80px_50px_50px_130px] gap-2 text-[10px] uppercase tracking-wider text-muted-foreground px-1">
                <span>Praça / Ticker</span>
                <span>Comm.</span>
                <span>Prêmio</span>
                <span>Cob. %</span>
                <span className="text-center">Seg.</span>
                <span className="text-center">Carr.</span>
                <span>Data receb.</span>
              </div>
              {rows.map((r) => {
                const s = perRow[r.id];
                if (!s) return null;
                const { available, rate, period } = resolveCarrySource(r);
                const result = lastResults[r.id];
                return (
                  <div key={r.id} className="border-t border-border/50">
                    <div className="grid grid-cols-[1fr_60px_80px_80px_50px_50px_130px] gap-2 items-center px-1 py-1">
                      <div className="text-xs">
                        <div className="font-medium truncate">{warehouseMap[r.warehouse_id] ?? r.warehouse_id}</div>
                        <div className="font-mono text-muted-foreground">{r.ticker}</div>
                      </div>
                      <span className="text-xs">{r.commodity === 'soybean' ? 'Soja' : 'Milho'}</span>
                      <Input
                        type="text"
                        inputMode="decimal"
                        value={s.premiumStr}
                        onChange={(e) => updateRow(r.id, { premiumStr: e.target.value })}
                        className="h-8 text-xs"
                      />
                      <Input
                        type="text"
                        inputMode="decimal"
                        value={s.coverageStr}
                        onChange={(e) => updateRow(r.id, { coverageStr: e.target.value })}
                        className="h-8 text-xs"
                      />
                      <div className="flex justify-center">
                        <Switch
                          checked={s.enabled}
                          onCheckedChange={(v) => updateRow(r.id, { enabled: v })}
                        />
                      </div>
                      <div className="flex justify-center" title={!available ? 'Taxa indisponível' : ''}>
                        <Switch
                          checked={s.carryEnabled && s.enabled && available}
                          disabled={!s.enabled || !available}
                          onCheckedChange={(v) => updateRow(r.id, { carryEnabled: v })}
                        />
                      </div>
                      <Input
                        type="date"
                        value={s.paymentReceiptDateStr || ''}
                        disabled={!s.carryEnabled || !s.enabled || !available}
                        onChange={(e) => updateRow(r.id, { paymentReceiptDateStr: e.target.value })}
                        className="h-8 text-xs"
                      />
                    </div>
                    {(result || !available) && (
                      <div className="px-1 pb-2 text-[10px] text-muted-foreground flex flex-wrap gap-x-3">
                        {!available && <span className="text-amber-500">Sem taxa de juros disponível — carrego desabilitado.</span>}
                        {available && rate != null && (
                          <span>Taxa: {rate}% ({period})</span>
                        )}
                        {result && (
                          <>
                            <span>Seguro: R$ {Number(result.insurance_cost_brl).toFixed(2)}</span>
                            <span>Carrego: R$ {Number(result.carry_cost_brl ?? 0).toFixed(2)}</span>
                            <span>Total: R$ {Number(result.total_insurance_cost_brl ?? result.insurance_cost_brl).toFixed(2)}</span>
                            <span>Ajustado: R$ {Number(result.adjusted_price_brl).toFixed(2)}</span>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </CollapsibleContent>
          </Collapsible>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancelar
          </Button>
          <Button onClick={handleApply} disabled={submitting || rows.length === 0}>
            {submitting ? 'Aplicando...' : 'Aplicar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

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
}

interface RowState {
  enabled: boolean;
  premiumStr: string;
  coverageStr: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rows: Row[];
  warehouseMap?: Record<string, string>;
}

interface InsuranceResult {
  pricing_snapshot_id: string;
  enabled: boolean;
  premium_brl: number;
  coverage_pct: number;
  insurance_cost_brl: number;
  adjusted_price_brl: number;
}

export function InsuranceLayerModal({ open, onOpenChange, rows, warehouseMap = {} }: Props) {
  const { user } = useAuth();
  const snapshotIds = useMemo(() => rows.map((r) => r.id), [rows]);
  const { data: existing } = useInsuranceSnapshots(snapshotIds);
  const applyMutation = useApplyInsuranceLayer();

  const [globalPremiumSoja, setGlobalPremiumSoja] = useState('');
  const [globalPremiumMilho, setGlobalPremiumMilho] = useState('');
  const [globalCoverage, setGlobalCoverage] = useState('25');
  const [perRow, setPerRow] = useState<Record<string, RowState>>({});
  const [perRowExpanded, setPerRowExpanded] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Initialize state per row when modal opens or existing data loads
  useEffect(() => {
    if (!open) return;
    const next: Record<string, RowState> = {};
    rows.forEach((r) => {
      const ex = existing?.[r.id];
      if (ex) {
        next[r.id] = {
          enabled: ex.enabled,
          premiumStr: String(ex.premium_brl ?? ''),
          coverageStr: String((ex.coverage_pct ?? 0) * 100),
        };
      } else {
        const atmPremium = r.insurance_json?.atm?.premium_brl;
        next[r.id] = {
          enabled: true,
          premiumStr: atmPremium != null ? String(atmPremium) : '',
          coverageStr: globalCoverage,
        };
      }
    });
    setPerRow(next);
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

  const handleApply = async () => {
    if (!user) {
      toast.error('Usuário não autenticado');
      return;
    }
    setSubmitting(true);
    try {
      const items = rows.map((r) => {
        const s = perRow[r.id];
        return {
          pricing_snapshot_id: r.id,
          base_price_brl: r.origination_price_brl,
          premium_brl: Number(s?.premiumStr || 0),
          coverage_pct: Number(s?.coverageStr || 0) / 100,
          enabled: s?.enabled ?? true,
        };
      });

      const resp = await callApi<{ results: InsuranceResult[] }>('/pricing/insurance-layer', { items });
      const results = resp.results ?? [];

      const upsertRows = results
        .map((result) => {
          const r = rows.find((row) => row.id === result.pricing_snapshot_id);
          if (!r) return null;
          const atmPremium = Number(r.insurance_json?.atm?.premium_brl);
          return {
            pricing_snapshot_id: result.pricing_snapshot_id,
            enabled: result.enabled,
            premium_brl: result.premium_brl,
            coverage_pct: result.coverage_pct,
            insurance_cost_brl: result.insurance_cost_brl,
            adjusted_price_brl: result.adjusted_price_brl,
            premium_source: result.premium_brl === atmPremium ? 'theoretical' : 'manual',
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
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
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
              <div className="grid grid-cols-[1fr_70px_90px_90px_60px] gap-2 text-[10px] uppercase tracking-wider text-muted-foreground px-1">
                <span>Praça / Ticker</span>
                <span>Comm.</span>
                <span>Prêmio</span>
                <span>Cobertura %</span>
                <span className="text-center">Ativo</span>
              </div>
              {rows.map((r) => {
                const s = perRow[r.id];
                if (!s) return null;
                return (
                  <div
                    key={r.id}
                    className="grid grid-cols-[1fr_70px_90px_90px_60px] gap-2 items-center px-1 py-1 border-t border-border/50"
                  >
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

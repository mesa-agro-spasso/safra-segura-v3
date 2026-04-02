import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { callApi } from '@/lib/api';
import { useSavePricingSnapshots } from '@/hooks/usePricingSnapshots';
import { useActiveArmazens } from '@/hooks/useWarehouses';
import { useMarketData } from '@/hooks/useMarketData';
import { usePricingCombinations } from '@/hooks/usePricingCombinations';
import { useAuth } from '@/contexts/AuthContext';
import type { Warehouse, MarketData, PricingSnapshot, PricingCombination } from '@/types';

function getNextTuesday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const daysUntilTuesday = day === 2 ? 7 : (2 - day + 7) % 7 || 7;
  d.setDate(d.getDate() + daysUntilTuesday);
  return d;
}

interface GeneratePricingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GeneratePricingModal({ open, onOpenChange }: GeneratePricingModalProps) {
  const { data: warehouses } = useActiveArmazens();
  const { data: marketData } = useMarketData();
  const { data: combinations } = usePricingCombinations(true);
  const saveSnapshots = useSavePricingSnapshots();
  const { user } = useAuth();
  const [generating, setGenerating] = useState(false);

  const spotRate = useMemo(() => {
    return marketData?.find((m) => m.ticker === 'USD/BRL')?.price ?? null;
  }, [marketData]);

  const marketMap = useMemo(() => {
    const m: Record<string, MarketData> = {};
    marketData?.forEach((md) => { m[md.ticker] = md; });
    return m;
  }, [marketData]);

  const warehouseMap = useMemo(() => {
    const m: Record<string, Warehouse> = {};
    warehouses?.forEach((w) => { m[w.id] = w; });
    return m;
  }, [warehouses]);

  const uniqueWarehouses = useMemo(() => {
    if (!combinations) return 0;
    return new Set(combinations.map((c) => c.warehouse_id)).size;
  }, [combinations]);

  const canGenerate = (combinations?.length ?? 0) > 0 && spotRate !== null;

  const handleGenerate = async () => {
    if (!canGenerate || !combinations || !marketData || !warehouses) return;

    const payload: Record<string, unknown>[] = [];

    for (const combo of combinations) {
      const market = marketMap[combo.ticker];
      if (!market) {
        toast.warning(`Ticker ${combo.ticker} não encontrado em market_data — pulando`);
        continue;
      }

      const warehouse = warehouseMap[combo.warehouse_id];
      if (!warehouse) continue;

      const basisConfig = (warehouse.basis_config ?? {}) as Record<string, unknown>;

      // Resolve exp_date
      const expDate = combo.exp_date ?? market.exp_date ?? null;

      // Resolve payment_date
      let paymentDate: string;
      if (combo.is_spot) {
        paymentDate = format(getNextTuesday(new Date()), 'yyyy-MM-dd');
      } else {
        if (!combo.payment_date) {
          toast.warning(`Combinação ${combo.ticker}/${warehouse.display_name} sem payment_date — pulando`);
          continue;
        }
        paymentDate = combo.payment_date;
      }

      // Resolve grain_reception_date
      const grainReceptionDate = combo.grain_reception_date ?? paymentDate;

      // Cost inheritance: combination overrides warehouse
      const inheritCost = (field: keyof PricingCombination, basisField: string) => {
        const val = combo[field];
        if (val != null) return val;
        return (basisConfig as Record<string, unknown>)[basisField] ?? null;
      };

      payload.push({
        warehouse_id: combo.warehouse_id,
        display_name: warehouse.display_name,
        commodity: combo.commodity,
        benchmark: combo.benchmark,
        ticker: combo.ticker,
        exp_date: expDate,
        payment_date: paymentDate,
        sale_date: combo.sale_date,
        grain_reception_date: grainReceptionDate,
        target_basis: combo.target_basis,
        futures_price: market.price,
        exchange_rate: spotRate,
        additional_discount_brl: combo.additional_discount_brl,
        interest_rate: inheritCost('interest_rate', 'interest_rate'),
        storage_cost: inheritCost('storage_cost', 'storage_cost'),
        storage_cost_type: inheritCost('storage_cost_type', 'storage_cost_type'),
        reception_cost: inheritCost('reception_cost', 'reception_cost'),
        brokerage_per_contract: inheritCost('brokerage_per_contract', 'brokerage_per_contract'),
        desk_cost_pct: inheritCost('desk_cost_pct', 'desk_cost_pct'),
        shrinkage_rate_monthly: inheritCost('shrinkage_rate_monthly', 'shrinkage_rate_monthly'),
      });
    }

    if (payload.length === 0) {
      toast.error('Nenhuma combinação válida — verifique tickers e market_data');
      return;
    }

    setGenerating(true);
    try {
      const result = await callApi<{ snapshots: Record<string, unknown>[] }>('/pricing/table', {
        combinations: payload,
      });

      if (result?.snapshots?.length) {
        await saveSnapshots.mutateAsync(
          result.snapshots.map((s: Record<string, unknown>) => ({
            ...(s as Omit<PricingSnapshot, 'id' | 'created_at'>),
            created_by: user?.id ?? null,
          }))
        );
        toast.success(`Tabela gerada: ${result.snapshots.length} preços calculados`);
        onOpenChange(false);
      } else {
        toast.warning('API retornou 0 snapshots');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : typeof err === 'object' && err !== null && 'message' in err ? String((err as Record<string, unknown>).message) : JSON.stringify(err);
      toast.error(`Erro ao gerar tabela: ${msg}`);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Gerar Tabela de Preços</DialogTitle>
          <DialogDescription>
            A tabela será gerada com base nas combinações ativas cadastradas em Configurações.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <p className="text-sm">
            <span className="font-semibold">{combinations?.length ?? 0}</span> combinações ativas para{' '}
            <span className="font-semibold">{uniqueWarehouses}</span> armazéns
          </p>

          {spotRate !== null ? (
            <p className="text-xs text-muted-foreground">USD/BRL: {spotRate.toFixed(4)}</p>
          ) : (
            <p className="text-xs text-destructive">USD/BRL não disponível — atualize dados de mercado primeiro</p>
          )}

          {combinations?.length === 0 && (
            <p className="text-xs text-destructive">Nenhuma combinação ativa. Cadastre combinações em Configurações → Combinações.</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleGenerate} disabled={!canGenerate || generating}>
            <RefreshCw className={cn('mr-2 h-4 w-4', generating && 'animate-spin')} />
            {generating ? 'Gerando...' : 'Gerar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

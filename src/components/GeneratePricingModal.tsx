import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { CalendarIcon, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { callApi } from '@/lib/api';
import { useSavePricingSnapshots } from '@/hooks/usePricingSnapshots';
import { useActiveArmazens } from '@/hooks/useWarehouses';
import { useMarketData } from '@/hooks/useMarketData';
import { useAuth } from '@/contexts/AuthContext';
import type { Warehouse, MarketData, PricingSnapshot } from '@/types';

interface BasisConfig {
  mode: 'fixed' | 'reference_delta';
  value?: number;
  reference_warehouse_id?: string;
  delta_brl?: number;
}

const COMMODITY_MAP: Record<string, { apiCommodity: string; basisKey: string }> = {
  SOJA: { apiCommodity: 'soybean', basisKey: 'soybean' },
  MILHO_CBOT: { apiCommodity: 'corn', basisKey: 'corn' },
};

function resolveBasis(
  warehouseId: string,
  commodityKey: string,
  warehouseMap: Record<string, Warehouse>,
  depth = 0
): number | null {
  if (depth > 5) throw new Error(`Ciclo detectado ao resolver basis para ${warehouseId}`);
  const warehouse = warehouseMap[warehouseId];
  if (!warehouse) return null;
  const config = (warehouse.basis_config as Record<string, BasisConfig>)?.[commodityKey];
  if (!config) return null;
  if (config.mode === 'fixed') return config.value ?? null;
  if (config.mode === 'reference_delta') {
    if (!config.reference_warehouse_id) return null;
    const refBasis = resolveBasis(config.reference_warehouse_id, commodityKey, warehouseMap, depth + 1);
    if (refBasis === null) return null;
    return refBasis + (config.delta_brl ?? 0);
  }
  return null;
}

interface GeneratePricingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GeneratePricingModal({ open, onOpenChange }: GeneratePricingModalProps) {
  const { data: warehouses } = useActiveArmazens();
  const { data: marketData } = useMarketData();
  const saveSnapshots = useSavePricingSnapshots();
  const { user } = useAuth();

  const [saleDate, setSaleDate] = useState<Date>();
  const [paymentDate, setPaymentDate] = useState<Date>();
  const [selectedTickers, setSelectedTickers] = useState<Set<string>>(new Set());
  const [generating, setGenerating] = useState(false);

  // Group tickers by commodity
  const tickerGroups = useMemo(() => {
    if (!marketData) return { soja: [], milho: [] };
    return {
      soja: marketData.filter((m) => m.commodity === 'SOJA'),
      milho: marketData.filter((m) => m.commodity === 'MILHO_CBOT'),
    };
  }, [marketData]);

  const spotRate = useMemo(() => {
    return marketData?.find((m) => m.ticker === 'USD/BRL')?.price ?? null;
  }, [marketData]);

  const toggleTicker = (ticker: string) => {
    setSelectedTickers((prev) => {
      const next = new Set(prev);
      if (next.has(ticker)) next.delete(ticker);
      else next.add(ticker);
      return next;
    });
  };

  const canGenerate = saleDate && paymentDate && selectedTickers.size > 0 && spotRate !== null;

  const handleGenerate = async () => {
    if (!canGenerate || !warehouses || !marketData) return;

    const warehouseMap: Record<string, Warehouse> = {};
    warehouses.forEach((w) => { warehouseMap[w.id] = w; });

    const selectedMarket = marketData.filter((m) => selectedTickers.has(m.ticker));
    const combinations: Record<string, unknown>[] = [];

    for (const market of selectedMarket) {
      const mapping = COMMODITY_MAP[market.commodity];
      if (!mapping) continue;

      for (const warehouse of warehouses) {
        const basis = resolveBasis(warehouse.id, mapping.basisKey, warehouseMap);
        if (basis === null) continue; // skip warehouses without basis config

        combinations.push({
          warehouse_id: warehouse.id,
          display_name: warehouse.display_name,
          commodity: mapping.apiCommodity,
          benchmark: 'cbot',
          payment_date: format(paymentDate, 'yyyy-MM-dd'),
          sale_date: format(saleDate, 'yyyy-MM-dd'),
          grain_reception_date: format(paymentDate, 'yyyy-MM-dd'),
          target_basis: basis,
          ticker: market.ticker,
          exp_date: market.exp_date,
          futures_price: market.price,
          exchange_rate: spotRate,
        });
      }
    }

    if (combinations.length === 0) {
      toast.error('Nenhuma combinação válida — verifique basis_config dos armazéns');
      return;
    }

    setGenerating(true);
    try {
      const result = await callApi<{ snapshots: Record<string, unknown>[] }>('/pricing/table', {
        combinations,
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
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Gerar Tabela de Preços</DialogTitle>
          <DialogDescription>Selecione as datas e os contratos para gerar a tabela.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Sale Date */}
          <div className="space-y-1.5">
            <Label>Data de venda</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn('w-full justify-start text-left font-normal', !saleDate && 'text-muted-foreground')}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {saleDate ? format(saleDate, 'dd/MM/yyyy') : 'Selecione'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={saleDate} onSelect={setSaleDate} initialFocus className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
          </div>

          {/* Payment Date */}
          <div className="space-y-1.5">
            <Label>Data de pagamento</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn('w-full justify-start text-left font-normal', !paymentDate && 'text-muted-foreground')}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {paymentDate ? format(paymentDate, 'dd/MM/yyyy') : 'Selecione'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={paymentDate} onSelect={setPaymentDate} initialFocus className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
          </div>

          {/* Spot Rate Display */}
          {spotRate !== null ? (
            <p className="text-xs text-muted-foreground">USD/BRL: {spotRate.toFixed(4)}</p>
          ) : (
            <p className="text-xs text-destructive">USD/BRL não disponível — atualize dados de mercado primeiro</p>
          )}

          {/* Ticker Selection */}
          <div className="space-y-2">
            <Label>Contratos Soja CBOT</Label>
            <div className="grid grid-cols-2 gap-2 max-h-32 overflow-auto">
              {tickerGroups.soja.map((m) => (
                <label key={m.ticker} className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox checked={selectedTickers.has(m.ticker)} onCheckedChange={() => toggleTicker(m.ticker)} />
                  {m.ticker} ({m.exp_date})
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Contratos Milho CBOT</Label>
            <div className="grid grid-cols-2 gap-2 max-h-32 overflow-auto">
              {tickerGroups.milho.map((m) => (
                <label key={m.ticker} className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox checked={selectedTickers.has(m.ticker)} onCheckedChange={() => toggleTicker(m.ticker)} />
                  {m.ticker} ({m.exp_date})
                </label>
              ))}
            </div>
          </div>
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

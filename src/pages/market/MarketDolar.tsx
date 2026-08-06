import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useMarketData, useUpsertMarketData, formatFreshness } from '@/hooks/useMarketData';
import { fetchQuotes, persistFX, type MarketWriteDeps } from '@/lib/marketWrites';
import { usePricingParameters } from '@/hooks/usePricingParameters';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { RefreshCw, Edit2, Check, Clock } from 'lucide-react';

const MarketDolar = () => {
  const { data: marketData, isLoading } = useMarketData();
  const { data: parameters } = usePricingParameters();
  const sojaQty = parameters?.find((p) => p.id === 'soybean_cbot')?.ticker_count ?? 8;
  const cornCbotQty = parameters?.find((p) => p.id === 'corn_cbot')?.ticker_count ?? 8;
  const upsertMarket = useUpsertMarketData();
  const queryClient = useQueryClient();
  const deps: MarketWriteDeps = { upsert: upsertMarket.mutateAsync, queryClient };

  const [fetching, setFetching] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState('');

  const fxRow = marketData?.find((m) => m.ticker === 'USD/BRL');

  const handleFetchFX = async () => {
    setFetching(true);
    try {
      const result = await fetchQuotes(Math.max(sojaQty, cornCbotQty));
      await persistFX(deps, result);
      toast.success('Câmbio atualizado');
    } catch (err) {
      toast.error(`Erro ao atualizar câmbio: ${err instanceof Error ? err.message : String(err)}`);
    } finally { setFetching(false); }
  };

  const handleManualSave = async () => {
    const price = parseFloat(editValue.replace(',', '.'));
    if (isNaN(price)) { toast.error('Valor inválido'); return; }
    try {
      await upsertMarket.mutateAsync({
        ticker: 'USD/BRL',
        commodity: fxRow?.commodity ?? 'UNKNOWN',
        price,
        currency: fxRow?.currency ?? 'BRL',
        source: 'manual',
      });
      toast.success('USD/BRL atualizado');
      setEditing(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro');
    }
  };

  const fresh = fxRow ? formatFreshness(fxRow.updated_at) : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Dólar</h2>
        <Button variant="outline" onClick={handleFetchFX} disabled={fetching}>
          <RefreshCw className={`mr-2 h-4 w-4 ${fetching ? 'animate-spin' : ''}`} />
          {fetching ? 'Atualizando...' : 'Atualizar câmbio'}
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : !fxRow ? (
        <p className="text-muted-foreground text-sm">Sem cotação gravada. Clique em "Atualizar câmbio".</p>
      ) : (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Dólar / Real (USD/BRL)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-4 flex-wrap">
              <span className="text-3xl font-bold">
                {fxRow.price != null ? `R$ ${fxRow.price.toFixed(4)}` : '-'}
              </span>
              {editing ? (
                <div className="flex gap-1 items-center">
                  <Input
                    type="number"
                    step="0.0001"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    className="h-8 w-28"
                    autoFocus
                    onKeyDown={(e) => e.key === 'Enter' && handleManualSave()}
                  />
                  <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={handleManualSave}>
                    <Check className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2"
                  onClick={() => { setEditing(true); setEditValue(fxRow.price?.toString() ?? ''); }}
                >
                  <Edit2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>

            {fresh && (
              <div
                title={new Date(fxRow.updated_at).toLocaleString('pt-BR')}
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${
                  fresh.stale
                    ? 'border-[hsl(var(--warning))] text-[hsl(var(--warning))] bg-[hsl(var(--warning)/0.1)]'
                    : 'border-border text-muted-foreground'
                }`}
              >
                <Clock className="h-3 w-3" />
                Observado {fresh.label} · {fxRow.source}
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              O frescor é informativo — a geração de preço não é bloqueada por cotação antiga.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default MarketDolar;

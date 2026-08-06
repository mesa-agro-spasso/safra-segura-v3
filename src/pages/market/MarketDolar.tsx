import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useMarketData, useUpsertMarketData } from '@/hooks/useMarketData';
import { fetchQuotes, persistFX, type MarketWriteDeps } from '@/lib/marketWrites';
import { usePricingParameters } from '@/hooks/usePricingParameters';
import FxQuoteCard from '@/components/market/FxQuoteCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Edit2, Check } from 'lucide-react';

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

  const editSlot = editing ? (
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
      onClick={() => { setEditing(true); setEditValue(fxRow?.price?.toString() ?? ''); }}
    >
      <Edit2 className="h-3.5 w-3.5" />
    </Button>
  );

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold">Dólar</h2>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : (
        <FxQuoteCard
          fxRow={fxRow}
          onRefresh={handleFetchFX}
          refreshing={fetching}
          editSlot={fxRow ? editSlot : undefined}
          footnote="O frescor é informativo — a geração de preço não é bloqueada por cotação antiga."
        />
      )}
    </div>
  );
};

export default MarketDolar;

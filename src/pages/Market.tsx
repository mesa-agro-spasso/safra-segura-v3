import { useState, useMemo } from 'react';
import { useMarketData, useUpsertMarketData, getHoursAgo } from '@/hooks/useMarketData';
import { callApi } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { RefreshCw, Edit2, Check } from 'lucide-react';

const B3_CORN_TICKERS = ['CCMF27', 'CCMK27'];

const TICKER_CONFIG: Record<string, { label: string; commodity: string; currency: string }> = {
  ZSQ26: { label: 'Soja CBOT Jul/26', commodity: 'SOJA', currency: 'USD' },
  ZSX26: { label: 'Soja CBOT Nov/26', commodity: 'SOJA', currency: 'USD' },
  CCMF27: { label: 'Milho B3 Jan/27', commodity: 'MILHO', currency: 'BRL' },
  CCMK27: { label: 'Milho B3 Mai/27', commodity: 'MILHO', currency: 'BRL' },
  'USD/BRL': { label: 'Dólar / Real', commodity: 'FX', currency: 'BRL' },
};

const Market = () => {
  const { data: marketData, isLoading } = useMarketData();
  const upsertMarket = useUpsertMarketData();
  const [fetching, setFetching] = useState(false);
  const [editingTicker, setEditingTicker] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const dataMap = useMemo(() => {
    const map: Record<string, typeof marketData extends (infer T)[] ? T : never> = {};
    marketData?.forEach((m) => { map[m.ticker] = m; });
    return map;
  }, [marketData]);

  const handleAutoFetch = async () => {
    setFetching(true);
    try {
      const result = await callApi<{ tickers: Record<string, { price: number; exchange_rate?: number }> }>('/market/fetch', {});
      if (result?.tickers) {
        for (const [ticker, values] of Object.entries(result.tickers)) {
          const config = TICKER_CONFIG[ticker];
          if (config && !B3_CORN_TICKERS.includes(ticker)) {
            await upsertMarket.mutateAsync({
              ticker,
              commodity: config.commodity,
              price: values.price,
              currency: config.currency,
              source: 'api',
              exchange_rate: values.exchange_rate ?? null,
            });
          }
        }
        toast.success('Dados de mercado atualizados');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao buscar dados');
    } finally {
      setFetching(false);
    }
  };

  const handleManualSave = async (ticker: string) => {
    const price = parseFloat(editValue);
    if (isNaN(price)) { toast.error('Valor inválido'); return; }
    const config = TICKER_CONFIG[ticker];
    if (!config) return;
    try {
      await upsertMarket.mutateAsync({
        ticker,
        commodity: config.commodity,
        price,
        currency: config.currency,
        source: 'manual',
      });
      toast.success(`${ticker} atualizado`);
      setEditingTicker(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro');
    }
  };

  const tickers = Object.keys(TICKER_CONFIG);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Dados de Mercado</h2>
        <Button onClick={handleAutoFetch} disabled={fetching}>
          <RefreshCw className={`mr-2 h-4 w-4 ${fetching ? 'animate-spin' : ''}`} />
          {fetching ? 'Atualizando...' : 'Atualizar Automático'}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">Milho B3 requer atualização manual obrigatória.</p>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {tickers.map((ticker) => {
            const config = TICKER_CONFIG[ticker];
            const item = dataMap[ticker];
            const isCorn = B3_CORN_TICKERS.includes(ticker);
            const hours = item ? getHoursAgo(item.updated_at) : null;
            const isEditing = editingTicker === ticker;

            return (
              <Card key={ticker} className={isCorn ? 'border-[hsl(var(--warning))]' : ''}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center justify-between">
                    <span>{config.label}</span>
                    <span className="text-xs font-normal text-muted-foreground">{ticker}</span>
                  </CardTitle>
                  {isCorn && (
                    <p className="text-xs text-[hsl(var(--warning))] font-medium">Atualização manual obrigatória</p>
                  )}
                </CardHeader>
                <CardContent className="space-y-2">
                  {item ? (
                    <>
                      <p className="text-2xl font-bold">{item.currency === 'BRL' ? 'R$' : '$'} {item.price.toFixed(2)}</p>
                      <p className={`text-xs ${hours !== null && hours > 24 ? 'text-[hsl(var(--warning))]' : 'text-muted-foreground'}`}>
                        {hours !== null ? `${hours}h atrás` : '-'} · {item.source}
                      </p>
                    </>
                  ) : (
                    <p className="text-muted-foreground text-sm">Sem dados</p>
                  )}

                  {isEditing ? (
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        step="0.01"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        className="h-8"
                        autoFocus
                      />
                      <Button size="sm" variant="ghost" onClick={() => handleManualSave(ticker)}>
                        <Check className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => {
                        setEditingTicker(ticker);
                        setEditValue(item?.price?.toString() ?? '');
                      }}
                    >
                      <Edit2 className="mr-2 h-3 w-3" />
                      Editar manualmente
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Market;

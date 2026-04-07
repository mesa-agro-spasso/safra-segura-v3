import { useState, useMemo, useEffect } from 'react';
import { useMarketData, useUpsertMarketData, getHoursAgo } from '@/hooks/useMarketData';
import { callApi } from '@/lib/api';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { RefreshCw, Edit2, Check } from 'lucide-react';
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '@/components/ui/table';

interface NdfData {
  spot: number;
  estimated: number;
  spread: number;
  override: number | null;
}

interface SoybeanQuote {
  ticker: string;
  exp_date: string;
  price_usd_bushel: number;
  ndf: NdfData;
}

interface CornQuote {
  ticker: string;
  exp_date: string;
  price_usd_cents_bushel: number;
}

interface MarketQuotesResponse {
  trade_date: string;
  spot_usd_brl: number;
  soybean_cbot: SoybeanQuote[];
  corn_cbot: CornQuote[];
}

interface B3CornQuote {
  ticker: string;
  exp_date: string;
}

interface B3Response {
  trade_date: string;
  corn_b3: B3CornQuote[];
}

interface B3SavedPrice {
  price: number | null;
  updated_at: string;
  source: string;
}

const Market = () => {
  const { data: marketData, isLoading } = useMarketData();
  const upsertMarket = useUpsertMarketData();
  const [fetching, setFetching] = useState(false);
  const [editingTicker, setEditingTicker] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [lastQuotes, setLastQuotes] = useState<MarketQuotesResponse | null>(null);

  // B3 corn state
  const [b3Tickers, setB3Tickers] = useState<B3CornQuote[]>([]);
  const [b3Prices, setB3Prices] = useState<Record<string, B3SavedPrice>>({});
  const [b3Loading, setB3Loading] = useState(true);
  const [b3Error, setB3Error] = useState<string | null>(null);

  const dataMap = useMemo(() => {
    const map: Record<string, typeof marketData extends (infer T)[] ? T : never> = {};
    marketData?.forEach((m) => { map[m.ticker] = m; });
    return map;
  }, [marketData]);

  // Fetch B3 tickers + saved prices on mount
  useEffect(() => {
    const fetchB3 = async () => {
      setB3Loading(true);
      setB3Error(null);
      try {
        const result = await callApi<B3Response>(
          '/market/b3-corn-quotes',
          undefined,
          { method: 'GET', query: { quantity: '10' } }
        );
        const tickers = result.corn_b3 ?? [];
        setB3Tickers(tickers);

        if (tickers.length > 0) {
          const tickerNames = tickers.map(t => t.ticker);
          const { data: saved } = await supabase
            .from('market_data')
            .select('ticker, price, updated_at, source')
            .eq('commodity', 'MILHO')
            .in('ticker', tickerNames);

          const priceMap: Record<string, B3SavedPrice> = {};
          (saved ?? []).forEach((row: any) => {
            priceMap[row.ticker] = {
              price: row.price,
              updated_at: row.updated_at,
              source: row.source,
            };
          });
          setB3Prices(priceMap);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setB3Error(msg);
      } finally {
        setB3Loading(false);
      }
    };
    fetchB3();
  }, []);

  const handleAutoFetch = async () => {
    setFetching(true);
    try {
      const result = await callApi<MarketQuotesResponse>(
        '/market/quotes',
        undefined,
        { method: 'GET', query: { quantity: '10' } }
      );

      setLastQuotes(result);

      if (result.spot_usd_brl) {
        await upsertMarket.mutateAsync({
          ticker: 'USD/BRL',
          commodity: 'FX',
          price: result.spot_usd_brl,
          currency: 'BRL',
          source: 'api',
        });
      }

      for (const s of result.soybean_cbot ?? []) {
        await upsertMarket.mutateAsync({
          ticker: s.ticker,
          commodity: 'SOJA',
          price: s.price_usd_bushel,
          currency: 'USD',
          source: 'api',
          exchange_rate: result.spot_usd_brl ?? null,
          exp_date: s.exp_date,
          ndf_spot: s.ndf?.spot ?? null,
          ndf_estimated: s.ndf?.estimated ?? null,
          ndf_spread: s.ndf?.spread ?? null,
          ndf_override: s.ndf?.override ?? null,
        });
      }

      for (const c of result.corn_cbot ?? []) {
        await upsertMarket.mutateAsync({
          ticker: c.ticker,
          commodity: 'MILHO_CBOT',
          price: c.price_usd_cents_bushel,
          currency: 'USD',
          source: 'api',
          price_unit: 'cents/bushel',
          exp_date: c.exp_date,
        });
      }

      toast.success('Dados de mercado atualizados');
    } catch (err) {
      const msg = err instanceof Error ? err.message : typeof err === 'object' && err !== null && 'message' in err ? String((err as any).message) : JSON.stringify(err);
      toast.error(`Erro ao atualizar mercado: ${msg}`);
    } finally {
      setFetching(false);
    }
  };

  const handleManualSave = async (ticker: string) => {
    const price = parseFloat(editValue);
    if (isNaN(price)) { toast.error('Valor inválido'); return; }
    const existing = dataMap[ticker];
    try {
      await upsertMarket.mutateAsync({
        ticker,
        commodity: existing?.commodity ?? 'UNKNOWN',
        price,
        currency: existing?.currency ?? 'BRL',
        source: 'manual',
      });
      toast.success(`${ticker} atualizado`);
      setEditingTicker(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro');
    }
  };

  const handleB3Save = async (ticker: string, expDate: string) => {
    const price = parseFloat(editValue);
    if (isNaN(price)) { toast.error('Valor inválido'); return; }
    try {
      await upsertMarket.mutateAsync({
        ticker,
        commodity: 'MILHO',
        price,
        currency: 'BRL',
        source: 'manual',
        price_unit: 'BRL/sack',
        exp_date: expDate,
        exchange_rate: null,
        ndf_spot: null,
        ndf_estimated: null,
        ndf_spread: null,
        ndf_override: null,
      });
      setB3Prices(prev => ({
        ...prev,
        [ticker]: { price, updated_at: new Date().toISOString(), source: 'manual' },
      }));
      toast.success(`${ticker} atualizado`);
      setEditingTicker(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro');
    }
  };

  // Group saved market data
  const sortByExpDate = (a: { exp_date?: string | null }, b: { exp_date?: string | null }) =>
    (a.exp_date ?? '').localeCompare(b.exp_date ?? '');
  const soybeanRows = (marketData?.filter(m => m.commodity === 'SOJA') ?? []).sort(sortByExpDate);
  const cornCbotRows = (marketData?.filter(m => m.commodity === 'MILHO_CBOT') ?? []).sort(sortByExpDate);
  const fxRow = dataMap['USD/BRL'];

  const renderEditCell = (ticker: string, currentPrice?: number) => {
    if (editingTicker === ticker) {
      return (
        <div className="flex gap-1 items-center">
          <Input
            type="number"
            step="0.01"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            className="h-7 w-24"
            autoFocus
            onKeyDown={(e) => e.key === 'Enter' && handleManualSave(ticker)}
          />
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => handleManualSave(ticker)}>
            <Check className="h-3 w-3" />
          </Button>
        </div>
      );
    }
    return (
      <Button
        variant="ghost"
        size="sm"
        className="h-7 px-2"
        onClick={() => {
          setEditingTicker(ticker);
          setEditValue(currentPrice?.toString() ?? '');
        }}
      >
        <Edit2 className="h-3 w-3" />
      </Button>
    );
  };

  const renderB3EditCell = (ticker: string, expDate: string, currentPrice?: number | null) => {
    if (editingTicker === ticker) {
      return (
        <div className="flex gap-1 items-center">
          <Input
            type="number"
            step="0.01"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            className="h-7 w-24"
            autoFocus
            onKeyDown={(e) => e.key === 'Enter' && handleB3Save(ticker, expDate)}
          />
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => handleB3Save(ticker, expDate)}>
            <Check className="h-3 w-3" />
          </Button>
        </div>
      );
    }
    return (
      <Button
        variant="ghost"
        size="sm"
        className="h-7 px-2"
        onClick={() => {
          setEditingTicker(ticker);
          setEditValue(currentPrice?.toString() ?? '');
        }}
      >
        <Edit2 className="h-3 w-3" />
      </Button>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Dados de Mercado</h2>
        <Button onClick={handleAutoFetch} disabled={fetching}>
          <RefreshCw className={`mr-2 h-4 w-4 ${fetching ? 'animate-spin' : ''}`} />
          {fetching ? 'Atualizando...' : 'Atualizar Automático'}
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : (
        <>
          {/* FX Card */}
          {fxRow && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Dólar / Real (USD/BRL)</CardTitle>
              </CardHeader>
              <CardContent className="flex items-center gap-4">
                <span className="text-2xl font-bold">R$ {fxRow.price.toFixed(4)}</span>
                <span className={`text-xs ${getHoursAgo(fxRow.updated_at) > 24 ? 'text-[hsl(var(--warning))]' : 'text-muted-foreground'}`}>
                  {getHoursAgo(fxRow.updated_at)}h atrás · {fxRow.source}
                </span>
                {renderEditCell('USD/BRL', fxRow.price)}
              </CardContent>
            </Card>
          )}

          {/* Soybean CBOT Table */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Soja CBOT</CardTitle>
            </CardHeader>
            <CardContent>
              {soybeanRows.length === 0 ? (
                <p className="text-muted-foreground text-sm">Sem dados. Clique em "Atualizar Automático".</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ticker</TableHead>
                      <TableHead>Vencimento</TableHead>
                      <TableHead className="text-right">Preço (USD/bu)</TableHead>
                      <TableHead className="text-right">Spot</TableHead>
                      <TableHead className="text-right">NDF Estimado</TableHead>
                      <TableHead className="text-right">Spread</TableHead>
                      <TableHead className="text-right">Atualizado</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {soybeanRows.map((row) => (
                      <TableRow key={row.ticker}>
                        <TableCell className="font-medium">{row.ticker}</TableCell>
                        <TableCell>{row.exp_date ?? '-'}</TableCell>
                        <TableCell className="text-right">{row.price.toFixed(2)}</TableCell>
                        <TableCell className="text-right">{row.ndf_spot?.toFixed(4) ?? '-'}</TableCell>
                        <TableCell className="text-right">{row.ndf_estimated?.toFixed(4) ?? '-'}</TableCell>
                        <TableCell className="text-right">{row.ndf_spread?.toFixed(4) ?? '-'}</TableCell>
                        <TableCell className={`text-right text-xs ${getHoursAgo(row.updated_at) > 24 ? 'text-[hsl(var(--warning))]' : 'text-muted-foreground'}`}>
                          {getHoursAgo(row.updated_at)}h · {row.source}
                        </TableCell>
                        <TableCell>{renderEditCell(row.ticker, row.price)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Corn CBOT Table */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Milho CBOT</CardTitle>
            </CardHeader>
            <CardContent>
              {cornCbotRows.length === 0 ? (
                <p className="text-muted-foreground text-sm">Sem dados. Clique em "Atualizar Automático".</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ticker</TableHead>
                      <TableHead>Vencimento</TableHead>
                      <TableHead className="text-right">Preço (¢/bu)</TableHead>
                      <TableHead className="text-right">Atualizado</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cornCbotRows.map((row) => (
                      <TableRow key={row.ticker}>
                        <TableCell className="font-medium">{row.ticker}</TableCell>
                        <TableCell>{row.exp_date ?? '-'}</TableCell>
                        <TableCell className="text-right">{row.price.toFixed(2)}</TableCell>
                        <TableCell className={`text-right text-xs ${getHoursAgo(row.updated_at) > 24 ? 'text-[hsl(var(--warning))]' : 'text-muted-foreground'}`}>
                          {getHoursAgo(row.updated_at)}h · {row.source}
                        </TableCell>
                        <TableCell>{renderEditCell(row.ticker, row.price)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Milho B3 (Manual) */}
          <Card className="border-[hsl(var(--warning))]">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Milho B3 (Manual)</CardTitle>
              <p className="text-xs text-[hsl(var(--warning))] font-medium">Atualização manual obrigatória</p>
            </CardHeader>
            <CardContent>
              {b3Loading ? (
                <div className="flex justify-center py-6">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
                </div>
              ) : b3Error ? (
                <p className="text-muted-foreground text-sm">Aguardando servidor acordar... ({b3Error})</p>
              ) : b3Tickers.length === 0 ? (
                <p className="text-muted-foreground text-sm">Nenhum contrato B3 disponível</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ticker</TableHead>
                      <TableHead>Vencimento</TableHead>
                      <TableHead className="text-right">Preço (BRL/saca)</TableHead>
                      <TableHead className="text-right">Atualizado</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {b3Tickers.map((t) => {
                      const saved = b3Prices[t.ticker];
                      return (
                        <TableRow key={t.ticker}>
                          <TableCell className="font-medium">{t.ticker}</TableCell>
                          <TableCell>{t.exp_date}</TableCell>
                          <TableCell className="text-right">
                            {saved?.price != null ? `R$ ${saved.price.toFixed(2)}` : '-'}
                          </TableCell>
                          <TableCell className={`text-right text-xs ${saved?.updated_at && getHoursAgo(saved.updated_at) > 24 ? 'text-[hsl(var(--warning))]' : 'text-muted-foreground'}`}>
                            {saved?.updated_at ? `${getHoursAgo(saved.updated_at)}h · ${saved.source}` : '-'}
                          </TableCell>
                          <TableCell>{renderB3EditCell(t.ticker, t.exp_date, saved?.price)}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

export default Market;

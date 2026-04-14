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
  const [fetchingOp, setFetchingOp] = useState<'fx' | 'soybean' | 'corn_cbot' | 'corn_b3' | 'all' | 'markets' | null>(null);
  const [editingTicker, setEditingTicker] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  // B3 corn state
  const [b3Tickers, setB3Tickers] = useState<B3CornQuote[]>([]);
  const [b3Prices, setB3Prices] = useState<Record<string, B3SavedPrice>>({});
  const [b3Loading, setB3Loading] = useState(true);
  const [b3Error, setB3Error] = useState<string | null>(null);
  const [confirmingB3, setConfirmingB3] = useState(false);

  const dataMap = useMemo(() => {
    const map: Record<string, typeof marketData extends (infer T)[] ? T : never> = {};
    marketData?.forEach((m) => { map[m.ticker] = m; });
    return map;
  }, [marketData]);

  // Load B3 from Supabase cache on mount (no API call)
  useEffect(() => {
    const loadB3FromDb = async () => {
      setB3Loading(true);
      try {
        const { data: saved } = await supabase
          .from('market_data')
          .select('ticker, price, updated_at, source, exp_date')
          .eq('commodity', 'MILHO')
          .order('exp_date');
        const tickers: B3CornQuote[] = [];
        const priceMap: Record<string, B3SavedPrice> = {};
        (saved ?? []).forEach((row: any) => {
          tickers.push({ ticker: row.ticker, exp_date: row.exp_date });
          priceMap[row.ticker] = { price: row.price, updated_at: row.updated_at, source: row.source };
        });
        setB3Tickers(tickers);
        setB3Prices(priceMap);
      } catch (err) {
        setB3Error(err instanceof Error ? err.message : String(err));
      } finally {
        setB3Loading(false);
      }
    };
    loadB3FromDb();
  }, []);

  // ---- Atomic functions ----

  const fetchQuotes = async (fxOverride?: number) => {
    const query: Record<string, string> = { quantity: '10' };
    if (fxOverride !== undefined) {
      query.fx_override = fxOverride.toString();
    }
    return await callApi<MarketQuotesResponse>(
      '/market/quotes', undefined,
      { method: 'GET', query }
    );
  };

  const getCurrentFxFromDb = async (): Promise<number | undefined> => {
    const { data } = await supabase
      .from('market_data')
      .select('price')
      .eq('ticker', 'USD/BRL')
      .single();
    return data?.price ?? undefined;
  };

  const persistFX = async (result: MarketQuotesResponse) => {
    if (!result.spot_usd_brl) return;
    await upsertMarket.mutateAsync({
      ticker: 'USD/BRL', commodity: 'FX',
      price: result.spot_usd_brl, currency: 'BRL', source: 'api',
    });
  };

  const persistSoybean = async (result: MarketQuotesResponse) => {
    for (const s of result.soybean_cbot ?? []) {
      await upsertMarket.mutateAsync({
        ticker: s.ticker, commodity: 'SOJA',
        price: s.price_usd_bushel, currency: 'USD', source: 'api',
        exchange_rate: result.spot_usd_brl ?? null,
        exp_date: s.exp_date,
        ndf_spot: s.ndf?.spot ?? null,
        ndf_estimated: s.ndf?.estimated ?? null,
        ndf_spread: s.ndf?.spread ?? null,
        ndf_override: s.ndf?.override ?? null,
      });
    }
  };

  const persistCornCBOT = async (result: MarketQuotesResponse) => {
    for (const c of result.corn_cbot ?? []) {
      await upsertMarket.mutateAsync({
        ticker: c.ticker, commodity: 'MILHO_CBOT',
        price: c.price_usd_cents_bushel, currency: 'USD', source: 'api',
        price_unit: 'cents/bushel', exp_date: c.exp_date,
      });
    }
  };

  const persistCornB3 = async () => {
    const b3Result = await callApi<B3Response>(
      '/market/b3-corn-quotes', undefined,
      { method: 'GET', query: { quantity: '10' } }
    );
    const apiTickers = b3Result.corn_b3 ?? [];
    const { data: existing } = await supabase
      .from('market_data').select('ticker').eq('commodity', 'MILHO');
    const existingSet = new Set((existing ?? []).map(r => r.ticker));
    for (const t of apiTickers) {
      if (!existingSet.has(t.ticker)) {
        await supabase.from('market_data').insert({
          ticker: t.ticker, commodity: 'MILHO', currency: 'BRL',
          price: null, price_unit: 'BRL/sack', source: 'manual',
          date: new Date().toISOString().split('T')[0], exp_date: t.exp_date,
        });
      }
    }
    // Reload B3 from DB
    const { data: refreshed } = await supabase
      .from('market_data')
      .select('ticker, price, updated_at, source, exp_date')
      .eq('commodity', 'MILHO').order('exp_date');
    const tickers: B3CornQuote[] = [];
    const priceMap: Record<string, B3SavedPrice> = {};
    (refreshed ?? []).forEach((row: any) => {
      tickers.push({ ticker: row.ticker, exp_date: row.exp_date });
      priceMap[row.ticker] = { price: row.price, updated_at: row.updated_at, source: row.source };
    });
    setB3Tickers(tickers);
    setB3Prices(priceMap);
  };

  // ---- Handlers ----

  const handleFetchFX = async () => {
    setFetchingOp('fx');
    try {
      const result = await fetchQuotes();
      await persistFX(result);
      toast.success('Câmbio atualizado');
    } catch (err) {
      toast.error(`Erro ao atualizar câmbio: ${err instanceof Error ? err.message : String(err)}`);
    } finally { setFetchingOp(null); }
  };

  const handleFetchSoybean = async () => {
    setFetchingOp('soybean');
    try {
      const fxOverride = await getCurrentFxFromDb();
      const result = await fetchQuotes(fxOverride);
      await persistSoybean(result);
      toast.success('Soja CBOT atualizada');
    } catch (err) {
      toast.error(`Erro ao atualizar soja: ${err instanceof Error ? err.message : String(err)}`);
    } finally { setFetchingOp(null); }
  };

  const handleFetchCornCBOT = async () => {
    setFetchingOp('corn_cbot');
    try {
      const fxOverride = await getCurrentFxFromDb();
      const result = await fetchQuotes(fxOverride);
      await persistCornCBOT(result);
      toast.success('Milho CBOT atualizado');
    } catch (err) {
      toast.error(`Erro ao atualizar milho CBOT: ${err instanceof Error ? err.message : String(err)}`);
    } finally { setFetchingOp(null); }
  };

  const handleFetchCornB3 = async () => {
    setFetchingOp('corn_b3');
    try {
      await persistCornB3();
      toast.success('Milho B3 atualizado');
    } catch (err) {
      toast.error(`Erro ao atualizar milho B3: ${err instanceof Error ? err.message : String(err)}`);
    } finally { setFetchingOp(null); }
  };

  const handleFetchAll = async () => {
    setFetchingOp('all');
    try {
      const result = await fetchQuotes();
      await persistFX(result);
      await persistSoybean(result);
      await persistCornCBOT(result);
      await persistCornB3();
      toast.success('Todos os dados atualizados');
    } catch (err) {
      toast.error(`Erro ao atualizar: ${err instanceof Error ? err.message : String(err)}`);
    } finally { setFetchingOp(null); }
  };

  const handleFetchMarkets = async () => {
    setFetchingOp('markets');
    try {
      const fxOverride = await getCurrentFxFromDb();
      const result = await fetchQuotes(fxOverride);
      await persistSoybean(result);
      await persistCornCBOT(result);
      await persistCornB3();
      toast.success('Mercados atualizados (câmbio preservado)');
    } catch (err) {
      toast.error(`Erro ao atualizar mercados: ${err instanceof Error ? err.message : String(err)}`);
    } finally { setFetchingOp(null); }
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

  const handleConfirmB3Update = async () => {
    setConfirmingB3(true);
    try {
      const tickers = b3Tickers.map(t => t.ticker);
      for (const ticker of tickers) {
        await supabase
          .from('market_data')
          .update({ updated_at: new Date().toISOString() })
          .eq('ticker', ticker);
      }
      setB3Prices(prev => {
        const updated = { ...prev };
        const now = new Date().toISOString();
        tickers.forEach(t => {
          if (updated[t]) updated[t] = { ...updated[t], updated_at: now };
        });
        return updated;
      });
      toast.success('Atualização B3 confirmada');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao confirmar');
    } finally {
      setConfirmingB3(false);
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
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleFetchMarkets}
            disabled={fetchingOp !== null}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${fetchingOp === 'markets' ? 'animate-spin' : ''}`} />
            {fetchingOp === 'markets' ? 'Atualizando...' : 'Atualizar Mercados'}
          </Button>
          <Button
            onClick={handleFetchAll}
            disabled={fetchingOp !== null}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${fetchingOp === 'all' ? 'animate-spin' : ''}`} />
            {fetchingOp === 'all' ? 'Atualizando...' : 'Atualizar Tudo'}
          </Button>
        </div>
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
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">Dólar / Real (USD/BRL)</CardTitle>
                  <Button variant="ghost" size="sm" onClick={handleFetchFX} disabled={fetchingOp !== null}>
                    <RefreshCw className={`h-3 w-3 ${fetchingOp === 'fx' ? 'animate-spin' : ''}`} />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="flex items-center gap-4">
                <span className="text-2xl font-bold">R$ {fxRow.price!.toFixed(4)}</span>
                <span className={`text-xs ${getHoursAgo(fxRow.updated_at) > 24 ? 'text-[hsl(var(--warning))]' : 'text-muted-foreground'}`}>
                  {getHoursAgo(fxRow.updated_at)}h atrás · {fxRow.source}
                </span>
                {renderEditCell('USD/BRL', fxRow.price ?? undefined)}
              </CardContent>
            </Card>
          )}

          {/* Soybean CBOT Table */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Soja CBOT</CardTitle>
                <Button variant="ghost" size="sm" onClick={handleFetchSoybean} disabled={fetchingOp !== null}>
                  <RefreshCw className={`h-3 w-3 ${fetchingOp === 'soybean' ? 'animate-spin' : ''}`} />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {soybeanRows.length === 0 ? (
                <p className="text-muted-foreground text-sm">Sem dados. Clique em "Atualizar Tudo".</p>
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
                        <TableCell className="text-right">{row.price!.toFixed(2)}</TableCell>
                        <TableCell className="text-right">{row.ndf_spot?.toFixed(4) ?? '-'}</TableCell>
                        <TableCell className="text-right">{row.ndf_estimated?.toFixed(4) ?? '-'}</TableCell>
                        <TableCell className="text-right">{row.ndf_spread?.toFixed(4) ?? '-'}</TableCell>
                        <TableCell className={`text-right text-xs ${getHoursAgo(row.updated_at) > 24 ? 'text-[hsl(var(--warning))]' : 'text-muted-foreground'}`}>
                          {getHoursAgo(row.updated_at)}h · {row.source}
                        </TableCell>
                        <TableCell>{renderEditCell(row.ticker, row.price ?? undefined)}</TableCell>
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
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Milho CBOT</CardTitle>
                <Button variant="ghost" size="sm" onClick={handleFetchCornCBOT} disabled={fetchingOp !== null}>
                  <RefreshCw className={`h-3 w-3 ${fetchingOp === 'corn_cbot' ? 'animate-spin' : ''}`} />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {cornCbotRows.length === 0 ? (
                <p className="text-muted-foreground text-sm">Sem dados. Clique em "Atualizar Tudo".</p>
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
                        <TableCell className="text-right">{row.price!.toFixed(2)}</TableCell>
                        <TableCell className={`text-right text-xs ${getHoursAgo(row.updated_at) > 24 ? 'text-[hsl(var(--warning))]' : 'text-muted-foreground'}`}>
                          {getHoursAgo(row.updated_at)}h · {row.source}
                        </TableCell>
                        <TableCell>{renderEditCell(row.ticker, row.price ?? undefined)}</TableCell>
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
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm">Milho B3 (Manual)</CardTitle>
                  <p className="text-xs text-[hsl(var(--warning))] font-medium mt-0.5">Atualização manual obrigatória</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={handleFetchCornB3} disabled={fetchingOp !== null}>
                    <RefreshCw className={`h-3 w-3 ${fetchingOp === 'corn_b3' ? 'animate-spin' : ''}`} />
                  </Button>
                  {b3Tickers.length > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs h-8"
                      onClick={handleConfirmB3Update}
                      disabled={confirmingB3}
                    >
                      <Check className="mr-1.5 h-3 w-3" />
                      {confirmingB3 ? 'Confirmando...' : 'Confirmar atualização'}
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {b3Loading ? (
                <div className="flex justify-center py-6">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
                </div>
              ) : b3Error ? (
                <p className="text-muted-foreground text-sm">Aguardando servidor acordar... ({b3Error})</p>
              ) : b3Tickers.length === 0 ? (
                <p className="text-muted-foreground text-sm">Clique em "Atualizar Tudo" para carregar os tickers B3.</p>
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

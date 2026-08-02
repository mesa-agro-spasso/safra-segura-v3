import type { QueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { callApi } from '@/lib/api';
import { logActivity } from '@/lib/activityLog';
import { toast } from 'sonner';

/**
 * Escrita de cotações em `market_data` — lógica COMPARTILHADA entre a aba
 * Mercado → Bolsa e o card de Mercado do cockpit.
 *
 * Mora em `src/lib/` de propósito: as duas telas consomem daqui, nenhuma
 * importa de dentro da pasta da outra. O comportamento é exatamente o que a
 * aba Mercado já fazia — nada foi alterado na extração.
 */

export interface NdfData {
  spot: number;
  estimated: number;
  spread: number;
  override: number | null;
}

export interface CbotQuote {
  ticker: string;
  exp_date: string;
  price_usd_bushel: number;
  price_usd_cents_bushel: number;
  ndf: NdfData;
}

export interface MarketQuotesResponse {
  trade_date: string;
  spot_usd_brl: number;
  soybean_cbot: CbotQuote[];
  corn_cbot: CbotQuote[];
}

export interface B3CornQuote {
  ticker: string;
  exp_date: string;
}

export interface B3Response {
  trade_date: string;
  corn_b3: B3CornQuote[];
}

export interface B3SavedPrice {
  price: number | null;
  updated_at: string;
  source: string;
}

export interface UpsertMarketItem {
  ticker: string;
  commodity: string;
  price: number | null;
  currency: string;
  source: string;
  exchange_rate?: number | null;
  price_unit?: string | null;
  exp_date?: string | null;
  raw_price?: number | null;
  raw_unit?: string | null;
  ndf_spot?: number | null;
  ndf_estimated?: number | null;
  ndf_spread?: number | null;
  ndf_override?: number | null;
}

export interface MarketWriteDeps {
  /** `useUpsertMarketData().mutateAsync` */
  upsert: (item: UpsertMarketItem) => Promise<unknown>;
  queryClient: QueryClient;
}

export const fetchQuotes = async (quantity: number, fxOverride?: number) => {
  const query: Record<string, string> = { quantity: String(quantity) };
  if (fxOverride !== undefined) {
    query.fx_override = fxOverride.toString();
  }
  return await callApi<MarketQuotesResponse>('/market/quotes', undefined, {
    method: 'GET',
    query,
  });
};

export const getCurrentFxFromDb = async (): Promise<number | undefined> => {
  const { data } = await supabase
    .from('market_data')
    .select('price')
    .eq('ticker', 'USD/BRL')
    .single();
  return data?.price ?? undefined;
};

export const persistFX = async (deps: MarketWriteDeps, result: MarketQuotesResponse) => {
  if (!result.spot_usd_brl) return;
  await deps.upsert({
    ticker: 'USD/BRL', commodity: 'FX',
    price: result.spot_usd_brl, currency: 'BRL', source: 'api',
    price_unit: 'brl_per_usd',
    raw_price: null, raw_unit: null,
  });
};

// Mirror the API batch into market_data: upsert everything the fetch returned,
// then delete rows for the same commodity whose ticker is no longer in the batch.
// Empty batch is treated as a no-op (never wipes data). Delete failures do NOT
// revert successful upserts — a specific toast surfaces the partial sync.
export const syncCommodityBatch = async (
  deps: MarketWriteDeps,
  commodity: 'SOJA' | 'MILHO_CBOT' | 'MILHO',
  batchTickers: string[],
) => {
  const inList = `(${batchTickers.map((t) => `"${t}"`).join(',')})`;
  const { data: removed, error } = await supabase
    .from('market_data')
    .delete()
    .eq('commodity', commodity)
    .not('ticker', 'in', inList)
    .select('ticker');

  if (error) {
    toast.error('Sync parcial: dados novos salvos, limpeza de tickers antigos falhou');
  } else if (removed && removed.length > 0) {
    void logActivity('market_data.sync', 'market_data', commodity, {
      removed_tickers: removed.map((r) => r.ticker),
      batch_tickers: batchTickers,
    });
  }

  // The upsert hook invalidates before the delete runs, so we must invalidate
  // again here to reflect removed rows in the UI.
  deps.queryClient.invalidateQueries({ queryKey: ['market_data'] });
};

export const persistSoybean = async (deps: MarketWriteDeps, result: MarketQuotesResponse) => {
  const batch = result.soybean_cbot ?? [];
  if (batch.length === 0) return;
  for (const s of batch) {
    await deps.upsert({
      ticker: s.ticker, commodity: 'SOJA',
      price: s.price_usd_bushel, currency: 'USD', source: 'api',
      price_unit: 'usd_per_bushel',
      raw_price: s.price_usd_cents_bushel, raw_unit: 'cents_per_bushel',
      exchange_rate: result.spot_usd_brl ?? null,
      exp_date: s.exp_date,
      ndf_spot: s.ndf?.spot ?? null,
      ndf_estimated: s.ndf?.estimated ?? null,
      ndf_spread: s.ndf?.spread ?? null,
      ndf_override: s.ndf?.override ?? null,
    });
  }
  await syncCommodityBatch(deps, 'SOJA', batch.map((s) => s.ticker));
};

export const persistCornCBOT = async (deps: MarketWriteDeps, result: MarketQuotesResponse) => {
  const batch = result.corn_cbot ?? [];
  if (batch.length === 0) return;
  for (const c of batch) {
    await deps.upsert({
      ticker: c.ticker, commodity: 'MILHO_CBOT',
      price: c.price_usd_bushel, currency: 'USD', source: 'api',
      price_unit: 'usd_per_bushel',
      raw_price: c.price_usd_cents_bushel, raw_unit: 'cents_per_bushel',
      exchange_rate: result.spot_usd_brl ?? null,
      exp_date: c.exp_date,
      ndf_spot: c.ndf?.spot ?? null,
      ndf_estimated: c.ndf?.estimated ?? null,
      ndf_spread: c.ndf?.spread ?? null,
      ndf_override: c.ndf?.override ?? null,
    });
  }
  await syncCommodityBatch(deps, 'MILHO_CBOT', batch.map((c) => c.ticker));
};

/** Busca os tickers B3, semeia os que faltam e devolve o estado recarregado do banco. */
export const persistCornB3 = async (
  deps: MarketWriteDeps,
  b3Qty: number,
): Promise<{ tickers: B3CornQuote[]; prices: Record<string, B3SavedPrice> }> => {
  const b3Result = await callApi<B3Response>('/market/b3-corn-quotes', undefined, {
    method: 'GET',
    query: { quantity: String(b3Qty) },
  });
  const apiTickers = b3Result.corn_b3 ?? [];
  const { data: existing } = await supabase
    .from('market_data').select('ticker').eq('commodity', 'MILHO');
  const existingSet = new Set((existing ?? []).map((r) => r.ticker));
  for (const t of apiTickers) {
    if (!existingSet.has(t.ticker)) {
      await supabase.from('market_data').insert({
        ticker: t.ticker, commodity: 'MILHO', currency: 'BRL',
        price: null, price_unit: 'brl_per_sack', source: 'manual',
        raw_price: null, raw_unit: null,
        date: new Date().toISOString().split('T')[0], exp_date: t.exp_date,
      });
    }
  }
  // Mirror the API batch: drop B3 rows the API no longer returns (rolled/expired).
  // Empty batch is a no-op, so manual data is never wiped.
  if (apiTickers.length > 0) {
    await syncCommodityBatch(deps, 'MILHO', apiTickers.map((t) => t.ticker));
  }

  return await loadB3FromDb();
};

/** Lê o estado atual do milho B3 direto do banco (sem chamar a API). */
export const loadB3FromDb = async (): Promise<{
  tickers: B3CornQuote[];
  prices: Record<string, B3SavedPrice>;
}> => {
  const { data: saved } = await supabase
    .from('market_data')
    .select('ticker, price, updated_at, source, exp_date')
    .eq('commodity', 'MILHO')
    .order('exp_date');
  const tickers: B3CornQuote[] = [];
  const prices: Record<string, B3SavedPrice> = {};
  (saved ?? []).forEach((row: { ticker: string; price: number | null; updated_at: string; source: string; exp_date: string | null }) => {
    tickers.push({ ticker: row.ticker, exp_date: row.exp_date ?? '' });
    prices[row.ticker] = { price: row.price, updated_at: row.updated_at, source: row.source };
  });
  return { tickers, prices };
};

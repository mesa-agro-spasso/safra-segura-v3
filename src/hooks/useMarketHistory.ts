import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface MarketHistoryRow {
  id: string;
  ticker: string;
  commodity: string | null;
  benchmark: string | null;
  reference_date: string;
  price: number;
  currency: string;
  price_unit: string | null;
  exp_date: string | null;
  source: string | null;
  notes: string | null;
  created_at: string;
}

/** Distinct tickers available for a given commodity, ordered by exp_date asc. */
export function useMarketHistoryTickers(commodity: string | null) {
  return useQuery({
    queryKey: ['market_history_tickers', commodity],
    enabled: !!commodity,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('market_data_history')
        .select('ticker, exp_date')
        .eq('commodity', commodity!)
        .order('exp_date', { ascending: true });
      if (error) throw error;
      const seen = new Map<string, string | null>();
      for (const r of (data ?? []) as { ticker: string; exp_date: string | null }[]) {
        if (!seen.has(r.ticker)) seen.set(r.ticker, r.exp_date);
      }
      return Array.from(seen.entries()).map(([ticker, exp_date]) => ({ ticker, exp_date }));
    },
  });
}

/** Time series for a single ticker. sinceDays=null -> all history. */
export function useMarketHistory(ticker: string | null, sinceDays: number | null) {
  return useQuery({
    queryKey: ['market_history', ticker, sinceDays],
    enabled: !!ticker,
    queryFn: async () => {
      let q = supabase
        .from('market_data_history')
        .select('*')
        .eq('ticker', ticker!)
        .order('reference_date', { ascending: true })
        .limit(1000);
      if (sinceDays != null) {
        const since = new Date();
        since.setDate(since.getDate() - sinceDays);
        q = q.gte('reference_date', since.toISOString().split('T')[0]);
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as MarketHistoryRow[];
    },
  });
}

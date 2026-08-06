import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { logActivity } from '@/lib/activityLog';

/**
 * Opções de seguro e suas cotações — fala só com o Supabase.
 * Nada é calculado aqui: prêmio em USD/bushel é gravado em USD/bushel.
 */

export type Benchmark = 'cbot' | 'b3';
export type Commodity = 'soybean' | 'corn';

export interface InsuranceOption {
  id: string;
  label: string;
  commodity: Commodity;
  benchmark: Benchmark;
  futures_ticker: string;
  option_type: 'call' | 'put';
  strike_usd_bushel: number | null;
  strike_brl_sack: number | null;
  expiry_date: string;
  active: boolean;
  created_by: string | null;
  created_at: string;
}

export interface OptionQuote {
  id: string;
  option_id: string;
  benchmark: Benchmark;
  premium_usd_bushel: number | null;
  premium_brl_sack: number | null;
  trade_date: string;
  created_by: string | null;
  created_at: string;
}

/** Pares aceitos pelo banco. Nenhum outro. */
export const VALID_PAIRS: Record<Benchmark, Commodity[]> = {
  cbot: ['soybean', 'corn'],
  b3: ['corn'],
};

export const todayISO = () => new Date().toISOString().slice(0, 10);

/** Como o par (benchmark + commodity) aparece na coluna commodity de market_data. */
export const MARKET_COMMODITY_BY_PAIR: Record<string, string> = {
  'cbot:soybean': 'SOJA',
  'cbot:corn': 'MILHO_CBOT',
  'b3:corn': 'MILHO',
};

export interface FuturesTicker {
  ticker: string;
  exp_date: string | null;
}

/** Futuros vigentes do par, só leitura de market_data. Nunca escreve. */
export function useFuturesTickers(benchmark: Benchmark, commodity: Commodity) {
  const marketCommodity = MARKET_COMMODITY_BY_PAIR[`${benchmark}:${commodity}`];
  return useQuery({
    queryKey: ['market_data', 'futures_tickers', marketCommodity],
    enabled: !!marketCommodity,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('market_data')
        .select('ticker, exp_date')
        .eq('commodity', marketCommodity!)
        .gte('exp_date', todayISO())
        .order('exp_date');
      if (error) throw error;
      return (data ?? []) as FuturesTicker[];
    },
  });
}

export function useInsuranceOptions() {
  return useQuery({
    queryKey: ['insurance_options', 'active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('insurance_options')
        .select('*')
        .eq('active', true)
        .order('expiry_date');
      if (error) throw error;
      return (data ?? []) as unknown as InsuranceOption[];
    },
  });
}

export interface NewInsuranceOption {
  label: string;
  commodity: Commodity;
  benchmark: Benchmark;
  futures_ticker: string;
  option_type: 'call' | 'put';
  strike: number;
  expiry_date: string;
}

export function useCreateInsuranceOption() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: NewInsuranceOption) => {
      const { data: { user } } = await supabase.auth.getUser();
      const row = {
        label: input.label,
        commodity: input.commodity,
        benchmark: input.benchmark,
        futures_ticker: input.futures_ticker,
        option_type: input.option_type,
        // Unidade decidida pelo benchmark — o banco proíbe preencher os dois.
        strike_usd_bushel: input.benchmark === 'cbot' ? input.strike : null,
        strike_brl_sack: input.benchmark === 'b3' ? input.strike : null,
        expiry_date: input.expiry_date,
        active: true,
        created_by: user?.id ?? null,
      };
      const { data, error } = await supabase
        .from('insurance_options')
        .insert(row as never)
        .select('id')
        .single();
      if (error) throw new Error(error.message);
      void logActivity('insurance_option.create', 'insurance_options', (data as { id: string }).id, {
        label: input.label, benchmark: input.benchmark, commodity: input.commodity,
      });
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['insurance_options'] }),
  });
}

/** Aposenta a opção: active = false. Nunca deleta — há cotações apontando para ela. */
export function useRetireInsuranceOption() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (option: InsuranceOption) => {
      const { error } = await supabase
        .from('insurance_options')
        .update({ active: false } as never)
        .eq('id', option.id);
      if (error) throw new Error(error.message);
      void logActivity('insurance_option.retire', 'insurance_options', option.id, { label: option.label });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['insurance_options'] }),
  });
}

/** Cotação mais recente por opção — dedupe no cliente, ordenado por pregão. */
export function useLatestOptionQuotes() {
  return useQuery({
    queryKey: ['insurance_option_quotes', 'latest'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('insurance_option_quotes')
        .select('*')
        .order('trade_date', { ascending: false })
        .order('created_at', { ascending: false });
      if (error) throw error;
      const map: Record<string, OptionQuote> = {};
      for (const row of (data ?? []) as unknown as OptionQuote[]) {
        if (!map[row.option_id]) map[row.option_id] = row;
      }
      return map;
    },
  });
}

export function useOptionQuoteHistory(optionId: string | null) {
  return useQuery({
    queryKey: ['insurance_option_quotes', 'history', optionId],
    enabled: !!optionId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('insurance_option_quotes')
        .select('*')
        .eq('option_id', optionId!)
        .order('trade_date', { ascending: false })
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as OptionQuote[];
    },
  });
}

/** Registrar SEMPRE insere. Nunca update, nunca upsert. */
export function useCreateOptionQuote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { option: InsuranceOption; premium: number; trade_date: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const row = {
        option_id: input.option.id,
        benchmark: input.option.benchmark,
        premium_usd_bushel: input.option.benchmark === 'cbot' ? input.premium : null,
        premium_brl_sack: input.option.benchmark === 'b3' ? input.premium : null,
        trade_date: input.trade_date,
        created_by: user?.id ?? null,
      };
      const { error } = await supabase.from('insurance_option_quotes').insert(row as never);
      if (error) throw new Error(error.message);
      void logActivity('insurance_option_quote.create', 'insurance_option_quotes', input.option.id, {
        label: input.option.label, premium: input.premium, trade_date: input.trade_date,
        benchmark: input.option.benchmark,
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['insurance_option_quotes'] }),
  });
}

// ---- Formatação (exibição pura, sem conversão) ----

export const unitLabel = (b: Benchmark) => (b === 'cbot' ? 'US$ /bushel' : 'R$ /saca');

export const formatStrike = (o: InsuranceOption) =>
  o.benchmark === 'cbot'
    ? o.strike_usd_bushel != null ? `US$ ${o.strike_usd_bushel.toFixed(4)} /bushel` : '—'
    : o.strike_brl_sack != null ? `R$ ${o.strike_brl_sack.toFixed(2)} /saca` : '—';

export const formatPremium = (q: OptionQuote) =>
  q.benchmark === 'cbot'
    ? q.premium_usd_bushel != null ? `US$ ${q.premium_usd_bushel.toFixed(4)} /bushel` : '—'
    : q.premium_brl_sack != null ? `R$ ${q.premium_brl_sack.toFixed(2)} /saca` : '—';

export const formatDateBr = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
};

export const COMMODITY_LABEL: Record<Commodity, string> = { soybean: 'Soja', corn: 'Milho' };
export const BENCHMARK_LABEL: Record<Benchmark, string> = { cbot: 'CBOT', b3: 'B3' };

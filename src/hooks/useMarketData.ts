import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { logActivity } from '@/lib/activityLog';
import type { MarketData } from '@/types';

export function useMarketData() {
  return useQuery({
    queryKey: ['market_data'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('market_data')
        .select('*')
        .order('ticker');
      if (error) throw error;
      return data as unknown as MarketData[];
    },
  });
}

export function getHoursAgo(updatedAt: string): number {
  const now = new Date();
  const updated = new Date(updatedAt);
  return Math.floor((now.getTime() - updated.getTime()) / (1000 * 60 * 60));
}

/**
 * Rótulo relativo de frescor, apenas para exibição. Não bloqueia nada:
 * qualquer trava por cotação velha tem que nascer no backend.
 */
export function formatFreshness(updatedAt: string): { label: string; stale: boolean } {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(updatedAt).getTime()) / 60000));
  const stale = minutes >= 24 * 60;
  if (minutes < 1) return { label: 'agora', stale };
  if (minutes < 60) return { label: `há ${minutes} min`, stale };
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return { label: `há ${hours} h`, stale };
  const days = Math.floor(hours / 24);
  return { label: `há ${days} d`, stale };
}


export function useUpsertMarketData() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (item: {
      ticker: string; commodity: string; price: number | null; currency: string; source: string;
      exchange_rate?: number | null; price_unit?: string | null; exp_date?: string | null;
      raw_price?: number | null; raw_unit?: string | null;
      ndf_spot?: number | null; ndf_estimated?: number | null; ndf_spread?: number | null; ndf_override?: number | null;
    }) => {
      const { error } = await supabase
        .from('market_data')
        .upsert(
          { ...item, date: new Date().toISOString().split('T')[0] },
          { onConflict: 'ticker' }
        );
      if (error) throw error;
      void logActivity('market_data.update', 'market_data', item.ticker, {
        commodity: item.commodity, price: item.price, exchange_rate: item.exchange_rate, source: item.source,
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['market_data'] }),
  });
}

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
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

export function useUpsertMarketData() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (item: { ticker: string; commodity: string; price: number; currency: string; source: string; exchange_rate?: number | null }) => {
      const { error } = await supabase
        .from('market_data')
        .upsert(
          { ...item, date: new Date().toISOString().split('T')[0] },
          { onConflict: 'ticker' }
        );
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['market_data'] }),
  });
}

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { logActivity } from '@/lib/activityLog';
import { callApi } from '@/lib/api';

/** Cotação bruta (uma linha por comprador × data de pagamento). */
export interface PhysicalQuote {
  id: string;
  location_id: string;
  commodity: string;
  reference_date: string;
  buyer: string;
  payment_date: string;
  price_brl_per_sack: number;
  incoterm: string;
  is_pf: boolean;
  is_coop: boolean;
  present_value_brl: number | null;
  interest_rate_used: number | null;
  source: string;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

/** Linha canônica do dia (escrita exclusivamente pela API Python). */
export interface PhysicalDaily {
  id: string;
  location_id: string;
  commodity: string;
  reference_date: string;
  price_brl_per_sack: number;
  winning_quote_id: string;
  interest_rate_used: number | null;
  computed_at: string;
}

/** Shape legado consumido por MTM, Block Trade e card do Cockpit. */
export interface PhysicalPrice {
  id: string;
  warehouse_id: string;
  commodity: string;
  reference_date: string;
  price_brl_per_sack: number;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export function getHoursAgo(date: string): number {
  return Math.floor((Date.now() - new Date(date).getTime()) / 3600000);
}

/** Dias úteis (seg–sex) decorridos desde a data de referência até hoje. */
export function businessDaysSince(iso: string): number {
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const ref = new Date(`${iso.slice(0, 10)}T12:00:00`);
  if (ref >= today) return 0;
  let count = 0;
  const cur = new Date(ref);
  while (cur < today) {
    cur.setDate(cur.getDate() + 1);
    const wd = cur.getDay();
    if (wd !== 0 && wd !== 6) count += 1;
  }
  return count;
}

export function isWeekendISO(iso: string): boolean {
  const wd = new Date(`${iso.slice(0, 10)}T12:00:00`).getDay();
  return wd === 0 || wd === 6;
}

/** Dispara a normalização na API sem bloquear a interface (fire-and-forget). */
export function triggerNormalize(): void {
  void callApi('/physical-prices/normalize', {}).catch(() => {
    /* silencioso: a API pode estar hibernando; o painel recupera na próxima visita */
  });
}

function addDaysISO(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function diffDays(fromISO: string, toISO: string): number {
  const a = new Date(`${fromISO}T12:00:00`).getTime();
  const b = new Date(`${toISO}T12:00:00`).getTime();
  return Math.round((b - a) / 86400000);
}

/** Dias corridos, empurrando para segunda-feira quando cair no fim de semana. */
export function addBusinessSafeDays(iso: string, days: number): string {
  const d = new Date(`${addDaysISO(iso, days)}T12:00:00`);
  const wd = d.getDay();
  if (wd === 6) d.setDate(d.getDate() + 2);
  else if (wd === 0) d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

export { addDaysISO };

async function fetchWarehouseLocations(): Promise<{ id: string; location_id: string | null }[]> {
  const { data, error } = await supabase
    .from('warehouses')
    .select('id, location_id')
    .is('deleted_at', null);
  if (error) throw error;
  return (data ?? []) as { id: string; location_id: string | null }[];
}

/**
 * Último preço canônico por (armazém × commodity), lido de physical_prices_daily.
 * A praça é resolvida internamente via warehouses.location_id.
 * Assinatura e shape preservados para os consumidores existentes.
 */
export function useLatestPhysicalPrices() {
  return useQuery({
    queryKey: ['physical_prices', 'latest'],
    queryFn: async (): Promise<PhysicalPrice[]> => {
      const [warehouses, dailyRes] = await Promise.all([
        fetchWarehouseLocations(),
        supabase
          .from('physical_prices_daily')
          .select('*')
          .order('reference_date', { ascending: false })
          .order('computed_at', { ascending: false }),
      ]);
      if (dailyRes.error) throw dailyRes.error;

      const latestByLoc = new Map<string, PhysicalDaily>();
      for (const row of (dailyRes.data ?? []) as PhysicalDaily[]) {
        const key = `${row.location_id}::${row.commodity}`;
        if (!latestByLoc.has(key)) latestByLoc.set(key, row);
      }

      const out: PhysicalPrice[] = [];
      for (const w of warehouses) {
        if (!w.location_id) continue;
        for (const commodity of ['soybean', 'corn']) {
          const row = latestByLoc.get(`${w.location_id}::${commodity}`);
          if (!row) continue;
          out.push({
            id: row.id,
            warehouse_id: w.id,
            commodity: row.commodity,
            reference_date: row.reference_date,
            price_brl_per_sack: Number(row.price_brl_per_sack),
            notes: null,
            created_by: null,
            created_at: row.computed_at,
            updated_at: row.computed_at,
          });
        }
      }
      return out;
    },
  });
}

export interface PanelRow {
  location_id: string;
  commodity: string;
  reference_date: string;
  price_brl_per_sack: number;
  computed_at: string;
  pending: boolean;
  winning_quote_id: string | null;
}


/** Painel: último preço canônico por praça × commodity + flag de VP em cálculo. */
export function usePhysicalPricePanel() {
  return useQuery({
    queryKey: ['physical_prices', 'panel'],
    queryFn: async (): Promise<PanelRow[]> => {
      const [dailyRes, pendingRes] = await Promise.all([
        supabase
          .from('physical_prices_daily')
          .select('*')
          .order('reference_date', { ascending: false })
          .order('computed_at', { ascending: false }),
        supabase
          .from('physical_prices')
          .select('location_id, commodity, reference_date')
          .is('present_value_brl', null)
          .order('reference_date', { ascending: false })
          .limit(2000),
      ]);
      if (dailyRes.error) throw dailyRes.error;
      if (pendingRes.error) throw pendingRes.error;

      const latest = new Map<string, PhysicalDaily>();
      for (const row of (dailyRes.data ?? []) as PhysicalDaily[]) {
        const key = `${row.location_id}::${row.commodity}`;
        if (!latest.has(key)) latest.set(key, row);
      }

      const pendingMax = new Map<string, string>();
      for (const q of (pendingRes.data ?? []) as { location_id: string; commodity: string; reference_date: string }[]) {
        const key = `${q.location_id}::${q.commodity}`;
        const cur = pendingMax.get(key);
        if (!cur || q.reference_date > cur) pendingMax.set(key, q.reference_date);
      }

      const keys = new Set<string>([...latest.keys(), ...pendingMax.keys()]);
      const rows: PanelRow[] = [];
      for (const key of keys) {
        const [location_id, commodity] = key.split('::');
        const d = latest.get(key);
        const pendingDate = pendingMax.get(key);
        const pending = !!pendingDate && (!d || pendingDate > d.reference_date);
        if (!d) continue;
        rows.push({
          location_id,
          commodity,
          reference_date: d.reference_date,
          price_brl_per_sack: Number(d.price_brl_per_sack),
          computed_at: d.computed_at,
          pending,
          winning_quote_id: d.winning_quote_id ?? null,
        });

      }
      return rows.sort((a, b) => a.location_id.localeCompare(b.location_id) || a.commodity.localeCompare(b.commodity));
    },
  });
}

/** Série diária de uma praça (vencedores do dia). */
export function useDailySeries(locationId: string | null, commodity: string | null, start?: string, end?: string) {
  return useQuery({
    queryKey: ['physical_prices', 'daily-series', locationId, commodity, start ?? null, end ?? null],
    enabled: !!locationId,
    queryFn: async (): Promise<PhysicalDaily[]> => {
      let q = supabase
        .from('physical_prices_daily')
        .select('*')
        .eq('location_id', locationId!)
        .order('reference_date', { ascending: false })
        .limit(500);
      if (commodity) q = q.eq('commodity', commodity);
      if (start) q = q.gte('reference_date', start);
      if (end) q = q.lte('reference_date', end);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as PhysicalDaily[];
    },
  });
}

/** Todas as cotações de uma praça no período. */
export function useQuotes(locationId: string | null, commodity: string | null, start?: string, end?: string) {
  return useQuery({
    queryKey: ['physical_prices', 'quotes', locationId, commodity, start ?? null, end ?? null],
    enabled: !!locationId,
    queryFn: async (): Promise<PhysicalQuote[]> => {
      let q = supabase
        .from('physical_prices')
        .select('*')
        .is('deleted_at', null)
        .eq('location_id', locationId!)
        .order('reference_date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(1000);
      if (commodity) q = q.eq('commodity', commodity);
      if (start) q = q.gte('reference_date', start);
      if (end) q = q.lte('reference_date', end);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as PhysicalQuote[];
    },
  });
}

export interface DayCount {
  total: number;
  byCommodity: Record<string, number>;
}

/** Contagem de cotações por dia (calendário de cobertura), detalhada por commodity. */
export function useQuoteCounts(locationId: string | null, commodity: string | null, start: string, end: string) {
  return useQuery({
    queryKey: ['physical_prices', 'counts', locationId, commodity, start, end],
    enabled: !!locationId,
    queryFn: async (): Promise<Record<string, DayCount>> => {
      let q = supabase
        .from('physical_prices')
        .select('reference_date, commodity')
        .is('deleted_at', null)
        .eq('location_id', locationId!)
        .gte('reference_date', start)
        .lte('reference_date', end)
        .limit(5000);
      if (commodity) q = q.eq('commodity', commodity);
      const { data, error } = await q;
      if (error) throw error;
      const counts: Record<string, DayCount> = {};
      for (const r of (data ?? []) as { reference_date: string; commodity: string }[]) {
        const entry = counts[r.reference_date] ?? { total: 0, byCommodity: {} };
        entry.total += 1;
        entry.byCommodity[r.commodity] = (entry.byCommodity[r.commodity] ?? 0) + 1;
        counts[r.reference_date] = entry;
      }
      return counts;
    },
  });
}

export interface QuoteInput {
  location_id: string;
  commodity: 'soybean' | 'corn';
  reference_date: string;
  buyer: string;
  payment_date: string;
  price_brl_per_sack: number;
  incoterm?: string;
  notes?: string | null;
}

async function currentUserId(): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.id) throw new Error('Sessão expirada. Entre novamente.');
  return user.id;
}

export function useCreateQuote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: QuoteInput) => {
      const updated_by = await currentUserId();
      await callApi('/basis/physical-prices', {
        location_id: input.location_id,
        commodity: input.commodity,
        reference_date: input.reference_date,
        buyer: input.buyer,
        payment_date: input.payment_date,
        price_brl_per_sack: input.price_brl_per_sack,
        incoterm: input.incoterm ?? 'FOB',
        is_pf: false,
        is_coop: false,
        source: 'manual',
        notes: input.notes ?? null,
        updated_by,
      });
      void logActivity('physical_price.quote_created', 'physical_price', null, {
        location_id: input.location_id, commodity: input.commodity,
        reference_date: input.reference_date, buyer: input.buyer,
      });
    },
    onSuccess: () => {
      triggerNormalize();
      void qc.invalidateQueries({ queryKey: ['physical_prices'] });
    },
  });
}

/** Cotações de um dia específico (praça × commodity), para detalhamento. */
export function useQuotesForDay(locationId: string | null, commodity: string | null, referenceDate: string | null) {
  return useQuery({
    queryKey: ['physical_prices', 'quotes-day', locationId, commodity, referenceDate],
    enabled: !!locationId && !!commodity && !!referenceDate,
    queryFn: async (): Promise<PhysicalQuote[]> => {
      const { data, error } = await supabase
        .from('physical_prices')
        .select('*')
        .is('deleted_at', null)
        .eq('location_id', locationId!)
        .eq('commodity', commodity!)
        .eq('reference_date', referenceDate!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as PhysicalQuote[];
    },
  });
}

/** Nomes dos usuários que registraram cotações (id → nome). */
export function useQuoteAuthors(ids: (string | null)[]) {
  const unique = Array.from(new Set(ids.filter((v): v is string => !!v))).sort();
  return useQuery({
    queryKey: ['physical_prices', 'authors', unique.join(',')],
    enabled: unique.length > 0,
    queryFn: async (): Promise<Record<string, string>> => {
      const { data, error } = await supabase
        .from('users')
        .select('id, full_name')
        .in('id', unique);
      if (error) throw error;
      const map: Record<string, string> = {};
      for (const u of (data ?? []) as { id: string; full_name: string }[]) map[u.id] = u.full_name;
      return map;
    },
  });
}


export function useDeleteQuote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const deleted_by = await currentUserId();
      await callApi(`/basis/physical-prices/${id}`, undefined, {
        method: 'DELETE',
        query: { deleted_by },
      });
      void logActivity('physical_price.delete', 'physical_price', id);
    },
    // Exclusão é soft delete: a API já refaz a série diária, sem normalize aqui.
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['physical_prices'] });
    },
  });
}


import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { useTradingLocations } from '@/hooks/useMyLocations';

const COMMODITY_LABEL: Record<string, string> = { soybean: 'Soja', corn: 'Milho' };

interface DailyRow {
  id: string;
  location_id: string;
  commodity: string;
  reference_date: string;
  price_brl_per_sack: number;
  computed_at: string;
}

function useDailyHistory(locationId: string | null, commodity: string | null) {
  return useQuery({
    queryKey: ['physical-daily-history', locationId, commodity],
    queryFn: async (): Promise<DailyRow[]> => {
      let q = supabase
        .from('physical_prices_daily')
        .select('id, location_id, commodity, reference_date, price_brl_per_sack, computed_at')
        .order('reference_date', { ascending: false })
        .limit(1000);
      if (locationId) q = q.eq('location_id', locationId);
      if (commodity) q = q.eq('commodity', commodity);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as DailyRow[];
    },
  });
}

const HistoricoFisico = () => {
  const [locationId, setLocationId] = useState<string>('all');
  const [commodity, setCommodity] = useState<string>('all');
  const { data: locations = [] } = useTradingLocations();
  const { data: rows = [], isLoading } = useDailyHistory(
    locationId === 'all' ? null : locationId,
    commodity === 'all' ? null : commodity,
  );

  const locationName = useMemo(() => {
    const m: Record<string, string> = {};
    locations.forEach((l) => { m[l.id] = l.name; });
    return m;
  }, [locations]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Commodity</label>
          <Select value={commodity} onValueChange={setCommodity}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="soybean">Soja</SelectItem>
              <SelectItem value="corn">Milho</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Praça</label>
          <Select value={locationId} onValueChange={setLocationId}>
            <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {locations.map((l) => (
                <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Histórico de preços físicos canônicos (valor presente)</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : rows.length === 0 ? (
            <p className="text-muted-foreground text-sm">Nenhum registro encontrado.</p>
          ) : (
            <div className="max-h-[560px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data ref.</TableHead>
                    <TableHead>Praça</TableHead>
                    <TableHead>Commodity</TableHead>
                    <TableHead className="text-right">Preço (R$/sc)</TableHead>
                    <TableHead>Calculado em</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>{r.reference_date}</TableCell>
                      <TableCell>{locationName[r.location_id] ?? r.location_id}</TableCell>
                      <TableCell>{COMMODITY_LABEL[r.commodity] ?? r.commodity}</TableCell>
                      <TableCell className="text-right font-mono">
                        R$ {Number(r.price_brl_per_sack).toFixed(2)}
                      </TableCell>
                      <TableCell>{new Date(r.computed_at).toLocaleString('pt-BR')}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default HistoricoFisico;

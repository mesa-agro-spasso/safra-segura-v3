import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { DateInput } from '@/components/ui/date-input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface Filters {
  start: string;
  end: string;
  userEmail: string;
  action: string;
  entityType: string;
  entityId: string;
  detailsQuery: string;
  showStaging: boolean;
}

interface ActivityRow {
  id: string;
  occurred_at: string;
  user_email: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  details: unknown;
  is_staging: boolean;
}

const isoDate = (d: Date) => format(d, 'yyyy-MM-dd');

const defaultFilters = (): Filters => {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - 7);
  return {
    start: isoDate(start),
    end: isoDate(end),
    userEmail: '',
    action: '',
    entityType: '',
    entityId: '',
    detailsQuery: '',
    showStaging: false,
  };
};

export default function ActivityLogTab() {
  const [draft, setDraft] = useState<Filters>(defaultFilters);
  const [applied, setApplied] = useState<Filters>(draft);

  // Per-column client-side refinement
  const [col, setCol] = useState({
    occurred_at: '',
    user_email: '',
    action: '',
    entity_type: '',
    entity_id: '',
    details: '',
  });

  const query = useQuery({
    queryKey: ['activity_log', applied],
    queryFn: async () => {
      const build = () => {
        let q = (supabase.from('activity_log' as any).select('*') as any)
          .gte('occurred_at', `${applied.start}T00:00:00`)
          .lte('occurred_at', `${applied.end}T23:59:59`)
          .order('occurred_at', { ascending: false })
          .limit(1000);
        if (!applied.showStaging) q = q.eq('is_staging', false);
        if (applied.userEmail) q = q.ilike('user_email', `%${applied.userEmail}%`);
        if (applied.action) q = q.ilike('action', `%${applied.action}%`);
        if (applied.entityType) q = q.ilike('entity_type', `%${applied.entityType}%`);
        if (applied.entityId) q = q.ilike('entity_id', `%${applied.entityId}%`);
        return q;
      };

      let detailsServerOk = false;
      if (applied.detailsQuery) {
        const r = await build().filter('details::text', 'ilike', `%${applied.detailsQuery}%`);
        if (!r.error) {
          return { rows: (r.data ?? []) as ActivityRow[], detailsServerOk: true };
        }
      }
      const r = await build();
      if (r.error) throw r.error;
      return { rows: (r.data ?? []) as ActivityRow[], detailsServerOk };
    },
  });

  const allRows: ActivityRow[] = query.data?.rows ?? [];
  const detailsServerOk = query.data?.detailsServerOk ?? false;

  const filteredRows = useMemo(() => {
    const detailFallback =
      applied.detailsQuery && !detailsServerOk ? applied.detailsQuery.toLowerCase() : '';
    return allRows.filter((r) => {
      if (detailFallback && !JSON.stringify(r.details ?? {}).toLowerCase().includes(detailFallback)) {
        return false;
      }
      if (col.occurred_at && !format(new Date(r.occurred_at), 'dd/MM/yyyy HH:mm:ss').toLowerCase().includes(col.occurred_at.toLowerCase())) return false;
      if (col.user_email && !(r.user_email ?? '').toLowerCase().includes(col.user_email.toLowerCase())) return false;
      if (col.action && !r.action.toLowerCase().includes(col.action.toLowerCase())) return false;
      if (col.entity_type && !(r.entity_type ?? '').toLowerCase().includes(col.entity_type.toLowerCase())) return false;
      if (col.entity_id && !(r.entity_id ?? '').toLowerCase().includes(col.entity_id.toLowerCase())) return false;
      if (col.details && !JSON.stringify(r.details ?? {}).toLowerCase().includes(col.details.toLowerCase())) return false;
      return true;
    });
  }, [allRows, col, applied.detailsQuery, detailsServerOk]);

  const apply = () => setApplied(draft);
  const clear = () => {
    const d = defaultFilters();
    setDraft(d);
    setApplied(d);
    setCol({ occurred_at: '', user_email: '', action: '', entity_type: '', entity_id: '', details: '' });
  };

  const set = <K extends keyof Filters>(k: K, v: Filters[K]) =>
    setDraft((prev) => ({ ...prev, [k]: v }));

  return (
    <div className="space-y-4">
      {/* Filtros server-side */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3 p-4 border rounded-md bg-card">
        <div>
          <Label className="text-xs">Data início</Label>
          <DateInput value={draft.start} onChange={(v) => set('start', v)} />
        </div>
        <div>
          <Label className="text-xs">Data fim</Label>
          <DateInput value={draft.end} onChange={(v) => set('end', v)} />
        </div>
        <div>
          <Label className="text-xs">Usuário (email)</Label>
          <Input value={draft.userEmail} onChange={(e) => set('userEmail', e.target.value)} placeholder="ex.: @grupospasso" />
        </div>
        <div>
          <Label className="text-xs">Ação</Label>
          <Input value={draft.action} onChange={(e) => set('action', e.target.value)} placeholder="ex.: auth.login" />
        </div>
        <div>
          <Label className="text-xs">Tipo de entidade</Label>
          <Input value={draft.entityType} onChange={(e) => set('entityType', e.target.value)} placeholder="ex.: user_profile" />
        </div>
        <div>
          <Label className="text-xs">ID da entidade</Label>
          <Input value={draft.entityId} onChange={(e) => set('entityId', e.target.value)} />
        </div>
        <div>
          <Label className="text-xs">Detalhes (JSON)</Label>
          <Input value={draft.detailsQuery} onChange={(e) => set('detailsQuery', e.target.value)} placeholder="busca no JSON" />
        </div>
        <div className="flex flex-col justify-end">
          <div className="flex items-center justify-between border rounded-md px-3 py-2 h-10">
            <span className="text-xs">Mostrar staging</span>
            <Switch checked={draft.showStaging} onCheckedChange={(v) => set('showStaging', v)} />
          </div>
        </div>
        <div className="flex items-end gap-2 md:col-span-3 lg:col-span-4">
          <Button onClick={apply} size="sm">Aplicar</Button>
          <Button onClick={clear} size="sm" variant="outline">Limpar</Button>
          {query.isFetching && <span className="text-xs text-muted-foreground">Carregando…</span>}
          {query.error && <span className="text-xs text-destructive">Erro ao carregar registros</span>}
        </div>
      </div>

      {/* Tabela */}
      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[200px]">
                <div>Quando</div>
                <Input value={col.occurred_at} onChange={(e) => setCol((p) => ({ ...p, occurred_at: e.target.value }))} className="h-7 mt-1" placeholder="filtrar" />
              </TableHead>
              <TableHead>
                <div>Usuário</div>
                <Input value={col.user_email} onChange={(e) => setCol((p) => ({ ...p, user_email: e.target.value }))} className="h-7 mt-1" placeholder="filtrar" />
              </TableHead>
              <TableHead>
                <div>Ação</div>
                <Input value={col.action} onChange={(e) => setCol((p) => ({ ...p, action: e.target.value }))} className="h-7 mt-1" placeholder="filtrar" />
              </TableHead>
              <TableHead>
                <div>Tipo entidade</div>
                <Input value={col.entity_type} onChange={(e) => setCol((p) => ({ ...p, entity_type: e.target.value }))} className="h-7 mt-1" placeholder="filtrar" />
              </TableHead>
              <TableHead>
                <div>ID entidade</div>
                <Input value={col.entity_id} onChange={(e) => setCol((p) => ({ ...p, entity_id: e.target.value }))} className="h-7 mt-1" placeholder="filtrar" />
              </TableHead>
              <TableHead>
                <div>Detalhes</div>
                <Input value={col.details} onChange={(e) => setCol((p) => ({ ...p, details: e.target.value }))} className="h-7 mt-1" placeholder="filtrar" />
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {query.isLoading ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Carregando…</TableCell></TableRow>
            ) : filteredRows.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhum registro encontrado.</TableCell></TableRow>
            ) : (
              filteredRows.map((r) => {
                const detailsStr = JSON.stringify(r.details ?? {});
                const truncated = detailsStr.length > 120 ? detailsStr.slice(0, 120) + '…' : detailsStr;
                return (
                  <TableRow key={r.id}>
                    <TableCell className="text-xs whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        {format(new Date(r.occurred_at), 'dd/MM/yyyy HH:mm:ss')}
                        {applied.showStaging && r.is_staging && (
                          <Badge className="bg-yellow-500 text-black hover:bg-yellow-500/80 text-[9px] px-1 py-0">STAGING</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs">{r.user_email ?? '—'}</TableCell>
                    <TableCell className="text-xs font-mono">{r.action}</TableCell>
                    <TableCell className="text-xs">{r.entity_type ?? '—'}</TableCell>
                    <TableCell className="text-xs font-mono" title={r.entity_id ?? ''}>
                      {r.entity_id ? (r.entity_id.length > 12 ? r.entity_id.slice(0, 8) + '…' : r.entity_id) : '—'}
                    </TableCell>
                    <TableCell className="text-xs">
                      <Popover>
                        <PopoverTrigger asChild>
                          <button type="button" className="text-left font-mono hover:text-foreground text-muted-foreground">
                            <pre className="whitespace-pre-wrap break-all max-w-[400px]">{truncated}</pre>
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[480px] max-h-[400px] overflow-auto">
                          <pre className="text-xs whitespace-pre-wrap break-all">{JSON.stringify(r.details ?? {}, null, 2)}</pre>
                        </PopoverContent>
                      </Popover>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <div className="text-xs text-muted-foreground flex items-center justify-between">
        <span>Mostrando {filteredRows.length} de {allRows.length}</span>
        {allRows.length >= 1000 && (
          <span className="text-yellow-600 dark:text-yellow-500">
            Limite de 1000 atingido — refine os filtros (especialmente datas).
          </span>
        )}
      </div>
    </div>
  );
}

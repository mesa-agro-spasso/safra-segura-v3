import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

import { supabase } from '@/integrations/supabase/client';
import { pgErrorDetail, pgErrorMessage } from '@/lib/pgError';
import { useAuth } from '@/contexts/AuthContext';
import { commodityLabel } from '@/lib/commodityLabel';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const TYPE_LABEL: Record<string, string> = { edit: 'Edição', delete: 'Exclusão', revive: 'Reativação' };

/** Rótulos dos campos da cotação exibidos no antes → depois. */
const FIELD_LABEL: Record<string, string> = {
  price_brl_per_sack: 'Preço (R$/sc)',
  reference_date: 'Data de referência',
  payment_date: 'Pagamento',
  buyer: 'Comprador',
  location_id: 'Praça',
  commodity: 'Commodity',
  incoterm: 'Incoterm',
  is_pf: 'Pessoa física',
  is_coop: 'Cooperativa',
};

interface AlertRow {
  id: string;
  price_id: string | null;
  change_type: string;
  changed_by: string | null;
  created_at: string;
  changes: Record<string, unknown> | null;
}

const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

const fmtValue = (field: string, v: unknown) => {
  if (v === null || v === undefined || v === '') return '—';
  if (typeof v === 'boolean') return v ? 'Sim' : 'Não';
  if (field === 'commodity') return commodityLabel(String(v));
  if (field.endsWith('_date')) return String(v).slice(0, 10).split('-').reverse().join('/');
  if (field === 'price_brl_per_sack') {
    const n = Number(v);
    return Number.isFinite(n) ? n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : String(v);
  }
  return String(v);
};

export function PriceAlertsSection() {
  const { user } = useAuth();
  const [rows, setRows] = useState<AlertRow[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('physical_price_change_alerts')
      .select('id, price_id, change_type, changed_by, created_at, changes')
      .is('acknowledged_at', null)
      .order('created_at', { ascending: false });
    if (error) toast.error(pgErrorMessage(error), { description: pgErrorDetail(error) });

    const list = (data ?? []) as unknown as AlertRow[];
    setRows(list);

    const ids = Array.from(new Set(list.map((r) => r.changed_by).filter(Boolean))) as string[];
    if (ids.length) {
      const { data: users } = await supabase.from('users').select('id, full_name, email').in('id', ids);
      const map: Record<string, string> = {};
      (users ?? []).forEach((u) => { map[u.id] = u.full_name || u.email || u.id; });
      setNames(map);
    }
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  const acknowledge = async (row: AlertRow) => {
    const { error } = await supabase
      .from('physical_price_change_alerts')
      .update({ acknowledged_by: user?.id ?? null, acknowledged_at: new Date().toISOString() })
      .eq('id', row.id);
    if (error) {
      toast.error(pgErrorMessage(error), { description: pgErrorDetail(error) });
      return;
    }
    setRows((prev) => prev.filter((r) => r.id !== row.id));
  };

  const content = useMemo(() => rows.map((row) => {
    const changes = row.changes ?? {};
    const before = changes.before as Record<string, unknown> | undefined;
    const after = changes.after as Record<string, unknown> | undefined;
    const deleted = changes.deleted_row as Record<string, unknown> | undefined;

    const diffs = before && after
      ? Object.keys(FIELD_LABEL).filter((f) => JSON.stringify(before[f] ?? null) !== JSON.stringify(after[f] ?? null))
      : [];

    return (
      <div key={row.id} className="flex items-start justify-between gap-4 rounded-md border p-3">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-[10px] font-normal">
              {TYPE_LABEL[row.change_type] ?? row.change_type}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {fmtDateTime(row.created_at)} · {row.changed_by ? names[row.changed_by] ?? row.changed_by : 'desconhecido'}
            </span>
          </div>

          {deleted && (
            <p className="text-xs text-muted-foreground">
              {[
                String(deleted.location_id ?? '—'),
                commodityLabel(deleted.commodity as string),
                fmtValue('reference_date', deleted.reference_date),
                String(deleted.buyer ?? '—'),
                `R$ ${fmtValue('price_brl_per_sack', deleted.price_brl_per_sack)}`,
              ].join(' · ')}
            </p>
          )}

          {!deleted && diffs.length > 0 && (
            <ul className="space-y-0.5 text-xs text-muted-foreground">
              {diffs.map((f) => (
                <li key={f}>
                  <span className="font-medium text-foreground">{FIELD_LABEL[f]}:</span>{' '}
                  {fmtValue(f, before?.[f])} → {fmtValue(f, after?.[f])}
                </li>
              ))}
            </ul>
          )}

          {!deleted && diffs.length === 0 && (
            <p className="text-xs text-muted-foreground">Sem diferenças de campo registradas.</p>
          )}
        </div>

        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => void acknowledge(row)}>
          Ciente
        </Button>
      </div>
    );
  }), [rows, names]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Alterações de preço físico</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {loading ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma alteração pendente de ciência.</p>
        ) : (
          content
        )}
      </CardContent>
    </Card>
  );
}

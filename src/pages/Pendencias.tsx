import { useEffect, useMemo, useState } from 'react';
import { UserPlus } from 'lucide-react';
import { toast } from 'sonner';

import { supabase } from '@/integrations/supabase/client';
import { logActivity } from '@/lib/activityLog';
import { pgErrorDetail, pgErrorMessage } from '@/lib/pgError';
import { useAuth } from '@/contexts/AuthContext';
import { warehousesLabel } from '@/components/common/WarehouseMultiSelect';
import { PendingTab } from '@/components/cadastros/PendingTab';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface PendingUser {
  id: string;
  email: string | null;
  full_name: string | null;
  job_title: string | null;
  warehouse_ids: string[] | null;
}

function PendingUsersSection() {
  const { user, profile } = useAuth();
  const isAdmin = !!profile?.is_admin;
  const [rows, setRows] = useState<PendingUser[]>([]);
  const [warehouses, setWarehouses] = useState<{ id: string; display_name: string }[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const [{ data: users, error }, { data: whs }] = await Promise.all([
      supabase
        .from('users')
        .select('id, email, full_name, job_title, warehouse_ids')
        .eq('status', 'pending')
        .is('deleted_at', null)
        .eq('is_owner', false),
      supabase.from('warehouses').select('id, display_name').is('deleted_at', null),
    ]);
    if (error) toast.error(pgErrorMessage(error), { description: pgErrorDetail(error) });
    setRows((users ?? []) as PendingUser[]);
    setWarehouses((whs ?? []) as { id: string; display_name: string }[]);
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const nameById = useMemo(() => {
    const m: Record<string, string> = {};
    warehouses.forEach((w) => { m[w.id] = w.display_name; });
    return m;
  }, [warehouses]);

  const approve = async (row: PendingUser) => {
    const { error } = await supabase
      .from('users')
      .update({ status: 'active', approved_at: new Date().toISOString(), approved_by: user?.id ?? null })
      .eq('id', row.id);
    if (error) {
      toast.error(pgErrorMessage(error), { description: pgErrorDetail(error) });
      return;
    }
    void logActivity('user.update', 'user', row.id, { fields: ['status'] });
    toast.success('Usuário aprovado');
    await load();
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <UserPlus className="h-4 w-4" />
          Cadastros de usuários aguardando aprovação
          {rows.length > 0 && <span className="text-sm text-muted-foreground">({rows.length})</span>}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum cadastro de usuário aguardando aprovação.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Cargo</TableHead>
                <TableHead>Unidades</TableHead>
                {isAdmin && <TableHead className="text-right">Ações</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.full_name || r.email || '—'}</TableCell>
                  <TableCell>{r.job_title || '—'}</TableCell>
                  <TableCell>{warehousesLabel(r.warehouse_ids, nameById)}</TableCell>
                  {isAdmin && (
                    <TableCell className="text-right">
                      <Button size="sm" className="h-7 text-xs" onClick={() => void approve(r)}>
                        Aprovar
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

export default function Pendencias() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Pendências</h1>
        <p className="text-sm text-muted-foreground">
          Cadastros incompletos e solicitações de acesso aguardando análise.
        </p>
      </div>

      <PendingUsersSection />

      <div className="space-y-2">
        <h2 className="text-base font-medium">Cadastros incompletos</h2>
        <PendingTab />
      </div>
    </div>
  );
}

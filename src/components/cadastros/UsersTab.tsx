import { useEffect, useMemo, useState } from 'react';
import { Pencil, Search, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';

import { supabase } from '@/integrations/supabase/client';
import { logActivity } from '@/lib/activityLog';
import { pgErrorDetail, pgErrorMessage } from '@/lib/pgError';
import { useAuth } from '@/contexts/AuthContext';
import { WarehouseMultiSelect, warehousesLabel, type WarehouseOption } from '@/components/common/WarehouseMultiSelect';
import { maskPhoneBR } from '@/lib/masks';
import { cn } from '@/lib/utils';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface UserRow {
  id: string;
  email: string | null;
  full_name: string | null;
  job_title: string | null;
  phone: string | null;
  warehouse_ids: string[] | null;
  roles: string[] | null;
  status: string;
  is_admin: boolean;
  created_at: string;
  approved_at: string | null;
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendente',
  active: 'Ativo',
  disabled: 'Desativado',
};

const STATUS_CLASSES: Record<string, string> = {
  pending: 'bg-yellow-500/15 text-yellow-600 dark:text-yellow-400 border-yellow-500/30',
  active: 'bg-green-500/15 text-green-600 dark:text-green-400 border-green-500/30',
  disabled: 'bg-muted text-muted-foreground border-border',
};

const normalize = (v: string) =>
  v.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export function UsersTab() {
  const { user } = useAuth();
  const [warehouses, setWarehouses] = useState<{ id: string; display_name: string; active: boolean }[]>([]);

  const [rows, setRows] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [onlyPending, setOnlyPending] = useState(false);
  const [showDisabled, setShowDisabled] = useState(false);

  const [editing, setEditing] = useState<UserRow | null>(null);
  const [form, setForm] = useState<{ full_name: string; job_title: string; phone: string; warehouse_ids: string[]; is_admin: boolean }>({ full_name: '', job_title: '', phone: '', warehouse_ids: [], is_admin: false });
  const [saving, setSaving] = useState(false);

  const [confirm, setConfirm] = useState<{ row: UserRow; action: 'approve' | 'disable' | 'reject' } | null>(null);

  const warehouseName = useMemo(() => {
    const map: Record<string, string> = {};
    warehouses.forEach((w) => {
      map[w.id] = w.display_name;
    });
    return map;
  }, [warehouses]);

  useEffect(() => {
    void (async () => {
      const { data } = await supabase
        .from('warehouses')
        .select('id, display_name, active')
        .is('deleted_at', null)
        .order('display_name');
      setWarehouses((data ?? []) as { id: string; display_name: string; active: boolean }[]);
    })();
  }, []);

  // Opções do multi-select: unidades ativas + as inativas já vinculadas ao usuário.
  const editOptions: WarehouseOption[] = useMemo(() => {
    const selected = form.warehouse_ids;
    const list: WarehouseOption[] = warehouses
      .filter((w) => w.active || selected.includes(w.id))
      .map((w) => ({ id: w.id, display_name: w.display_name, inactive: !w.active }));
    selected
      .filter((id) => !warehouses.some((w) => w.id === id))
      .forEach((id) => list.push({ id, display_name: id, inactive: true }));
    return list;
  }, [warehouses, form.warehouse_ids]);

  const fetchRows = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('users')
      .select('id, email, full_name, job_title, phone, warehouse_ids, roles, status, is_admin, created_at, approved_at')
      .is('deleted_at', null)
      .eq('is_owner', false);

    if (error) {
      toast.error(pgErrorMessage(error), { description: pgErrorDetail(error) });
      setRows([]);
    } else {
      setRows((data as unknown as UserRow[]) || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    void fetchRows();
  }, []);

  const update = async (id: string, updates: Record<string, unknown>, successMessage: string) => {
    const { error } = await supabase.from('users').update(updates as never).eq('id', id);
    if (error) {
      toast.error(pgErrorMessage(error), { description: pgErrorDetail(error) });
      return false;
    }
    void logActivity('user.update', 'user', id, { fields: Object.keys(updates) });
    toast.success(successMessage);
    await fetchRows();
    return true;
  };

  const handleApprove = (row: UserRow) =>
    update(
      row.id,
      { status: 'active', approved_at: new Date().toISOString(), approved_by: user?.id ?? null },
      'Usuário aprovado',
    );

  const handleDisable = (row: UserRow) => update(row.id, { status: 'disabled' }, 'Usuário desativado');

  const handleReject = (row: UserRow) => update(row.id, { status: 'disabled' }, 'Cadastro recusado');

  const handleReactivate = (row: UserRow) =>
    update(
      row.id,
      { status: 'active', approved_at: new Date().toISOString(), approved_by: user?.id ?? null },
      'Usuário reativado',
    );

  const openEdit = (row: UserRow) => {
    setEditing(row);
    setForm({
      full_name: row.full_name ?? '',
      job_title: row.job_title ?? '',
      phone: row.phone ?? '',
      warehouse_ids: row.warehouse_ids ?? [],
      is_admin: row.is_admin,
    });
  };

  const handleSave = async () => {
    if (!editing) return;
    if (!form.full_name.trim()) {
      toast.error('Preencha o nome completo.');
      return;
    }
    setSaving(true);
    const ok = await update(
      editing.id,
      {
        full_name: form.full_name.trim(),
        job_title: form.job_title.trim() || null,
        phone: form.phone.trim() || null,
        warehouse_ids: form.warehouse_ids.length > 0 ? form.warehouse_ids : null,
        is_admin: form.is_admin,
      },
      'Usuário atualizado',
    );
    setSaving(false);
    if (ok) setEditing(null);
  };

  const filtered = useMemo(() => {
    const q = normalize(search.trim());
    return rows
      .filter((r) => (onlyPending ? r.status === 'pending' : true))
      .filter((r) => (showDisabled ? true : r.status !== 'disabled'))
      .filter((r) => {
        if (!q) return true;
        return [r.full_name, r.email, r.job_title, r.phone].some((v) => v && normalize(String(v)).includes(q));
      })
      .sort((a, b) => {
        const pa = a.status === 'pending' ? 0 : 1;
        const pb = b.status === 'pending' ? 0 : 1;
        if (pa !== pb) return pa - pb;
        return (a.full_name || a.email || '').localeCompare(b.full_name || b.email || '', 'pt-BR');
      });
  }, [rows, search, onlyPending, showDisabled]);

  const unitLabel = (ids: string[] | null) => warehousesLabel(ids, warehouseName);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4">
        <div className="relative max-w-sm flex-1 min-w-[220px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, email, cargo..."
            className="pl-8"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={onlyPending} onCheckedChange={setOnlyPending} />
          Somente pendentes
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={showDisabled} onCheckedChange={setShowDisabled} />
          Mostrar desativados
        </label>
      </div>

      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Cargo</TableHead>
              <TableHead>Unidade</TableHead>
              <TableHead>Telefone</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Admin</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  Carregando...
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  Nenhum usuário encontrado.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.full_name || '—'}</TableCell>
                  <TableCell className="text-muted-foreground">{r.email || '—'}</TableCell>
                  <TableCell>{r.job_title || '—'}</TableCell>
                  <TableCell>{unitLabel(r.warehouse_ids)}</TableCell>
                  <TableCell>{r.phone || '—'}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={cn('text-xs', STATUS_CLASSES[r.status])}>
                      {STATUS_LABELS[r.status] || r.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {r.is_admin ? (
                      <Badge variant="outline" className="text-xs gap-1">
                        <ShieldCheck className="h-3 w-3" /> Admin
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      {r.status === 'pending' && (
                        <Button
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => setConfirm({ row: r, action: 'approve' })}
                        >
                          Aprovar
                        </Button>
                      )}
                      {r.status === 'pending' && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          onClick={() => setConfirm({ row: r, action: 'reject' })}
                        >
                          Recusar
                        </Button>
                      )}
                      {r.status === 'active' && r.id !== user?.id && (
                        <Button
                          size="sm"
                          variant="destructive"
                          className="h-7 text-xs"
                          onClick={() => setConfirm({ row: r, action: 'disable' })}
                        >
                          Desativar
                        </Button>
                      )}
                      {r.status === 'disabled' && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          onClick={() => handleReactivate(r)}
                        >
                          Reativar
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => openEdit(r)}>
                        <Pencil className="h-3.5 w-3.5 mr-1" /> Editar
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar usuário</DialogTitle>
            <DialogDescription>{editing?.email}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="user-name">Nome completo</Label>
              <Input
                id="user-name"
                value={form.full_name}
                onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="user-job">Cargo</Label>
              <Input
                id="user-job"
                value={form.job_title}
                onChange={(e) => setForm((f) => ({ ...f, job_title: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="user-phone">Telefone</Label>
              <Input
                id="user-phone"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: maskPhoneBR(e.target.value) }))}
                placeholder="(00) 00000-0000"
              />
            </div>
            <div className="space-y-2">
              <Label>Unidades</Label>
              <WarehouseMultiSelect
                options={editOptions}
                value={form.warehouse_ids}
                onChange={(next) => setForm((f) => ({ ...f, warehouse_ids: next }))}
              />
            </div>
            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <p className="text-sm font-medium">Administrador</p>
                <p className="text-xs text-muted-foreground">Acesso às telas administrativas.</p>
              </div>
              <Switch
                checked={form.is_admin}
                disabled={editing?.id === user?.id}
                onCheckedChange={(c) => setForm((f) => ({ ...f, is_admin: c }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirm} onOpenChange={(open) => !open && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm?.action === 'approve'
                ? 'Aprovar usuário?'
                : confirm?.action === 'reject'
                  ? 'Recusar cadastro?'
                  : 'Desativar usuário?'}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">
                {confirm?.action === 'approve' ? (
                  <>
                    <p>Confirme os dados informados pelo usuário antes de aprovar o acesso:</p>
                    <ul className="list-disc pl-5 space-y-0.5">
                      <li>
                        <span className="font-medium text-foreground">Nome:</span>{' '}
                        {confirm?.row.full_name || '—'}
                      </li>
                      <li>
                        <span className="font-medium text-foreground">Cargo:</span>{' '}
                        {confirm?.row.job_title || '—'}
                      </li>
                      <li>
                        <span className="font-medium text-foreground">Unidade:</span>{' '}
                        {unitLabel(confirm?.row.warehouse_ids ?? null)}
                      </li>
                    </ul>
                    <p>Email: {confirm?.row.email || '—'}</p>
                  </>
                ) : confirm?.action === 'reject' ? (
                  <>
                    <p>O cadastro será recusado e o usuário ficará desativado. Ele pode ser reativado depois.</p>
                    <ul className="list-disc pl-5 space-y-0.5">
                      <li>
                        <span className="font-medium text-foreground">Nome:</span>{' '}
                        {confirm?.row.full_name || '—'}
                      </li>
                      <li>
                        <span className="font-medium text-foreground">Cargo:</span>{' '}
                        {confirm?.row.job_title || '—'}
                      </li>
                      <li>
                        <span className="font-medium text-foreground">Unidades:</span>{' '}
                        {unitLabel(confirm?.row.warehouse_ids ?? null)}
                      </li>
                    </ul>
                  </>
                ) : (
                  <p>
                    {confirm?.row.full_name || confirm?.row.email} perderá o acesso ao sistema.
                  </p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!confirm) return;
                if (confirm.action === 'approve') void handleApprove(confirm.row);
                else if (confirm.action === 'reject') void handleReject(confirm.row);
                else void handleDisable(confirm.row);
                setConfirm(null);
              }}
            >
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

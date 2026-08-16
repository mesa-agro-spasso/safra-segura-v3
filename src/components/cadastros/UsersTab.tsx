import { useEffect, useMemo, useState } from 'react';
import { Pencil, Search, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';

import { supabase } from '@/integrations/supabase/client';
import { logActivity } from '@/lib/activityLog';
import { pgErrorDetail, pgErrorMessage } from '@/lib/pgError';
import { useAuth } from '@/contexts/AuthContext';
import { useActiveArmazens } from '@/hooks/useWarehouses';
import { maskPhoneBR } from '@/lib/masks';
import { cn } from '@/lib/utils';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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

const SEDE = '__SEDE__';

interface UserRow {
  id: string;
  email: string | null;
  full_name: string | null;
  job_title: string | null;
  phone: string | null;
  warehouse_id: string | null;
  roles: string[] | null;
  status: string;
  is_admin: boolean;
  created_at: string;
  approved_at: string | null;
}

const AVAILABLE_ROLES: { value: string; label: string }[] = [
  { value: 'mesa', label: 'Mesa' },
  { value: 'comercial_n1', label: 'Comercial N1' },
  { value: 'comercial_n2', label: 'Comercial N2' },
  { value: 'financeiro_n1', label: 'Financeiro N1' },
  { value: 'financeiro_n2', label: 'Financeiro N2' },
  { value: 'presidencia', label: 'Presidência' },
];

const ROLE_COLORS: Record<string, string> = {
  mesa: 'bg-blue-500 text-white hover:bg-blue-500/80',
  comercial_n1: 'bg-orange-400 text-white hover:bg-orange-400/80',
  comercial_n2: 'bg-orange-600 text-white hover:bg-orange-600/80',
  financeiro_n1: 'bg-purple-400 text-white hover:bg-purple-400/80',
  financeiro_n2: 'bg-purple-600 text-white hover:bg-purple-600/80',
  presidencia: 'bg-amber-500 text-white hover:bg-amber-500/80',
};

const ROLE_LABEL_BY_VALUE: Record<string, string> = AVAILABLE_ROLES.reduce(
  (acc, r) => ({ ...acc, [r.value]: r.label }),
  {} as Record<string, string>,
);

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

interface RolesEditorProps {
  userId: string;
  roles: string[];
  onSave: (userId: string, newRoles: string[]) => Promise<void>;
}

const RolesEditor = ({ userId, roles, onSave }: RolesEditorProps) => {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>(roles);

  useEffect(() => {
    setSelected(roles);
  }, [roles]);

  const trigger = (
    <div className="flex flex-wrap gap-1 min-h-[24px] items-center">
      {roles.length === 0 ? (
        <span className="text-muted-foreground">—</span>
      ) : (
        roles.map((r) => (
          <Badge key={r} className={cn('text-xs border-transparent', ROLE_COLORS[r] || 'bg-muted text-foreground')}>
            {ROLE_LABEL_BY_VALUE[r] || r}
          </Badge>
        ))
      )}
    </div>
  );

  const toggle = (value: string, checked: boolean) => {
    setSelected((prev) => (checked ? [...prev, value] : prev.filter((v) => v !== value)));
  };

  const handleOpenChange = async (next: boolean) => {
    setOpen(next);
    if (!next) {
      const a = [...roles].sort().join(',');
      const b = [...selected].sort().join(',');
      if (a !== b) await onSave(userId, selected);
    }
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button type="button" className="cursor-pointer text-left w-full">
          {trigger}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-2" align="start">
        <div className="space-y-1">
          {AVAILABLE_ROLES.map((r) => (
            <label
              key={r.value}
              className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer text-sm"
            >
              <Checkbox
                checked={selected.includes(r.value)}
                onCheckedChange={(c) => toggle(r.value, c === true)}
              />
              <span>{r.label}</span>
            </label>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export function UsersTab() {
  const { user } = useAuth();
  const { data: armazens = [] } = useActiveArmazens();

  const [rows, setRows] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [onlyPending, setOnlyPending] = useState(false);

  const [editing, setEditing] = useState<UserRow | null>(null);
  const [form, setForm] = useState({ full_name: '', job_title: '', phone: '', unit: SEDE, is_admin: false });
  const [saving, setSaving] = useState(false);

  const [confirm, setConfirm] = useState<{ row: UserRow; action: 'approve' | 'disable' } | null>(null);

  const warehouseName = useMemo(() => {
    const map: Record<string, string> = {};
    armazens.forEach((w) => {
      map[w.id] = w.display_name;
    });
    return map;
  }, [armazens]);

  const fetchRows = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('users')
      .select('id, email, full_name, job_title, phone, warehouse_id, roles, status, is_admin, created_at, approved_at')
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

  const handleReactivate = (row: UserRow) =>
    update(
      row.id,
      { status: 'active', approved_at: new Date().toISOString(), approved_by: user?.id ?? null },
      'Usuário reativado',
    );

  const handleUpdateRoles = async (userId: string, newRoles: string[]) => {
    const { error } = await supabase.from('users').update({ roles: newRoles }).eq('id', userId);
    if (error) {
      toast.error(pgErrorMessage(error), { description: pgErrorDetail(error) });
      return;
    }
    void logActivity('user_roles.update', 'user', userId, { roles: newRoles });
    setRows((prev) => prev.map((r) => (r.id === userId ? { ...r, roles: newRoles } : r)));
    toast.success('Função atualizada');
  };

  const openEdit = (row: UserRow) => {
    setEditing(row);
    setForm({
      full_name: row.full_name ?? '',
      job_title: row.job_title ?? '',
      phone: row.phone ?? '',
      unit: row.warehouse_id || SEDE,
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
        warehouse_id: form.unit === SEDE ? null : form.unit,
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
  }, [rows, search, onlyPending]);

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
              <TableHead>Função</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Admin</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                  Carregando...
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                  Nenhum usuário encontrado.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.full_name || '—'}</TableCell>
                  <TableCell className="text-muted-foreground">{r.email || '—'}</TableCell>
                  <TableCell>{r.job_title || '—'}</TableCell>
                  <TableCell>{r.warehouse_id ? warehouseName[r.warehouse_id] || r.warehouse_id : 'Sede'}</TableCell>
                  <TableCell>{r.phone || '—'}</TableCell>
                  <TableCell>
                    <RolesEditor userId={r.id} roles={r.roles || []} onSave={handleUpdateRoles} />
                  </TableCell>
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
              <Label htmlFor="user-unit">Unidade</Label>
              <Select value={form.unit} onValueChange={(v) => setForm((f) => ({ ...f, unit: v }))}>
                <SelectTrigger id="user-unit">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={SEDE}>Sede</SelectItem>
                  {armazens.map((w) => (
                    <SelectItem key={w.id} value={w.id}>
                      {w.display_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
              {confirm?.action === 'approve' ? 'Aprovar usuário?' : 'Desativar usuário?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm?.action === 'approve'
                ? `${confirm?.row.full_name || confirm?.row.email} passará a ter acesso ao sistema.`
                : `${confirm?.row.full_name || confirm?.row.email} perderá o acesso ao sistema.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!confirm) return;
                if (confirm.action === 'approve') void handleApprove(confirm.row);
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

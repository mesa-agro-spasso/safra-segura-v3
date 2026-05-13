import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { logActivity } from '@/lib/activityLog';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import type { UserProfile } from '@/types';

const statusLabels: Record<string, string> = {
  pending: 'Pendente',
  active: 'Ativo',
  disabled: 'Desativado',
};

const statusVariants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  pending: 'outline',
  active: 'default',
  disabled: 'destructive',
};

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

interface RolesEditorProps {
  userId: string;
  roles: string[];
  canEdit: boolean;
  onSave: (userId: string, newRoles: string[]) => Promise<void>;
}

const RolesEditor = ({ userId, roles, canEdit, onSave }: RolesEditorProps) => {
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
          <Badge
            key={r}
            className={cn('text-xs border-transparent', ROLE_COLORS[r] || 'bg-muted text-foreground')}
          >
            {ROLE_LABEL_BY_VALUE[r] || r}
          </Badge>
        ))
      )}
    </div>
  );

  if (!canEdit) {
    return trigger;
  }

  const toggle = (value: string, checked: boolean) => {
    setSelected((prev) => (checked ? [...prev, value] : prev.filter((v) => v !== value)));
  };

  const handleOpenChange = async (next: boolean) => {
    setOpen(next);
    if (!next) {
      const sortedA = [...roles].sort().join(',');
      const sortedB = [...selected].sort().join(',');
      if (sortedA !== sortedB) {
        await onSave(userId, selected);
      }
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
          {AVAILABLE_ROLES.map((r) => {
            const checked = selected.includes(r.value);
            return (
              <label
                key={r.value}
                className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer text-sm"
              >
                <Checkbox
                  checked={checked}
                  onCheckedChange={(c) => toggle(r.value, c === true)}
                />
                <span>{r.label}</span>
              </label>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
};

const AdminUsers = () => {
  const { user, profile } = useAuth();
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [rolesMap, setRolesMap] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const canEditRoles = !!profile?.is_admin;

  const fetchProfiles = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      toast.error('Erro ao carregar usuários');
    } else {
      setProfiles((data as UserProfile[]) || []);
    }

    const { data: userRoles, error: rolesError } = await supabase
      .from('users')
      .select('id, roles');

    if (rolesError) {
      setRolesMap({});
    } else {
      const map: Record<string, string[]> = {};
      (userRoles || []).forEach((u: { id: string; roles: string[] | null }) => {
        map[u.id] = u.roles || [];
      });
      setRolesMap(map);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchProfiles();
  }, []);

  const updateProfile = async (id: string, updates: Record<string, unknown>) => {
    try {
      const { error } = await supabase
        .from('user_profiles')
        .update(updates as never)
        .eq('id', id);

      if (error) {
        toast.error('Erro ao atualizar usuário: ' + error.message);
        return false;
      }
      void logActivity('user_profile.update', 'user_profile', id, { fields: Object.keys(updates) });
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido';
      toast.error('Erro ao atualizar: ' + msg);
      return false;
    }
  };

  const handleUpdateRoles = async (userId: string, newRoles: string[]) => {
    const { error } = await supabase
      .from('users')
      .update({ roles: newRoles })
      .eq('id', userId);

    if (error) {
      toast.error('Erro ao atualizar função: ' + error.message);
      return;
    }
    void logActivity('user_roles.update', 'user', userId, { roles: newRoles });
    setRolesMap((prev) => ({ ...prev, [userId]: newRoles }));
    toast.success('Função atualizada');
  };

  const handleApprove = async (id: string) => {
    const ok = await updateProfile(id, {
      status: 'active',
      approved_at: new Date().toISOString(),
      approved_by: user?.id,
    });
    if (ok) {
      toast.success('Usuário aprovado');
      fetchProfiles();
    }
  };

  const handleDisable = async (id: string) => {
    const ok = await updateProfile(id, { status: 'disabled' });
    if (ok) {
      toast.success('Usuário desativado');
      fetchProfiles();
    }
  };

  const handleReactivate = async (id: string) => {
    const ok = await updateProfile(id, {
      status: 'active',
      approved_at: new Date().toISOString(),
      approved_by: user?.id,
    });
    if (ok) {
      toast.success('Usuário reativado');
      fetchProfiles();
    }
  };

  const handleToggleAdmin = async (id: string, currentValue: boolean) => {
    const ok = await updateProfile(id, { is_admin: !currentValue });
    if (ok) {
      toast.success(!currentValue ? 'Admin concedido' : 'Admin removido');
      fetchProfiles();
    }
  };

  const handleChangeAccessLevel = async (id: string, level: 'limited' | 'full') => {
    const ok = await updateProfile(id, { access_level: level });
    if (ok) {
      toast.success('Nível de acesso alterado');
      fetchProfiles();
    }
  };

  const filtered = profiles.filter((p) => {
    const matchSearch =
      !search ||
      (p.full_name || '').toLowerCase().includes(search.toLowerCase()) ||
      p.email.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || p.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Administração de Usuários</h2>
        <p className="text-sm text-muted-foreground">Gerencie acessos e permissões do sistema.</p>
      </div>

      <div className="flex gap-4 items-center">
        <Input
          placeholder="Buscar por nome ou email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Filtrar status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="pending">Pendente</SelectItem>
            <SelectItem value="active">Ativo</SelectItem>
            <SelectItem value="disabled">Desativado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Acesso</TableHead>
              <TableHead>Função</TableHead>
              <TableHead>Admin</TableHead>
              <TableHead>Criado em</TableHead>
              <TableHead>Aprovado em</TableHead>
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
              filtered.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.full_name || p.email}</TableCell>
                  <TableCell className="text-muted-foreground">{p.email}</TableCell>
                  <TableCell>
                    <Badge variant={statusVariants[p.status] || 'outline'}>
                      {statusLabels[p.status] || p.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Select
                      value={p.access_level}
                      onValueChange={(val) => handleChangeAccessLevel(p.id, val as 'limited' | 'full')}
                    >
                      <SelectTrigger className="w-24 h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="limited">Limited</SelectItem>
                        <SelectItem value="full">Full</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <RolesEditor
                      userId={p.id}
                      roles={rolesMap[p.id] || []}
                      canEdit={canEditRoles}
                      onSave={handleUpdateRoles}
                    />
                  </TableCell>
                  <TableCell>
                    <Button
                      variant={p.is_admin ? 'default' : 'outline'}
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => handleToggleAdmin(p.id, p.is_admin)}
                      disabled={p.id === user?.id}
                    >
                      {p.is_admin ? 'Sim' : 'Não'}
                    </Button>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {format(new Date(p.created_at), 'dd/MM/yyyy')}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {p.approved_at ? format(new Date(p.approved_at), 'dd/MM/yyyy') : '—'}
                  </TableCell>
                  <TableCell className="text-right">
                    {p.status === 'pending' && (
                      <Button size="sm" className="h-7 text-xs" onClick={() => handleApprove(p.id)}>
                        Aprovar
                      </Button>
                    )}
                    {p.status === 'active' && p.id !== user?.id && (
                      <Button size="sm" variant="destructive" className="h-7 text-xs" onClick={() => handleDisable(p.id)}>
                        Desativar
                      </Button>
                    )}
                    {p.status === 'disabled' && (
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleReactivate(p.id)}>
                        Reativar
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default AdminUsers;

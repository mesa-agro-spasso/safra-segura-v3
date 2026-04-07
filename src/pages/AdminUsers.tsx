import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { format } from 'date-fns';
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

const AdminUsers = () => {
  const { user } = useAuth();
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

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
    setLoading(false);
  };

  useEffect(() => {
    fetchProfiles();
  }, []);

  const updateProfile = async (id: string, updates: Partial<UserProfile>) => {
    const { error } = await supabase
      .from('user_profiles')
      .update(updates)
      .eq('id', id);

    if (error) {
      toast.error('Erro ao atualizar usuário: ' + error.message);
      return false;
    }
    return true;
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

  const handleChangeAccessLevel = async (id: string, level: string) => {
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
              <TableHead>Admin</TableHead>
              <TableHead>Criado em</TableHead>
              <TableHead>Aprovado em</TableHead>
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
                      onValueChange={(val) => handleChangeAccessLevel(p.id, val)}
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

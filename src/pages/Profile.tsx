import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';

const ROLE_LABELS: Record<string, string> = {
  mesa: 'Mesa',
  comercial_n1: 'Comercial N1',
  comercial_n2: 'Comercial N2',
  admin: 'Admin',
};

const formatRole = (r: string) =>
  ROLE_LABELS[r] ?? r.charAt(0).toUpperCase() + r.slice(1).replace(/_/g, ' ');

const Profile = () => {
  const { user, profile, refreshProfile } = useAuth();

  const [theme, setTheme] = useState<'dark' | 'light'>(profile?.theme ?? 'dark');
  const [savingTheme, setSavingTheme] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    if (profile?.theme) setTheme(profile.theme);
  }, [profile]);

  const { data: rolesData } = useQuery({
    queryKey: ['current-user-roles', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await (supabase.from('users') as any)
        .select('roles')
        .eq('id', user!.id)
        .maybeSingle();
      const r = data?.roles;
      return Array.isArray(r) ? (r as string[]) : [];
    },
  });

  const roles = Array.isArray(rolesData) ? rolesData : [];

  const handleToggleTheme = async (checked: boolean) => {
    if (!user) return;
    const newTheme: 'dark' | 'light' = checked ? 'dark' : 'light';
    setTheme(newTheme);
    document.documentElement.classList.toggle('dark', newTheme === 'dark');
    setSavingTheme(true);
    try {
      // Regra do banco: não-admin só pode atualizar a coluna `theme` da própria linha.
      const { error } = await (supabase.from('users') as any)
        .update({ theme: newTheme })
        .eq('id', user.id);
      if (error) throw error;
      await refreshProfile();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao salvar tema';
      toast.error(message);
    } finally {
      setSavingTheme(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword) {
      toast.error('Informe a senha atual');
      return;
    }
    if (newPassword.length < 6) {
      toast.error('A nova senha deve ter pelo menos 6 caracteres');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('As senhas não coincidem');
      return;
    }
    setSavingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast.success('Senha alterada com sucesso');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao alterar senha';
      toast.error(message);
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div className="container max-w-3xl mx-auto py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Meu perfil</h1>
        <p className="text-sm text-muted-foreground">Gerencie suas informações, preferências e segurança.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Informações pessoais</CardTitle>
          <CardDescription>Seu nome aparece em ordens, aprovações e logs.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="full-name">Nome completo</Label>
            <Input id="full-name" value={profile?.full_name ?? ''} readOnly disabled />
            <p className="text-xs text-muted-foreground">
              Para alterar seu nome, peça a um administrador.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="job-title">Cargo</Label>
            <Input id="job-title" value={profile?.job_title ?? '—'} readOnly disabled />
          </div>


          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" value={user?.email ?? ''} readOnly disabled />
          </div>

          <div className="space-y-2">
            <Label>Funções</Label>
            <div className="flex flex-wrap gap-2 pt-1">
              {roles.length === 0 ? (
                <span className="text-sm text-muted-foreground">Nenhuma função atribuída</span>
              ) : (
                roles.map((r) => (
                  <Badge key={r} variant="secondary">
                    {formatRole(r)}
                  </Badge>
                ))
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Preferências</CardTitle>
          <CardDescription>Personalize a aparência da aplicação.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="theme-toggle" className="text-sm">Tema escuro</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Desative para usar o tema claro.
              </p>
            </div>
            <Switch
              id="theme-toggle"
              checked={theme === 'dark'}
              onCheckedChange={handleToggleTheme}
              disabled={savingTheme}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Segurança</CardTitle>
          <CardDescription>Altere sua senha de acesso.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="current-password">Senha atual</Label>
              <Input
                id="current-password"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-password">Nova senha</Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-new-password">Confirmar nova senha</Label>
              <Input
                id="confirm-new-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>
            <Button type="submit" disabled={savingPassword}>
              {savingPassword ? 'Alterando...' : 'Alterar senha'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default Profile;

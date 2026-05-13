import { Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { getMesaEnv, setMesaEnv } from '@/integrations/supabase/client';

const PendingApproval = () => {
  const { user, profile, refreshProfile, signOut } = useAuth();
  const navigate = useNavigate();

  const handleRefresh = async () => {
    await refreshProfile();
    if (profile?.status === 'active') {
      toast.success('Acesso liberado!');
      navigate('/');
    } else {
      toast.info('Seu acesso ainda está em análise.');
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md border-border text-center">
        <CardHeader>
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
            <Clock className="h-8 w-8 text-muted-foreground" />
          </div>
          <CardTitle className="text-xl">Cadastro em análise</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Olá, <strong>{profile?.full_name || user?.email || 'usuário'}</strong>.
            Seu cadastro foi recebido e está aguardando aprovação de um administrador.
          </p>
          <div className="flex flex-col gap-2">
            <Button onClick={handleRefresh} variant="outline">
              Verificar status
            </Button>
            {getMesaEnv() === 'staging' && (
              <Button
                onClick={() => { setMesaEnv('production'); window.location.reload(); }}
                variant="outline"
                className="border-yellow-500 text-yellow-600"
              >
                Sair do modo Teste
              </Button>
            )}
            <Button onClick={handleSignOut} variant="ghost" className="text-muted-foreground">
              Sair
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PendingApproval;

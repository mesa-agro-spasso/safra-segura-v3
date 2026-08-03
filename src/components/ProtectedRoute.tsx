import { Navigate } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, profile, profileError, loading, isPasswordRecovery, refreshProfile, signOut } = useAuth();

  if (isPasswordRecovery) {
    return <>{children}</>;
  }

  if (loading && (!user || !profile)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Technical failure loading profile → show error screen, not "pending approval"
  if (profileError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md border-border text-center">
          <CardHeader>
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
              <AlertTriangle className="h-8 w-8 text-destructive" />
            </div>
            <CardTitle className="text-xl">Falha ao carregar perfil</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Não foi possível verificar seu cadastro por um problema técnico.
              Tente novamente em alguns instantes.
            </p>
            <div className="flex flex-col gap-2">
              <Button onClick={() => void refreshProfile()} variant="outline">
                Tentar novamente
              </Button>
              <Button onClick={() => void signOut()} variant="ghost" className="text-muted-foreground">
                Sair
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Profile not found or pending → waiting for approval
  if (!profile || profile.status === 'pending') {
    return <Navigate to="/aguardando-aprovacao" replace />;
  }

  // Disabled account
  if (profile.status === 'disabled') {
    return <Navigate to="/acesso-desativado" replace />;
  }

  return <>{children}</>;
};

import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

export const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
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

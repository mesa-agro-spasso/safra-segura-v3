import { Navigate } from 'react-router-dom';
import { useAuthorization } from '@/hooks/useAuthorization';

export const AdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAdmin } = useAuthorization();

  if (!isAdmin()) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

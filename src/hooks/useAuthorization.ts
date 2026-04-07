import { useAuth } from '@/contexts/AuthContext';

export function useAuthorization() {
  const { profile } = useAuth();

  return {
    isAdmin: () => profile?.is_admin === true && profile?.status === 'active',
    isActive: () => profile?.status === 'active',
    hasAccessLevel: (level: string) => profile?.access_level === level,
    canAccess: () => profile?.status === 'active',
  };
}

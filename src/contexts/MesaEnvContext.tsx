import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { toast } from 'sonner';
import { setMesaEnv as setMesaEnvLegacy } from '@/integrations/supabase/client';
import {
  getCurrentEnv,
  onEnvChange,
  readAdminToggle,
  type EnvState,
  type MesaEnv,
} from '@/lib/envState';
import { useAuth } from '@/contexts/AuthContext';

interface Ctx {
  env: EnvState;
  isStaging: boolean;
  isPending: boolean;
  isLocked: boolean; // user has forced_env — toggle is disabled
  setEnv: (env: MesaEnv) => void;
  toggle: () => void;
}

const MesaEnvContext = createContext<Ctx | null>(null);

export function MesaEnvProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth();
  const [env, setEnvState] = useState<EnvState>(getCurrentEnv());

  useEffect(() => {
    // Subscribe to env transitions emitted by envState.
    const unsubscribe = onEnvChange((next, reason) => {
      setEnvState(next);
      // Admin toggle: full reload to wipe React Query cache + any in-flight
      // queries. This preserves the historical guarantee that the toggle
      // never contaminates the next env.
      if (reason === 'admin-toggle') {
        window.location.reload();
      }
    });
    return unsubscribe;
  }, []);

  const isLocked = profile?.forced_env === 'staging';

  const setEnv = (next: MesaEnv) => {
    if (isLocked) {
      toast.error('Ambiente travado para este usuário.');
      return;
    }
    setMesaEnvLegacy(next);
  };

  const toggle = () => {
    if (isLocked) {
      toast.error('Ambiente travado para este usuário.');
      return;
    }
    const currentToggle = readAdminToggle();
    setMesaEnvLegacy(currentToggle === 'staging' ? 'production' : 'staging');
  };

  return (
    <MesaEnvContext.Provider
      value={{
        env,
        isStaging: env === 'staging',
        isPending: env === 'pending',
        isLocked,
        setEnv,
        toggle,
      }}
    >
      {children}
    </MesaEnvContext.Provider>
  );
}

export const useMesaEnv = () => {
  const ctx = useContext(MesaEnvContext);
  if (!ctx) throw new Error('useMesaEnv must be used within MesaEnvProvider');
  return ctx;
};

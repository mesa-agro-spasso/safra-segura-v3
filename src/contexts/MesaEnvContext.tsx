import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getMesaEnv, setMesaEnv as setEnvLS, type MesaEnv } from '@/integrations/supabase/client';

interface Ctx {
  env: MesaEnv;
  isStaging: boolean;
  setEnv: (env: MesaEnv) => void;
  toggle: () => void;
}

const MesaEnvContext = createContext<Ctx | null>(null);

export function MesaEnvProvider({ children }: { children: ReactNode }) {
  const [env, setEnvState] = useState<MesaEnv>(getMesaEnv());
  const queryClient = useQueryClient();

  useEffect(() => {
    const handler = (e: Event) => {
      const next = (e as CustomEvent<MesaEnv>).detail ?? getMesaEnv();
      setEnvState(next);
      queryClient.clear();
    };
    window.addEventListener('mesa-env-change', handler);
    return () => window.removeEventListener('mesa-env-change', handler);
  }, [queryClient]);

  const setEnv = (next: MesaEnv) => setEnvLS(next);
  const toggle = () => setEnvLS(env === 'staging' ? 'production' : 'staging');

  return (
    <MesaEnvContext.Provider value={{ env, isStaging: env === 'staging', setEnv, toggle }}>
      {children}
    </MesaEnvContext.Provider>
  );
}

export const useMesaEnv = () => {
  const ctx = useContext(MesaEnvContext);
  if (!ctx) throw new Error('useMesaEnv must be used within MesaEnvProvider');
  return ctx;
};

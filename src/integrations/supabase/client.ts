// Single Supabase project, two schemas: public (production) and staging.
// We keep ONE underlying client and route data calls through `.schema()`
// based on localStorage.mesa_env. Auth, edge functions, storage, realtime
// always use the canonical client (single session shared by both envs).
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = "https://ngwhatepvofvwgzbudth.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5nd2hhdGVwdm9mdndnemJ1ZHRoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwNDA2NzgsImV4cCI6MjA5MDYxNjY3OH0.t6_qd3X3_DyNWlkHg2Yp26GHQu2EiQgKk8_x7hBXz_o";

export type MesaEnv = 'production' | 'staging';

export const getMesaEnv = (): MesaEnv =>
  typeof window !== 'undefined' && localStorage.getItem('mesa_env') === 'staging'
    ? 'staging'
    : 'production';

export const setMesaEnv = (env: MesaEnv) => {
  if (env === 'staging') localStorage.setItem('mesa_env', 'staging');
  else localStorage.removeItem('mesa_env');
  window.dispatchEvent(new CustomEvent('mesa-env-change', { detail: env }));
};

export const isStagingEnv = () => getMesaEnv() === 'staging';

const baseClient: SupabaseClient<Database> = createClient<Database>(
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  {
    auth: {
      storage: localStorage,
      persistSession: true,
      autoRefreshToken: true,
    },
  },
);

// Always-production client (ignores mesa_env). Use for auth/profile/authorization
// reads, since auth.users is shared across both schemas.
export const supabasePublic: SupabaseClient<Database> = baseClient;

// Routes data calls (`.from`, `.rpc`, `.schema`) through the schema matching
// the current env. Everything else (auth, functions, storage, realtime,
// channel, etc.) uses the underlying client directly.
const DATA_PROPS = new Set(['from', 'rpc', 'schema']);

export const supabase: SupabaseClient<Database> = new Proxy(baseClient, {
  get(target, prop, receiver) {
    if (typeof prop === 'string' && DATA_PROPS.has(prop)) {
      const env = getMesaEnv();
      if (env === 'staging') {
        const scoped = (target as any).schema('staging');
        const value = (scoped as any)[prop];
        return typeof value === 'function' ? value.bind(scoped) : value;
      }
    }
    const value = Reflect.get(target, prop, receiver);
    return typeof value === 'function' ? value.bind(target) : value;
  },
}) as SupabaseClient<Database>;

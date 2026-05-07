// Single Supabase client. Schema is selected dynamically via mesa_env.
// Production = 'public', Staging = 'staging' (same project, different schema).
import { createClient } from '@supabase/supabase-js';
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

const schemaFor = (env: MesaEnv) => (env === 'staging' ? 'staging' : 'public');

// One auth-enabled client (handles login/session) on the public schema.
// Used for `supabase.auth.*` and as the default for prod data.
export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  },
});

// Separate client for the staging schema. Shares the same auth storage key
// so the user is logged in for both, but uses a different schema for queries.
const stagingClient = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
    storageKey: `sb-${new URL(SUPABASE_URL).hostname.split('.')[0]}-auth-token`,
  },
  db: { schema: 'staging' as never },
});

// Returns the data client for the current env. Auth always uses `supabase`.
export const getDb = () => (getMesaEnv() === 'staging' ? stagingClient : supabase);

// Convenience: same as getDb() but resolved at call time. Use this in hooks
// that need to react to env changes (combine with the env from useMesaEnv()
// in queryKeys to trigger refetch).
export const db = new Proxy({} as typeof supabase, {
  get(_t, prop) {
    return (getDb() as any)[prop];
  },
});

export const STAGING_SCHEMA = 'staging';
export const isStagingEnv = () => getMesaEnv() === 'staging';

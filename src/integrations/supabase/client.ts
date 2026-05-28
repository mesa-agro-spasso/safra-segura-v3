// Single Supabase project, two schemas: public (production) and staging.
// We keep ONE underlying client and route data calls through `.schema()`
// based on the active env in `src/lib/envState.ts`. Auth, edge functions,
// storage and realtime always use the canonical client (single session shared
// by both envs).
//
// The env is derived from the logged-in user's profile (see envState.ts),
// NOT from localStorage directly. localStorage only holds the admin toggle
// preference, which is one of the inputs to the resolution.
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './types';
import {
  getCurrentEnv,
  readAdminToggle,
  writeAdminToggle,
  setCurrentEnv,
  type MesaEnv,
} from '@/lib/envState';

const SUPABASE_URL = "https://ngwhatepvofvwgzbudth.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5nd2hhdGVwdm9mdndnemJ1ZHRoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwNDA2NzgsImV4cCI6MjA5MDYxNjY3OH0.t6_qd3X3_DyNWlkHg2Yp26GHQu2EiQgKk8_x7hBXz_o";

export type { MesaEnv };

// Legacy facade: read the admin toggle preference (NOT the active env).
// Kept for backward compat with components that only care about the toggle
// (e.g. PendingApproval's "leave test mode" button).
export const getMesaEnv = (): MesaEnv => readAdminToggle();

export const setMesaEnv = (env: MesaEnv): void => {
  writeAdminToggle(env);
  // Apply to the active env ref and notify listeners (admin-toggle reason
  // triggers a full reload via MesaEnvContext to clear React Query cache).
  setCurrentEnv(env, 'admin-toggle');
};

export const isStagingEnv = (): boolean => getCurrentEnv() === 'staging';

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

// Always-production client (ignores active env). Use for auth/profile/authorization
// reads, since auth.users is shared across both schemas.
export const supabasePublic: SupabaseClient<Database> = baseClient;

// Routes data calls (`.from`, `.rpc`, `.schema`) through the schema matching
// the active env. Everything else (auth, functions, storage, realtime,
// channel, etc.) uses the underlying client directly.
//
// If env === 'pending' (boot before profile resolved), data calls THROW.
// ProtectedRoute prevents this from happening in normal flow; the throw is
// defense in depth — surfaces escapes loudly instead of leaking production.
const DATA_PROPS = new Set(['from', 'rpc', 'schema']);

export const supabase: SupabaseClient<Database> = new Proxy(baseClient, {
  get(target, prop, receiver) {
    if (typeof prop === 'string' && DATA_PROPS.has(prop)) {
      const env = getCurrentEnv();
      if (env === 'pending') {
        throw new Error(
          `[supabase] Data call '${prop}' attempted before env was resolved from profile. ` +
          `This is a bug — ensure the call is inside ProtectedRoute (after profile load).`,
        );
      }
      if (env === 'staging') {
        const scoped = (target as unknown as { schema: (s: string) => unknown }).schema('staging');
        const value = (scoped as Record<string, unknown>)[prop];
        return typeof value === 'function' ? (value as (...args: unknown[]) => unknown).bind(scoped) : value;
      }
    }
    const value = Reflect.get(target, prop, receiver);
    return typeof value === 'function' ? value.bind(target) : value;
  },
}) as SupabaseClient<Database>;

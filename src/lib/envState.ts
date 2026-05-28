// Single source of truth for the active mesa env, decoupled from React.
// Read synchronously by the Supabase Proxy (src/integrations/supabase/client.ts)
// and the React MesaEnvContext (which mirrors it into UI state).
//
// Default is 'pending' — the Proxy throws on data calls in this state so any
// query that escapes ProtectedRoute fails loudly instead of leaking production.

export type MesaEnv = 'production' | 'staging';
export type EnvState = MesaEnv | 'pending';

export type EnvChangeReason =
  | 'init'              // first resolution post-boot, silent (no listeners fire)
  | 'profile-resolved'  // fetchProfile resolved for current user
  | 'user-switch'       // session.user.id changed — cache must be cleared
  | 'admin-toggle'      // admin clicked the env switch — requires full reload
  | 'signout';          // SIGNED_OUT — reset to production

const ADMIN_TOGGLE_LS_KEY = 'mesa_env';

let current: EnvState = 'pending';
let initialized = false;
const listeners = new Set<(env: EnvState, reason: EnvChangeReason) => void>();

export const getCurrentEnv = (): EnvState => current;

export const setCurrentEnv = (next: EnvState, reason: EnvChangeReason): void => {
  const changed = next !== current;
  current = next;
  if (!initialized) {
    // First call after boot is the "initialization" — silent, no listeners.
    initialized = true;
    return;
  }
  if (changed) {
    listeners.forEach((fn) => fn(next, reason));
  }
};

export const onEnvChange = (
  fn: (env: EnvState, reason: EnvChangeReason) => void,
): (() => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};

// ──────────────────────────────────────────────────────────────────────────
// Admin toggle persistence (localStorage). Only the admin writes/reads this.
// Used by resolveEnvFromProfile when the user has no forced_env.
// ──────────────────────────────────────────────────────────────────────────

export const readAdminToggle = (): MesaEnv => {
  if (typeof window === 'undefined') return 'production';
  return localStorage.getItem(ADMIN_TOGGLE_LS_KEY) === 'staging' ? 'staging' : 'production';
};

export const writeAdminToggle = (env: MesaEnv): void => {
  if (typeof window === 'undefined') return;
  if (env === 'staging') localStorage.setItem(ADMIN_TOGGLE_LS_KEY, 'staging');
  else localStorage.removeItem(ADMIN_TOGGLE_LS_KEY);
};

// ──────────────────────────────────────────────────────────────────────────
// Derivation rule — single place that decides the env from a profile.
// Profile-less callers (logged out) must use 'production' directly.
// ──────────────────────────────────────────────────────────────────────────

interface ProfileEnvFields {
  is_admin?: boolean | null;
  forced_env?: 'staging' | null;
}

export const resolveEnvFromProfile = (profile: ProfileEnvFields | null): MesaEnv => {
  if (!profile) return 'production';
  if (profile.forced_env === 'staging') return 'staging';
  // Both admins and regular users follow the admin toggle (current behavior).
  return readAdminToggle();
};

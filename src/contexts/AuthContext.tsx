import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase, supabasePublic } from '@/integrations/supabase/client';
import { logActivity } from '@/lib/activityLog';
import { queryClient } from '@/lib/queryClient';
import {
  setCurrentEnv,
  resolveEnvFromProfile,
} from '@/lib/envState';
import type { UserProfile } from '@/types';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  loading: boolean;
  isPasswordRecovery: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);
  const authStateRef = useRef<{ user: User | null; profile: UserProfile | null }>({ user: null, profile: null });

  authStateRef.current = { user, profile };

  const fetchProfile = useCallback(async (userId: string): Promise<UserProfile | null> => {
    try {
      const { data, error } = await supabasePublic
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.error('Error fetching profile:', error.message);
        setProfile(null);
        return null;
      }

      const p = data as UserProfile | null;
      setProfile(p);
      // Resolve the active env from this profile. This is the single point
      // where pending → production/staging transition happens.
      setCurrentEnv(resolveEnvFromProfile(p), 'profile-resolved');
      // Apply theme preference to document root
      if (p?.theme === 'light') {
        document.documentElement.classList.remove('dark');
      } else {
        document.documentElement.classList.add('dark');
      }
      return p;
    } catch {
      setProfile(null);
      return null;
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    // Get initial session first. fetchProfile is awaited so the env is
    // resolved before setLoading(false) — no window where AppLayout can
    // mount with env='pending'.
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!mounted) return;
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        await fetchProfile(session.user.id);
      } else {
        setCurrentEnv('production', 'init');
      }
      if (mounted) setLoading(false);
    });

    // Then listen for changes — do NOT await Supabase calls inside this callback
    // (causes deadlock per Supabase docs).
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      if (event === 'PASSWORD_RECOVERY') {
        setIsPasswordRecovery(true);
      } else {
        setIsPasswordRecovery(false);
      }
      setSession(session);
      setUser(session?.user ?? null);

      if (!session?.user) {
        // BRANCH A: logout
        setProfile(null);
        setCurrentEnv('production', 'signout');
        queryClient.clear();
        setLoading(false);
        return;
      }

      const cached = authStateRef.current.profile;
      const sameUser = authStateRef.current.user?.id === session.user.id;

      if (cached && sameUser) {
        // BRANCH B: same user, profile already in memory.
        // Env was synced with this profile on its last resolution.
        // Re-applying is an idempotent no-op (kept explicit for robustness).
        setCurrentEnv(resolveEnvFromProfile(cached), 'profile-resolved');
        if (event === 'TOKEN_REFRESHED') return;
        // Other events (USER_UPDATED, INITIAL_SESSION) → refetch without blocking UI.
        setTimeout(() => {
          if (mounted) void fetchProfile(session.user.id);
        }, 0);
        return;
      }

      // BRANCH C: different user (cached!==null && !sameUser) OR first load
      // via onAuthStateChange (cached===null). Env stays 'pending' until
      // fetchProfile resolves. ProtectedRoute blocks UI via loading=true.
      if (cached && !sameUser) {
        // Real user switch: previous user's cache must die.
        queryClient.clear();
        setCurrentEnv('pending', 'user-switch');
      }

      setLoading(true);
      setProfile(null); // clear stale profile from previous user (if any)

      setTimeout(async () => {
        if (!mounted) return;
        await fetchProfile(session.user.id);
        if (mounted) setLoading(false);
      }, 0);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [fetchProfile]);

  const refreshProfile = useCallback(async () => {
    if (user) {
      await fetchProfile(user.id);
    }
  }, [user, fetchProfile]);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    void logActivity('auth.login', 'user', null, { email });
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });
    if (error) throw error;
    void logActivity('auth.signup', 'user', null, { email, full_name: fullName });
  };

  const signOut = async () => {
    void logActivity('auth.logout', 'user', user?.id ?? null);
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  return (
    <AuthContext.Provider value={{ user, session, profile, loading, isPasswordRecovery, signIn, signUp, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

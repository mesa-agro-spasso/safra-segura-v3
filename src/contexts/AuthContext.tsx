import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase, supabasePublic } from '@/integrations/supabase/client';
import { logActivity } from '@/lib/activityLog';
import { queryClient } from '@/lib/queryClient';
import type { UserProfile } from '@/types';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  profileError: Error | null;
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
  const [profileError, setProfileError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);
  const authStateRef = useRef<{ user: User | null; profile: UserProfile | null }>({ user: null, profile: null });

  authStateRef.current = { user, profile };

  const fetchProfile = useCallback(async (userId: string): Promise<UserProfile | null> => {
    setProfileError(null);
    try {
      const { data, error } = await supabasePublic
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.error('Error fetching profile:', error.message);
        setProfileError(new Error(error.message));
        setProfile(null);
        return null;
      }

      const p = data as UserProfile | null;
      setProfile(p);
      // Apply theme preference to document root
      if (p?.theme === 'light') {
        document.documentElement.classList.remove('dark');
      } else {
        document.documentElement.classList.add('dark');
      }
      return p;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Erro desconhecido ao carregar perfil');
      console.error('Error fetching profile:', error.message);
      setProfileError(error);
      setProfile(null);
      return null;
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    // Get initial session first.
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!mounted) return;
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        await fetchProfile(session.user.id);
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
        queryClient.clear();
        setLoading(false);
        return;
      }

      const cached = authStateRef.current.profile;
      const sameUser = authStateRef.current.user?.id === session.user.id;

      if (cached && sameUser) {
        // BRANCH B: same user, profile already in memory.
        if (event === 'TOKEN_REFRESHED') return;
        // Other events (USER_UPDATED, INITIAL_SESSION) → refetch without blocking UI.
        setTimeout(() => {
          if (mounted) void fetchProfile(session.user.id);
        }, 0);
        return;
      }

      // BRANCH C: different user (cached!==null && !sameUser) OR first load
      // via onAuthStateChange (cached===null).
      if (cached && !sameUser) {
        // Real user switch: previous user's cache must die.
        queryClient.clear();
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
    setProfileError(null);
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
    <AuthContext.Provider value={{ user, session, profile, profileError, loading, isPasswordRecovery, signIn, signUp, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

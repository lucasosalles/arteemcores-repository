import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase, purgeSupabaseStorage } from '@/integrations/supabase/client';

type AppRole = 'admin' | 'sindico' | 'morador' | 'arquiteto' | 'prestador' | 'tecnico';

interface Profile {
  id: string;
  full_name: string;
  phone: string | null;
  avatar_url: string | null;
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  role: AppRole | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any; role?: AppRole }>;
  signUp: (email: string, password: string, metadata?: Record<string, any>) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Delegates to purgeSupabaseStorage (sessionStorage-first) for all auth cleanup.
// Kept as a named export for components that call it directly.
export const clearAuthStorage = () => purgeSupabaseStorage();

const clearIfExpiredSession = () => {
  try {
    // Auth tokens are now stored in sessionStorage
    const key = [...Array(sessionStorage.length)].map((_, i) => sessionStorage.key(i))
      .find(k => k?.startsWith('sb-') && k.endsWith('-auth-token'));
    if (!key) return;
    const stored = JSON.parse(sessionStorage.getItem(key) || 'null');
    if (stored?.expires_at && Date.now() / 1000 > stored.expires_at) {
      purgeSupabaseStorage();
    }
  } catch {
    purgeSupabaseStorage();
  }
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);
  const initializedRef = useRef(false);

  const fetchProfileAndRole = async (userId: string): Promise<AppRole | null> => {
    try {
      const [profileRes, roleRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', userId).single(),
        supabase.from('user_roles').select('role').eq('user_id', userId).maybeSingle(),
      ]);
      if (profileRes.data) setProfile(profileRes.data as Profile);
      const fetchedRole = (roleRes.data?.role as AppRole) ?? null;
      setRole(fetchedRole);
      return fetchedRole;
    } catch (err) {
      console.error('Erro ao buscar perfil/role:', err);
      return null;
    }
  };

  useEffect(() => {
    let mounted = true;

    const forceReset = () => {
      supabase.auth.signOut({ scope: 'local' }).catch(() => {});
      clearAuthStorage();
      if (mounted) {
        setSession(null);
        setUser(null);
        setProfile(null);
        setRole(null);
        setLoading(false);
        initializedRef.current = true;
      }
    };

    const init = async () => {
      // Limpa token expirado antes de qualquer requisição de rede
      clearIfExpiredSession();

      // Timeout de segurança: sessão corrompida/expirada pode travar getSession()
      const safetyTimer = setTimeout(() => {
        if (!initializedRef.current) forceReset();
      }, 4000);

      try {
        const sessionResult = await Promise.race([
          supabase.auth.getSession(),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('session_timeout')), 3000)
          ),
        ]);

        const { data: { session }, error } = sessionResult;

        if (error) {
          forceReset();
          return;
        }

        if (!mounted) return;
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          await fetchProfileAndRole(session.user.id);
        }

        if (mounted) {
          setLoading(false);
          initializedRef.current = true;
        }
      } catch (err: any) {
        // Any init error (session_timeout, refresh_token_not_found, invalid_refresh_token, etc.)
        // means the stored session is unusable. Purge storage and do a hard redirect so the
        // SDK reinitializes from a clean slate — forceReset() alone is not enough because the
        // SDK instance in memory may still hold the corrupted state.
        console.warn('Auth init error, purging and redirecting:', err?.message ?? err);
        purgeSupabaseStorage();
        window.location.href = '/login';
      } finally {
        clearTimeout(safetyTimer);
      }
    };

    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;
        if (!initializedRef.current && event === 'INITIAL_SESSION') return;

        if (event === 'TOKEN_REFRESH_FAILED') {
          forceReset();
          return;
        }

        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          await fetchProfileAndRole(session.user.id);
        } else {
          setProfile(null);
          setRole(null);
        }

        if (mounted && !initializedRef.current) {
          setLoading(false);
          initializedRef.current = true;
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error };

    if (data.session?.user) {
      const role = await fetchProfileAndRole(data.session.user.id);
      return { error: null, role };
    }

    return { error: null };
  };

  const signUp = async (email: string, password: string, metadata?: Record<string, any>) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: metadata },
    });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut({ scope: 'local' });
    purgeSupabaseStorage();
    setSession(null);
    setUser(null);
    setProfile(null);
    setRole(null);
  };

  return (
    <AuthContext.Provider value={{ session, user, profile, role, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
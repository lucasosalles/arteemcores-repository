import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

// fix-redirect-v4
type AppRole = 'sindico' | 'tecnico' | 'admin';

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

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);
  const initializedRef = useRef(false);

  const fetchProfileAndRole = async (userId: string) => {
    try {
      const [profileRes, roleRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', userId).single(),
        supabase.from('user_roles').select('role').eq('user_id', userId).maybeSingle(),
      ]);
      if (profileRes.data) setProfile(profileRes.data as Profile);
      if (roleRes.data) {
        setRole(roleRes.data.role as AppRole);
      } else {
        console.warn('Nenhuma role encontrada para o usuário', userId);
        setRole(null);
      }
    } catch (err) {
      console.error('Erro ao buscar perfil/role:', err);
    }
  };

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(async ({ data: { session } }) => {
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
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;
        if (!initializedRef.current && event === 'INITIAL_SESSION') return;
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          await fetchProfileAndRole(session.user.id);
        } else {
          setProfile(null);
          setRole(null);
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

    console.log('[signIn] auth ok, userId:', data.session?.user?.id);

    if (data.session?.user) {
      console.log('[signIn] chamando fetchProfileAndRole...');
      await fetchProfileAndRole(data.session.user.id);
      console.log('[signIn] fetchProfileAndRole concluído');

      const { data: roleRes, error: roleError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', data.session.user.id)
        .maybeSingle();

      console.log('[signIn] roleRes:', JSON.stringify(roleRes), 'roleError:', JSON.stringify(roleError));

      return { error: null, role: (roleRes?.role as AppRole) ?? null };
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
    await supabase.auth.signOut();
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
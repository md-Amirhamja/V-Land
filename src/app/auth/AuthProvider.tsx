import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase, supabaseConfigured } from '@/lib/supabase';

export type Role = 'citizen' | 'admin';
export interface Profile { id: string; role: Role; display_name: string | null; lang: 'bn' | 'en' }
export type SignInResult = { ok: true; role: Role } | { ok: false; error: 'invalid' | 'network' | 'noProfile' };

interface Ctx {
  session: Session | null;
  profile: Profile | null;
  role: Role | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<SignInResult>;
  signOut: () => Promise<void>;
}
const AuthCtx = createContext<Ctx | null>(null);

async function fetchProfile(uid: string): Promise<Profile | null> {
  const { data, error } = await supabase.from('profiles').select('id, role, display_name, lang').eq('id', uid).maybeSingle();
  if (error) return null;
  return (data as Profile) ?? null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(supabaseConfigured);
  const lastUid = useRef<string | null>(null);
  const ready = useRef(false);

  // 1) session from storage + live changes (never await Supabase calls inside the callback)
  useEffect(() => {
    if (!supabaseConfigured) return;
    supabase.auth.getSession().then(({ data }) => { ready.current = true; setSession(data.session); if (!data.session) setLoading(false); });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  // 2) profile follows the signed-in user
  useEffect(() => {
    const uid = session?.user.id ?? null;
    if (uid === lastUid.current && (profile || !uid)) { if (uid || ready.current) setLoading(false); return; }
    lastUid.current = uid;
    if (!uid) { setProfile(null); setLoading(false); return; }
    let alive = true;
    setLoading(true);
    fetchProfile(uid).then((p) => { if (alive) { setProfile(p); setLoading(false); } });
    return () => { alive = false; };
  }, [session]);

  const signIn = useCallback<Ctx['signIn']>(async (email, password) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error || !data.user) return { ok: false, error: /fetch|network/i.test(error?.message ?? '') ? 'network' : 'invalid' };
      const p = await fetchProfile(data.user.id);
      if (!p) return { ok: false, error: 'noProfile' };
      setProfile(p); lastUid.current = data.user.id; setSession(data.session);
      return { ok: true, role: p.role };
    } catch { return { ok: false, error: 'network' }; }
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut().catch(() => undefined);
    setSession(null); setProfile(null); lastUid.current = null;
  }, []);

  const value = useMemo<Ctx>(() => ({ session, profile, role: profile?.role ?? null, loading, signIn, signOut }), [session, profile, loading, signIn, signOut]);
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  const c = useContext(AuthCtx);
  if (!c) throw new Error('useAuth must be used inside <AuthProvider>');
  return c;
}

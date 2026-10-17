import { useState, type FormEvent } from 'react';
import { useLocation, useNavigate, Navigate, Link } from 'react-router-dom';
import { Sparkles, TriangleAlert } from 'lucide-react';
import { useLang } from '@/i18n';
import { useAuth } from '@/auth/AuthProvider';
import { DEMO } from '@/lib/demo';
import { safeRedirect } from '@/lib/utils';
import { AuthLayout } from '@/layouts/AuthLayout';
import { Button, Card, Input } from '@/components/ui/core';
import { FullPageSpinner } from '@/components/ui/core';

type Kind = 'citizen' | 'admin';
export default function LoginPage({ kind }: { kind: Kind }) {
  const { t } = useLang(); const { signIn, signOut, role, loading, session } = useAuth();
  const nav = useNavigate(); const loc = useLocation();
  const st = (loc.state ?? {}) as { from?: string; reason?: 'notAdmin' | 'notCitizen' | 'idle' };
  const home = kind === 'admin' ? '/admin' : '/portal';
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(st.reason === 'notAdmin' ? t('auth.errNotAdmin') : st.reason === 'notCitizen' ? t('auth.errNotCitizen') : null);
  const [busy, setBusy] = useState(false);

  if (loading && !busy) return <AuthLayout kind={kind}><FullPageSpinner /></AuthLayout>;
  if (session && role === kind && !busy) return <Navigate to={safeRedirect(st.from, home)} replace />;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password) { setError(t('auth.errEmpty')); return; }
    setBusy(true); setError(null);
    const r = await signIn(email, password);
    if (!r.ok) { setBusy(false); setError(r.error === 'network' ? t('auth.errNetwork') : t('auth.errInvalid')); return; }
    if (r.role !== kind) {                        // each portal rejects the other's account
      await signOut(); setBusy(false);
      setError(kind === 'admin' ? t('auth.errNotAdmin') : t('auth.errNotCitizen')); return;
    }
    nav(safeRedirect(st.from, home), { replace: true });
  }

  return (
    <AuthLayout kind={kind}>
      <Card className="space-y-4">
        {st.reason === 'idle' && <p role="alert" className="flex gap-2 rounded-xl bg-caution-bg p-3 text-sm text-caution"><TriangleAlert className="h-5 w-5 shrink-0" aria-hidden />{t('auth.idleOut')}</p>}
        {kind === 'admin' && <div className="rounded-xl border border-line bg-surface2 p-3 text-sm"><p className="font-semibold">{t('auth.adminDemoTitle')}</p><p className="mt-1 text-muted">{t('auth.adminDemoHint')}</p></div>}
        <form onSubmit={submit} className="space-y-4" noValidate>
          <Input label={t('auth.email')} type="email" autoComplete="username" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Input label={t('auth.password')} type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          {error && <p role="alert" className="rounded-xl bg-stop-bg p-3 text-sm font-medium text-stop">{error}</p>}
          <Button type="submit" size="lg" className="w-full" loading={busy}>{busy ? t('auth.signingIn') : t('auth.submit')}</Button>
        </form>
        <div className="space-y-2 border-t border-line pt-4">
          <Button type="button" variant="secondary" className="w-full" onClick={() => { setEmail(DEMO[kind].email); setPassword(DEMO[kind].password); setError(null); }}>
            <Sparkles className="h-4 w-4" aria-hidden />{t('auth.useDemo')}
          </Button>
          <p className="text-center text-xs text-muted">{t('auth.demoNote')}</p>
        </div>
      </Card>
      <p className="text-center text-sm">
        <Link className="font-semibold text-brand underline-offset-2 hover:underline" to={kind === 'admin' ? '/portal/login' : '/admin/login'}>{t(kind === 'admin' ? 'auth.goCitizen' : 'auth.goAdmin')}</Link>
      </p>
    </AuthLayout>
  );
}

import { useEffect, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import { useLang } from '@/i18n';
import { useTheme } from '@/lib/theme';
import { cn } from '@/lib/utils';
import { DemoRibbon, LanguageToggle } from '@/components/ui/nav';

export function AuthLayout({ kind, children }: { kind: 'citizen' | 'admin'; children: ReactNode }) {
  const { t } = useLang();
  useTheme(kind === "admin" ? "admin" : "portal");
  useEffect(() => { document.title = `${t(kind === 'admin' ? 'auth.adminTitle' : 'auth.citizenTitle')} · V-Land`; });
  return (
    <div className={cn('min-h-screen', kind === 'admin' && 'bg-[radial-gradient(ellipse_at_50%_20%,rgb(27_58_43),rgb(15_29_23)_70%)]')}>
      <DemoRibbon />
      <div className="mx-auto flex max-w-md flex-col gap-6 px-4 py-8">
        <div className="flex items-center justify-between">
          <Link to={kind === 'admin' ? '/' : '/portal'} className="inline-flex min-h-[44px] items-center gap-2 text-sm font-semibold text-muted hover:text-ink"><ArrowLeft className="h-4 w-4" aria-hidden />{t('common.back')}</Link>
          <LanguageToggle />
        </div>
        <div className="flex flex-col items-center gap-2 text-center">
          <img src="/logo.png" alt="" className="h-16 w-16" />
          <h1 className="text-2xl font-bold">{t(kind === 'admin' ? 'auth.adminTitle' : 'auth.citizenTitle')}</h1>
          {kind === 'admin'
            ? <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/40 bg-accent/10 px-3 py-1 text-xs font-semibold text-accent"><ShieldCheck className="h-3.5 w-3.5" aria-hidden />{t('auth.adminBadge')}</span> : null}
          <p className="text-sm text-muted">{t(kind === 'admin' ? 'auth.adminSub' : 'auth.citizenSub')}</p>
        </div>
        {children}
      </div>
    </div>
  );
}

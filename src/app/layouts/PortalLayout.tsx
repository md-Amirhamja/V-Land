import { NavLink, Link, Outlet, useNavigate } from 'react-router-dom';
import { Home, Map as MapIcon, ScanSearch, UserRound, LogIn, LogOut } from 'lucide-react';
import { useLang } from '@/i18n';
import { useAuth } from '@/auth/AuthProvider';
import { useLargeText, useTheme } from '@/lib/theme';
import { cn } from '@/lib/utils';
import { DemoRibbon, LanguageToggle, LargeTextToggle, ThemeToggle } from '@/components/ui/nav';

export function PortalLayout() {
  const { t } = useLang(); const { session, profile, signOut } = useAuth(); const nav = useNavigate();
  const th = useTheme('portal'); const big = useLargeText();
  const link = ({ isActive }: { isActive: boolean }) => cn('rounded-xl px-3 py-2 text-sm font-semibold min-h-[44px] inline-flex items-center', isActive ? 'bg-brand/10 text-brand' : 'text-muted hover:text-ink');
  const bottom = ({ isActive }: { isActive: boolean }) => cn('flex min-h-[56px] flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold', isActive ? 'text-brand' : 'text-muted');
  return (
    <div className="flex min-h-screen flex-col pb-16 md:pb-0">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-lg focus:bg-surface focus:p-3">{t('common.skip')}</a>
      <DemoRibbon />
      <header className="sticky top-0 z-30 border-b border-line bg-surface/90 backdrop-blur" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="mx-auto flex max-w-6xl items-center gap-2 px-3 py-2">
          <Link to="/portal" className="flex items-center gap-2 pr-2"><img src="/logo.png" alt="" className="h-9 w-9" /><span className="text-lg font-bold">V-Land</span></Link>
          <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
            <NavLink to="/portal" end className={link}>{t('portal.navHome')}</NavLink>
            <NavLink to="/portal/verify" className={link}>{t('portal.navVerify')}</NavLink>
            <NavLink to="/portal/my" className={link}>{t('portal.navMy')}</NavLink>
            <a href="/" className="rounded-xl px-3 py-2 text-sm font-semibold text-muted hover:text-ink min-h-[44px] inline-flex items-center">{t('common.map3d')}</a>
          </nav>
          <div className="ml-auto flex items-center gap-1">
            <LargeTextToggle on={big.on} onToggle={big.toggle} />
            <ThemeToggle theme={th.theme} onToggle={th.toggle} />
            <LanguageToggle />
            {session
              ? <button onClick={async () => { await signOut(); nav('/portal'); }} className="ml-1 inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-line px-3 text-sm font-semibold hover:bg-surface2" title={profile?.display_name ?? ''}><LogOut className="h-4 w-4" aria-hidden /><span className="hidden sm:inline">{t('common.signOut')}</span></button>
              : <Link to="/portal/login" className="ml-1 inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-brand px-3 text-sm font-semibold text-brand-fg"><LogIn className="h-4 w-4" aria-hidden /><span className="hidden sm:inline">{t('common.signIn')}</span></Link>}
          </div>
        </div>
      </header>
      <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-6"><Outlet /></main>
      <footer className="border-t border-line px-4 py-4 text-center text-xs text-muted">{t('common.disclaimer')}</footer>
      <nav aria-label="Bottom" className="fixed inset-x-0 bottom-0 z-30 flex border-t border-line bg-surface md:hidden" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <NavLink to="/portal" end className={bottom}><Home className="h-5 w-5" aria-hidden />{t('portal.navHome')}</NavLink>
        <NavLink to="/portal/verify" className={bottom}><ScanSearch className="h-5 w-5" aria-hidden />{t('portal.navVerify')}</NavLink>
        <a href="/" className={bottom({ isActive: false })}><MapIcon className="h-5 w-5" aria-hidden />{t('portal.navMap')}</a>
        <NavLink to="/portal/my" className={bottom}><UserRound className="h-5 w-5" aria-hidden />{t('portal.navMy')}</NavLink>
      </nav>
    </div>
  );
}

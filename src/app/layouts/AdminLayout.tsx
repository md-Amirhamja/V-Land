import { useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Activity, ChevronsLeft, ChevronsRight, FileCheck2, FlaskConical, FolderOpen, Inbox, LayoutDashboard, LogOut, ScrollText, ShieldAlert, SlidersHorizontal, Settings2 } from 'lucide-react';
import { useLang } from '@/i18n';
import { useAuth } from '@/auth/AuthProvider';
import { useIdleLogout } from '@/auth/useIdleLogout';
import { useTheme } from '@/lib/theme';
import { cn } from '@/lib/utils';
import { DemoRibbon, LanguageToggle, ThemeToggle } from '@/components/ui/nav';
import { Dialog } from '@/components/ui/overlay';

const ITEMS = [
  { to: '/admin', key: 'admin.dashboard', Icon: LayoutDashboard },
  { to: '/admin/records', key: 'admin.records', Icon: FolderOpen },
  { to: '/admin/fraud', key: 'admin.fraud', Icon: ShieldAlert },
  { to: '/admin/inbox', key: 'admin.inbox', Icon: Inbox },
  { to: '/admin/rules', key: 'admin.rules', Icon: SlidersHorizontal },
  { to: '/admin/reports', key: 'admin.reports', Icon: FileCheck2 },
  { to: '/admin/audit', key: 'admin.audit', Icon: ScrollText },
  { to: '/admin/system', key: 'admin.system', Icon: Settings2 },
  { to: '/admin/sandbox', key: 'admin.dashboard', Icon: FlaskConical, label: 'Sandbox' },
];

export function AdminLayout() {
  const { t } = useLang(); const { profile, signOut } = useAuth(); const nav = useNavigate(); const loc = useLocation();
  const th = useTheme('admin'); const [slim, setSlim] = useState(false); const [menu, setMenu] = useState(false); const [confirmLogout, setConfirmLogout] = useState(false);
  useIdleLogout(30);
  const isActive = (to: string) => (to === '/admin' ? loc.pathname === '/admin' : loc.pathname.startsWith(to));
  const current = ITEMS.find((i) => isActive(i.to)) ?? ITEMS[0];
  return (
    <div className="min-h-screen">
      <DemoRibbon />
      <div className="flex min-h-[calc(100vh-28px)]">
        <aside className={cn('sticky top-0 hidden h-screen shrink-0 flex-col border-r border-line bg-surface2 transition-all md:flex', slim ? 'w-[72px]' : 'w-64')}>
          <div className="flex items-center gap-2 px-4 py-4"><img src="/logo.png" alt="" className="h-9 w-9" />{!slim && <div><div className="font-bold leading-tight">V-Land</div><div className="text-xs text-accent">{t('auth.adminBadge')}</div></div>}</div>
          <nav aria-label="Admin" className="flex-1 space-y-1 px-2">
            {ITEMS.map(({ to, key, Icon, label }) => {
              const on = isActive(to);
              const text = label ?? t(key);
              return (
                <Link key={to} to={to} aria-current={on ? 'page' : undefined} title={text}
                  className={cn('flex min-h-[44px] items-center gap-3 rounded-xl px-3 text-sm hover:bg-surface', on && 'bg-brand/20 font-semibold', slim && 'justify-center px-0')}>
                  <Icon className="h-5 w-5 shrink-0" aria-hidden />{!slim && text}
                </Link>
              );
            })}
          </nav>
          <button onClick={() => setSlim(!slim)} aria-label={slim ? t('admin.expand') : t('admin.collapse')} className="m-2 grid min-h-[44px] place-items-center rounded-xl text-muted hover:bg-surface">{slim ? <ChevronsRight className="h-5 w-5" /> : <ChevronsLeft className="h-5 w-5" />}</button>
        </aside>
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex items-center gap-3 border-b border-line bg-surface px-4 py-2">
            <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm text-muted"><Activity className="h-4 w-4" aria-hidden /><span>{t('admin.title')}</span><span aria-hidden>/</span><span className="font-semibold text-ink">{current.label ?? t(current.key)}</span></nav>
            <div className="ml-auto flex items-center gap-1">
              <LanguageToggle /><ThemeToggle theme={th.theme} onToggle={th.toggle} />
              <div className="relative">
                <button onClick={() => setMenu(!menu)} aria-haspopup="menu" aria-expanded={menu} aria-label={t('admin.userMenu')} className="flex min-h-[44px] items-center gap-2 rounded-xl border border-line px-3 text-sm font-semibold hover:bg-surface2">
                  <span className="grid h-7 w-7 place-items-center rounded-full bg-brand text-xs text-brand-fg">{(profile?.display_name ?? 'A')[0].toUpperCase()}</span><span className="hidden sm:inline">{profile?.display_name}</span>
                </button>
                {menu && <div role="menu" className="absolute right-0 z-20 mt-2 w-52 rounded-xl border border-line bg-surface p-1 shadow-xl">
                  <div className="px-3 py-2 text-xs text-muted">{t('admin.roleAdmin')}</div>
                  <button role="menuitem" aria-label={t('common.signOut')} onClick={() => setConfirmLogout(true)} className="flex min-h-[44px] w-full items-center gap-2 rounded-lg px-3 text-sm hover:bg-surface2"><LogOut className="h-4 w-4" aria-hidden />{t('common.signOut')}</button>
                </div>}
              </div>
            </div>
          </header>
          <main className="flex-1 p-4 sm:p-6"><Outlet /></main>
          <footer className="border-t border-line px-4 py-3 text-center text-xs text-muted">{t('admin.demoOnly')} · {t('common.disclaimer')}</footer>
        </div>
      </div>
      <Dialog open={confirmLogout} onClose={() => setConfirmLogout(false)} title={t('common.signOutTitle')}>
        <div className="space-y-4">
          <p className="text-sm text-muted">{t('common.signOutConfirm')}</p>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setConfirmLogout(false)} className="min-h-[44px] rounded-xl border border-line px-4 text-sm font-semibold hover:bg-surface2">{t('common.cancel')}</button>
            <button type="button" onClick={async () => { setConfirmLogout(false); await signOut(); nav('/admin/login'); }} className="min-h-[44px] rounded-xl bg-stop-solid px-4 text-sm font-semibold text-white">{t('common.signOut')}</button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { Inbox } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useLang } from '@/i18n';
import { useAuth } from '@/auth/AuthProvider';
import { supabase } from '@/lib/supabase';
import { EmptyState } from '@/components/ui/core';
import { Tabs } from '@/components/ui/nav';

export default function PortalMy() {
  const { t } = useLang(); const { profile } = useAuth();
  const [land, setLand] = useState<{ plots: any[]; alerts: any[] }>({ plots: [], alerts: [] });
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'checks' | 'watch' | 'buy' | 'alerts'>('checks');
  useEffect(() => {
    supabase.rpc('my_land').then(({ data }) => {
      const result = (data as { plots?: any[]; alerts?: any[] } | null) ?? {};
      setLand({ plots: result.plots ?? [], alerts: result.alerts ?? [] });
      setLoading(false);
    });
  }, []);
  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold">{t('portal.myTitle')}</h1><p className="text-sm text-muted">{t('auth.signedInAs')}: {profile?.display_name}</p></div>
      <Tabs<'checks' | 'watch' | 'buy' | 'alerts'> label={t('portal.myTitle')} value={tab} onChange={setTab} tabs={[
        { id: 'checks', label: t('portal.myChecks') }, { id: 'watch', label: t('portal.myWatch') }, { id: 'buy', label: t('portal.myBuy') }, { id: 'alerts', label: t('portal.myAlerts') }]} />
      <div role="tabpanel" className="space-y-3">
        {tab === 'buy' && <section className="space-y-3" aria-labelledby="owned-plots-title">
          <h2 id="owned-plots-title" className="text-lg font-bold">{t('portal.ownedPlots')}</h2>
          {loading && <p className="text-sm text-muted">{t('common.loading')}</p>}
          {!loading && land.plots.length === 0 && <EmptyState icon={<Inbox className="h-10 w-10" />} title={t('portal.myEmpty')} />}
          {!loading && land.plots.map((item) => {
            const label = item.plot?.label;
            const text = typeof label === 'object' ? label.bn ?? label.en : label ?? `#${item.plot?.id}`;
            return <div key={item.plot?.id} className="rounded-2xl border border-line bg-surface p-4">
              <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-semibold">{text}</h3><p className="text-sm text-muted">{t('portal.share')}: {item.share_num}/{item.share_den}</p></div><span className="rounded-full bg-brand/10 px-3 py-1 text-sm font-semibold">{item.self_check_verdict ?? t('portal.notChecked')}</span></div>
              <Link className="mt-3 inline-block text-sm font-semibold underline" to={`/portal/plot/${item.plot?.id}`}>{t('portal.openDossier')}</Link>
            </div>;
          })}
        </section>}
        {tab !== 'buy' && <EmptyState icon={<Inbox className="h-10 w-10" />} title={t('portal.myEmpty')} />}
      </div>
    </div>
  );
}

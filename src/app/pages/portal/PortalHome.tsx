import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Hash, MapPinned, Crosshair, FileText, Map as MapIcon, Search, UserCheck, ListChecks, Dice5, Navigation } from 'lucide-react';
import { useLang } from '@/i18n';
import { supabase } from '@/lib/supabase';
import { Card } from '@/components/ui/core';
import { Button } from '@/components/ui/core';

export default function PortalHome() {
  const { t } = useLang();
  const [ownedPlots, setOwnedPlots] = useState<any[]>([]);
  const [demoScenarios, setDemoScenarios] = useState<{ code: string; plot_id: number }[]>([]);
  const [demoLoading, setDemoLoading] = useState(false);
  async function showDemoScenarios() {
    setDemoLoading(true);
    const { data } = await supabase.rpc('list_scenarios');
    const scenarios = Array.isArray(data) ? data : [];
    setDemoScenarios([...scenarios].sort(() => Math.random() - 0.5).slice(0, 5));
    setDemoLoading(false);
  }
  useEffect(() => {
    supabase.rpc('my_land').then(({ data }) => setOwnedPlots(Array.isArray(data?.plots) ? data.plots : []));
  }, []);
  const cards = [
    { k: 'Record', Icon: Hash, to: '/portal/verify' },
    { k: 'Map', Icon: MapPinned, to: '/', plain: true },
    { k: 'Gps', Icon: Crosshair, to: '/portal/verify' },
    { k: 'Deed', Icon: FileText, to: '/portal/verify' },
  ];
  const how = [{ Icon: Search, k: 'how1' }, { Icon: UserCheck, k: 'how2' }, { Icon: ListChecks, k: 'how3' }];
  return (
    <div className="space-y-10">
      <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-brand to-[#0f1d17] px-6 py-10 text-white sm:px-10 sm:py-14">
        <h1 className="text-3xl font-bold sm:text-5xl">{t('portal.heroTitle')}</h1>
        <p className="mt-3 max-w-2xl text-base text-white sm:text-lg">{t('portal.heroSub')}</p>
        <a href="/map" className="mt-6 inline-flex min-h-[48px] items-center gap-2 rounded-xl bg-white px-5 font-semibold text-[#004a37] hover:bg-white/90"><MapIcon className="h-5 w-5" aria-hidden />{t('portal.cta3d')}</a>
      </section>
      <section aria-label={t('portal.verifyTitle')} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map(({ k, Icon, to, plain }) => {
          const body = (
            <Card className="h-full space-y-3 transition hover:border-brand hover:shadow-md">
              <div><span className="inline-flex rounded-xl bg-brand/10 p-3 text-brand"><Icon className="h-6 w-6" aria-hidden /></span></div>
              <h2 className="text-lg font-semibold">{t(`portal.entry${k}`)}</h2>
              <p className="text-sm text-muted">{t(`portal.entry${k}Desc`)}</p>
            </Card>);
          return plain ? <a key={k} href={to} className="block rounded-2xl">{body}</a> : <Link key={k} to={to} className="block rounded-2xl">{body}</Link>;
        })}
      </section>
      <section className="space-y-4 rounded-2xl border border-line bg-surface2 p-4" aria-labelledby="demo-scenarios-title">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 id="demo-scenarios-title" className="font-bold">{t('portal.demoTitle')}</h2>
            <p className="text-sm text-muted">{t('portal.demoSub')}</p>
          </div>
          <Button type="button" variant="secondary" loading={demoLoading} onClick={showDemoScenarios}><Dice5 className="h-4 w-4" aria-hidden />{t('portal.demoButton')}</Button>
        </div>
        {demoScenarios.length > 0 && <div className="grid gap-2 sm:grid-cols-5">
          {demoScenarios.map((scenario) => <Link key={scenario.code} to={`/portal/check?scenario=${encodeURIComponent(scenario.code)}`} className="rounded-xl border border-line bg-surface px-3 py-3 text-center text-sm font-semibold hover:border-brand hover:bg-surface2">{scenario.code}</Link>)}
        </div>}
      </section>
      {ownedPlots.length > 0 && <section className="space-y-4 rounded-2xl border border-line bg-surface2 p-4" aria-labelledby="owned-plots-home-title">
        <div className="flex items-center justify-between gap-3"><div><h2 id="owned-plots-home-title" className="font-bold">{t('portal.ownedPlots')}</h2><p className="text-sm text-muted">{t('portal.homePlotsHint')}</p></div><Link to="/portal/my" className="text-sm font-semibold underline">{t('portal.viewAllPlots')}</Link></div>
        <div className="grid gap-3 sm:grid-cols-3">
          {ownedPlots.map((item) => { const label = item.plot?.label; const text = typeof label === 'object' ? label.bn ?? label.en : label ?? `#${item.plot?.id}`; return <Card key={item.plot?.id} className="space-y-3"><h3 className="font-semibold">{text}</h3><p className="text-sm text-muted">{t('portal.share')}: {item.share_num}/{item.share_den}</p><div className="flex flex-wrap gap-2"><Link to={`/portal/plot/${item.plot?.id}`} className="text-sm font-semibold underline">{t('portal.openDossier')}</Link>{item.plot?.glb_key && <a href={`/map?focus=${encodeURIComponent(item.plot.glb_key)}`} className="inline-flex items-center gap-1 text-sm font-semibold underline"><Navigation className="h-4 w-4" aria-hidden />{t('portal.viewOnMap')}</a>}</div></Card>; })}
        </div>
      </section>}
      <section>
        <h2 className="mb-4 text-xl font-bold">{t('portal.howTitle')}</h2>
        <ol className="grid gap-4 sm:grid-cols-3">
          {how.map(({ Icon, k }, i) => (
            <li key={k}><Card className="h-full"><div className="mb-2 flex items-center gap-2 text-brand"><span className="grid h-8 w-8 place-items-center rounded-full bg-brand text-sm font-bold text-brand-fg">{i + 1}</span><Icon className="h-5 w-5" aria-hidden /></div>
              <h3 className="font-semibold">{t(`portal.${k}`)}</h3><p className="text-sm text-muted">{t(`portal.${k}d`)}</p></Card></li>
          ))}
        </ol>
      </section>
      <div className="text-center"><Link to="/verify/demo"><Button variant="secondary">{t('portal.verifyCode')}</Button></Link></div>
    </div>
  );
}

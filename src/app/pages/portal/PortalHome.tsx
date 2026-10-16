import { Link } from 'react-router-dom';
import { Hash, MapPinned, Crosshair, FileText, Map as MapIcon, Search, UserCheck, ListChecks } from 'lucide-react';
import { useLang } from '@/i18n';
import { Badge, Card } from '@/components/ui/core';
import { Button } from '@/components/ui/core';

export default function PortalHome() {
  const { t } = useLang();
  const cards = [
    { k: 'Record', Icon: Hash, to: '/portal/verify', soon: true },
    { k: 'Map', Icon: MapPinned, to: '/', soon: false, plain: true },
    { k: 'Gps', Icon: Crosshair, to: '/portal/verify', soon: true },
    { k: 'Deed', Icon: FileText, to: '/portal/verify', soon: true },
  ];
  const how = [{ Icon: Search, k: 'how1' }, { Icon: UserCheck, k: 'how2' }, { Icon: ListChecks, k: 'how3' }];
  return (
    <div className="space-y-10">
      <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-brand to-[#0f1d17] px-6 py-10 text-white sm:px-10 sm:py-14">
        <h1 className="text-3xl font-bold sm:text-5xl">{t('portal.heroTitle')}</h1>
        <p className="mt-3 max-w-2xl text-base text-white/90 sm:text-lg">{t('portal.heroSub')}</p>
        <a href="/" className="mt-6 inline-flex min-h-[48px] items-center gap-2 rounded-xl bg-white px-5 font-semibold text-[#004a37] hover:bg-white/90"><MapIcon className="h-5 w-5" aria-hidden />{t('portal.cta3d')}</a>
      </section>
      <section aria-label={t('portal.verifyTitle')} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map(({ k, Icon, to, soon, plain }) => {
          const body = (
            <Card className="h-full space-y-3 transition hover:border-brand hover:shadow-md">
              <div className="flex items-start justify-between"><span className="rounded-xl bg-brand/10 p-3 text-brand"><Icon className="h-6 w-6" aria-hidden /></span>{soon && <Badge tone="caution">{t('common.comingRound3')}</Badge>}</div>
              <h2 className="text-lg font-semibold">{t(`portal.entry${k}`)}</h2>
              <p className="text-sm text-muted">{t(`portal.entry${k}Desc`)}</p>
            </Card>);
          return plain ? <a key={k} href={to} className="block rounded-2xl">{body}</a> : <Link key={k} to={to} className="block rounded-2xl">{body}</Link>;
        })}
      </section>
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

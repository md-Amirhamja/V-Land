import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Construction, MapPin } from 'lucide-react';
import { useLang } from '@/i18n';
import { supabase, supabaseConfigured } from '@/lib/supabase';
import { Button, Card, EmptyState, Skeleton } from '@/components/ui/core';
import { Stepper } from '@/components/ui/nav';

interface Unit { name_en: string; name_bn: string; parent?: Unit | null }
const fromKey = (key: string): { en: string; bn: string }[] => key.split('__').map((s) => { const n = s.replace(/_/g, ' ').replace(/\s+\d+$/, ''); return { en: n, bn: n }; });

export default function PortalVerify() {
  const { t, lang } = useLang(); const [sp] = useSearchParams(); const key = sp.get('area');
  const [chain, setChain] = useState<{ en: string; bn: string }[] | null>(null); const [note, setNote] = useState(false);

  useEffect(() => {
    if (!key) { setChain(null); return; }
    setChain(null); setNote(false);
    if (!supabaseConfigured) { setChain(fromKey(key)); setNote(true); return; }
    let alive = true;
    supabase.from('geo_units').select('name_en,name_bn,parent:parent_id(name_en,name_bn,parent:parent_id(name_en,name_bn))').eq('glb_key', key).maybeSingle()
      .then(({ data, error }) => {
        if (!alive) return;
        if (error || !data) { setChain(fromKey(key)); setNote(true); return; }
        const list: { en: string; bn: string }[] = []; let u = data as unknown as Unit | null | undefined;
        while (u) { list.unshift({ en: u.name_en, bn: u.name_bn }); u = u.parent; }
        setChain(list);
      });
    return () => { alive = false; };
  }, [key]);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">{t('portal.verifyTitle')}</h1>
      <Stepper steps={['Where', 'Who and why', 'Result']} current={0} />
      {!key ? (
        <EmptyState icon={<MapPin className="h-10 w-10" />} title={t('portal.verifyNoArea')} action={<a href="/"><Button>{t('portal.verifyOnMap')}</Button></a>} />
      ) : (
        <Card className="space-y-3">
          <div className="text-sm text-muted">{t('portal.verifyArea')}</div>
          {chain === null ? <Skeleton className="h-8 w-2/3" /> : (
            <>
              <div data-testid="area-name" className="text-2xl font-bold">{chain[chain.length - 1][lang]}</div>
              <div className="text-sm text-muted">{chain.slice(0, -1).map((c) => c[lang]).join(' › ')}</div>
              {note && <p className="text-xs text-muted">{t('portal.areaLookupFail')}</p>}
            </>
          )}
        </Card>
      )}
      <Card className="flex items-start gap-3 bg-caution-bg text-caution"><Construction className="mt-0.5 h-5 w-5 shrink-0" aria-hidden /><p className="text-sm">{t('portal.verifyWizardSoon')}</p></Card>
      <Link to="/portal" className="inline-flex min-h-[44px] items-center gap-2 text-sm font-semibold text-brand"><ArrowLeft className="h-4 w-4" aria-hidden />{t('common.back')}</Link>
    </div>
  );
}

import { useState } from 'react';
import { Inbox } from 'lucide-react';
import { useLang } from '@/i18n';
import { useAuth } from '@/auth/AuthProvider';
import { EmptyState } from '@/components/ui/core';
import { Tabs } from '@/components/ui/nav';

export default function PortalMy() {
  const { t } = useLang(); const { profile } = useAuth();
  const [tab, setTab] = useState<'checks' | 'watch' | 'buy' | 'alerts'>('checks');
  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold">{t('portal.myTitle')}</h1><p className="text-sm text-muted">{t('auth.signedInAs')}: {profile?.display_name}</p></div>
      <Tabs<'checks' | 'watch' | 'buy' | 'alerts'> label={t('portal.myTitle')} value={tab} onChange={setTab} tabs={[
        { id: 'checks', label: t('portal.myChecks') }, { id: 'watch', label: t('portal.myWatch') }, { id: 'buy', label: t('portal.myBuy') }, { id: 'alerts', label: t('portal.myAlerts') }]} />
      <div role="tabpanel"><EmptyState icon={<Inbox className="h-10 w-10" />} title={t('portal.myEmpty')} /></div>
    </div>
  );
}

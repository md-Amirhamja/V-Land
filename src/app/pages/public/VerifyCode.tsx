import { useParams, Link } from 'react-router-dom';
import { QrCode } from 'lucide-react';
import { useLang } from '@/i18n';
import { Button, Card, EmptyState } from '@/components/ui/core';
import { DemoRibbon, LanguageToggle } from '@/components/ui/nav';

export default function VerifyCode() {
  const { t } = useLang(); const { code } = useParams();
  return (
    <div className="min-h-screen">
      <DemoRibbon />
      <div className="mx-auto max-w-xl space-y-6 px-4 py-8">
        <div className="flex items-center justify-between"><Link to="/portal" className="flex items-center gap-2 font-bold"><img src="/logo.png" alt="" className="h-9 w-9" />V-Land</Link><LanguageToggle /></div>
        <Card><EmptyState icon={<QrCode className="h-10 w-10" />} title={t('portal.verifyCode')} body={`${t('portal.verifyCodeStatus')} (${code})`} action={<Link to="/portal"><Button variant="secondary">{t('portal.navHome')}</Button></Link>} /></Card>
      </div>
    </div>
  );
}

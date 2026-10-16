import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { useLang } from '@/i18n';
import { Button, EmptyState } from '@/components/ui/core';

export default function NotFound() {
  const { t } = useLang();
  return <div className="mx-auto max-w-lg px-4 py-16"><EmptyState icon={<Compass className="h-12 w-12" />} title={t('common.notFoundTitle')} body={t('common.notFoundBody')} action={<Link to="/portal"><Button>{t('common.home')}</Button></Link>} /></div>;
}

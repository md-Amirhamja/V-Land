import { BarChart3 } from 'lucide-react';
import { useLang } from '@/i18n';
import { useAuth } from '@/auth/AuthProvider';
import { EmptyState } from '@/components/ui/core';

export default function AdminDashboard() {
  const { t } = useLang(); const { profile } = useAuth();
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t('admin.welcome')}, {profile?.display_name}</h1>
      <EmptyState icon={<BarChart3 className="h-10 w-10" />} title={t('admin.emptyTitle')} body={t('admin.emptyBody')} />
    </div>
  );
}

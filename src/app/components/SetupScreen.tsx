import { KeyRound } from 'lucide-react';
import { useLang } from '@/i18n';
import { missingEnv } from '@/lib/supabase';
import { Card } from '@/components/ui/core';
import { LanguageToggle } from '@/components/ui/nav';

/** Shown instead of a blank page when the Supabase variables are missing. */
export function SetupScreen() {
  const { t } = useLang();
  return (
    <div className="mx-auto max-w-xl space-y-4 px-4 py-12">
      <div className="flex justify-end"><LanguageToggle /></div>
      <Card className="space-y-4">
        <div className="flex items-center gap-3"><span className="rounded-xl bg-caution-bg p-3 text-caution"><KeyRound className="h-6 w-6" aria-hidden /></span><h1 className="text-xl font-bold">{t('common.setupTitle')}</h1></div>
        <p className="text-sm">{t('common.setupBody')}</p>
        <ul className="space-y-2">{missingEnv.map((n) => <li key={n} className="flex items-center justify-between rounded-xl bg-surface2 px-3 py-2 font-mono text-sm"><span>{n}</span><span className="text-xs text-stop">{t('common.setupMissing')}</span></li>)}</ul>
        <p className="text-xs text-muted">{t('common.setupWhere')}</p>
      </Card>
    </div>
  );
}

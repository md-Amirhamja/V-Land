import { useRef, type KeyboardEvent, type ReactNode } from 'react';
import { Check, Moon, Sun, Type, FlaskConical } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLang } from '@/i18n';
import type { Theme } from '@/lib/theme';

export function Tabs<const T extends string>({ tabs, value, onChange, label }: { tabs: { id: T; label: string; badge?: ReactNode }[]; value: T; onChange: (v: T) => void; label: string }) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});
  const onKey = (e: KeyboardEvent, i: number) => {
    const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0; if (!d) return;
    const n = tabs[(i + d + tabs.length) % tabs.length]; onChange(n.id); refs.current[n.id]?.focus(); e.preventDefault();
  };
  return (
    <div role="tablist" aria-label={label} className="flex gap-1 overflow-x-auto rounded-2xl bg-surface2 p-1">
      {tabs.map((tab, i) => (
        <button key={tab.id} ref={(el) => (refs.current[tab.id] = el)} role="tab" aria-selected={value === tab.id} tabIndex={value === tab.id ? 0 : -1}
          onClick={() => onChange(tab.id)} onKeyDown={(e) => onKey(e, i)}
          className={cn('flex min-h-[44px] shrink-0 items-center gap-2 rounded-xl px-4 text-sm font-semibold transition', value === tab.id ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink')}>
          {tab.label}{tab.badge}
        </button>
      ))}
    </div>
  );
}

export function Stepper({ steps, current }: { steps: string[]; current: number }) {
  return (
    <ol className="flex items-center gap-2" aria-label="progress">
      {steps.map((s, i) => (
        <li key={s} className="flex flex-1 items-center gap-2" aria-current={i === current ? 'step' : undefined}>
          <span className={cn('grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-bold', i < current ? 'bg-brand text-brand-fg' : i === current ? 'border-2 border-brand text-brand' : 'border border-line text-muted')}>
            {i < current ? <Check className="h-4 w-4" aria-hidden /> : i + 1}
          </span>
          <span className={cn('hidden text-sm sm:block', i === current ? 'font-semibold' : 'text-muted')}>{s}</span>
          {i < steps.length - 1 && <span className="h-px flex-1 bg-line" aria-hidden />}
        </li>
      ))}
    </ol>
  );
}

export function LanguageToggle({ className }: { className?: string }) {
  const { lang, setLang, t } = useLang();
  return (
    <div role="group" aria-label={t('common.language')} className={cn('inline-flex rounded-full border border-line bg-surface p-0.5 text-sm font-semibold', className)}>
      {(['bn', 'en'] as const).map((l) => (
        <button key={l} onClick={() => setLang(l)} aria-pressed={lang === l} className={cn('min-h-[40px] rounded-full px-3', lang === l ? 'bg-brand text-brand-fg' : 'text-muted hover:text-ink')}>
          {l === 'bn' ? 'বাংলা' : 'EN'}
        </button>
      ))}
    </div>
  );
}

export function ThemeToggle({ theme, onToggle }: { theme: Theme; onToggle: () => void }) {
  const { t } = useLang();
  const label = `${t('common.theme')}: ${theme === 'dark' ? t('common.themeDark') : t('common.themeLight')}`;
  return <button onClick={onToggle} aria-label={label} title={label} className="grid h-11 w-11 place-items-center rounded-xl text-ink hover:bg-surface2">{theme === 'dark' ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}</button>;
}

export function LargeTextToggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  const { t } = useLang();
  return <button onClick={onToggle} aria-pressed={on} aria-label={t('common.largeText')} title={t('common.largeText')} className={cn('grid h-11 w-11 place-items-center rounded-xl hover:bg-surface2', on && 'bg-brand/15 text-brand')}><Type className="h-5 w-5" /></button>;
}

/** Shown on every page (rulebook 8.1/8.2: synthetic data only). */
export function DemoRibbon() {
  const { t } = useLang();
  return (
    <div className="flex items-center justify-center gap-2 bg-brand px-3 py-1.5 text-center text-xs font-semibold text-brand-fg" role="note">
      <FlaskConical className="h-3.5 w-3.5 shrink-0" aria-hidden />{t('common.demoRibbon')}
    </div>
  );
}

import type { ReactNode } from 'react';
import { OctagonX, ShieldCheck, TriangleAlert, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLang } from '@/i18n';

export type Verdict = 'clear' | 'caution' | 'stop';
const V = {
  clear:   { Icon: ShieldCheck,   box: 'bg-clear-bg text-clear border-clear/40',        key: 'common.verdictClear' },
  caution: { Icon: TriangleAlert, box: 'bg-caution-bg text-caution border-caution/40',  key: 'common.verdictCaution' },
  stop:    { Icon: OctagonX,      box: 'bg-stop-bg text-stop border-stop-solid/60',     key: 'common.verdictStop' },
} as const;

/** Never colour alone: every verdict has an icon AND a word, and is announced to screen readers. */
export function VerdictBadge({ verdict, size = 'md' }: { verdict: Verdict; size?: 'md' | 'xl' }) {
  const { t } = useLang();
  const { Icon, box, key } = V[verdict];
  return (
    <span role="status" aria-label={t(key)} className={cn('inline-flex items-center gap-2 rounded-2xl border-2 font-bold', box, size === 'xl' ? 'px-6 py-3 text-3xl' : 'px-3 py-1 text-sm')}>
      <Icon className={size === 'xl' ? 'h-9 w-9' : 'h-4 w-4'} aria-hidden />{t(key)}
    </span>
  );
}

export type Severity = 'blocker' | 'high' | 'medium' | 'info';
const SEV: Record<Severity, { label: [string, string]; cls: string; Icon: typeof Info }> = {
  blocker: { label: ['বাধা', 'Blocker'], cls: 'border-stop-solid bg-stop-bg', Icon: OctagonX },
  high:    { label: ['উচ্চ ঝুঁকি', 'High'], cls: 'border-caution bg-caution-bg', Icon: TriangleAlert },
  medium:  { label: ['মাঝারি', 'Medium'], cls: 'border-caution/50 bg-caution-bg/60', Icon: TriangleAlert },
  info:    { label: ['তথ্য', 'Info'], cls: 'border-line bg-surface2', Icon: Info },
};
export function FindingCard({ severity, title, detail, advice, code, evidence }: { severity: Severity; title: string; detail?: string; advice?: string; code?: string; evidence?: string[] }) {
  const { lang } = useLang();
  const s = SEV[severity];
  return (
    <article className={cn('rounded-2xl border-l-4 p-4', s.cls)}>
      <header className="flex flex-wrap items-center gap-2">
        <s.Icon className="h-5 w-5 shrink-0" aria-hidden />
        <h3 className="text-base font-semibold">{title}</h3>
        <span className="ml-auto flex items-center gap-2 text-xs font-semibold">
          <span className="rounded-full border border-line bg-surface px-2 py-0.5">{s.label[lang === 'bn' ? 0 : 1]}</span>
          {code && <span className="rounded-full border border-line bg-surface px-2 py-0.5 font-mono">{code}</span>}
        </span>
      </header>
      {detail && <p className="mt-2 text-sm">{detail}</p>}
      {evidence && evidence.length > 0 && <ul className="mt-2 flex flex-wrap gap-1.5">{evidence.map((e) => <li key={e} className="rounded-full bg-surface px-2 py-0.5 text-xs text-muted ring-1 ring-line">{e}</li>)}</ul>}
      {advice && <p className="mt-3 rounded-xl bg-surface p-3 text-sm ring-1 ring-line"><b>{lang === 'bn' ? 'কী করবেন: ' : 'What to do: '}</b>{advice}</p>}
    </article>
  );
}

export interface TimelineItem { id: string; date: string; title: string; detail?: string; tone?: 'neutral' | 'clear' | 'caution' | 'stop'; gap?: boolean }
export function Timeline({ items }: { items: TimelineItem[] }) {
  const dot = { neutral: 'bg-muted', clear: 'bg-clear', caution: 'bg-caution', stop: 'bg-stop-solid' } as const;
  return (
    <ol className="relative space-y-4 border-l-2 border-line pl-6">
      {items.map((i) => (
        <li key={i.id} className={cn('relative', i.gap && 'opacity-80')}>
          <span className={cn('absolute -left-[31px] top-1.5 h-3.5 w-3.5 rounded-full ring-4 ring-bg', i.gap ? 'border-2 border-dashed border-muted bg-bg' : dot[i.tone ?? 'neutral'])} aria-hidden />
          <time className="text-xs text-muted">{i.date}</time>
          <div className="font-semibold">{i.title}</div>
          {i.detail && <div className="text-sm text-muted">{i.detail}</div>}
        </li>
      ))}
    </ol>
  );
}
export type { ReactNode };

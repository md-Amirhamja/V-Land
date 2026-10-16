import { forwardRef, useId, type ButtonHTMLAttributes, type HTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

/* ---------- Button ---------- */
type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
const VARIANT: Record<Variant, string> = {
  primary: 'bg-brand text-brand-fg hover:brightness-110 shadow-sm',
  secondary: 'bg-surface text-ink border border-line hover:bg-surface2',
  ghost: 'text-ink hover:bg-surface2',
  danger: 'bg-stop-bg text-stop border border-stop-solid/50 hover:brightness-95',
};
export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; loading?: boolean; size?: 'md' | 'lg' }>(
  ({ variant = 'primary', loading, size = 'md', className, children, disabled, ...p }, ref) => (
    <button ref={ref} disabled={disabled || loading}
      className={cn('inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] min-w-[44px]',
        size === 'lg' ? 'px-6 py-3 text-base' : 'px-4 py-2 text-sm', VARIANT[variant], className)} {...p}>
      {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}{children}
    </button>
  ));
Button.displayName = 'Button';

/* ---------- Field wrapper, Input, Select ---------- */
function Field({ id, label, hint, error, children }: { id: string; label: string; hint?: string; error?: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-ink">{label}</label>
      {children}
      {hint && !error && <p id={`${id}-hint`} className="text-xs text-muted">{hint}</p>}
      {error && <p id={`${id}-err`} role="alert" className="text-sm text-stop">{error}</p>}
    </div>
  );
}
const CONTROL = 'w-full min-h-[44px] rounded-xl border border-line bg-surface px-3 py-2 text-base text-ink placeholder:text-muted/80 focus:border-brand focus:outline-none focus-visible:ring-2 focus-visible:ring-accent';
export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string; error?: string }>(
  ({ label, hint, error, className, id, ...p }, ref) => {
    const auto = useId(); const i = id ?? auto;
    return <Field id={i} label={label} hint={hint} error={error}>
      <input ref={ref} id={i} aria-invalid={!!error} aria-describedby={error ? `${i}-err` : hint ? `${i}-hint` : undefined} className={cn(CONTROL, error && 'border-stop-solid', className)} {...p} />
    </Field>;
  });
Input.displayName = 'Input';
export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement> & { label: string; hint?: string; error?: string }>(
  ({ label, hint, error, className, id, children, ...p }, ref) => {
    const auto = useId(); const i = id ?? auto;
    return <Field id={i} label={label} hint={hint} error={error}>
      <select ref={ref} id={i} className={cn(CONTROL, className)} {...p}>{children}</select>
    </Field>;
  });
Select.displayName = 'Select';

/* ---------- Card, Badge, Stat ---------- */
export function Card({ className, ...p }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('rounded-2xl border border-line bg-surface p-5 shadow-sm', className)} {...p} />;
}
const TONE = {
  neutral: 'bg-surface2 text-ink border-line', brand: 'bg-brand/10 text-brand border-brand/30',
  clear: 'bg-clear-bg text-clear border-clear/30', caution: 'bg-caution-bg text-caution border-caution/30', stop: 'bg-stop-bg text-stop border-stop-solid/40',
};
export function Badge({ tone = 'neutral', className, ...p }: HTMLAttributes<HTMLSpanElement> & { tone?: keyof typeof TONE }) {
  return <span className={cn('inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold', TONE[tone], className)} {...p} />;
}
export function Stat({ label, value, hint, icon }: { label: string; value: ReactNode; hint?: string; icon?: ReactNode }) {
  return (
    <Card className="flex items-start gap-3">
      {icon && <div className="rounded-xl bg-brand/10 p-2 text-brand" aria-hidden>{icon}</div>}
      <div><div className="text-sm text-muted">{label}</div><div className="text-2xl font-bold">{value}</div>{hint && <div className="text-xs text-muted">{hint}</div>}</div>
    </Card>
  );
}

/* ---------- Skeleton, EmptyState, spinners ---------- */
export const Skeleton = ({ className }: { className?: string }) => <div className={cn('skeleton h-4 w-full', className)} aria-hidden />;
export function EmptyState({ icon, title, body, action }: { icon?: ReactNode; title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-line bg-surface/60 px-6 py-10 text-center">
      {icon && <div className="text-muted" aria-hidden>{icon}</div>}
      <h3 className="text-lg font-semibold">{title}</h3>
      {body && <p className="max-w-md text-sm text-muted">{body}</p>}
      {action}
    </div>
  );
}
export function FullPageSpinner() {
  return <div className="grid min-h-[50vh] place-items-center" role="status" aria-live="polite"><Loader2 className="h-8 w-8 animate-spin text-brand" /><span className="sr-only">Loading…</span></div>;
}

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { X, CheckCircle2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLang } from '@/i18n';

/** Native <dialog>: focus trap, Esc to close and aria-modal come for free. `sheet` slides from the bottom on phones. */
export function Dialog({ open, onClose, title, children, sheet }: { open: boolean; onClose: () => void; title: string; children: ReactNode; sheet?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  const { t } = useLang();
  useEffect(() => {
    const d = ref.current; if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} onClose={onClose} onClick={(e) => { if (e.target === ref.current) onClose(); }} aria-label={title}
      className={cn('w-[min(32rem,calc(100vw-1.5rem))] rounded-2xl border border-line bg-surface p-0 text-ink shadow-2xl backdrop:bg-black/50',
        sheet && 'm-0 mt-auto w-full max-w-none rounded-b-none sm:m-auto sm:w-[32rem] sm:rounded-2xl')}>
      <div className="flex items-center justify-between border-b border-line px-5 py-3">
        <h2 className="text-lg font-semibold">{title}</h2>
        <button onClick={onClose} aria-label={t('common.close')} className="grid h-11 w-11 place-items-center rounded-xl hover:bg-surface2"><X className="h-5 w-5" /></button>
      </div>
      <div className="p-5">{children}</div>
    </dialog>
  );
}
export const Sheet = (p: Omit<Parameters<typeof Dialog>[0], 'sheet'>) => <Dialog {...p} sheet />;

/* ---------- Toasts ---------- */
type ToastItem = { id: number; text: string; tone: 'ok' | 'error' };
const ToastCtx = createContext<(text: string, tone?: ToastItem['tone']) => void>(() => undefined);
export const useToast = () => useContext(ToastCtx);
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, set] = useState<ToastItem[]>([]);
  const push = useCallback((text: string, tone: ToastItem['tone'] = 'ok') => {
    const id = Date.now() + Math.random();
    set((l) => [...l, { id, text, tone }]);
    setTimeout(() => set((l) => l.filter((x) => x.id !== id)), 4500);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-20 z-50 flex flex-col items-center gap-2 px-3 sm:bottom-6" role="status" aria-live="polite">
        {items.map((i) => (
          <div key={i.id} className="pointer-events-auto flex items-center gap-2 rounded-xl border border-line bg-surface px-4 py-3 text-sm shadow-lg">
            {i.tone === 'ok' ? <CheckCircle2 className="h-5 w-5 text-clear" aria-hidden /> : <AlertCircle className="h-5 w-5 text-stop" aria-hidden />}{i.text}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

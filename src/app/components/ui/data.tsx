import { useId, useMemo, useState, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLang } from '@/i18n';

/* ---------- DataTable: sort, filter, paginate ---------- */
export interface Column<R> { key: string; header: string; render?: (r: R) => ReactNode; value?: (r: R) => string | number; sortable?: boolean }
export function DataTable<R extends { id: string | number }>({ rows, columns, pageSize = 8, empty }: { rows: R[]; columns: Column<R>[]; pageSize?: number; empty?: ReactNode }) {
  const { t } = useLang();
  const [q, setQ] = useState(''); const [sort, setSort] = useState<{ key: string; dir: 1 | -1 } | null>(null); const [page, setPage] = useState(0);
  const val = (r: R, c: Column<R>) => (c.value ? c.value(r) : String((r as any)[c.key] ?? ''));
  const shown = useMemo(() => {
    let l = rows.filter((r) => !q || columns.some((c) => String(val(r, c)).toLowerCase().includes(q.toLowerCase())));
    if (sort) { const c = columns.find((x) => x.key === sort.key)!; l = [...l].sort((a, b) => (val(a, c) > val(b, c) ? 1 : -1) * sort.dir); }
    return l;
  }, [rows, columns, q, sort]);
  const pages = Math.max(1, Math.ceil(shown.length / pageSize)); const p = Math.min(page, pages - 1);
  return (
    <div className="space-y-3">
      <label className="relative block max-w-xs"><span className="sr-only">{t('common.search')}</span>
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
        <input value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} placeholder={t('common.search')} className="min-h-[44px] w-full rounded-xl border border-line bg-surface pl-9 pr-3 text-sm" /></label>
      <div className="overflow-x-auto rounded-2xl border border-line">
        <table className="w-full text-left text-sm">
          <thead className="bg-surface2 text-muted"><tr>{columns.map((c) => (
            <th key={c.key} scope="col" aria-sort={sort?.key === c.key ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'} className="px-4 py-3 font-semibold">
              {c.sortable ? <button className="inline-flex items-center gap-1" onClick={() => setSort(sort?.key === c.key ? { key: c.key, dir: (sort.dir * -1) as 1 | -1 } : { key: c.key, dir: 1 })}>
                {c.header}{sort?.key === c.key && (sort.dir === 1 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}</button> : c.header}</th>))}</tr></thead>
          <tbody className="divide-y divide-line bg-surface">
            {shown.slice(p * pageSize, p * pageSize + pageSize).map((r) => <tr key={r.id}>{columns.map((c) => <td key={c.key} className="px-4 py-3">{c.render ? c.render(r) : val(r, c)}</td>)}</tr>)}
            {shown.length === 0 && <tr><td colSpan={columns.length} className="px-4 py-8 text-center text-muted">{empty ?? t('common.empty')}</td></tr>}
          </tbody>
        </table>
      </div>
      {pages > 1 && (
        <div className="flex items-center justify-end gap-2 text-sm">
          <button disabled={p === 0} onClick={() => setPage(p - 1)} aria-label="Previous page" className="grid h-11 w-11 place-items-center rounded-xl border border-line disabled:opacity-40"><ChevronLeft className="h-4 w-4" /></button>
          <span>{p + 1} / {pages}</span>
          <button disabled={p >= pages - 1} onClick={() => setPage(p + 1)} aria-label="Next page" className="grid h-11 w-11 place-items-center rounded-xl border border-line disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button>
        </div>
      )}
    </div>
  );
}

/* ---------- Combobox: searchable, keyboard friendly (used for Mouza / Upazila pickers in Round 3) ---------- */
export function Combobox({ label, options, value, onChange, placeholder }: { label: string; options: { value: string; label: string }[]; value: string | null; onChange: (v: string) => void; placeholder?: string }) {
  const id = useId(); const [open, setOpen] = useState(false); const [q, setQ] = useState(''); const [hi, setHi] = useState(0);
  const list = options.filter((o) => o.label.toLowerCase().includes(q.toLowerCase())).slice(0, 50);
  const chosen = options.find((o) => o.value === value);
  const pick = (v: string) => { onChange(v); setOpen(false); setQ(''); };
  return (
    <div className="relative space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium">{label}</label>
      <input id={id} role="combobox" aria-expanded={open} aria-controls={`${id}-list`} aria-autocomplete="list" autoComplete="off"
        value={open ? q : chosen?.label ?? ''} placeholder={placeholder}
        onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 120)}
        onChange={(e) => { setQ(e.target.value); setHi(0); setOpen(true); }}
        onKeyDown={(e) => { if (e.key === 'ArrowDown') { setHi(Math.min(hi + 1, list.length - 1)); e.preventDefault(); } else if (e.key === 'ArrowUp') { setHi(Math.max(hi - 1, 0)); e.preventDefault(); } else if (e.key === 'Enter' && list[hi]) { pick(list[hi].value); e.preventDefault(); } else if (e.key === 'Escape') setOpen(false); }}
        className="min-h-[44px] w-full rounded-xl border border-line bg-surface px-3 text-base" />
      {open && (
        <ul id={`${id}-list`} role="listbox" className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-xl border border-line bg-surface shadow-lg">
          {list.map((o, i) => <li key={o.value} role="option" aria-selected={o.value === value} onMouseDown={() => pick(o.value)} className={cn('cursor-pointer px-3 py-2.5', i === hi && 'bg-surface2', o.value === value && 'font-semibold')}>{o.label}</li>)}
          {list.length === 0 && <li className="px-3 py-2.5 text-muted">—</li>}
        </ul>
      )}
    </div>
  );
}

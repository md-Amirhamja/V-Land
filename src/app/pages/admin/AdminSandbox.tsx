import { useState } from 'react';
import { supabase } from '@/lib/supabase';

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown) => (typeof v === 'string' || typeof v === 'number' ? String(v) : '');

function findFindings(out: unknown): Obj[] {
  if (!isObj(out)) return [];
  if (Array.isArray(out.findings)) return out.findings.filter(isObj);
  const ev = out.evaluation;
  if (isObj(ev) && Array.isArray(ev.findings)) return ev.findings.filter(isObj);
  return [];
}

function findVerdict(out: unknown): string {
  if (!isObj(out)) return '';
  if (out.verdict) return str(out.verdict);
  const ev = out.evaluation;
  return isObj(ev) ? str(ev.verdict) : '';
}

export default function AdminSandbox() {
  const [code, setCode] = useState('SCN-01');
  const [plotInfo, setPlotInfo] = useState('');
  const [fn, setFn] = useState('admin_evaluate_plot');
  const [args, setArgs] = useState('{\n  "p_plot": 0,\n  "p_seller_name": "",\n  "p_seller_father": ""\n}');
  const [out, setOut] = useState<unknown>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function findPlot() {
    setErr('');
    const q = code.trim();
    const base = supabase.from('plots').select('id, scenario_code, area_decimal, land_class');
    const { data, error } = /^\d+$/.test(q) ? await base.eq('id', Number(q)).limit(1) : await base.eq('scenario_code', q.toUpperCase()).limit(1);
    if (error) { setErr(error.message); return; }
    if (!data || data.length === 0) { setErr('No plot found'); return; }
    const p = data[0] as Obj;
    setPlotInfo(`id ${str(p.id)} / ${str(p.scenario_code) || 'no scenario'} / ${str(p.area_decimal)} decimal / ${str(p.land_class)}`);
    try {
      const cur = JSON.parse(args) as Obj;
      cur.p_plot = p.id;
      setArgs(JSON.stringify(cur, null, 2));
    } catch {
      setErr('Args box is not valid JSON, fix it and search again');
    }
  }

  async function run() {
    setErr(''); setOut(null); setBusy(true);
    try {
      const parsed = JSON.parse(args) as Obj;
      const { data, error } = await supabase.rpc(fn, parsed);
      if (error) setErr(error.message); else setOut(data);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(false);
    }
  }

  const findings = findFindings(out);
  const verdict = findVerdict(out);
  const field = 'rounded-lg border border-line bg-surface2 px-3 py-2 text-sm';
  const btn = 'min-h-[44px] rounded-xl bg-brand px-4 text-sm font-semibold text-brand-fg';

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Verification sandbox</h1>
      <div className="flex flex-wrap items-center gap-2">
        <input className={field} value={code} onChange={(e) => setCode(e.target.value)} aria-label="Plot id or scenario code" />
        <button className={btn} onClick={findPlot}>Find plot</button>
        <span className="text-sm text-muted">{plotInfo}</span>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <input className={`${field} w-full`} value={fn} onChange={(e) => setFn(e.target.value)} aria-label="Function name" />
          <textarea className={`${field} h-48 w-full font-mono`} value={args} onChange={(e) => setArgs(e.target.value)} aria-label="Arguments JSON" />
          <button className={btn} onClick={run} disabled={busy}>{busy ? 'Running...' : 'Run'}</button>
          {err && <p role="alert" className="text-sm text-red-500">{err}</p>}
        </div>
        <div className="space-y-2">
          {verdict && <p className="text-lg font-bold uppercase">Verdict: {verdict}</p>}
          <ul className="space-y-2">
            {findings.map((f, i) => (
              <li key={i} className="rounded-xl border border-line p-3 text-sm">
                <b>{str(f.code ?? f.rule)}</b> {str(f.severity)} {str(f.title_en ?? f.title)}
                <div className="text-muted">{str(f.detail_en ?? f.detail)}</div>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <pre className="max-h-96 overflow-auto rounded-xl border border-line bg-surface2 p-3 text-xs">{out ? JSON.stringify(out, null, 2) : ''}</pre>
    </div>
  );
}

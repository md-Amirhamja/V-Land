import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';

type Any = any;
const bn = () => (localStorage.getItem('lang') ?? 'bn') === 'bn';
const tx = (b: string, e: string) => (bn() ? b : e);
const COLORS: Record<string, string> = { clear: 'bg-green-700', caution: 'bg-amber-600', stop: 'bg-red-600' };
const WORDS: Record<string, [string, string]> = { clear: ['নিরাপদ', 'Clear'], caution: ['সতর্কতা', 'Caution'], stop: ['থামুন', 'Stop'] };
const field = 'min-h-[44px] w-full rounded-xl border border-line bg-surface px-3 text-sm';
const btn = 'min-h-[44px] rounded-xl bg-brand px-4 text-sm font-semibold text-brand-fg disabled:opacity-50';

function find(o: Any, key: string): Any {
  if (!o || typeof o !== 'object') return undefined;
  if (key in o) return o[key];
  for (const v of Object.values(o)) { const r = find(v, key); if (r !== undefined) return r; }
  return undefined;
}

export default function PortalVerify() {
  const [sp] = useSearchParams();
  const [areas, setAreas] = useState<Any[]>([]);
  const [area, setArea] = useState(sp.get('area') ?? '');
  const [mouzas, setMouzas] = useState<Any[]>([]);
  const [f, setF] = useState({ mouza: '', survey: 'RS', khatian: '', dag: '' });
  const [plots, setPlots] = useState<Any[] | null>(null);
  const [plot, setPlot] = useState<Any>(null);
  const [s, setS] = useState({ seller: '', father: '', share: '', area: '', intent: 'buy' });
  const [res, setRes] = useState<Any>(null);
  const [signed, setSigned] = useState(false);
  const [cert, setCert] = useState<Any>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.from('geo_units').select('glb_key,name_bn,name_en').eq('level', 'area').order('name_en').then(({ data }) => setAreas(data ?? []));
    supabase.auth.getSession().then(({ data }) => setSigned(!!data.session));
  }, []);
  useEffect(() => {
    if (!area) { setMouzas([]); return; }
    supabase.rpc('list_mouzas', { p_glb: area }).then(({ data }) => setMouzas((data as Any[]) ?? []));
  }, [area]);

  async function search() {
    setErr(''); setBusy(true); setPlot(null);
    const { data, error } = await supabase.rpc('search_plots_by_record', { p_mouza: Number(f.mouza), p_survey: f.survey, p_khatian: f.khatian || null, p_dag: f.dag || null });
    setBusy(false);
    if (error) { setErr(error.message + (error.message.includes('JWT') || error.code === '42501' ? ' (sign in first)' : '')); return; }
    const list = Array.isArray(data) ? data : (find(data, 'plots') ?? []);
    setPlots(list); if (list.length === 1) setPlot(list[0]);
  }
  async function run() {
    setErr(''); setBusy(true); setCert(null);
    const pid = plot.plot_id ?? plot.id;
    const base = { p_plot: pid, p_seller_name: s.seller || null };
    const { data, error } = signed
      ? await supabase.rpc('run_verification', { ...base, p_seller_father: s.father || null, p_share_claimed: s.share ? Number(s.share) : null, p_area_claimed: s.area ? Number(s.area) : null, p_intent: s.intent })
      : await supabase.rpc('quick_check', base);
    setBusy(false);
    if (error) setErr(error.message); else setRes(data);
  }
  async function issue() {
    setErr(''); setBusy(true);
    const vid = find(res, 'verification_id') ?? find(res, 'id');
    const { data, error } = await supabase.rpc('issue_report', { p_verification: vid });
    setBusy(false);
    if (error) setErr(error.message); else setCert(data);
  }

  const verdict: string | undefined = find(res, 'verdict');
  const findings: Any[] = find(res, 'findings') ?? find(res, 'reasons') ?? [];
  const steps: Any[] = find(res, 'next_steps') ?? [];
  const code = cert ? find(cert, 'code') : null;
  const L = (o: Any, k: string) => o?.[`${k}_${bn() ? 'bn' : 'en'}`] ?? o?.[k] ?? '';

  return (
    <div className="mx-auto max-w-2xl space-y-5 p-4">
      <h1 className="text-xl font-bold">{tx('প্লট যাচাই', 'Verify a plot')}</h1>
      <section className="space-y-3 rounded-2xl border border-line bg-surface2 p-4">
        <h2 className="font-semibold">1. {tx('কোথায়', 'Where')}</h2>
        <select aria-label="area" className={field} value={area} onChange={(e) => setArea(e.target.value)}>
          <option value="">{tx('উপজেলা বাছুন', 'Choose upazila')}</option>
          {areas.map((a) => <option key={a.glb_key} value={a.glb_key}>{bn() ? a.name_bn : a.name_en}</option>)}
        </select>
        <select aria-label="mouza" className={field} value={f.mouza} onChange={(e) => setF({ ...f, mouza: e.target.value })}>
          <option value="">{tx('মৌজা', 'Mouza')}</option>
          {mouzas.map((m) => <option key={m.id} value={m.id}>{bn() ? m.name_bn : m.name_en} {m.jl_no ? `(JL ${m.jl_no})` : ''}</option>)}
        </select>
        <div className="grid grid-cols-3 gap-2">
          <select aria-label="survey" className={field} value={f.survey} onChange={(e) => setF({ ...f, survey: e.target.value })}>{['CS', 'SA', 'RS', 'BS', 'DIGITAL'].map((x) => <option key={x}>{x}</option>)}</select>
          <input aria-label="khatian" className={field} placeholder={tx('খতিয়ান', 'Khatian')} value={f.khatian} onChange={(e) => setF({ ...f, khatian: e.target.value })} />
          <input aria-label="dag" className={field} placeholder={tx('দাগ', 'Dag')} value={f.dag} onChange={(e) => setF({ ...f, dag: e.target.value })} />
        </div>
        <button className={btn} disabled={!f.mouza || busy} onClick={search}>{tx('খুঁজুন', 'Find plot')}</button>
        {plots && plots.length === 0 && <p className="text-sm">{tx('কোনো প্লট পাওয়া যায়নি। অন্য জরিপ বেছে দেখুন।', 'No plot found. Try another survey type.')}</p>}
        {plots && plots.length > 1 && <ul className="space-y-1">{plots.map((p) => <li key={p.plot_id ?? p.id}><button className="min-h-[44px] w-full rounded-xl border border-line px-3 text-left text-sm" onClick={() => setPlot(p)}>{p.label ?? p.plot_id ?? p.id}</button></li>)}</ul>}
        {plot && <p className="rounded-xl bg-surface p-2 text-sm">✔ {tx('নির্বাচিত', 'Selected')}: {plot.label ?? plot.plot_id ?? plot.id}</p>}
      </section>

      {plot && <section className="space-y-3 rounded-2xl border border-line bg-surface2 p-4">
        <h2 className="font-semibold">2. {tx('বিক্রেতা', 'Seller')}</h2>
        <input aria-label="seller" className={field} placeholder={tx('বিক্রেতার নাম', 'Seller name')} value={s.seller} onChange={(e) => setS({ ...s, seller: e.target.value })} />
        {signed && <>
          <input aria-label="father" className={field} placeholder={tx('পিতার নাম', "Father's name")} value={s.father} onChange={(e) => setS({ ...s, father: e.target.value })} />
          <div className="grid grid-cols-2 gap-2">
            <input aria-label="share" className={field} placeholder={tx('অংশ (যেমন 0.33)', 'Share offered (e.g. 0.33)')} value={s.share} onChange={(e) => setS({ ...s, share: e.target.value })} />
            <input aria-label="area claimed" className={field} placeholder={tx('শতাংশ', 'Area (decimal)')} value={s.area} onChange={(e) => setS({ ...s, area: e.target.value })} />
          </div></>}
        {!signed && <p className="text-xs text-muted">{tx('পূর্ণ ডসিয়ারের জন্য ', 'For the full dossier ')}<Link className="underline" to="/portal/login">{tx('লগইন করুন', 'sign in')}</Link></p>}
        <button className={btn} disabled={busy} onClick={run}>{tx('যাচাই চালান', 'Run check')}</button>
      </section>}

      {err && <p role="alert" className="rounded-xl bg-red-600/15 p-3 text-sm text-red-500">{err}</p>}

      {res && <section className="space-y-3 rounded-2xl border border-line p-4" aria-live="polite">
        {verdict && <div className={`rounded-xl p-4 text-white ${COLORS[verdict] ?? 'bg-surface2'}`}>
          <div className="text-2xl font-bold">{verdict === 'stop' ? '⛔' : verdict === 'caution' ? '⚠️' : '✅'} {(WORDS[verdict] ?? [verdict, verdict])[bn() ? 0 : 1]}</div></div>}
        {findings.length === 0 && verdict === 'clear' && <p className="text-sm">{tx('কোনো ঝুঁকি পাওয়া যায়নি।', 'No risks found.')}</p>}
        {findings.map((x, i) => <div key={i} className="rounded-xl border border-line p-3 text-sm">
          <div className="font-semibold">{x.code ?? x.rule} · {L(x, 'title')}</div>
          {L(x, 'detail') && <p>{L(x, 'detail')}</p>}
          {L(x, 'advice') && <p className="text-muted">→ {L(x, 'advice')}</p>}</div>)}
        {steps.length > 0 && <div><h3 className="text-sm font-semibold">{tx('পরবর্তী করণীয়', 'Next steps')}</h3><ul className="list-disc pl-5 text-sm">{steps.map((x, i) => <li key={i}>{L(x, '') || x.bn || x.en || JSON.stringify(x)}</li>)}</ul></div>}
        {signed && <button className={btn} disabled={busy} onClick={issue}>{tx('সনদ নিন', 'Get certified report')}</button>}
        {code && <p className="text-sm">{tx('কোড', 'Code')}: <b>{code}</b> · <Link className="underline" to={`/verify/${code}`}>{tx('যাচাই পাতা', 'Public check page')}</Link></p>}
        <details><summary className="cursor-pointer text-xs text-muted">raw</summary><pre className="max-h-72 overflow-auto text-xs">{JSON.stringify(res, null, 2)}</pre></details>
        <p className="text-center text-xs text-muted">{tx('ডেমো ডেটা — সিদ্ধান্ত-সহায়তা, আইনি পরামর্শ নয়।', 'Demo data. Decision support, not legal advice.')}</p>
      </section>}
    </div>
  );
}

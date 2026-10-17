import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useLang } from '@/i18n';

const SURVEYS = ['CS', 'SA', 'RS', 'BS', 'DIGITAL'];
const TONE: Record<string, string> = { clear: 'bg-green-600', caution: 'bg-amber-500', stop: 'bg-red-600' };
const WORD: Record<string, [string, string, string]> = { clear: ['নিরাপদ', 'CLEAR', '✔'], caution: ['সতর্কতা', 'CAUTION', '⚠'], stop: ['থামুন', 'STOP', '✖'] };
const inp = 'min-h-[44px] w-full rounded-xl border border-line bg-surface px-3 text-sm';
const displayLabel = (value: any, fallback: string) => typeof value === 'object' ? value?.bn ?? value?.en ?? fallback : value ?? fallback;

export default function PortalCheck() {
  const { lang } = useLang();
  const [searchParams] = useSearchParams();
  const selectedScenario = searchParams.get('scenario');
  const en = lang === 'en';
  const tx = (bn: string, e: string) => (en ? e : bn);
  const pick = (o: any, k: string) => o?.[`${k}_${en ? 'en' : 'bn'}`] ?? o?.[k] ?? '';
  const [signed, setSigned] = useState(false);
  const [mouzas, setMouzas] = useState<any[]>([]);
  const [scn, setScn] = useState<any[]>([]);
  const [f, setF] = useState({ mouza: '', survey: 'RS', khatian: '', dag: '', seller: '', father: '' });
  const [plots, setPlots] = useState<any[] | null>(null);
  const [res, setRes] = useState<any>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSigned(!!data.session));
    supabase.rpc('list_mouzas').then(({ data }) => setMouzas(data ?? []));
    supabase.rpc('list_scenarios').then(({ data }) => setScn(data ?? []));
  }, []);

  async function search() {
    setErr(''); setPlots(null); setRes(null); setBusy(true);
    const { data, error } = await supabase.rpc('search_plots_by_record', { p_mouza: Number(f.mouza), p_survey: f.survey, p_khatian: f.khatian || null, p_dag: f.dag || null });
    setBusy(false);
    if (error) return setErr(error.message);
    setPlots(Array.isArray(data) ? data : data?.plots ?? []);
  }
  async function run(id: number) {
    setErr(''); setRes(null); setBusy(true);
    const seller = f.seller.trim() || null;
    const r = signed
      ? await supabase.rpc('run_verification', { p_plot: id, p_seller_name: seller, p_seller_father: f.father.trim() || null })
      : await supabase.rpc('quick_check', { p_plot: id, p_seller_name: seller });
    setBusy(false);
    if (r.error) return setErr(r.error.message);
    setRes(r.data);
  }

  const ev = res?.evaluation ?? res;
  const verdict: string | undefined = ev?.verdict;
  const findings: any[] = ev?.findings ?? ev?.reasons ?? [];
  const w = verdict ? WORD[verdict] : null;
  const shownScenarios = selectedScenario ? scn.filter((scenario) => scenario.code === selectedScenario) : scn;

  return (
    <div className="mx-auto max-w-3xl space-y-5 p-4">
      <h1 className="text-2xl font-bold">{tx('প্লট যাচাই', 'Check a plot')}</h1>
      <section className="space-y-3 rounded-2xl border border-line bg-surface2 p-4">
        <h2 className="font-semibold">{tx('১. দ্রুত ডেমো (১৫টি দৃশ্যপট)', '1. Quick demo (15 scenarios)')}</h2>
        <div className="flex flex-wrap gap-2">
          {shownScenarios.map((s) => <button key={s.code} onClick={() => run(s.plot_id)} className="min-h-[44px] rounded-xl border border-line px-3 text-sm hover:bg-surface">{s.code}</button>)}
        </div>
      </section>
      <section className="space-y-3 rounded-2xl border border-line bg-surface2 p-4">
        <h2 className="font-semibold">{tx('২. রেকর্ড নম্বর দিয়ে খুঁজুন', '2. Search by record numbers')}</h2>
        {!signed && <p className="text-sm text-muted">{tx('খুঁজতে লগইন করুন।', 'Sign in to search.')} <Link className="underline" to="/portal/login">{tx('লগইন', 'Sign in')}</Link></p>}
        <select aria-label="mouza" className={inp} value={f.mouza} onChange={(e) => setF({ ...f, mouza: e.target.value })}>
          <option value="">{tx('মৌজা বাছুন', 'Select mouza')}</option>
          {mouzas.map((m) => <option key={m.id} value={m.id}>{pick(m, 'name')} · {m.area}</option>)}
        </select>
        <div className="grid grid-cols-3 gap-2">
          <select aria-label="survey" className={inp} value={f.survey} onChange={(e) => setF({ ...f, survey: e.target.value })}>{SURVEYS.map((s) => <option key={s}>{s}</option>)}</select>
          <input className={inp} placeholder={tx('খতিয়ান', 'Khatian')} value={f.khatian} onChange={(e) => setF({ ...f, khatian: e.target.value })} />
          <input className={inp} placeholder={tx('দাগ', 'Dag')} value={f.dag} onChange={(e) => setF({ ...f, dag: e.target.value })} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <input className={inp} placeholder={tx('বিক্রেতার নাম', 'Seller name')} value={f.seller} onChange={(e) => setF({ ...f, seller: e.target.value })} />
          <input className={inp} placeholder={tx('পিতার নাম', "Father's name")} value={f.father} onChange={(e) => setF({ ...f, father: e.target.value })} />
        </div>
        <button disabled={!f.mouza || !signed || busy} onClick={search} className="min-h-[44px] rounded-xl bg-brand px-4 text-sm font-semibold text-brand-fg disabled:opacity-50">{tx('খুঁজুন', 'Search')}</button>
        {plots && plots.length === 0 && <p className="text-sm">{tx('কোনো প্লট পাওয়া যায়নি। সার্ভে ধরন বদলে দেখুন।', 'No plot found. Try another survey type.')}</p>}
        {plots?.map((p, i) => { const id = p.id ?? p.plot_id; return (
          <button key={id ?? i} onClick={() => run(id)} className="block min-h-[44px] w-full rounded-xl border border-line px-3 text-left text-sm hover:bg-surface">{displayLabel(p.label, `#${id}`)}</button>); })}
      </section>
      {busy && <p role="status" className="text-sm">{tx('যাচাই চলছে…', 'Checking…')}</p>}
      {err && <p role="alert" className="rounded-xl bg-red-600/20 p-3 text-sm">{err}</p>}
      {w && verdict && (
        <section className="space-y-3 rounded-2xl border border-line p-4" aria-live="polite">
          <div className={`rounded-xl p-4 text-2xl font-bold text-white ${TONE[verdict]}`}>{w[2]} {en ? w[1] : w[0]}</div>
          {findings.map((x, i) => (
            <div key={i} className="rounded-xl border border-line bg-surface2 p-3 text-sm">
              <div className="font-semibold">{x.code ?? x.rule} {pick(x, 'title')}</div>
              <div>{pick(x, 'detail')}</div>
              <div className="text-muted">{pick(x, 'advice')}</div>
            </div>))}
          {findings.length === 0 && <p className="text-sm">{tx('কোনো ঝুঁকি পাওয়া যায়নি।', 'No risks found.')}</p>}
          <button onClick={() => window.print()} className="min-h-[44px] rounded-xl border border-line px-4 text-sm">{tx('প্রিন্ট', 'Print')}</button>
        </section>)}
      <p className="text-center text-xs text-muted">{tx('ডেমো ডেটা — সিদ্ধান্ত-সহায়তা, আইনি পরামর্শ নয়।', 'Demonstration data — Decision support, not legal advice.')}</p>
    </div>
  );
}

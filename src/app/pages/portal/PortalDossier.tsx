import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useLang } from '@/i18n';
import { supabase } from '@/lib/supabase';

interface Dossier {
  plot: { id: number; mouza_id: number; area_decimal: number; land_class: string };
  state_hash: string;
  survey: { type: string; khatian_no: string; dag_no: string; recorded_area: number; kind: string }[];
  owners: { share_num: number; share_den: number; acquired_via: string | null; from_date: string | null }[];
  deeds: { deed_no: string; year: number; office: string; type: string; registered_on: string | null; area_sold: number | null; status: string }[];
  mutations: { case_no: string; status: string; filed_on: string | null; decided_on: string | null; office: string | null }[];
  cases: { court: string; case_no: string; type: string; status: string; stay_order: boolean; filed_on: string | null; next_hearing: string | null }[];
  flags: { flag: string; authority: string | null; ref_no: string | null; status: string; from_date: string | null; to_date: string | null }[];
  tax: { fiscal_year: number; amount: number; paid_on: string | null }[];
  events: { type: string; at: string }[];
}
type Tab = 'record' | 'deeds' | 'disputes' | 'tax' | 'activity';

const bn = () => (localStorage.getItem('lang') ?? 'bn') === 'bn';
const tx = (b: string, e: string) => (bn() ? b : e);

function Item({ title, lines }: { title: string; lines: (string | null | undefined | false)[] }) {
  return (
    <div className="rounded-xl border border-line p-3 text-sm">
      <div className="font-semibold">{title}</div>
      {lines.filter(Boolean).map((l, i) => <p key={i} className="text-muted">{l}</p>)}
    </div>
  );
}
const Empty = () => <p className="text-sm text-muted">{tx('কোনো রেকর্ড নেই।', 'Nothing recorded.')}</p>;
const H = ({ children }: { children: string }) => <h2 className="pt-2 text-sm font-semibold">{children}</h2>;

export default function PortalDossier() {
  useLang();
  const { id } = useParams();
  const [d, setD] = useState<Dossier | null>(null);
  const [err, setErr] = useState('');
  const [needSignIn, setNeedSignIn] = useState(false);
  const [done, setDone] = useState(false);
  const [tab, setTab] = useState<Tab>('record');

  useEffect(() => {
    let alive = true;
    setDone(false); setErr(''); setNeedSignIn(false); setD(null);
    if (!id || Number.isNaN(Number(id))) { setDone(true); return; }
    supabase.rpc('plot_dossier', { p_plot: Number(id) }).then(({ data, error }) => {
      if (!alive) return;
      if (error) {
        setErr(error.message);
        setNeedSignIn(error.code === '42501' || /JWT|permission/i.test(error.message));
      } else setD((data as Dossier | null) ?? null);
      setDone(true);
    });
    return () => { alive = false; };
  }, [id]);

  const tabs: [Tab, string][] = [
    ['record', tx('রেকর্ড', 'Record')], ['deeds', tx('দলিল ও নামজারি', 'Deeds')],
    ['disputes', tx('মামলা ও বাধা', 'Disputes')], ['tax', tx('কর', 'Tax')], ['activity', tx('কার্যকলাপ', 'Activity')],
  ];
  const when = (s: string) => new Date(s).toLocaleString(bn() ? 'bn-BD' : 'en-GB');

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Link to="/portal/verify" className="text-sm underline">← {tx('যাচাই', 'Verify')}</Link>
      <h1 className="text-xl font-bold">{tx('প্লট ডসিয়ার', 'Plot dossier')}</h1>
      {!done && <p className="text-sm text-muted">{tx('লোড হচ্ছে…', 'Loading…')}</p>}
      {err && <p role="alert" className="rounded-xl bg-red-600/15 p-3 text-sm text-red-500">{err}</p>}
      {needSignIn && <p className="text-sm"><Link className="underline" to="/portal/login">{tx('ডসিয়ার দেখতে লগইন করুন', 'Sign in to view the dossier')}</Link></p>}
      {done && !err && !d && <p className="text-sm">{tx('প্লট পাওয়া যায়নি।', 'Plot not found.')}</p>}
      {d && <>
        <p className="rounded-xl bg-surface2 p-3 text-sm">
          {d.plot.area_decimal} {tx('শতাংশ', 'decimal')} · {d.plot.land_class}
          <span className="block text-xs text-muted">{tx('রেকর্ড ছাপ', 'Record fingerprint')}: {d.state_hash.slice(0, 10)}…</span>
        </p>
        <div role="tablist" className="flex flex-wrap gap-1">
          {tabs.map(([k, label]) => (
            <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
              className={`min-h-[44px] rounded-xl px-3 text-sm font-semibold ${tab === k ? 'bg-brand text-brand-fg' : 'border border-line'}`}>{label}</button>
          ))}
        </div>
        <div role="tabpanel" className="space-y-2">
          {tab === 'record' && <>
            <H>{tx('মালিকানা', 'Ownership')}</H>
            {d.owners.length === 0 ? <Empty /> : d.owners.map((o, i) => (
              <Item key={i} title={`${o.share_num}/${o.share_den} ${tx('অংশ', 'share')}`}
                lines={[o.acquired_via && `${tx('উপায়', 'Via')}: ${o.acquired_via}`, o.from_date && `${tx('থেকে', 'Since')}: ${o.from_date}`]} />
            ))}
            <H>{tx('জরিপ রেকর্ড', 'Survey records')}</H>
            {d.survey.length === 0 ? <Empty /> : d.survey.map((s, i) => (
              <Item key={i} title={`${s.type} · ${tx('খতিয়ান', 'Khatian')} ${s.khatian_no} · ${tx('দাগ', 'Dag')} ${s.dag_no}`}
                lines={[`${tx('পরিমাণ', 'Area')}: ${s.recorded_area} ${tx('শতাংশ', 'decimal')}`, s.kind]} />
            ))}
          </>}
          {tab === 'deeds' && <>
            <H>{tx('দলিল', 'Deeds')}</H>
            {d.deeds.length === 0 ? <Empty /> : d.deeds.map((x, i) => (
              <Item key={i} title={`${x.deed_no} (${x.year})`}
                lines={[`${x.type} · ${x.status}`, x.office, x.registered_on && `${tx('নিবন্ধন', 'Registered')}: ${x.registered_on}`, x.area_sold != null && `${tx('বিক্রীত', 'Area sold')}: ${x.area_sold}`]} />
            ))}
            <H>{tx('নামজারি', 'Mutations')}</H>
            {d.mutations.length === 0 ? <Empty /> : d.mutations.map((m, i) => (
              <Item key={i} title={`${m.case_no} · ${m.status}`}
                lines={[m.office, m.filed_on && `${tx('দায়ের', 'Filed')}: ${m.filed_on}`, m.decided_on && `${tx('নিষ্পত্তি', 'Decided')}: ${m.decided_on}`]} />
            ))}
          </>}
          {tab === 'disputes' && <>
            <H>{tx('মামলা', 'Cases')}</H>
            {d.cases.length === 0 ? <Empty /> : d.cases.map((c, i) => (
              <Item key={i} title={`${c.case_no} · ${c.status}`}
                lines={[c.court, c.type, c.stay_order && tx('স্থগিতাদেশ কার্যকর', 'Stay order in force'), c.next_hearing && `${tx('পরবর্তী শুনানি', 'Next hearing')}: ${c.next_hearing}`]} />
            ))}
            <H>{tx('নিষেধাজ্ঞা ও চিহ্ন', 'Flags')}</H>
            {d.flags.length === 0 ? <Empty /> : d.flags.map((f, i) => (
              <Item key={i} title={`${f.flag} · ${f.status}`}
                lines={[f.authority, f.ref_no, f.from_date && `${tx('থেকে', 'From')}: ${f.from_date}`, f.to_date && `${tx('পর্যন্ত', 'To')}: ${f.to_date}`]} />
            ))}
          </>}
          {tab === 'tax' && (d.tax.length === 0 ? <Empty /> : d.tax.map((t) => (
            <Item key={t.fiscal_year} title={String(t.fiscal_year)}
              lines={[`${tx('পরিমাণ', 'Amount')}: ${t.amount}`, t.paid_on ? `${tx('পরিশোধ', 'Paid')}: ${t.paid_on}` : tx('অপরিশোধিত', 'Unpaid')]} />
          )))}
          {tab === 'activity' && (d.events.length === 0 ? <Empty /> : d.events.map((e, i) => <Item key={i} title={e.type} lines={[when(e.at)]} />))}
        </div>
        <p className="text-center text-xs text-muted">{tx('ডেমো ডেটা — সিদ্ধান্ত-সহায়তা, আইনি পরামর্শ নয়।', 'Demo data. Decision support, not legal advice.')}</p>
      </>}
    </div>
  );
}

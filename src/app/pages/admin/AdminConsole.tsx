import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

type Any = any;
const BLOCKERS = ['R01', 'R02', 'R03', 'R05', 'R19'];
const field = 'min-h-[40px] rounded-lg border border-line bg-surface px-2 text-sm';
const btn = 'min-h-[40px] rounded-lg bg-brand px-3 text-sm font-semibold text-brand-fg disabled:opacity-50';
const ghost = 'min-h-[40px] rounded-lg border border-line px-3 text-sm disabled:opacity-50';
const card = 'rounded-2xl border border-line bg-surface2 p-4';
const Head = ({ cols }: { cols: string[] }) => <thead><tr className="text-xs uppercase text-muted">{cols.map((c) => <th key={c} className="p-2">{c}</th>)}</tr></thead>;

export default function AdminConsole({ tab }: { tab: string }) {
  const [rows, setRows] = useState<Any[]>([]);
  const [extra, setExtra] = useState<Any[]>([]);
  const [stats, setStats] = useState<Any>(null);
  const [msg, setMsg] = useState('');
  const [tick, setTick] = useState(0);
  const [note, setNote] = useState<Record<string, string>>({});
  const [ed, setEd] = useState<Record<string, Any>>({});
  const [confirm, setConfirm] = useState('');
  const [plotKey, setPlotKey] = useState('SCN-01');
  const [lookup, setLookup] = useState('SCN-01');
  const [plot, setPlot] = useState<Any>(null);
  const [rec, setRec] = useState<Any>({ flags: [], muts: [], deeds: [] });
  const [cs, setCs] = useState({ court: '', no: '', stay: false });

  useEffect(() => {
    let on = true;
    (async () => {
      let r: Any[] = []; let e: Any[] = [];
      if (tab === 'fraud') r = (await supabase.from('fraud_signals').select('*').order('id', { ascending: false }).limit(100)).data ?? [];
      else if (tab === 'inbox') {
        r = (await supabase.from('objections').select('*').eq('status', 'open').order('id')).data ?? [];
        e = (await supabase.from('fraud_reports').select('*').eq('status', 'open').order('id')).data ?? [];
      } else if (tab === 'rules') r = (await supabase.from('risk_rules').select('*').order('code')).data ?? [];
      else if (tab === 'reports') r = (await supabase.from('reports').select('id,code,issued_at,expires_at,revoked,revoked_reason').order('id', { ascending: false }).limit(100)).data ?? [];
      else if (tab === 'audit') r = (await supabase.from('audit_log').select('id,actor,action,entity,entity_id,created_at').order('id', { ascending: false }).limit(100)).data ?? [];
      else if (tab === 'system') { const s = await supabase.rpc('admin_stats'); if (on) setStats(s.data ?? s.error?.message); }
      if (on) { setRows(r); setExtra(e); }
    })();
    return () => { on = false; };
  }, [tab, tick]);

  useEffect(() => {
    if (tab !== 'records') return;
    let on = true;
    (async () => {
      const q = lookup.trim();
      const sel = supabase.from('plots').select('id,scenario_code,area_decimal,land_class');
      const { data } = /^\d+$/.test(q) ? await sel.eq('id', Number(q)).maybeSingle() : await sel.eq('scenario_code', q.toUpperCase()).maybeSingle();
      if (!on) return;
      setPlot(data ?? null);
      if (!data) { setRec({ flags: [], muts: [], deeds: [] }); return; }
      const [f, m, d] = await Promise.all([
        supabase.from('land_flags').select('*').eq('plot_id', data.id).order('id'),
        supabase.from('mutations').select('*').eq('plot_id', data.id).order('id'),
        supabase.from('deeds').select('id,deed_no,year,deed_type,registered_on').eq('plot_id', data.id).order('id'),
      ]);
      if (on) setRec({ flags: f.data ?? [], muts: m.data ?? [], deeds: d.data ?? [] });
    })();
    return () => { on = false; };
  }, [tab, tick, lookup]);

  async function act(fn: string, args: Any, ok = 'Done') {
    setMsg('');
    const { data, error } = await supabase.rpc(fn, args);
    if (error) setMsg('Error: ' + error.message);
    else { setMsg(ok + (data && typeof data === 'object' ? ' — ' + JSON.stringify(data) : '')); setTick((x) => x + 1); }
  }
  const tickets = [...rows.map((r) => ({ ...r, kind: 'objection' })), ...extra.map((r) => ({ ...r, kind: 'fraud_report' }))];

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold capitalize">{tab}</h1>
      {msg && <p role="status" className="break-words rounded-xl border border-line bg-surface p-3 text-sm">{msg}</p>}

      {tab === 'system' && <div className="grid gap-3 sm:grid-cols-2">
        <div className={card}><h2 className="mb-2 font-semibold">Stats</h2><pre className="overflow-auto text-xs">{JSON.stringify(stats, null, 2)}</pre></div>
        <div className={card + ' space-y-3'}>
          <button className={btn} onClick={() => act('run_fraud_detection', {}, 'Detection finished')}>Run fraud detection now</button>
          <div className="flex gap-2">
            <input className={field} placeholder="type RESET" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            <button className={ghost} disabled={confirm !== 'RESET'} onClick={() => { act('admin_reset_demo', {}, 'Demo data restored'); setConfirm(''); }}>Reset demo data</button>
          </div>
        </div>
      </div>}

      {tab === 'fraud' && <div className="overflow-x-auto"><table className="w-full text-left text-sm"><Head cols={['id', 'plot', 'type', 'status', 'evidence', 'actions']} />
        <tbody>{rows.map((r) => <tr key={r.id} className="border-t border-line align-top">
          <td className="p-2">{r.id}</td><td className="p-2">{r.plot_id}</td><td className="p-2">{r.signal_type}</td><td className="p-2">{r.status}</td>
          <td className="max-w-xs break-words p-2 text-xs">{JSON.stringify(r.evidence)}</td>
          <td className="space-x-1 whitespace-nowrap p-2">
            {['investigating', 'confirmed', 'dismissed'].map((s) => <button key={s} className={ghost} onClick={() => act('admin_set_signal_status', { p_id: r.id, p_status: s }, 'Updated')}>{s}</button>)}
            <button className={ghost} onClick={() => act('admin_freeze_plot', { p_plot: r.plot_id, p_reason: 'fraud signal ' + r.id }, 'Plot frozen')}>freeze</button>
          </td></tr>)}</tbody></table>
        {rows.length === 0 && <p className="p-3 text-sm text-muted">No signals yet. Run detection from System.</p>}</div>}

      {tab === 'inbox' && <div className="space-y-3">
        {tickets.length === 0 && <p className="text-sm text-muted">No open tickets.</p>}
        {tickets.map((r) => { const k = r.kind + r.id; return (
          <div key={k} className={card + ' space-y-2'}>
            <div className="text-xs text-muted">{r.kind} #{r.id} · plot {r.plot_id} · {r.type}</div>
            <p className="text-sm">{r.message}</p>
            <div className="flex gap-2"><input className={field + ' flex-1'} placeholder="resolution note" value={note[k] ?? ''} onChange={(e) => setNote({ ...note, [k]: e.target.value })} />
              <button className={btn} disabled={!note[k]} onClick={() => act('admin_resolve_ticket', { p_kind: r.kind, p_id: r.id, p_resolution: note[k] }, 'Resolved, citizen notified')}>Resolve</button></div>
          </div>); })}
      </div>}

      {tab === 'rules' && <div className="overflow-x-auto"><table className="w-full text-left text-sm"><Head cols={['code', 'rule', 'severity', 'on', 'weight', 'reason / confirm', '']} />
        <tbody>{rows.map((r) => { const e = ed[r.code] ?? {}; const enabled = e.enabled ?? r.enabled; const weight = e.weight ?? r.weight; return (
          <tr key={r.code} className="border-t border-line align-top">
            <td className="p-2 font-semibold">{r.code}</td><td className="p-2">{r.title_en}</td><td className="p-2">{r.severity}</td>
            <td className="p-2"><input type="checkbox" checked={enabled} onChange={(x) => setEd({ ...ed, [r.code]: { ...e, enabled: x.target.checked } })} /></td>
            <td className="p-2"><input type="number" className={field + ' w-20'} value={weight} onChange={(x) => setEd({ ...ed, [r.code]: { ...e, weight: x.target.value } })} /></td>
            <td className="space-y-1 p-2">
              <input className={field} placeholder="reason (required)" value={e.reason ?? ''} onChange={(x) => setEd({ ...ed, [r.code]: { ...e, reason: x.target.value } })} />
              {BLOCKERS.includes(r.code) && !enabled && <input className={field} placeholder={'type ' + r.code + ' to confirm'} value={e.confirm ?? ''} onChange={(x) => setEd({ ...ed, [r.code]: { ...e, confirm: x.target.value } })} />}
            </td>
            <td className="p-2"><button className={btn} disabled={!e.reason} onClick={() => act('admin_update_rule', { p_code: r.code, p_enabled: enabled, p_weight: Number(weight), p_params: r.params, p_reason: e.reason, p_confirm: e.confirm ?? null }, 'Rule saved')}>Save</button></td>
          </tr>); })}</tbody></table></div>}

      {tab === 'reports' && <div className="overflow-x-auto"><table className="w-full text-left text-sm"><Head cols={['code', 'issued', 'expires', 'status', 'revoke']} />
        <tbody>{rows.map((r) => <tr key={r.id} className="border-t border-line align-top">
          <td className="p-2 font-mono">{r.code}</td><td className="p-2">{String(r.issued_at).slice(0, 10)}</td><td className="p-2">{String(r.expires_at).slice(0, 10)}</td>
          <td className="p-2">{r.revoked ? 'revoked: ' + r.revoked_reason : 'active'}</td>
          <td className="p-2">{!r.revoked && <div className="flex gap-2"><input className={field} placeholder="reason" value={note[r.code] ?? ''} onChange={(e) => setNote({ ...note, [r.code]: e.target.value })} />
            <button className={ghost} disabled={!note[r.code]} onClick={() => act('admin_revoke_report', { p_code: r.code, p_reason: note[r.code] }, 'Revoked')}>Revoke</button></div>}</td></tr>)}</tbody></table></div>}

      {tab === 'audit' && <div className="space-y-3">
        <button className={btn} onClick={() => act('admin_audit_verify', {}, 'Audit chain')}>Verify chain</button>
        <div className="overflow-x-auto"><table className="w-full text-left text-sm"><Head cols={['id', 'when', 'action', 'entity', 'entity id']} />
          <tbody>{rows.map((r) => <tr key={r.id} className="border-t border-line"><td className="p-2">{r.id}</td><td className="p-2">{String(r.created_at).slice(0, 19)}</td><td className="p-2">{r.action}</td><td className="p-2">{r.entity}</td><td className="p-2">{r.entity_id}</td></tr>)}</tbody></table></div>
      </div>}

      {tab === 'records' && <div className="space-y-3">
        <div className="flex gap-2"><input className={field} placeholder="SCN-01 or plot id" value={plotKey} onChange={(e) => setPlotKey(e.target.value)} />
          <button className={btn} onClick={() => setLookup(plotKey)}>Open plot</button></div>
        {!plot && <p className="text-sm text-muted">No plot found.</p>}
        {plot && <>
          <div className={card + ' space-y-2'}>
            <div className="text-sm">Plot {plot.id} · {plot.scenario_code ?? 'ordinary'} · {plot.area_decimal} decimal · {plot.land_class}</div>
            <div className="flex gap-2"><input className={field + ' flex-1'} placeholder="freeze reason" value={note.freeze ?? ''} onChange={(e) => setNote({ ...note, freeze: e.target.value })} />
              <button className={btn} disabled={!note.freeze} onClick={() => act('admin_freeze_plot', { p_plot: plot.id, p_reason: note.freeze }, 'Plot frozen')}>Freeze plot</button></div>
          </div>
          <div className={card + ' space-y-1 text-sm'}><h2 className="font-semibold">Flags</h2>
            {rec.flags.length === 0 && <p className="text-muted">None.</p>}
            {rec.flags.map((f: Any) => <div key={f.id} className="flex items-center gap-2"><span>#{f.id} {f.flag} · {f.status} · {f.ref_no}</span>
              {f.status === 'active' && <button className={ghost} onClick={() => act('admin_release_flag', { p_flag: f.id }, 'Released')}>Release</button>}</div>)}</div>
          <div className={card + ' space-y-1 text-sm'}><h2 className="font-semibold">Deeds and mutations</h2>
            {rec.deeds.map((d: Any) => { const has = rec.muts.some((m: Any) => m.deed_id === d.id); return (
              <div key={d.id} className="flex items-center gap-2"><span>Deed {d.deed_no}/{d.year} · {d.deed_type} · {d.registered_on}</span>
                {!has && <button className={ghost} onClick={() => act('admin_file_mutation', { p_plot: plot.id, p_deed: d.id, p_office: 'AC Land (demo)' }, 'Mutation filed')}>File mutation</button>}</div>); })}
            {rec.muts.map((m: Any) => <div key={m.id} className="flex items-center gap-2"><span>Mutation {m.case_no} · {m.status}</span>
              {m.status === 'pending' && <><button className={btn} onClick={() => act('admin_decide_mutation', { p_mutation: m.id, p_approve: true }, 'Approved')}>Approve</button>
                <button className={ghost} onClick={() => act('admin_decide_mutation', { p_mutation: m.id, p_approve: false }, 'Rejected')}>Reject</button></>}</div>)}</div>
          <div className={card + ' space-y-2'}><h2 className="text-sm font-semibold">Add court case</h2>
            <div className="flex flex-wrap gap-2"><input className={field} placeholder="court" value={cs.court} onChange={(e) => setCs({ ...cs, court: e.target.value })} />
              <input className={field} placeholder="case no" value={cs.no} onChange={(e) => setCs({ ...cs, no: e.target.value })} />
              <label className="flex items-center gap-1 text-sm"><input type="checkbox" checked={cs.stay} onChange={(e) => setCs({ ...cs, stay: e.target.checked })} />stay order</label>
              <button className={btn} disabled={!cs.court || !cs.no} onClick={() => act('admin_add_case', { p_plot: plot.id, p_court: cs.court, p_case_no: cs.no, p_case_type: 'title_suit', p_stay: cs.stay }, 'Case added')}>Add case</button></div></div>
        </>}
      </div>}
    </div>
  );
}

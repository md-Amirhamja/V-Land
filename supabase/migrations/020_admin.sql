set search_path = public, private, extensions;

create or replace function public.admin_freeze_plot(p_plot bigint, p_reason text) returns jsonb
language plpgsql security definer set search_path = public, private as $$
declare fid bigint;
begin
  if not public.is_admin() then raise exception 'admin_only'; end if;
  if not exists (select 1 from public.plots where id = p_plot) then raise exception 'plot_not_found'; end if;
  insert into public.land_flags (plot_id, flag, authority, ref_no, status)
  values (p_plot, 'admin_hold', 'V-Land admin', left(coalesce(p_reason, ''), 200), 'active') returning id into fid;
  perform audit_write(auth.uid(), 'freeze_plot', 'plots', p_plot::text, jsonb_build_object('flag_id', fid, 'reason', p_reason));
  return jsonb_build_object('flag_id', fid);
end $$;

create or replace function public.admin_release_flag(p_flag bigint) returns jsonb
language plpgsql security definer set search_path = public, private as $$
declare pid bigint;
begin
  if not public.is_admin() then raise exception 'admin_only'; end if;
  update public.land_flags set status = 'released', to_date = current_date where id = p_flag and status = 'active' returning plot_id into pid;
  if pid is null then raise exception 'flag_not_found'; end if;
  perform audit_write(auth.uid(), 'release_flag', 'land_flags', p_flag::text, jsonb_build_object('plot', pid));
  return jsonb_build_object('released', p_flag);
end $$;

create or replace function public.admin_add_case(p_plot bigint, p_court text, p_case_no text, p_case_type text, p_stay boolean) returns jsonb
language plpgsql security definer set search_path = public, private as $$
declare cid bigint;
begin
  if not public.is_admin() then raise exception 'admin_only'; end if;
  insert into public.cases (plot_id, court, case_no, case_type, status, stay_order, filed_on)
  values (p_plot, p_court, p_case_no, p_case_type::case_type, 'pending', coalesce(p_stay, false), current_date) returning id into cid;
  perform audit_write(auth.uid(), 'add_case', 'cases', cid::text, jsonb_build_object('plot', p_plot, 'stay', p_stay));
  return jsonb_build_object('case_id', cid);
end $$;

create or replace function public.admin_file_mutation(p_plot bigint, p_deed bigint, p_office text) returns jsonb
language plpgsql security definer set search_path = public, private as $$
declare mid bigint;
begin
  if not public.is_admin() then raise exception 'admin_only'; end if;
  if not exists (select 1 from public.deeds where id = p_deed and plot_id = p_plot) then raise exception 'deed_not_on_plot'; end if;
  insert into public.mutations (plot_id, case_no, deed_id, status, filed_on, office)
  values (p_plot, 'MUT-' || to_char(now(), 'YYMMDDHH24MISS'), p_deed, 'pending', current_date, p_office) returning id into mid;
  perform audit_write(auth.uid(), 'file_mutation', 'mutations', mid::text, jsonb_build_object('plot', p_plot, 'deed', p_deed));
  return jsonb_build_object('mutation_id', mid);
end $$;

-- Approval closes the seller's current rows and opens the buyer's, in one transaction.
-- Simplification: shares move whole; with several buyers the denominator is multiplied by their count.
create or replace function public.admin_decide_mutation(p_mutation bigint, p_approve boolean) returns jsonb
language plpgsql security definer set search_path = public, private as $$
declare m public.mutations%rowtype; r record; b record; nb int := 0; closed int := 0; opened int := 0;
begin
  if not public.is_admin() then raise exception 'admin_only'; end if;
  select * into m from public.mutations where id = p_mutation for update;
  if not found then raise exception 'mutation_not_found'; end if;
  if m.status <> 'pending' then raise exception 'already_decided'; end if;
  if p_approve and m.deed_id is not null then
    select count(*) into nb from public.deed_parties where deed_id = m.deed_id and role = 'buyer';
    for r in
      select o.* from public.ownerships o
      join public.deed_parties dp on dp.person_id = o.person_id and dp.deed_id = m.deed_id and dp.role = 'seller'
      where o.plot_id = m.plot_id and o.to_date is null
    loop
      update public.ownerships set to_date = current_date where id = r.id;
      closed := closed + 1;
      if nb > 0 then
        for b in select person_id from public.deed_parties where deed_id = m.deed_id and role = 'buyer' loop
          insert into public.ownerships (plot_id, person_id, share_num, share_den, acquired_via, source_deed_id, from_date)
          values (m.plot_id, b.person_id, r.share_num, r.share_den * nb, 'deed', m.deed_id, current_date);
          opened := opened + 1;
        end loop;
      end if;
    end loop;
  end if;
  update public.mutations
    set status = case when p_approve then 'approved'::mutation_status else 'rejected'::mutation_status end, decided_on = current_date
    where id = p_mutation;
  perform audit_write(auth.uid(), case when p_approve then 'approve_mutation' else 'reject_mutation' end, 'mutations', p_mutation::text,
    jsonb_build_object('closed', closed, 'opened', opened));
  return jsonb_build_object('closed', closed, 'opened', opened);
end $$;

create or replace function public.admin_revoke_report(p_code text, p_reason text) returns jsonb
language plpgsql security definer set search_path = public, private as $$
declare rid bigint;
begin
  if not public.is_admin() then raise exception 'admin_only'; end if;
  if coalesce(trim(p_reason), '') = '' then raise exception 'reason_required'; end if;
  update public.reports set revoked = true, revoked_reason = p_reason where code = p_code and not revoked returning id into rid;
  if rid is null then raise exception 'report_not_found_or_already_revoked'; end if;
  perform audit_write(auth.uid(), 'revoke_report', 'reports', p_code, jsonb_build_object('reason', p_reason));
  return jsonb_build_object('revoked', p_code);
end $$;

create or replace function public.admin_update_rule(p_code text, p_enabled boolean, p_weight integer, p_params jsonb, p_reason text, p_confirm text default null) returns jsonb
language plpgsql security definer set search_path = public, private as $$
declare old public.risk_rules%rowtype;
begin
  if not public.is_admin() then raise exception 'admin_only'; end if;
  if coalesce(trim(p_reason), '') = '' then raise exception 'reason_required'; end if;
  select * into old from public.risk_rules where code = p_code for update;
  if not found then raise exception 'rule_not_found'; end if;
  if p_code = any (array['R01','R02','R03','R05','R19']) and not p_enabled and p_confirm is distinct from p_code then
    raise exception 'confirmation_required';
  end if;
  insert into public.risk_rules_history (code, snapshot, reason, changed_by) values (p_code, to_jsonb(old), p_reason, auth.uid());
  update public.risk_rules set enabled = p_enabled, weight = p_weight, params = coalesce(p_params, params), updated_at = now() where code = p_code;
  perform audit_write(auth.uid(), 'update_rule', 'risk_rules', p_code, jsonb_build_object('enabled', p_enabled, 'weight', p_weight, 'reason', p_reason));
  return jsonb_build_object('saved', p_code);
end $$;

create or replace function public.admin_resolve_ticket(p_kind text, p_id bigint, p_resolution text) returns jsonb
language plpgsql security definer set search_path = public, private as $$
declare uid uuid; pid bigint;
begin
  if not public.is_admin() then raise exception 'admin_only'; end if;
  if p_kind = 'objection' then
    update public.objections set status = 'resolved', resolution = p_resolution where id = p_id and status = 'open' returning user_id, plot_id into uid, pid;
  elsif p_kind = 'fraud_report' then
    update public.fraud_reports set status = 'resolved', resolution = p_resolution where id = p_id and status = 'open' returning user_id, plot_id into uid, pid;
  else raise exception 'bad_kind'; end if;
  if uid is null then raise exception 'ticket_not_found'; end if;
  insert into public.notifications (user_id, plot_id, type, title) values (uid, pid, 'ticket_resolved', left(coalesce(p_resolution, 'Resolved'), 200));
  perform audit_write(auth.uid(), 'resolve_ticket', p_kind, p_id::text, jsonb_build_object('resolution', p_resolution));
  return jsonb_build_object('resolved', p_id);
end $$;

create or replace function public.admin_set_signal_status(p_id bigint, p_status text) returns jsonb
language plpgsql security definer set search_path = public, private as $$
begin
  if not public.is_admin() then raise exception 'admin_only'; end if;
  update public.fraud_signals set status = p_status::signal_status where id = p_id;
  if not found then raise exception 'signal_not_found'; end if;
  perform audit_write(auth.uid(), 'set_signal_status', 'fraud_signals', p_id::text, jsonb_build_object('status', p_status));
  return jsonb_build_object('updated', p_id);
end $$;

-- Detectors implemented: double sale, rapid transfers, registration-mutation gap.
create or replace function public.run_fraud_detection() returns jsonb
language plpgsql security definer set search_path = public, private as $$
declare n1 int; n2 int; n3 int;
begin
  if not public.is_admin() then raise exception 'admin_only'; end if;

  with ins as (
    insert into public.fraud_signals (plot_id, signal_type, evidence, dedupe_key)
    select distinct on (a.id, b.id) a.plot_id, 'double_sale',
      jsonb_build_object('deed_a', a.id, 'deed_b', b.id, 'days_apart', abs(a.registered_on - b.registered_on), 'seller', pa.person_id),
      'double_sale:' || a.id || ':' || b.id
    from public.deeds a
    join public.deeds b on b.plot_id = a.plot_id and a.id < b.id
    join public.deed_parties pa on pa.deed_id = a.id and pa.role = 'seller'
    join public.deed_parties pb on pb.deed_id = b.id and pb.role = 'seller' and pb.person_id = pa.person_id
    where a.deed_type = 'sale' and b.deed_type = 'sale' and a.status = 'registered' and b.status = 'registered'
      and abs(a.registered_on - b.registered_on) <= 90
      and not exists (select 1 from public.fraud_signals s where s.dedupe_key = 'double_sale:' || a.id || ':' || b.id)
    order by a.id, b.id
    returning 1)
  select count(*) into n1 from ins;

  with ins as (
    insert into public.fraud_signals (plot_id, signal_type, evidence, dedupe_key)
    select o.plot_id, 'rapid_transfers',
      jsonb_build_object('owners', count(distinct o.person_id), 'window_months', 24), 'rapid:' || o.plot_id
    from public.ownerships o
    where o.from_date >= current_date - interval '24 months'
    group by o.plot_id
    having count(distinct o.person_id) >= 3
      and not exists (select 1 from public.fraud_signals s where s.dedupe_key = 'rapid:' || o.plot_id)
    returning 1)
  select count(*) into n2 from ins;

  with ins as (
    insert into public.fraud_signals (plot_id, signal_type, evidence, dedupe_key)
    select d.plot_id, 'registration_mutation_gap', jsonb_build_object('deed', d.id, 'registered_on', d.registered_on), 'mutgap:' || d.id
    from public.deeds d
    where d.deed_type = 'sale' and d.status = 'registered' and d.registered_on < current_date - 60
      and not exists (select 1 from public.mutations m where m.deed_id = d.id)
      and not exists (select 1 from public.fraud_signals s where s.dedupe_key = 'mutgap:' || d.id)
    returning 1)
  select count(*) into n3 from ins;

  perform audit_write(auth.uid(), 'run_fraud_detection', 'fraud_signals', '-', jsonb_build_object('double_sale', n1, 'rapid', n2, 'mutgap', n3));
  return jsonb_build_object('double_sale', n1, 'rapid_transfers', n2, 'registration_mutation_gap', n3);
end $$;

create or replace function public.admin_stats() returns jsonb
language plpgsql stable security definer set search_path = public, private as $$
begin
  if not public.is_admin() then raise exception 'admin_only'; end if;
  return jsonb_build_object(
    'plots', (select count(*) from public.plots),
    'verifications', (select count(*) from public.verifications),
    'stop', (select count(*) from public.verifications where verdict = 'stop'),
    'caution', (select count(*) from public.verifications where verdict = 'caution'),
    'clear', (select count(*) from public.verifications where verdict = 'clear'),
    'open_fraud_signals', (select count(*) from public.fraud_signals where status in ('new', 'investigating')),
    'open_tickets', (select count(*) from public.objections where status = 'open') + (select count(*) from public.fraud_reports where status = 'open'),
    'reports_issued', (select count(*) from public.reports),
    'reports_revoked', (select count(*) from public.reports where revoked));
end $$;

create or replace function public.admin_audit_verify() returns jsonb
language plpgsql security definer set search_path = public, private as $$
declare r jsonb;
begin
  if not public.is_admin() then raise exception 'admin_only'; end if;
  if to_regprocedure('public.audit_verify()') is not null then execute 'select public.audit_verify()' into r;
  else execute 'select private.audit_verify()' into r; end if;
  return r;
end $$;

create or replace function public.admin_reset_demo() returns jsonb
language plpgsql security definer set search_path = public, private as $$
declare r jsonb;
begin
  if not public.is_admin() then raise exception 'admin_only'; end if;
  r := private.restore_demo();
  perform audit_write(auth.uid(), 'reset_demo', 'plots', '-', r);
  return r;
end $$;

do $$ declare f text; begin
  foreach f in array array[
    'admin_freeze_plot(bigint,text)', 'admin_release_flag(bigint)', 'admin_add_case(bigint,text,text,text,boolean)',
    'admin_file_mutation(bigint,bigint,text)', 'admin_decide_mutation(bigint,boolean)', 'admin_revoke_report(text,text)',
    'admin_update_rule(text,boolean,integer,jsonb,text,text)', 'admin_resolve_ticket(text,bigint,text)',
    'admin_set_signal_status(bigint,text)', 'run_fraud_detection()', 'admin_stats()', 'admin_audit_verify()', 'admin_reset_demo()'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

select proname, has_function_privilege('anon', oid, 'execute') as anon_can
from pg_proc where pronamespace = 'public'::regnamespace and (left(proname, 6) = 'admin_' or proname = 'run_fraud_detection') order by 1;

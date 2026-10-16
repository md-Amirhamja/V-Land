-- 012_rpc.sql - V-Land P5 / Build Round 2 (C. Functions the app will call)
-- Run:  supabase db query --linked -f supabase/migrations/012_rpc.sql
-- Needs 011_engine.sql first. Safe to re-run.

do $$ begin execute 'set role postgres';
exception when others then raise notice 'set role postgres skipped: %', sqlerrm; end $$;
set search_path = public, extensions;

-- =====================================================================
-- private helpers (not reachable through the API)
-- =====================================================================
create or replace function private.plot_summary(p_plot bigint) returns jsonb
language sql stable security definer set search_path = public, extensions as $fn$
  select jsonb_build_object(
    'id', p.id,
    'label', private.plot_label(p.id),
    'mouza_bn', m.name_bn, 'mouza_en', m.name_en,
    'upazila_bn', g.name_bn, 'upazila_en', g.name_en, 'glb_key', g.glb_key,
    'area_decimal', p.area_decimal, 'land_class', p.land_class,
    'lat', st_y(st_centroid(p.geom)), 'lng', st_x(st_centroid(p.geom)),
    'surveys', (select coalesce(jsonb_agg(jsonb_build_object('survey', s.survey_type, 'khatian', s.khatian_no, 'dag', s.dag_no)
                  order by array_position(array['CS','SA','RS','BS','DIGITAL'], s.survey_type::text)), '[]'::jsonb)
                from public.survey_records s where s.plot_id = p.id))
  from public.plots p
  join public.mouzas m on m.id = p.mouza_id
  join public.geo_units g on g.id = m.upazila_id
  where p.id = p_plot
$fn$;

-- cheap status colour for map layers (not the full engine)
create or replace function private.plot_status(p_plot bigint) returns text
language sql stable security definer set search_path = public, extensions as $fn$
  select case
    when exists (select 1 from public.land_flags l where l.plot_id = p_plot and l.status = 'active' and l.flag in ('khas','vested','acquisition','admin_hold'))
      or exists (select 1 from public.cases c where c.plot_id = p_plot and c.status = 'pending' and c.stay_order)
      or exists (select 1 from public.survey_records s where s.plot_id = p_plot and s.khatian_kind in ('khas','vested')) then 'stop'
    when exists (select 1 from public.land_flags l where l.plot_id = p_plot and l.status = 'active')
      or exists (select 1 from public.cases c where c.plot_id = p_plot and c.status = 'pending')
      or exists (select 1 from public.tax_records t where t.plot_id = p_plot and t.paid_on is null) then 'caution'
    else 'clear' end
$fn$;

create or replace function private.plot_dossier(p_plot bigint) returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $fn$
declare res jsonb;
begin
  select jsonb_build_object(
    'plot', private.plot_summary(p_plot),
    'surveys', (select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'survey', s.survey_type, 'khatian', s.khatian_no,
                  'dag', s.dag_no, 'recorded_area', s.recorded_area, 'kind', s.khatian_kind)
                  order by array_position(array['CS','SA','RS','BS','DIGITAL'], s.survey_type::text)), '[]'::jsonb)
                from public.survey_records s where s.plot_id = p_plot),
    'owners', (select coalesce(jsonb_agg(jsonb_build_object('id', o.id, 'name_bn', pe.name_bn, 'name_en', pe.name_en,
                  'father_bn', pe.father_name_bn, 'father_en', pe.father_name_en,
                  'share_num', o.share_num, 'share_den', o.share_den, 'via', o.acquired_via,
                  'from', o.from_date, 'to', o.to_date, 'current', o.to_date is null,
                  'is_minor', pe.is_minor, 'deed_id', o.source_deed_id) order by o.from_date, o.id), '[]'::jsonb)
               from public.ownerships o join public.persons pe on pe.id = o.person_id where o.plot_id = p_plot),
    'deeds', (select coalesce(jsonb_agg(jsonb_build_object('id', d.id, 'deed_no', d.deed_no, 'year', d.year,
                  'office', d.sub_registry_office, 'type', d.deed_type, 'registered_on', d.registered_on,
                  'area_sold', d.area_sold, 'consideration', d.consideration, 'status', d.status,
                  'parties', (select coalesce(jsonb_agg(jsonb_build_object('role', dp.role, 'name_bn', pe.name_bn, 'name_en', pe.name_en)), '[]'::jsonb)
                              from public.deed_parties dp join public.persons pe on pe.id = dp.person_id where dp.deed_id = d.id))
                  order by d.registered_on, d.id), '[]'::jsonb)
              from public.deeds d where d.plot_id = p_plot),
    'mutations', (select coalesce(jsonb_agg(jsonb_build_object('id', m.id, 'case_no', m.case_no, 'deed_id', m.deed_id,
                  'status', m.status, 'filed_on', m.filed_on, 'decided_on', m.decided_on, 'office', m.office)
                  order by m.filed_on, m.id), '[]'::jsonb) from public.mutations m where m.plot_id = p_plot),
    'cases', (select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'court', c.court, 'case_no', c.case_no,
                  'type', c.case_type, 'status', c.status, 'stay_order', c.stay_order,
                  'filed_on', c.filed_on, 'next_hearing', c.next_hearing) order by c.filed_on, c.id), '[]'::jsonb)
              from public.cases c where c.plot_id = p_plot),
    'flags', (select coalesce(jsonb_agg(jsonb_build_object('id', l.id, 'flag', l.flag, 'authority', l.authority,
                  'ref_no', l.ref_no, 'status', l.status, 'from', l.from_date, 'to', l.to_date) order by l.id), '[]'::jsonb)
              from public.land_flags l where l.plot_id = p_plot),
    'tax', (select coalesce(jsonb_agg(jsonb_build_object('fiscal_year', t.fiscal_year, 'amount', t.amount,
                  'paid_on', t.paid_on, 'receipt_no', t.receipt_no) order by t.fiscal_year), '[]'::jsonb)
            from public.tax_records t where t.plot_id = p_plot),
    'state_hash', public.plot_state_hash(p_plot)
  ) into res;
  return res;
end $fn$;

-- =====================================================================
-- finding a plot (signed-in users)
-- =====================================================================
create or replace function public.search_plots_by_record(
  p_mouza bigint, p_survey public.survey_type, p_khatian text default null, p_dag text default null)
returns jsonb language plpgsql stable security definer set search_path = public, extensions as $fn$
declare res jsonb; n int;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  select coalesce(jsonb_agg(private.plot_summary(x.plot_id)), '[]'::jsonb), count(*) into res, n from (
    select distinct s.plot_id from public.survey_records s join public.plots p on p.id = s.plot_id
    where p.mouza_id = p_mouza and s.survey_type = p_survey
      and (p_khatian is null or btrim(p_khatian) = '' or s.khatian_no = btrim(p_khatian))
      and (p_dag is null or btrim(p_dag) = '' or s.dag_no = btrim(p_dag))
    order by s.plot_id limit 20) x;
  return jsonb_build_object('count', n, 'plots', res);
end $fn$;

create or replace function public.plot_at_point(p_lat double precision, p_lng double precision)
returns jsonb language plpgsql stable security definer set search_path = public, extensions as $fn$
declare pt geometry := st_setsrid(st_makepoint(p_lng, p_lat), 4326); v_id bigint; d double precision := 0; inside boolean := true;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  select p.id into v_id from public.plots p where p.geom && pt and st_contains(p.geom, pt) limit 1;
  if v_id is null then
    inside := false;
    select p.id, st_distance(p.geom::geography, pt::geography) into v_id, d
    from public.plots p
    where p.geom && st_expand(pt, 0.001) and st_dwithin(p.geom::geography, pt::geography, 30)
    order by st_distance(p.geom::geography, pt::geography) limit 1;
  end if;
  if v_id is null then return jsonb_build_object('found', false); end if;
  return jsonb_build_object('found', true, 'inside', inside, 'distance_m', round(d::numeric, 1), 'plot', private.plot_summary(v_id));
end $fn$;

create or replace function public.find_by_deed(p_deed_no text, p_year int default null, p_office text default null)
returns jsonb language plpgsql stable security definer set search_path = public, extensions as $fn$
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  return (select jsonb_build_object('count', count(*), 'matches', coalesce(jsonb_agg(jsonb_build_object(
            'deed', jsonb_build_object('deed_no', d.deed_no, 'year', d.year, 'office', d.sub_registry_office,
                                       'type', d.deed_type, 'registered_on', d.registered_on),
            'plot', private.plot_summary(d.plot_id))), '[]'::jsonb))
          from (select * from public.deeds
                where upper(btrim(deed_no)) = upper(btrim(p_deed_no))
                  and (p_year is null or year = p_year)
                  and (p_office is null or btrim(p_office) = '' or sub_registry_office ilike '%' || btrim(p_office) || '%')
                order by id limit 10) d);
end $fn$;

-- status colours only, no personal data
create or replace function public.plots_in_bbox(
  p_min_lng double precision, p_min_lat double precision, p_max_lng double precision, p_max_lat double precision)
returns jsonb language sql stable security definer set search_path = public, extensions as $fn$
  select jsonb_build_object('type', 'FeatureCollection', 'features', coalesce(jsonb_agg(jsonb_build_object(
    'type', 'Feature', 'geometry', st_asgeojson(x.geom)::jsonb,
    'properties', jsonb_build_object('id', x.id, 'status', private.plot_status(x.id)))), '[]'::jsonb))
  from (select id, geom from public.plots
        where geom && st_makeenvelope(p_min_lng, p_min_lat, p_max_lng, p_max_lat, 4326) limit 500) x
$fn$;

-- =====================================================================
-- verdicts
-- =====================================================================
create or replace function public.quick_check(p_plot bigint, p_seller_name text default null)
returns jsonb language plpgsql security definer set search_path = public, extensions as $fn$
declare ev jsonb;
begin
  if not exists (select 1 from public.plots where id = p_plot) then raise exception 'plot_not_found'; end if;
  ev := private.evaluate_plot(p_plot, p_seller_name);
  return jsonb_build_object(
    'plot_id', p_plot, 'label', private.plot_label(p_plot),
    'verdict', ev->'verdict', 'risk_points', ev->'risk_points',
    'reasons', (select coalesce(jsonb_agg(jsonb_build_object('code', t.x->>'code', 'severity', t.x->>'severity',
                  'title_bn', t.x->>'title_bn', 'title_en', t.x->>'title_en',
                  'detail_bn', t.x->>'detail_bn', 'detail_en', t.x->>'detail_en',
                  'advice_bn', t.x->>'advice_bn', 'advice_en', t.x->>'advice_en') order by t.i), '[]'::jsonb)
                from jsonb_array_elements(ev->'findings') with ordinality as t(x, i) where t.i <= 3),
    'finding_count', jsonb_array_length(ev->'findings'),
    'owners_masked', (select coalesce(jsonb_agg(jsonb_build_object('name_bn', private.mask_name(pe.name_bn),
                  'name_en', private.mask_name(pe.name_en), 'share_num', o.share_num, 'share_den', o.share_den)), '[]'::jsonb)
                from public.ownerships o join public.persons pe on pe.id = o.person_id
                where o.plot_id = p_plot and o.to_date is null),
    'disclaimer_en', ev->'disclaimer_en', 'disclaimer_bn', ev->'disclaimer_bn');
end $fn$;

create or replace function public.run_verification(
  p_plot bigint, p_seller_name text default null, p_seller_father text default null,
  p_share_claimed numeric default null, p_area_claimed numeric default null, p_intent text default null)
returns jsonb language plpgsql security definer set search_path = public, extensions as $fn$
declare uid uuid := auth.uid(); lim int; used int; ev jsonb; vid bigint;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if not exists (select 1 from public.plots where id = p_plot) then raise exception 'plot_not_found'; end if;
  lim := private.setting_int('rate_limit_per_hour', 30);
  select count(*) into used from public.verifications where user_id = uid and created_at > now() - interval '1 hour';
  if used >= lim then raise exception 'rate_limit_exceeded'; end if;
  ev := private.evaluate_plot(p_plot, p_seller_name, p_seller_father, p_share_claimed, p_area_claimed, null, p_intent);
  insert into public.verifications (user_id, plot_id, seller_input, intent, verdict, risk_points, findings)
  values (uid, p_plot,
          jsonb_build_object('name', p_seller_name, 'father', p_seller_father, 'share', p_share_claimed, 'area', p_area_claimed),
          p_intent, (ev->>'verdict')::public.verdict_t, (ev->>'risk_points')::int, ev->'findings')
  returning id into vid;
  return jsonb_build_object('verification_id', vid, 'dossier', private.plot_dossier(p_plot), 'evaluation', ev);
end $fn$;

create or replace function public.admin_evaluate_plot(
  p_plot bigint, p_seller_name text default null, p_seller_father text default null,
  p_share_claimed numeric default null, p_area_claimed numeric default null, p_measured_area numeric default null)
returns jsonb language plpgsql security definer set search_path = public, extensions as $fn$
begin
  if not public.is_admin() then raise exception 'not_authorized'; end if;
  return jsonb_build_object('dossier', private.plot_dossier(p_plot),
    'evaluation', private.evaluate_plot(p_plot, p_seller_name, p_seller_father, p_share_claimed, p_area_claimed, p_measured_area, 'sandbox'));
end $fn$;

-- =====================================================================
-- measuring and deed checks
-- =====================================================================
create or replace function public.compare_measurement(p_plot bigint, p_polygon jsonb)
returns jsonb language plpgsql stable security definer set search_path = public, extensions as $fn$
declare pl public.plots%rowtype; g geometry; rec_m2 double precision; m2 double precision; i2 double precision;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  select * into pl from public.plots where id = p_plot;
  if not found then raise exception 'plot_not_found'; end if;
  g := st_geomfromgeojson((case when p_polygon->'geometry' is not null then p_polygon->'geometry' else p_polygon end)::text);
  g := st_makevalid(st_setsrid(g, 4326));
  rec_m2 := st_area(pl.geom::geography);
  m2 := st_area(g::geography);
  i2 := st_area(st_intersection(g, pl.geom)::geography);
  return jsonb_build_object(
    'record_area_decimal', round((rec_m2 / 40.4686)::numeric, 2),
    'measured_area_decimal', round((m2 / 40.4686)::numeric, 2),
    'area_diff_pct', round(((m2 - rec_m2) / nullif(rec_m2, 0) * 100)::numeric, 1),
    'overlap_pct', round((i2 / nullif(rec_m2, 0) * 100)::numeric, 1),
    'outside_decimal', round(((m2 - i2) / 40.4686)::numeric, 2),
    'outside_pct_of_measured', round(((m2 - i2) / nullif(m2, 0) * 100)::numeric, 1));
end $fn$;

create or replace function public.check_deed(
  p_deed_no text, p_year int default null, p_office text default null, p_seller text default null,
  p_area numeric default null, p_date date default null)
returns jsonb language plpgsql stable security definer set search_path = public, extensions as $fn$
declare dd public.deeds%rowtype; sc numeric := 0; fields jsonb := '[]'::jsonb; rec record; ok boolean;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  select * into dd from public.deeds d
  where upper(btrim(d.deed_no)) = upper(btrim(p_deed_no)) and (p_year is null or d.year = p_year)
  order by (case when p_office is not null and d.sub_registry_office ilike '%' || btrim(p_office) || '%' then 0 else 1 end), d.id
  limit 1;
  if not found then
    return jsonb_build_object('found', false,
      'advice_en', 'No registered deed matches these details. This can mean a forged or altered copy. Do not pay; verify at the sub-registry.',
      'advice_bn', 'এই তথ্যের সঙ্গে কোনো নিবন্ধিত দলিল মেলেনি। এটি জাল বা পরিবর্তিত কপি হতে পারে। টাকা দেবেন না; সাব-রেজিস্ট্রি অফিসে যাচাই করুন।');
  end if;
  if p_office is not null and btrim(p_office) <> '' then
    ok := dd.sub_registry_office ilike '%' || btrim(p_office) || '%';
    fields := fields || jsonb_build_array(jsonb_build_object('field', 'office', 'claimed', p_office, 'recorded', dd.sub_registry_office, 'match', ok));
  end if;
  if p_year is not null then
    fields := fields || jsonb_build_array(jsonb_build_object('field', 'year', 'claimed', p_year, 'recorded', dd.year, 'match', dd.year = p_year));
  end if;
  if p_seller is not null and btrim(p_seller) <> '' then
    for rec in select pe.name_bn, pe.name_en, pe.father_name_bn, pe.father_name_en
               from public.deed_parties dp join public.persons pe on pe.id = dp.person_id
               where dp.deed_id = dd.id and dp.role = 'seller' loop
      sc := greatest(sc, private.person_score(p_seller, null, rec.name_bn, rec.name_en, rec.father_name_bn, rec.father_name_en));
    end loop;
    fields := fields || jsonb_build_array(jsonb_build_object('field', 'seller', 'claimed', p_seller, 'recorded', '(masked)',
                'match', sc >= 0.85, 'confidence', sc));
  end if;
  if p_area is not null and dd.area_sold is not null then
    fields := fields || jsonb_build_array(jsonb_build_object('field', 'area', 'claimed', p_area, 'recorded', dd.area_sold,
                'match', abs(p_area - dd.area_sold) / nullif(dd.area_sold, 0) <= 0.10));
  end if;
  if p_date is not null then
    fields := fields || jsonb_build_array(jsonb_build_object('field', 'date', 'claimed', p_date, 'recorded', dd.registered_on, 'match', dd.registered_on = p_date));
  end if;
  return jsonb_build_object('found', true, 'plot', private.plot_summary(dd.plot_id), 'fields', fields,
    'all_match', not exists (select 1 from jsonb_array_elements(fields) as t(x) where (t.x->>'match')::boolean is not true));
end $fn$;

-- =====================================================================
-- certificates
-- =====================================================================
create or replace function public.issue_report(p_verification bigint)
returns jsonb language plpgsql security definer set search_path = public, extensions as $fn$
declare v public.verifications%rowtype; payload jsonb; phash text; sig text; v_code text; days int; exp timestamptz; sh text;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  select * into v from public.verifications where id = p_verification and user_id = auth.uid();
  if not found then raise exception 'verification_not_found'; end if;
  days := private.setting_int('report_validity_days', 7);
  sh := public.plot_state_hash(v.plot_id);
  payload := jsonb_build_object(
    'v', 1, 'plot_id', v.plot_id, 'plot_label', private.plot_label(v.plot_id),
    'verdict', v.verdict, 'risk_points', v.risk_points, 'issued_at', now(), 'state_hash', sh,
    'findings', (select coalesce(jsonb_agg(jsonb_build_object('code', t.x->>'code', 'severity', t.x->>'severity',
                  'title_bn', t.x->>'title_bn', 'title_en', t.x->>'title_en')), '[]'::jsonb)
                 from jsonb_array_elements(v.findings::jsonb) as t(x)),
    'disclaimer_en', 'Decision support, not legal advice. Demo data, not real records.',
    'disclaimer_bn', 'এটি সিদ্ধান্ত-সহায়ক তথ্য, আইনি পরামর্শ নয়। ডেমো ডেটা, প্রকৃত রেকর্ড নয়।');
  phash := encode(extensions.digest(payload::text, 'sha256'), 'hex');
  loop
    v_code := 'VL-' || upper(encode(extensions.gen_random_bytes(5), 'hex'));
    exit when not exists (select 1 from public.reports where code = v_code);
  end loop;
  sig := encode(extensions.hmac(phash || '|' || v_code, private.signing_secret(), 'sha256'), 'hex');
  exp := now() + make_interval(days => days);
  insert into public.reports (code, verification_id, user_id, payload, payload_hash, signature, state_hash, issued_at, expires_at)
  values (v_code, p_verification, auth.uid(), payload, phash, sig, sh, now(), exp);
  return jsonb_build_object('code', v_code, 'payload_hash', phash, 'signature', sig, 'issued_at', now(), 'expires_at', exp);
end $fn$;

create or replace function public.verify_report(p_code text)
returns jsonb language plpgsql stable security definer set search_path = public, extensions as $fn$
declare rp public.reports%rowtype; st text; cur text;
begin
  select * into rp from public.reports where code = upper(btrim(p_code));
  if not found then return jsonb_build_object('status', 'not_found'); end if;
  if encode(extensions.digest(rp.payload::text, 'sha256'), 'hex') <> rp.payload_hash
     or encode(extensions.hmac(rp.payload_hash || '|' || rp.code, private.signing_secret(), 'sha256'), 'hex') <> rp.signature then
    return jsonb_build_object('status', 'invalid');
  end if;
  cur := public.plot_state_hash((rp.payload->>'plot_id')::bigint);
  st := case when rp.revoked then 'revoked'
             when rp.expires_at < now() then 'expired'
             when cur is distinct from rp.state_hash then 'changed'
             else 'genuine' end;
  return jsonb_build_object('status', st, 'code', rp.code, 'issued_at', rp.issued_at, 'expires_at', rp.expires_at,
    'verdict', rp.payload->>'verdict', 'plot_label', rp.payload->'plot_label',
    'hash_fragment', left(rp.payload_hash, 16),
    'disclaimer_en', 'Decision support, not legal advice. Demo data.', 'disclaimer_bn', 'সিদ্ধান্ত-সহায়ক তথ্য, আইনি পরামর্শ নয়। ডেমো ডেটা।');
end $fn$;

-- =====================================================================
-- watch, owner shield, tickets
-- =====================================================================
create or replace function public.toggle_watch(p_plot bigint) returns jsonb
language plpgsql security definer set search_path = public, extensions as $fn$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if exists (select 1 from public.watches where user_id = uid and plot_id = p_plot) then
    delete from public.watches where user_id = uid and plot_id = p_plot;
    return jsonb_build_object('watching', false);
  end if;
  insert into public.watches (user_id, plot_id, last_state_hash) values (uid, p_plot, public.plot_state_hash(p_plot));
  return jsonb_build_object('watching', true);
end $fn$;

create or replace function public.get_changes_since(p_plot bigint, p_state_hash text) returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $fn$
declare uid uuid := auth.uid(); since timestamptz; cur text;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  select max(issued_at) into since from public.reports
   where user_id = uid and state_hash = p_state_hash and (payload->>'plot_id')::bigint = p_plot;
  since := coalesce(since, now() - interval '30 days');
  cur := public.plot_state_hash(p_plot);
  return jsonb_build_object('changed', cur is distinct from p_state_hash, 'current_state_hash', cur, 'since', since,
    'events', (select coalesce(jsonb_agg(jsonb_build_object('event_type', e.event_type, 'detail', e.detail, 'at', e.created_at)
                order by e.created_at desc), '[]'::jsonb)
               from (select * from public.plot_events where plot_id = p_plot and created_at > since
                     order by created_at desc limit 50) e));
end $fn$;

create or replace function public.my_land() returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $fn$
declare uid uuid := auth.uid(); pid uuid; nm text; res jsonb;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  select linked_person_id into pid from public.profiles where id = uid;
  if pid is null then return jsonb_build_object('plots', '[]'::jsonb, 'alerts', '[]'::jsonb); end if;
  select coalesce(name_en, name_bn) into nm from public.persons where id = pid;
  select jsonb_build_object(
    'plots', coalesce((select jsonb_agg(jsonb_build_object('plot', private.plot_summary(o.plot_id),
                'share_num', o.share_num, 'share_den', o.share_den,
                'self_check_verdict', e.ev->>'verdict', 'findings_count', jsonb_array_length(e.ev->'findings'),
                'checks_30d', (select count(*) from public.verifications v where v.plot_id = o.plot_id and v.created_at > now() - interval '30 days')))
              from public.ownerships o
              cross join lateral (select private.evaluate_plot(o.plot_id, nm) as ev) e
              where o.person_id = pid and o.to_date is null), '[]'::jsonb),
    'alerts', coalesce((select jsonb_agg(jsonb_build_object('plot_id', pe.plot_id, 'event_type', pe.event_type,
                'detail', pe.detail, 'at', pe.created_at) order by pe.created_at desc)
              from public.plot_events pe
              where pe.created_at > now() - interval '30 days'
                and pe.plot_id in (select plot_id from public.ownerships where person_id = pid and to_date is null)), '[]'::jsonb))
  into res;
  return res;
end $fn$;

-- counts only, never who
create or replace function public.my_land_check_counts() returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $fn$
declare uid uuid := auth.uid(); pid uuid;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  select linked_person_id into pid from public.profiles where id = uid;
  if pid is null then return '[]'::jsonb; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('plot_id', o.plot_id,
            'checks_30d', (select count(*) from public.verifications v where v.plot_id = o.plot_id and v.created_at > now() - interval '30 days'))), '[]'::jsonb)
          from public.ownerships o where o.person_id = pid and o.to_date is null);
end $fn$;

create or replace function public.submit_objection(p_plot bigint, p_type text, p_message text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $fn$
declare vid bigint;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if p_message is null or btrim(p_message) = '' then raise exception 'message_required'; end if;
  insert into public.objections (user_id, plot_id, type, message)
  values (auth.uid(), p_plot, left(coalesce(p_type, 'record_wrong'), 60), left(p_message, 2000)) returning id into vid;
  return jsonb_build_object('ticket_id', vid);
end $fn$;

create or replace function public.submit_fraud_report(p_plot bigint, p_type text, p_message text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $fn$
declare vid bigint;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if p_message is null or btrim(p_message) = '' then raise exception 'message_required'; end if;
  insert into public.fraud_reports (user_id, plot_id, type, message)
  values (auth.uid(), p_plot, left(coalesce(p_type, 'suspicious_seller'), 60), left(p_message, 2000)) returning id into vid;
  return jsonb_build_object('ticket_id', vid);
end $fn$;

-- =====================================================================
-- grants: nothing is callable by default; open each function to the right role
-- =====================================================================
revoke all on function private.plot_summary(bigint) from public, anon, authenticated;
revoke all on function private.plot_status(bigint) from public, anon, authenticated;
revoke all on function private.plot_dossier(bigint) from public, anon, authenticated;

revoke all on function public.search_plots_by_record(bigint, public.survey_type, text, text) from public, anon, authenticated;
revoke all on function public.plot_at_point(double precision, double precision) from public, anon, authenticated;
revoke all on function public.find_by_deed(text, int, text) from public, anon, authenticated;
revoke all on function public.plots_in_bbox(double precision, double precision, double precision, double precision) from public, anon, authenticated;
revoke all on function public.quick_check(bigint, text) from public, anon, authenticated;
revoke all on function public.run_verification(bigint, text, text, numeric, numeric, text) from public, anon, authenticated;
revoke all on function public.admin_evaluate_plot(bigint, text, text, numeric, numeric, numeric) from public, anon, authenticated;
revoke all on function public.compare_measurement(bigint, jsonb) from public, anon, authenticated;
revoke all on function public.check_deed(text, int, text, text, numeric, date) from public, anon, authenticated;
revoke all on function public.issue_report(bigint) from public, anon, authenticated;
revoke all on function public.verify_report(text) from public, anon, authenticated;
revoke all on function public.toggle_watch(bigint) from public, anon, authenticated;
revoke all on function public.get_changes_since(bigint, text) from public, anon, authenticated;
revoke all on function public.my_land() from public, anon, authenticated;
revoke all on function public.my_land_check_counts() from public, anon, authenticated;
revoke all on function public.submit_objection(bigint, text, text) from public, anon, authenticated;
revoke all on function public.submit_fraud_report(bigint, text, text) from public, anon, authenticated;

-- anyone
grant execute on function public.plots_in_bbox(double precision, double precision, double precision, double precision) to anon, authenticated;
grant execute on function public.quick_check(bigint, text) to anon, authenticated;
grant execute on function public.verify_report(text) to anon, authenticated;
-- signed-in users (admins are signed-in users too; admin_evaluate_plot checks is_admin() itself)
grant execute on function public.search_plots_by_record(bigint, public.survey_type, text, text) to authenticated;
grant execute on function public.plot_at_point(double precision, double precision) to authenticated;
grant execute on function public.find_by_deed(text, int, text) to authenticated;
grant execute on function public.run_verification(bigint, text, text, numeric, numeric, text) to authenticated;
grant execute on function public.admin_evaluate_plot(bigint, text, text, numeric, numeric, numeric) to authenticated;
grant execute on function public.compare_measurement(bigint, jsonb) to authenticated;
grant execute on function public.check_deed(text, int, text, text, numeric, date) to authenticated;
grant execute on function public.issue_report(bigint) to authenticated;
grant execute on function public.toggle_watch(bigint) to authenticated;
grant execute on function public.get_changes_since(bigint, text) to authenticated;
grant execute on function public.my_land() to authenticated;
grant execute on function public.my_land_check_counts() to authenticated;
grant execute on function public.submit_objection(bigint, text, text) to authenticated;
grant execute on function public.submit_fraud_report(bigint, text, text) to authenticated;

notify pgrst, 'reload schema';

-- ---------- check query: who can execute what ----------
select p.proname,
       has_function_privilege('anon', p.oid, 'execute') as anon_can,
       has_function_privilege('authenticated', p.oid, 'execute') as signed_in_can
from pg_proc p
where p.pronamespace = 'public'::regnamespace
  and p.proname in ('quick_check','verify_report','plots_in_bbox','run_verification','admin_evaluate_plot','issue_report',
                    'search_plots_by_record','plot_at_point','find_by_deed','compare_measurement','check_deed',
                    'toggle_watch','get_changes_since','my_land','my_land_check_counts','submit_objection','submit_fraud_report')
order by 2 desc, 1;

-- 011_engine.sql - V-Land P5 / Build Round 2 (D. Verdict engine)
-- Run:  supabase db query --linked -f supabase/migrations/011_engine.sql
-- Safe to re-run. Re-running resets rule text, weights and params to the shipped defaults
-- (it never changes the enabled flag of an existing rule).

do $$ begin execute 'set role postgres';
exception when others then raise notice 'set role postgres skipped: %', sqlerrm; end $$;
set search_path = public, extensions;

-- ---------- preflight: fail early with a readable message ----------
do $pf$
declare miss text[] := '{}'; r record;
begin
  if to_regprocedure('public.plot_state_hash(bigint)') is null then miss := miss || 'function public.plot_state_hash(bigint)'; end if;
  if to_regclass('private.app_secrets') is null then miss := miss || 'table private.app_secrets'; end if;
  for r in select * from (values
      ('verifications','findings'),('verifications','created_at'),('verifications','seller_input'),
      ('verifications','verdict'),('verifications','risk_points'),
      ('watches','user_id'),('watches','plot_id'),('watches','last_state_hash')) as v(t, c)
  loop
    if not exists (select 1 from information_schema.columns
                   where table_schema = 'public' and table_name = r.t and column_name = r.c) then
      miss := miss || (r.t || '.' || r.c);
    end if;
  end loop;
  if array_length(miss, 1) > 0 then
    raise exception 'Preflight failed. Missing: %. Run this and send me the output: select table_name, string_agg(column_name, '', '') from information_schema.columns where table_schema=''public'' and table_name in (''verifications'',''watches'') group by 1;', array_to_string(miss, '; ');
  end if;
end $pf$;

-- ---------- settings (rate limits, thresholds, certificate validity) ----------
create table if not exists public.app_settings (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.app_settings enable row level security;
revoke all on public.app_settings from anon;
grant select, insert, update, delete on public.app_settings to authenticated;
drop policy if exists app_settings_admin_all on public.app_settings;
create policy app_settings_admin_all on public.app_settings for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
insert into public.app_settings (key, value) values
  ('caution_threshold', '15'), ('report_validity_days', '7'), ('rate_limit_per_hour', '30')
on conflict (key) do nothing;

create or replace function private.setting_int(k text, d int) returns int
language sql stable security definer set search_path = public as $fn$
  select coalesce((select (value #>> '{}')::int from public.app_settings where key = k), d)
$fn$;

-- ---------- name matching ----------
create or replace function private.mask_name(n text) returns text
language sql immutable as $fn$
  select regexp_replace(coalesce(n, ''), '(\S)\S*', '\1***', 'g')
$fn$;

create or replace function private.norm_name(n text) returns text
language plpgsql immutable as $fn$
declare s text; i int;
begin
  if n is null then return ''; end if;
  s := lower(n);
  -- precomposed nukta letters (ড় ঢ় য়) -> base letter, drop standalone nukta
  s := translate(s, chr(2524) || chr(2525) || chr(2527) || chr(2492), chr(2465) || chr(2466) || chr(2479));
  -- drop chandrabindu, visarga, ZWNJ, ZWJ
  s := translate(s, chr(2433) || chr(2435) || chr(8204) || chr(8205), '');
  -- punctuation -> space (keep a-z, 0-9, Bangla block)
  s := regexp_replace(s, '[^a-z0-9\u0980-\u09ff ]', ' ', 'g');
  -- honorifics (two passes so adjacent ones are both removed)
  s := ' ' || s || ' ';
  for i in 1..2 loop
    s := regexp_replace(s, ' (md|mohammad|mohammed|muhammad|muhammed|mohd|mohamed|mst|mosammat|mossammat|musammat|mosa|late|মো|মোহাম্মদ|মোহাম্মাদ|মুহাম্মদ|মুহাম্মাদ|মোসাম্মৎ|মোছাম্মৎ|মোসা|মোছা|মরহুম|মৃত) ', ' ', 'g');
  end loop;
  -- Bangla look-alikes: ষ শ -> স ; ণ -> ন ; ী -> ি ; ূ -> ু ; ৎ -> ত
  s := translate(s, chr(2487) || chr(2486) || chr(2467) || chr(2496) || chr(2498) || chr(2510),
                    chr(2488) || chr(2488) || chr(2472) || chr(2495) || chr(2497) || chr(2468));
  -- collapse repeated latin letters (hossain/hosain, kareem/karim-ish)
  s := regexp_replace(s, '([a-z])\1+', '\1', 'g');
  return btrim(regexp_replace(s, '\s+', ' ', 'g'));
end $fn$;

create or replace function private.sort_tokens(s text) returns text
language sql immutable as $fn$
  select coalesce(string_agg(t.tok, ' ' order by t.tok), '')
  from regexp_split_to_table(coalesce(s, ''), ' ') as t(tok) where t.tok <> ''
$fn$;

-- Dice coefficient over character bigrams of the normalised, token-sorted names (0..1)
create or replace function private.name_sim(a text, b text) returns numeric
language plpgsql immutable as $fn$
declare x text; y text; ba text[]; bb text[]; inter int;
begin
  x := private.sort_tokens(private.norm_name(a));
  y := private.sort_tokens(private.norm_name(b));
  if x = '' or y = '' then return 0; end if;
  if x = y then return 1; end if;
  select array_agg(distinct substr(x, i, 2)) into ba from generate_series(1, greatest(length(x) - 1, 1)) i;
  select array_agg(distinct substr(y, i, 2)) into bb from generate_series(1, greatest(length(y) - 1, 1)) i;
  select count(*) into inter from (select unnest(ba) intersect select unnest(bb)) q;
  return round(2.0 * inter / (array_length(ba, 1) + array_length(bb, 1)), 3);
end $fn$;

-- name score + father's-name rule: father agrees (>=0.85) -> +0.08 ; father clearly differs (<0.5) -> cap at 0.84
create or replace function private.person_score(p_name text, p_father text, n_bn text, n_en text, f_bn text, f_en text)
returns numeric language plpgsql immutable as $fn$
declare ns numeric; fs numeric; sc numeric;
begin
  ns := greatest(private.name_sim(p_name, n_bn), private.name_sim(p_name, n_en));
  sc := ns;
  if p_father is not null and btrim(p_father) <> '' then
    fs := greatest(private.name_sim(p_father, f_bn), private.name_sim(p_father, f_en));
    if fs >= 0.85 then sc := least(1, ns + 0.08);
    elsif fs < 0.5 and ns >= 0.85 then sc := least(ns, 0.84);
    end if;
  end if;
  return round(sc, 3);
end $fn$;

-- ---------- plot helpers ----------
create or replace function private.plot_label(p_plot bigint) returns jsonb
language sql stable security definer set search_path = public, extensions as $fn$
  select jsonb_build_object(
    'en', m.name_en || coalesce(' · ' || s.survey_type::text || ' dag ' || s.dag_no, ''),
    'bn', m.name_bn || coalesce(' · ' || s.survey_type::text || ' দাগ ' || s.dag_no, ''))
  from public.plots p
  join public.mouzas m on m.id = p.mouza_id
  left join lateral (
    select survey_type, dag_no from public.survey_records where plot_id = p.id
    order by array_position(array['DIGITAL','BS','RS','SA','CS'], survey_type::text) limit 1) s on true
  where p.id = p_plot
$fn$;

create or replace function private.signing_secret() returns text
language plpgsql stable security definer set search_path = public, extensions as $fn$
declare j jsonb; s text;
begin
  select to_jsonb(t) into j from private.app_secrets t limit 1;
  s := coalesce(j->>'secret', j->>'value', j->>'signing_secret', j->>'report_secret', j->>'val');
  if s is null then
    raise exception 'Cannot find the signing secret in private.app_secrets (keys: %)',
      (select string_agg(k, ',') from jsonb_object_keys(coalesce(j, '{}'::jsonb)) k);
  end if;
  return s;
end $fn$;

-- ---------- the 20 rules ----------
insert into public.risk_rules (code, enabled, weight, severity, params, title_bn, title_en, advice_bn, advice_en) values
('R01', true, 100, 'blocker', '{}'::jsonb,
  'খাস জমি', 'Khas (government) land',
  'সরকারি খাস জমি কোনো ব্যক্তি বিক্রি করতে পারেন না; কোনো টাকা দেবেন না।',
  'Government land cannot be sold by a private person; pay nothing.'),
('R02', true, 100, 'blocker', '{}'::jsonb,
  'অর্পিত সম্পত্তি', 'Vested property',
  'এগোবেন না; ভূমি অফিসে জমির অবস্থা নিশ্চিত করুন।',
  'Do not proceed; confirm the status with the land office.'),
('R03', true, 100, 'blocker', '{"active_stages":["notice","active","gazetted"]}'::jsonb,
  'অধিগ্রহণ প্রক্রিয়া চলমান', 'Active acquisition',
  'জমিটি সরকার অধিগ্রহণ করতে পারে; ক্ষতিপূরণ পাবেন রেকর্ডভুক্ত মালিক।',
  'The land may be taken by the government; compensation goes to the recorded owner.'),
('R04', true, 15, 'medium', '{"meters":100,"planned_stages":["planned","proposed"]}'::jsonb,
  'পরিকল্পিত অধিগ্রহণ পথের কাছে', 'Near a planned corridor',
  'প্রকল্প অফিসকে জিজ্ঞেস করুন নকশা বদলাতে পারে কিনা।',
  'Ask the project office if the alignment can change.'),
('R05', true, 100, 'blocker', '{}'::jsonb,
  'আদালতের স্থগিতাদেশ', 'Court stay order',
  'স্থগিতাদেশ বহাল থাকা পর্যন্ত হস্তান্তর নিষিদ্ধ।',
  'Transfers are barred while the order stands.'),
('R06', true, 30, 'high', '{}'::jsonb,
  'বিচারাধীন মামলা', 'Pending suit',
  'মামলার ফল ক্রেতার ওপরও বর্তাতে পারে; আগে আইনজীবীর পরামর্শ নিন।',
  'A buyer can be bound by the suit''s outcome; see a lawyer first.'),
('R07', true, 100, 'blocker', '{"match":0.85,"lookalike":0.6}'::jsonb,
  'বিক্রেতা রেকর্ডের মালিকের সঙ্গে মেলে না', 'Seller does not match the recorded owner',
  'টাকা দেবেন না; পরিচয়ের প্রমাণ ও মালিকানার কাগজ চান।',
  'Do not pay; ask for ID and ownership papers.'),
('R08', true, 30, 'high', '{}'::jsonb,
  'আংশিক অংশের মালিক', 'Seller holds only part of the plot',
  'সব সহ-অংশীদারের লিখিত সম্মতি নিন।',
  'Get written consent from every co-sharer.'),
('R09', true, 100, 'blocker', '{"days":90}'::jsonb,
  'দ্বৈত বিক্রির সন্দেহ', 'Suspected double sale',
  'টাকা দেবেন না; বিষয়টি রিপোর্ট করুন।',
  'Do not pay; report it.'),
('R10', true, 15, 'medium', '{"days":60}'::jsonb,
  'নামজারি অসম্পূর্ণ', 'Mutation pending',
  'আগে বিক্রেতাকে নামজারি সম্পন্ন করতে বলুন।',
  'Ask the seller to complete mutation first.'),
('R11', true, 15, 'medium', '{"months":24,"count":3}'::jsonb,
  'অল্প সময়ে বারবার হাতবদল', 'Rapid transfers',
  'জমি কেন বারবার হাত বদলাচ্ছে তা জানুন।',
  'Find out why the land is changing hands so often.'),
('R12', true, 30, 'high', '{}'::jsonb,
  'মালিকানার ধারাবাহিকতায় ফাঁক', 'Gap in the chain of title',
  'টাকা দেওয়ার আগে অনুপস্থিত কাগজ চান।',
  'Ask for the missing links before paying.'),
('R13', true, 15, 'medium', '{"medium_years":1,"high_years":3}'::jsonb,
  'ভূমি উন্নয়ন কর বকেয়া', 'Land tax due',
  'বিক্রেতাকে বকেয়া পরিশোধ করে রসিদ দেখাতে বলুন।',
  'Have the seller clear dues and show receipts.'),
('R14', true, 30, 'high', '{}'::jsonb,
  'বন্ধক বা ক্রোক', 'Mortgage or lien',
  'কেনার আগে লিখিত মুক্তিপত্র নিন।',
  'Get a written release before buying.'),
('R15', true, 15, 'medium', '{"pct":10}'::jsonb,
  'জমির পরিমাণে অমিল', 'Area mismatch',
  'সই করার আগে সার্ভেয়ার দিয়ে মাপান।',
  'Re-measure with a surveyor before signing.'),
('R16', true, 30, 'high', '{"pct":20}'::jsonb,
  'জরিপের রেকর্ডে বিরোধ', 'Survey record conflict',
  'ভূমি অফিসকে রেকর্ড মেলাতে বলুন।',
  'Ask the land office to reconcile the records.'),
('R17', true, 30, 'high', '{}'::jsonb,
  'নাবালক সহ-অংশীদার', 'Minor co-sharer',
  'বিক্রয়ে আদালতের অনুমতি লাগতে পারে; আইনি পরামর্শ নিন।',
  'A sale may need court permission; take legal advice.'),
('R18', true, 0, 'info', '{}'::jsonb,
  'কৃষিজমি', 'Agricultural land',
  'আপনার পরিকল্পনার জন্য শ্রেণি পরিবর্তনের অনুমতি লাগবে কিনা দেখুন।',
  'Check if conversion permission is needed for your plan.'),
('R19', true, 100, 'blocker', '{}'::jsonb,
  'প্রশাসনিক স্থগিতাদেশ', 'Administrative hold',
  'ভূমি অফিস স্থগিতাদেশ না তোলা পর্যন্ত অপেক্ষা করুন।',
  'Wait for the land office to lift the hold.'),
('R20', true, 0, 'info', '{}'::jsonb,
  'অসম্পূর্ণ রেকর্ড', 'Thin record',
  'এই ফলাফলে কম আস্থা রাখুন।',
  'Treat this result with less confidence.')
on conflict (code) do update set
  weight = excluded.weight, severity = excluded.severity, params = excluded.params,
  title_bn = excluded.title_bn, title_en = excluded.title_en,
  advice_bn = excluded.advice_bn, advice_en = excluded.advice_en;

-- ---------- finding builder ----------
create or replace function private.rule_pts(r public.risk_rules, sev public.severity_t) returns int
language sql immutable as $fn$
  select case when sev = r.severity then coalesce(r.weight, 0)
    else case sev when 'blocker' then 100
                  when 'high'    then coalesce((r.params->>'pts_high')::int, 30)
                  when 'medium'  then coalesce((r.params->>'pts_medium')::int, 15)
                  else 0 end
  end
$fn$;

create or replace function private.add_finding(f jsonb, r public.risk_rules, sev public.severity_t,
                                               d_bn text, d_en text, ev jsonb) returns jsonb
language sql immutable as $fn$
  select f || jsonb_build_array(jsonb_build_object(
    'code', r.code, 'severity', sev, 'points', private.rule_pts(r, sev),
    'title_bn', r.title_bn, 'title_en', r.title_en,
    'detail_bn', d_bn, 'detail_en', d_en,
    'advice_bn', r.advice_bn, 'advice_en', r.advice_en,
    'evidence', coalesce(ev, '[]'::jsonb)))
$fn$;

-- ---------- the engine ----------
create or replace function private.evaluate_plot(
  p_plot bigint,
  p_seller text default null,
  p_father text default null,
  p_share_claimed numeric default null,
  p_area_claimed numeric default null,
  p_measured_area numeric default null,
  p_intent text default null
) returns jsonb
language plpgsql security definer set search_path = public, extensions as $fn$
declare
  pl public.plots%rowtype;
  r public.risk_rules%rowtype;
  f jsonb := '[]'::jsonb;
  ev jsonb;
  n int; dups int; hasbs boolean;
  dist numeric; v_age int;
  today date := current_date;
  fy int := extract(year from current_date)::int - case when extract(month from current_date) < 7 then 1 else 0 end;
  seller_given boolean := p_seller is not null and btrim(p_seller) <> '';
  lvl text;
  best numeric := 0; best_found boolean := false; sc numeric;
  bo_id bigint; bo_name text; bo_num int; bo_den int;
  sm jsonb := jsonb_build_object('provided', false);
  t_match numeric := 0.85; t_look numeric := 0.6;
  rec record; rec9 record;
  pct numeric; claimed numeric; held numeric; expected numeric;
  mm_bn text[]; mm_en text[];
  v_r03 boolean := false;
  v_thresh int := private.setting_int('caution_threshold', 15);
  fin jsonb; tot int; has_blocker boolean;
  vd public.verdict_t;
  sev public.severity_t;
  steps jsonb := '[]'::jsonb;
  smap jsonb := $j${
    "R01":[{"t":"action","bn":"কোনো টাকা বা অগ্রিম দেবেন না","en":"Do not pay anything or any advance"},{"t":"action","bn":"ইউএনও বা এসি ল্যান্ড অফিসে খাস রেকর্ড যাচাই করুন","en":"Confirm the khas record at the UNO or AC Land office"}],
    "R02":[{"t":"action","bn":"ভূমি অফিসে অর্পিত সম্পত্তির তালিকা যাচাই করুন","en":"Check the vested property list at the land office"}],
    "R03":[{"t":"action","bn":"জেলা প্রশাসকের কার্যালয়ে অধিগ্রহণ নোটিশের অবস্থা জানুন","en":"Ask the District Commissioner office about the acquisition status"}],
    "R04":[{"t":"action","bn":"প্রকল্প অফিসে নকশা ও সীমানা জিজ্ঞেস করুন","en":"Ask the project office about the alignment"}],
    "R05":[{"t":"doc","bn":"আদালতের আদেশের সত্যায়িত কপি","en":"Certified copy of the court order"},{"t":"action","bn":"আইনজীবীর পরামর্শ নিন","en":"Take legal advice"}],
    "R06":[{"t":"doc","bn":"মামলার নম্বর ও সর্বশেষ আদেশ","en":"Case number and latest order"},{"t":"action","bn":"আইনজীবীর পরামর্শ নিন","en":"Take legal advice"}],
    "R07":[{"t":"doc","bn":"বিক্রেতার পরিচয়ের প্রমাণ","en":"Seller's photo ID"},{"t":"doc","bn":"মালিকানার কাগজ (খতিয়ান, দলিল, নামজারি)","en":"Ownership papers (khatian, deed, mutation)"}],
    "R08":[{"t":"doc","bn":"সব সহ-অংশীদারের লিখিত সম্মতি","en":"Written consent from every co-sharer"}],
    "R09":[{"t":"action","bn":"টাকা দেবেন না; সাব-রেজিস্ট্রি অফিসে দুটি দলিলই যাচাই করুন","en":"Do not pay; verify both deeds at the sub-registry"},{"t":"action","bn":"সন্দেহজনক বিক্রেতা হিসেবে রিপোর্ট করুন","en":"Report the seller as suspicious"}],
    "R10":[{"t":"doc","bn":"নামজারির আবেদন ও মঞ্জুরির কপি","en":"Mutation application and approval copy"}],
    "R11":[{"t":"action","bn":"বিক্রেতার কাছে বারবার হাতবদলের কারণ জানতে চান","en":"Ask the seller why the land keeps changing hands"}],
    "R12":[{"t":"doc","bn":"ধারাবাহিক মালিকানার সব দলিল ও নামজারি","en":"Every deed and mutation in the chain of title"}],
    "R13":[{"t":"doc","bn":"হালনাগাদ ভূমি উন্নয়ন কর রসিদ","en":"Up-to-date land development tax receipts"}],
    "R14":[{"t":"doc","bn":"ব্যাংক বা ঋণদাতার লিখিত মুক্তিপত্র","en":"Written release from the lender"}],
    "R15":[{"t":"action","bn":"লাইসেন্সধারী সার্ভেয়ার দিয়ে জমি মাপান","en":"Have a licensed surveyor measure the land"}],
    "R16":[{"t":"action","bn":"ভূমি অফিসে জরিপ রেকর্ডের অমিল সংশোধনের আবেদন করুন","en":"Ask the land office to reconcile the survey records"}],
    "R17":[{"t":"action","bn":"নাবালকের অংশ বিক্রিতে আদালতের অনুমতি লাগবে কিনা আইনজীবীর কাছে জানুন","en":"Ask a lawyer whether court permission is needed to sell a minor's share"}],
    "R18":[{"t":"action","bn":"শ্রেণি পরিবর্তনের অনুমতি লাগবে কিনা যাচাই করুন","en":"Check whether land-class conversion permission is needed"}],
    "R19":[{"t":"action","bn":"ভূমি অফিস স্থগিতাদেশ না তোলা পর্যন্ত অপেক্ষা করুন","en":"Wait until the land office lifts the hold"}],
    "R20":[{"t":"action","bn":"ভূমি অফিস থেকে হালনাগাদ পর্চা সংগ্রহ করুন","en":"Get a fresh record (porcha) from the land office"}]
  }$j$::jsonb;
  step_code text;
begin
  select * into pl from public.plots where id = p_plot;
  if not found then raise exception 'plot_not_found'; end if;

  -- ---- seller matching (only when a seller name is given) ----
  if seller_given then
    select coalesce((params->>'match')::numeric, 0.85), coalesce((params->>'lookalike')::numeric, 0.6)
      into t_match, t_look from public.risk_rules where code = 'R07';
    t_match := coalesce(t_match, 0.85); t_look := coalesce(t_look, 0.6);
    for rec in
      select o.id as own_id, o.share_num, o.share_den, pe.name_bn, pe.name_en, pe.father_name_bn, pe.father_name_en
      from public.ownerships o join public.persons pe on pe.id = o.person_id
      where o.plot_id = p_plot and o.to_date is null
    loop
      sc := private.person_score(p_seller, p_father, rec.name_bn, rec.name_en, rec.father_name_bn, rec.father_name_en);
      if not best_found or sc > best then
        best := sc; best_found := true;
        bo_id := rec.own_id; bo_name := coalesce(rec.name_en, rec.name_bn); bo_num := rec.share_num; bo_den := rec.share_den;
      end if;
    end loop;
    lvl := case when not best_found then 'no_owner'
                when best >= t_match then 'match'
                when best >= t_look then 'lookalike'
                else 'mismatch' end;
    sm := jsonb_build_object('provided', true, 'level', lvl,
            'confidence', case when best_found then best end,
            'owner_masked', case when best_found then private.mask_name(bo_name) end,
            'share_num', bo_num, 'share_den', bo_den);
  end if;

  -- ---- run every enabled rule ----
  for r in select * from public.risk_rules where enabled order by code loop

    if r.code = 'R01' then
      select coalesce(jsonb_agg(q.e), '[]'::jsonb) into ev from (
        select jsonb_build_object('table','survey_records','id',s.id) as e from public.survey_records s
          where s.plot_id = p_plot and s.khatian_kind = 'khas'
        union all
        select jsonb_build_object('table','land_flags','id',l.id) from public.land_flags l
          where l.plot_id = p_plot and l.flag = 'khas' and l.status = 'active') q;
      if jsonb_array_length(ev) > 0 then
        f := private.add_finding(f, r, 'blocker', 'রেকর্ডে এই জমি খাস হিসেবে চিহ্নিত।',
          'The records mark this plot as khas (government) land.', ev);
      end if;

    elsif r.code = 'R02' then
      select coalesce(jsonb_agg(q.e), '[]'::jsonb) into ev from (
        select jsonb_build_object('table','survey_records','id',s.id) as e from public.survey_records s
          where s.plot_id = p_plot and s.khatian_kind = 'vested'
        union all
        select jsonb_build_object('table','land_flags','id',l.id) from public.land_flags l
          where l.plot_id = p_plot and l.flag = 'vested' and l.status = 'active') q;
      if jsonb_array_length(ev) > 0 then
        f := private.add_finding(f, r, 'blocker', 'জমিটি অর্পিত সম্পত্তির তালিকাভুক্ত।',
          'The plot is on the vested property list.', ev);
      end if;

    elsif r.code = 'R03' then
      select coalesce(jsonb_agg(q.e), '[]'::jsonb) into ev from (
        select jsonb_build_object('table','land_flags','id',l.id) as e from public.land_flags l
          where l.plot_id = p_plot and l.flag = 'acquisition' and l.status = 'active'
        union all
        select jsonb_build_object('table','acquisition_zones','id',z.id) from public.acquisition_zones z
          where pl.geom is not null and st_intersects(z.geom, pl.geom)
            and lower(z.stage) in (select jsonb_array_elements_text(
                  coalesce(r.params->'active_stages', '["notice","active","gazetted"]'::jsonb)))) q;
      if jsonb_array_length(ev) > 0 then
        v_r03 := true;
        f := private.add_finding(f, r, 'blocker', 'জমিটি একটি চলমান অধিগ্রহণ নোটিশের আওতায় পড়ে।',
          'The plot falls under an active acquisition notice.', ev);
      end if;

    elsif r.code = 'R04' then
      if not v_r03 and pl.geom is not null then
        select min(st_distance(z.geom::geography, pl.geom::geography)),
               coalesce(jsonb_agg(jsonb_build_object('table','acquisition_zones','id',z.id)), '[]'::jsonb)
          into dist, ev
        from public.acquisition_zones z
        where lower(z.stage) in (select jsonb_array_elements_text(
                coalesce(r.params->'planned_stages', '["planned","proposed"]'::jsonb)))
          and not st_intersects(z.geom, pl.geom)
          and st_dwithin(z.geom::geography, pl.geom::geography, coalesce((r.params->>'meters')::numeric, 100));
        if dist is not null then
          f := private.add_finding(f, r, r.severity,
            format('একটি পরিকল্পিত করিডোর জমি থেকে প্রায় %s মিটার দূরে।', round(dist)),
            format('A planned corridor passes about %s m from this plot.', round(dist)), ev);
        end if;
      end if;

    elsif r.code = 'R05' then
      select coalesce(jsonb_agg(jsonb_build_object('table','cases','id',c.id)), '[]'::jsonb), count(*)
        into ev, n from public.cases c where c.plot_id = p_plot and c.status = 'pending' and c.stay_order;
      if n > 0 then
        f := private.add_finding(f, r, 'blocker',
          format('%s টি চলমান মামলায় স্থগিতাদেশ বা নিষেধাজ্ঞা আছে।', n),
          format('%s pending case(s) carry a stay or injunction order.', n), ev);
      end if;

    elsif r.code = 'R06' then
      select coalesce(jsonb_agg(jsonb_build_object('table','cases','id',c.id)), '[]'::jsonb), count(*)
        into ev, n from public.cases c where c.plot_id = p_plot and c.status = 'pending' and not c.stay_order;
      if n > 0 then
        f := private.add_finding(f, r, r.severity,
          format('%s টি মামলা বিচারাধীন (স্থগিতাদেশ নেই)।', n),
          format('%s pending suit(s) without a stay order.', n), ev);
      end if;

    elsif r.code = 'R07' then
      if seller_given and lvl <> 'match' then
        sev := case when lvl = 'lookalike' then 'high' else 'blocker' end;
        ev := case when bo_id is not null
                   then jsonb_build_array(jsonb_build_object('table','ownerships','id',bo_id))
                   else '[]'::jsonb end;
        f := private.add_finding(f, r, sev,
          case lvl
            when 'no_owner'   then 'রেকর্ডে এই জমির কোনো বর্তমান ব্যক্তি-মালিক নেই।'
            when 'lookalike'  then format('বিক্রেতার নাম একজন মালিকের সঙ্গে প্রায় মেলে (মিল %s%%) কিন্তু নিশ্চিত নয়।', round(best * 100))
            else 'বিক্রেতার নাম ও পিতার নাম রেকর্ডের কোনো বর্তমান মালিকের সঙ্গে মেলে না।' end,
          case lvl
            when 'no_owner'   then 'The records show no current private owner for this plot.'
            when 'lookalike'  then format('The seller''s name only resembles a recorded owner (%s%% similar); not confirmed.', round(best * 100))
            else 'The seller''s name and father''s name do not match any current recorded owner.' end,
          ev);
      end if;

    elsif r.code = 'R08' then
      if seller_given and lvl = 'match' and bo_num is not null then
        claimed := coalesce(p_share_claimed,
                     case when p_area_claimed is not null and pl.area_decimal > 0 then p_area_claimed / pl.area_decimal end);
        held := bo_num::numeric / nullif(bo_den, 0);
        if claimed is not null and held is not null and claimed > held + 0.005 then
          f := private.add_finding(f, r, r.severity,
            format('বিক্রেতার রেকর্ডকৃত অংশ %s/%s, কিন্তু তিনি %s%% অফার করছেন।', bo_num, bo_den, round(claimed * 100)),
            format('The seller is recorded as holding %s/%s of the plot but is offering %s%%.', bo_num, bo_den, round(claimed * 100)),
            jsonb_build_array(jsonb_build_object('table','ownerships','id',bo_id)));
        end if;
      end if;

    elsif r.code = 'R09' then
      select d1.id as a, d2.id as b, abs(d2.registered_on - d1.registered_on) as gap into rec9
      from public.deeds d1
      join public.deeds d2 on d2.plot_id = d1.plot_id and d2.id > d1.id
      join public.deed_parties s1 on s1.deed_id = d1.id and s1.role = 'seller'
      join public.deed_parties s2 on s2.deed_id = d2.id and s2.role = 'seller' and s2.person_id = s1.person_id
      where d1.plot_id = p_plot and d1.deed_type = 'sale' and d2.deed_type = 'sale'
        and d1.status = 'registered' and d2.status = 'registered'
        and abs(d2.registered_on - d1.registered_on) <= coalesce((r.params->>'days')::int, 90)
      limit 1;
      if found then
        f := private.add_finding(f, r, 'blocker',
          format('একই বিক্রেতা %s দিনের ব্যবধানে দুটি বিক্রয় দলিল করেছেন।', rec9.gap),
          format('The same seller registered two sale deeds %s days apart.', rec9.gap),
          jsonb_build_array(jsonb_build_object('table','deeds','id',rec9.a), jsonb_build_object('table','deeds','id',rec9.b)));
      else
        select da.id as a, db.id as b into rec9
        from public.deeds da
        join public.deed_parties bp on bp.deed_id = da.id and bp.role = 'buyer'
        join public.deeds db on db.plot_id = da.plot_id and db.registered_on > da.registered_on
        join public.deed_parties sp on sp.deed_id = db.id and sp.role = 'seller' and sp.person_id = bp.person_id
        where da.plot_id = p_plot and da.deed_type = 'sale' and db.deed_type = 'sale'
          and da.status = 'registered' and db.status = 'registered'
          and not exists (select 1 from public.mutations m where m.deed_id = da.id and m.status = 'approved')
        limit 1;
        if found then
          f := private.add_finding(f, r, 'blocker',
            'একটি আগের দলিলের নামজারি হয়নি, অথচ ক্রেতা নিজেই আবার বিক্রি করেছেন।',
            'A later deed follows an earlier sale that was never mutated.',
            jsonb_build_array(jsonb_build_object('table','deeds','id',rec9.a), jsonb_build_object('table','deeds','id',rec9.b)));
        end if;
      end if;

    elsif r.code = 'R10' then
      select coalesce(jsonb_agg(jsonb_build_object('table','deeds','id',d.id)), '[]'::jsonb), count(*), max(today - d.registered_on)
        into ev, n, v_age
      from public.deeds d
      where d.plot_id = p_plot and d.status = 'registered' and d.deed_type in ('sale','gift')
        and d.registered_on < today - coalesce((r.params->>'days')::int, 60)
        and not exists (select 1 from public.mutations m where m.deed_id = d.id and m.status = 'approved');
      if n > 0 then
        f := private.add_finding(f, r, r.severity,
          format('%s টি নিবন্ধিত দলিলের নামজারি অনুমোদিত হয়নি (সবচেয়ে পুরনো %s দিন)।', n, v_age),
          format('%s registered deed(s) have no approved mutation (oldest %s days).', n, v_age), ev);
      end if;

    elsif r.code = 'R11' then
      select count(distinct o.from_date) into n from public.ownerships o
      where o.plot_id = p_plot and coalesce(o.acquired_via, '') <> 'survey'
        and o.from_date >= today - make_interval(months => coalesce((r.params->>'months')::int, 24));
      if n >= coalesce((r.params->>'count')::int, 3) then
        f := private.add_finding(f, r, r.severity,
          format('গত %s মাসে %s বার মালিকানা বদলেছে।', coalesce((r.params->>'months')::int, 24), n),
          format('%s ownership changes in the last %s months.', n, coalesce((r.params->>'months')::int, 24)),
          (select coalesce(jsonb_agg(jsonb_build_object('table','ownerships','id',o.id)), '[]'::jsonb) from public.ownerships o
            where o.plot_id = p_plot and coalesce(o.acquired_via, '') <> 'survey'
              and o.from_date >= today - make_interval(months => coalesce((r.params->>'months')::int, 24))));
      end if;

    elsif r.code = 'R12' then
      select coalesce(jsonb_agg(jsonb_build_object('table','ownerships','id',o.id)), '[]'::jsonb), count(*)
        into ev, n from public.ownerships o
      where o.plot_id = p_plot and o.to_date is null
        and (o.acquired_via is null or (o.acquired_via in ('sale','gift') and o.source_deed_id is null));
      if n > 0 then
        f := private.add_finding(f, r, r.severity,
          'বর্তমান মালিকের পেছনে কোনো দলিল, নামজারি বা উত্তরাধিকারের রেকর্ড নেই।',
          'The current owner has no deed, mutation or inheritance record behind them.', ev);
      end if;

    elsif r.code = 'R13' then
      select coalesce(jsonb_agg(jsonb_build_object('table','tax_records','id',t.id)), '[]'::jsonb), count(*)
        into ev, n from public.tax_records t where t.plot_id = p_plot and t.paid_on is null and t.fiscal_year < fy;
      if n >= coalesce((r.params->>'medium_years')::int, 1) then
        sev := case when n >= coalesce((r.params->>'high_years')::int, 3) then 'high' else 'medium' end;
        f := private.add_finding(f, r, sev,
          format('ভূমি উন্নয়ন কর %s অর্থবছরের জন্য বকেয়া।', n),
          format('Land development tax is unpaid for %s fiscal year(s).', n), ev);
      end if;

    elsif r.code = 'R14' then
      select coalesce(jsonb_agg(jsonb_build_object('table','land_flags','id',l.id)), '[]'::jsonb), count(*)
        into ev, n from public.land_flags l where l.plot_id = p_plot and l.status = 'active' and l.flag in ('mortgage','lien');
      if n > 0 then
        f := private.add_finding(f, r, r.severity,
          'জমির ওপর সক্রিয় বন্ধক বা ক্রোক নথিভুক্ত আছে।',
          'An active mortgage or lien is recorded on the plot.', ev);
      end if;

    elsif r.code = 'R15' then
      pct := coalesce((r.params->>'pct')::numeric, 10) / 100;
      ev := '[]'::jsonb; mm_bn := '{}'; mm_en := '{}';
      if p_area_claimed is not null and pl.area_decimal > 0 and p_area_claimed > pl.area_decimal * (1 + pct) then
        mm_bn := mm_bn || format('আপনাকে দেখানো পরিমাণ %s শতাংশ, রেকর্ডে %s শতাংশ', round(p_area_claimed, 2), pl.area_decimal);
        mm_en := mm_en || format('offered area %s decimal vs %s recorded', round(p_area_claimed, 2), pl.area_decimal);
      end if;
      if p_measured_area is not null and pl.area_decimal > 0 and abs(p_measured_area - pl.area_decimal) / pl.area_decimal > pct then
        mm_bn := mm_bn || format('মাপা পরিমাণ %s শতাংশ, রেকর্ডে %s শতাংশ', round(p_measured_area, 2), pl.area_decimal);
        mm_en := mm_en || format('measured area %s decimal vs %s recorded', round(p_measured_area, 2), pl.area_decimal);
      end if;
      for rec in
        select d.id as did, d.area_sold, o.share_num, o.share_den
        from public.ownerships o join public.deeds d on d.id = o.source_deed_id
        where o.plot_id = p_plot and o.to_date is null and d.area_sold is not null and d.deed_type in ('sale','gift')
      loop
        expected := pl.area_decimal * rec.share_num::numeric / nullif(rec.share_den, 0);
        if expected > 0 and abs(rec.area_sold - expected) / expected > pct then
          mm_bn := mm_bn || format('দলিলে %s শতাংশ, রেকর্ড অনুযায়ী প্রত্যাশিত %s শতাংশ', rec.area_sold, round(expected, 2));
          mm_en := mm_en || format('deed says %s decimal, record implies %s', rec.area_sold, round(expected, 2));
          ev := ev || jsonb_build_array(jsonb_build_object('table','deeds','id',rec.did));
        end if;
      end loop;
      if coalesce(array_length(mm_bn, 1), 0) > 0 then
        f := private.add_finding(f, r, r.severity, array_to_string(mm_bn, '; ') || ' (১০%-এর বেশি পার্থক্য)।',
          array_to_string(mm_en, '; ') || ' (more than ' || round(pct * 100) || '% apart).', ev);
      end if;

    elsif r.code = 'R16' then
      pct := coalesce((r.params->>'pct')::numeric, 20) / 100;
      select coalesce(jsonb_agg(jsonb_build_object('table','survey_records','id',a.id)), '[]'::jsonb), count(*)
        into ev, n
      from public.survey_records a
      join public.survey_records b on b.plot_id = a.plot_id and b.survey_type > a.survey_type
      where a.plot_id = p_plot and a.recorded_area > 0 and b.recorded_area > 0
        and abs(a.recorded_area - b.recorded_area) / greatest(a.recorded_area, b.recorded_area) > pct;
      select count(*) into dups
      from public.survey_records a
      join public.plots pa on pa.id = a.plot_id
      join public.plots pb on pb.mouza_id = pa.mouza_id and pb.id <> pa.id
      join public.survey_records b on b.plot_id = pb.id and b.survey_type = a.survey_type and b.dag_no = a.dag_no
      where a.plot_id = p_plot;
      if n > 0 or dups > 0 then
        f := private.add_finding(f, r, r.severity,
          case when n > 0 then 'দুটি জরিপের রেকর্ডে জমির পরিমাণে বড় অমিল আছে।'
               else 'একই দাগ নম্বর অন্য একটি জমির রেকর্ডেও আছে।' end,
          case when n > 0 then 'Two survey generations record very different areas for this plot.'
               else 'The same dag number appears on another plot in this mouza.' end, ev);
      end if;

    elsif r.code = 'R17' then
      select coalesce(jsonb_agg(jsonb_build_object('table','ownerships','id',o.id)), '[]'::jsonb), count(*)
        into ev, n from public.ownerships o join public.persons pe on pe.id = o.person_id
      where o.plot_id = p_plot and o.to_date is null and pe.is_minor;
      if n > 0 then
        f := private.add_finding(f, r, r.severity,
          'একজন বর্তমান সহ-অংশীদার নাবালক।', 'A current co-sharer is a minor.', ev);
      end if;

    elsif r.code = 'R18' then
      if pl.land_class = 'agricultural' then
        f := private.add_finding(f, r, r.severity, 'জমির শ্রেণি কৃষি।', 'The land class is agricultural.', '[]'::jsonb);
      end if;

    elsif r.code = 'R19' then
      select coalesce(jsonb_agg(jsonb_build_object('table','land_flags','id',l.id)), '[]'::jsonb), count(*)
        into ev, n from public.land_flags l where l.plot_id = p_plot and l.status = 'active' and l.flag = 'admin_hold';
      if n > 0 then
        f := private.add_finding(f, r, 'blocker',
          'ভূমি প্রশাসন জমিটি স্থগিত (ফ্রিজ) করেছে।', 'The land office has put an administrative hold on this plot.', ev);
      end if;

    elsif r.code = 'R20' then
      select count(distinct survey_type), bool_or(survey_type in ('BS','DIGITAL')) into n, hasbs
        from public.survey_records where plot_id = p_plot;
      if n < 2 or not coalesce(hasbs, false) then
        f := private.add_finding(f, r, r.severity,
          'একটি জরিপের রেকর্ড বা সাম্প্রতিক হালনাগাদ অনুপস্থিত।',
          'A survey generation or a recent update is missing.', '[]'::jsonb);
      end if;
    end if;
  end loop;

  -- ---- verdict ----
  select coalesce(jsonb_agg(q.e order by q.rk, q.code), '[]'::jsonb), coalesce(sum(q.pts), 0), coalesce(bool_or(q.sev = 'blocker'), false)
    into fin, tot, has_blocker
  from (select t.e as e, (t.e->>'points')::int as pts, t.e->>'severity' as sev, t.e->>'code' as code,
               case t.e->>'severity' when 'blocker' then 0 when 'high' then 1 when 'medium' then 2 else 3 end as rk
        from jsonb_array_elements(f) as t(e)) q;
  tot := least(tot, 100);
  vd := (case when has_blocker then 'stop' when tot >= v_thresh then 'caution' else 'clear' end)::public.verdict_t;

  -- ---- next steps (documents to ask for, actions to take) ----
  for step_code in select distinct t.e->>'code' from jsonb_array_elements(fin) as t(e) order by 1 loop
    steps := steps || coalesce((select jsonb_agg(s || jsonb_build_object('rule', step_code))
                                from jsonb_array_elements(coalesce(smap -> step_code, '[]'::jsonb)) as x(s)), '[]'::jsonb);
  end loop;

  return jsonb_build_object(
    'plot_id', p_plot, 'verdict', vd, 'risk_points', tot, 'findings', fin, 'next_steps', steps,
    'seller_match', sm, 'state_hash', public.plot_state_hash(p_plot), 'evaluated_at', now(),
    'disclaimer_en', 'Decision support, not legal advice.',
    'disclaimer_bn', 'এটি সিদ্ধান্ত-সহায়ক তথ্য, আইনি পরামর্শ নয়।');
end $fn$;

-- private helpers stay unreachable from the API
revoke all on function private.evaluate_plot(bigint, text, text, numeric, numeric, numeric, text) from public, anon, authenticated;

notify pgrst, 'reload schema';

-- ---------- check query ----------
select (select count(*) from public.risk_rules) as rules,
       (select count(*) from pg_proc where pronamespace = 'private'::regnamespace) as private_functions,
       (select string_agg(distinct proowner::regrole::text, ',') from pg_proc where pronamespace = 'private'::regnamespace) as function_owner,
       private.name_sim('Md. Rahim Uddin Sarker', 'রহিম উদ্দিন সরকার Rahim Uddin Sarker') as sim_demo;

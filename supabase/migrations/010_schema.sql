-- 010_schema.sql - V-Land P5 / Build Round 2 (A. Schema)
-- Run in Supabase SQL Editor after 001-003. Safe to re-run.
set search_path = public, extensions;

-- ---------- enums ----------
do $$ begin create type survey_type    as enum ('CS','SA','RS','BS','DIGITAL'); exception when duplicate_object then null; end $$;
do $$ begin create type khatian_kind   as enum ('private','khas','vested','waqf'); exception when duplicate_object then null; end $$;
do $$ begin create type land_class     as enum ('residential','agricultural','commercial','water','other'); exception when duplicate_object then null; end $$;
do $$ begin create type deed_type      as enum ('sale','gift','mortgage','partition','lease','inheritance'); exception when duplicate_object then null; end $$;
do $$ begin create type deed_status    as enum ('registered','cancelled'); exception when duplicate_object then null; end $$;
do $$ begin create type deed_role      as enum ('seller','buyer','mortgagor','mortgagee'); exception when duplicate_object then null; end $$;
do $$ begin create type flag_kind      as enum ('khas','vested','acquisition','waqf','mortgage','lien','admin_hold'); exception when duplicate_object then null; end $$;
do $$ begin create type flag_status    as enum ('active','released'); exception when duplicate_object then null; end $$;
do $$ begin create type case_type      as enum ('title_suit','partition_suit','injunction','other'); exception when duplicate_object then null; end $$;
do $$ begin create type case_status    as enum ('pending','disposed'); exception when duplicate_object then null; end $$;
do $$ begin create type mutation_status as enum ('pending','approved','rejected'); exception when duplicate_object then null; end $$;
do $$ begin create type severity_t     as enum ('blocker','high','medium','info'); exception when duplicate_object then null; end $$;
do $$ begin create type verdict_t      as enum ('clear','caution','stop'); exception when duplicate_object then null; end $$;
do $$ begin create type ticket_status  as enum ('open','resolved'); exception when duplicate_object then null; end $$;
do $$ begin create type signal_status  as enum ('new','investigating','confirmed','dismissed'); exception when duplicate_object then null; end $$;

-- ---------- land tables ----------
create table if not exists plots (
  id            bigint generated always as identity primary key,
  mouza_id      bigint not null references mouzas(id),
  area_decimal  numeric(10,2) not null check (area_decimal > 0),
  land_class    land_class not null default 'residential',
  geom          geometry(Polygon,4326),
  scenario_code text unique,
  is_synthetic  boolean not null default true check (is_synthetic),
  created_at    timestamptz not null default now()
);

create table if not exists survey_records (
  id            bigint generated always as identity primary key,
  plot_id       bigint not null references plots(id) on delete cascade,
  survey_type   survey_type not null,
  khatian_no    text not null,
  dag_no        text not null,
  recorded_area numeric(10,2) check (recorded_area > 0),
  khatian_kind  khatian_kind not null default 'private',
  is_synthetic  boolean not null default true,
  unique (plot_id, survey_type)
);

create table if not exists persons (
  id            uuid primary key default gen_random_uuid(),
  name_bn       text not null,
  name_en       text not null,
  father_name_bn text,
  father_name_en text,
  village_text  text,
  name_key      text not null,            -- normalised for matching
  is_minor      boolean not null default false,
  is_synthetic  boolean not null default true
);  -- deliberately no NID / phone / address columns

create table if not exists deeds (
  id          bigint generated always as identity primary key,
  plot_id     bigint not null references plots(id) on delete cascade,
  deed_no     text not null,
  year        int  not null check (year between 1900 and 2100),
  sub_registry_office text not null,
  deed_type   deed_type not null,
  registered_on date not null,
  area_sold   numeric(10,2) check (area_sold > 0),
  consideration numeric(14,2),
  status      deed_status not null default 'registered',
  is_synthetic boolean not null default true,
  unique (deed_no, year, sub_registry_office)
);

create table if not exists deed_parties (
  deed_id   bigint not null references deeds(id) on delete cascade,
  person_id uuid   not null references persons(id),
  role      deed_role not null,
  primary key (deed_id, person_id, role)
);

create table if not exists ownerships (
  id           bigint generated always as identity primary key,
  plot_id      bigint not null references plots(id) on delete cascade,
  person_id    uuid   not null references persons(id),
  share_num    int not null check (share_num > 0),
  share_den    int not null check (share_den > 0),
  acquired_via text not null check (acquired_via in ('inheritance','deed','allotment','mutation','survey')),
  source_deed_id bigint references deeds(id),
  from_date    date not null,
  to_date      date,
  check (share_num <= share_den),
  check (to_date is null or to_date >= from_date)
);

create table if not exists mutations (
  id         bigint generated always as identity primary key,
  plot_id    bigint not null references plots(id) on delete cascade,
  case_no    text not null,
  deed_id    bigint references deeds(id),
  status     mutation_status not null default 'pending',
  filed_on   date not null,
  decided_on date,
  office     text not null,
  unique (case_no, office)
);

create table if not exists cases (
  id           bigint generated always as identity primary key,
  plot_id      bigint not null references plots(id) on delete cascade,
  court        text not null,
  case_no      text not null,
  case_type    case_type not null,
  status       case_status not null default 'pending',
  stay_order   boolean not null default false,
  filed_on     date not null,
  next_hearing date
);

create table if not exists land_flags (
  id        bigint generated always as identity primary key,
  plot_id   bigint not null references plots(id) on delete cascade,
  flag      flag_kind not null,
  authority text,
  ref_no    text,
  status    flag_status not null default 'active',
  from_date date not null default current_date,
  to_date   date
);

create table if not exists acquisition_zones (
  id         bigint generated always as identity primary key,
  project    text not null,
  notice_ref text not null,
  stage      text not null check (stage in ('planned','notice','active','completed')),
  geom       geometry(Polygon,4326) not null
);

create table if not exists tax_records (
  id          bigint generated always as identity primary key,
  plot_id     bigint not null references plots(id) on delete cascade,
  fiscal_year int not null,
  amount      numeric(12,2) not null check (amount >= 0),
  paid_on     date,
  receipt_no  text,
  unique (plot_id, fiscal_year)
);

-- ---------- citizen-owned tables ----------
create table if not exists verifications (
  id          bigint generated always as identity primary key,
  user_id     uuid references auth.users(id) on delete set null,
  plot_id     bigint not null references plots(id),
  seller_input jsonb,
  intent      text,
  verdict     verdict_t not null,
  risk_points int not null default 0,
  findings    jsonb not null default '[]',
  state_hash  text,
  created_at  timestamptz not null default now()
);
create table if not exists reports (
  id           bigint generated always as identity primary key,
  code         text not null unique,
  verification_id bigint not null references verifications(id),
  user_id      uuid references auth.users(id) on delete set null,
  payload      jsonb not null,
  payload_hash text not null,
  signature    text not null,
  state_hash   text not null,
  issued_at    timestamptz not null default now(),
  expires_at   timestamptz not null,
  revoked      boolean not null default false,
  revoked_reason text
);
create table if not exists watches (
  user_id uuid not null references auth.users(id) on delete cascade,
  plot_id bigint not null references plots(id) on delete cascade,
  last_state_hash text,
  created_at timestamptz not null default now(),
  primary key (user_id, plot_id)
);
create table if not exists notifications (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  plot_id    bigint references plots(id) on delete cascade,
  type       text not null,
  title      text not null,
  read       boolean not null default false,
  created_at timestamptz not null default now()
);
create table if not exists purchase_cases (
  id        bigint generated always as identity primary key,
  user_id   uuid not null references auth.users(id) on delete cascade,
  plot_id   bigint not null references plots(id),
  stage     text not null default 'checking',
  checklist jsonb not null default '[]',
  notes     text,
  updated_at timestamptz not null default now(),
  unique (user_id, plot_id)
);
create table if not exists objections (
  id        bigint generated always as identity primary key,
  user_id   uuid references auth.users(id) on delete set null,
  plot_id   bigint references plots(id),
  type      text not null,
  message   text not null check (length(message) between 5 and 2000),
  status    ticket_status not null default 'open',
  resolution text,
  created_at timestamptz not null default now()
);
create table if not exists fraud_reports (like objections including all);

-- ---------- rules, events, signals ----------
create table if not exists risk_rules (
  code      text primary key,              -- R01..R20
  enabled   boolean not null default true,
  weight    int not null default 0,
  severity  severity_t not null,
  params    jsonb not null default '{}',
  title_bn  text not null, title_en text not null,
  advice_bn text not null, advice_en text not null,
  updated_at timestamptz not null default now()
);
create table if not exists risk_rules_history (
  id bigint generated always as identity primary key,
  code text not null, snapshot jsonb not null, reason text,
  changed_by uuid, changed_at timestamptz not null default now()
);
create table if not exists plot_events (
  id bigint generated always as identity primary key,
  plot_id bigint not null references plots(id) on delete cascade,
  event_type text not null, detail jsonb,
  created_at timestamptz not null default now()
);
create table if not exists fraud_signals (
  id bigint generated always as identity primary key,
  plot_id bigint references plots(id) on delete cascade,
  signal_type text not null, evidence jsonb not null,
  status signal_status not null default 'new',
  dedupe_key text not null unique,
  created_at timestamptz not null default now()
);

-- ---------- audit log + private secrets ----------
create table if not exists audit_log (
  id bigint primary key,
  actor uuid, action text not null, entity text not null, entity_id text,
  diff jsonb not null default '{}',
  created_at timestamptz not null default clock_timestamp(),
  prev_hash text not null, hash text not null
);
create table if not exists private.app_secrets (name text primary key, value text not null);
insert into private.app_secrets (name, value)
  values ('report_signing', encode(gen_random_bytes(32),'hex')) on conflict do nothing;

-- ---------- indexes ----------
create index if not exists plots_geom_gix   on plots using gist (geom);
create index if not exists zones_geom_gix   on acquisition_zones using gist (geom);
create index if not exists plots_mouza_idx  on plots(mouza_id);
create index if not exists persons_name_trgm on persons using gin (name_key gin_trgm_ops);
create index if not exists survey_lookup_idx on survey_records (survey_type, khatian_no, dag_no);
create index if not exists own_current_idx  on ownerships (plot_id) where to_date is null;
create index if not exists deeds_plot_idx   on deeds(plot_id);
create index if not exists muts_plot_idx    on mutations(plot_id);
create index if not exists cases_plot_idx   on cases(plot_id);
create index if not exists flags_plot_idx   on land_flags(plot_id) where status = 'active';
create index if not exists events_plot_idx  on plot_events(plot_id, created_at desc);
create index if not exists verif_user_idx   on verifications(user_id, created_at desc);

-- ---------- share-sum warning ----------
create or replace function warn_share_sum() returns trigger
language plpgsql set search_path = public, extensions, pg_temp as $$
declare s numeric; pid bigint := coalesce(new.plot_id, old.plot_id);
begin
  select coalesce(sum(share_num::numeric/share_den),0) into s
    from ownerships where plot_id = pid and to_date is null;
  if s <> 0 and abs(s - 1) > 0.0001 then
    raise warning 'plot % current shares sum to % (expected 1)', pid, s;
  end if;
  return null;
end $$;
drop trigger if exists trg_share_sum on ownerships;
create trigger trg_share_sum after insert or update or delete on ownerships
  for each row execute function warn_share_sum();

-- ---------- state hash ----------
create or replace function plot_state_hash(p_plot bigint) returns text
language sql stable security definer set search_path = public, extensions, pg_temp as $$
  select encode(digest(
    coalesce((select jsonb_agg(to_jsonb(o) order by o.id)::text from ownerships o where o.plot_id=p_plot),'') || '|' ||
    coalesce((select jsonb_agg(to_jsonb(d) order by d.id)::text from deeds d where d.plot_id=p_plot),'') || '|' ||
    coalesce((select jsonb_agg(to_jsonb(m) order by m.id)::text from mutations m where m.plot_id=p_plot),'') || '|' ||
    coalesce((select jsonb_agg(to_jsonb(c) order by c.id)::text from cases c where c.plot_id=p_plot),'') || '|' ||
    coalesce((select jsonb_agg(to_jsonb(f) order by f.id)::text from land_flags f where f.plot_id=p_plot),'') || '|' ||
    coalesce((select jsonb_agg(to_jsonb(t) order by t.id)::text from tax_records t where t.plot_id=p_plot),''),
  'sha256'), 'hex');
$$;
revoke all on function plot_state_hash(bigint) from public, anon;
grant execute on function plot_state_hash(bigint) to authenticated;

-- ---------- change events + watcher notifications ----------
create or replace function record_plot_event() returns trigger
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare r jsonb := to_jsonb(coalesce(new, old)); pid bigint := (r->>'plot_id')::bigint;
begin
  if pid is null then return null; end if;
  insert into plot_events (plot_id, event_type, detail)
    values (pid, tg_table_name || '.' || lower(tg_op), r);
  insert into notifications (user_id, plot_id, type, title)
    select w.user_id, pid, 'plot_changed', 'Record changed: ' || tg_table_name || ' (' || lower(tg_op) || ')'
    from watches w where w.plot_id = pid;
  return null;
end $$;
do $$ declare t text; begin
  foreach t in array array['ownerships','deeds','mutations','cases','land_flags','tax_records'] loop
    execute format('drop trigger if exists trg_event on %I', t);
    execute format('create trigger trg_event after insert or update or delete on %I for each row execute function record_plot_event()', t);
  end loop;
end $$;

-- ---------- audit chain ----------
create or replace function audit_write(p_actor uuid, p_action text, p_entity text, p_entity_id text, p_diff jsonb)
returns bigint language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare prev text; nid bigint; ts timestamptz := clock_timestamp(); h text;
begin
  lock table audit_log in exclusive mode;
  select coalesce(max(id),0)+1 into nid from audit_log;
  select hash into prev from audit_log order by id desc limit 1;
  prev := coalesce(prev, repeat('0',64));
  h := encode(digest(prev || '|' || nid || '|' || coalesce(p_actor::text,'') || '|' || p_action || '|' || p_entity || '|' ||
        coalesce(p_entity_id,'') || '|' || coalesce(p_diff,'{}'::jsonb)::text || '|' || to_char(ts at time zone 'utc','YYYY-MM-DD"T"HH24:MI:SS.US'), 'sha256'), 'hex');
  insert into audit_log (id, actor, action, entity, entity_id, diff, created_at, prev_hash, hash)
    values (nid, p_actor, p_action, p_entity, p_entity_id, coalesce(p_diff,'{}'::jsonb), ts, prev, h);
  return nid;
end $$;
revoke all on function audit_write(uuid,text,text,text,jsonb) from public, anon, authenticated;

create or replace function audit_verify() returns jsonb
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare r record; prev text := repeat('0',64); h text; n int := 0;
begin
  if not is_admin() then raise exception 'admin only' using errcode = '42501'; end if;
  for r in select * from audit_log order by id loop
    h := encode(digest(prev || '|' || r.id || '|' || coalesce(r.actor::text,'') || '|' || r.action || '|' || r.entity || '|' ||
          coalesce(r.entity_id,'') || '|' || r.diff::text || '|' || to_char(r.created_at at time zone 'utc','YYYY-MM-DD"T"HH24:MI:SS.US'), 'sha256'), 'hex');
    if r.prev_hash <> prev or r.hash <> h then
      return jsonb_build_object('intact', false, 'broken_at', r.id, 'entries', n);
    end if;
    prev := r.hash; n := n + 1;
  end loop;
  return jsonb_build_object('intact', true, 'entries', n);
end $$;
revoke all on function audit_verify() from public, anon;
grant execute on function audit_verify() to authenticated;

-- ---------- RLS ----------
do $$ declare t text; begin
  foreach t in array array['plots','survey_records','persons','deeds','deed_parties','ownerships','mutations','cases',
    'land_flags','acquisition_zones','tax_records','verifications','reports','watches','notifications','purchase_cases',
    'objections','fraud_reports','risk_rules','risk_rules_history','plot_events','fraud_signals','audit_log'] loop
    execute format('alter table %I enable row level security', t);
    execute format('revoke all on %I from anon', t);
    execute format('grant select, insert, update, delete on %I to authenticated', t);
    execute format('drop policy if exists %I on %I', t || '_admin_all', t);
    execute format('create policy %I on %I for all to authenticated using (is_admin()) with check (is_admin())', t || '_admin_all', t);
  end loop;
  -- citizens: read-only on their own rows (all writes go through functions)
  foreach t in array array['verifications','reports','watches','notifications','purchase_cases','objections','fraud_reports'] loop
    execute format('drop policy if exists %I on %I', t || '_own_select', t);
    execute format('create policy %I on %I for select to authenticated using (user_id = auth.uid())', t || '_own_select', t);
    execute format('revoke insert, update, delete on %I from authenticated', t);
  end loop;
  -- audit_log and risk rules: admin only, nothing for citizens
  revoke insert, update, delete on audit_log from authenticated;   -- only audit_write() may append
end $$;

-- ---------- check query ----------
select 'tables' as what, count(*) from information_schema.tables where table_schema='public'
union all select 'audit_verify', 0;

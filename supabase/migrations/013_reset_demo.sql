set search_path = public, extensions;

create table if not exists private.demo_snapshot (
  tbl text primary key,
  rows jsonb not null,
  taken_at timestamptz not null default now()
);

create or replace function private.snapshot_demo() returns integer
language plpgsql security definer set search_path = public, private, extensions as $$
declare
  ids bigint[];
  t text;
begin
  select array_agg(id) into ids from public.plots where scenario_code is not null;
  if ids is null then raise exception 'no_scenario_plots'; end if;
  delete from private.demo_snapshot;
  insert into private.demo_snapshot(tbl, rows)
    select 'plots', coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from public.plots x where x.id = any(ids);
  insert into private.demo_snapshot(tbl, rows)
    select 'deed_parties', coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from public.deed_parties x
    where x.deed_id in (select id from public.deeds where plot_id = any(ids));
  foreach t in array array['survey_records','deeds','mutations','ownerships','cases','land_flags','tax_records'] loop
    execute format('insert into private.demo_snapshot(tbl, rows) select %L, coalesce(jsonb_agg(to_jsonb(x)), ''[]''::jsonb) from public.%I x where x.plot_id = any($1)', t, t) using ids;
  end loop;
  return array_length(ids, 1);
end $$;

create or replace function private.restore_demo() returns jsonb
language plpgsql security definer set search_path = public, private, extensions as $$
declare
  ids bigint[];
  t text;
  snap jsonb;
  cnt integer;
  total integer := 0;
begin
  if not exists (select 1 from private.demo_snapshot) then raise exception 'no_snapshot'; end if;
  select array_agg(id) into ids from public.plots where scenario_code is not null;

  foreach t in array array['ownerships','deeds','mutations','cases','land_flags','tax_records'] loop
    execute format('alter table public.%I disable trigger trg_event', t);
  end loop;

  delete from public.ownerships where plot_id = any(ids);
  delete from public.mutations where plot_id = any(ids);
  delete from public.deed_parties where deed_id in (select id from public.deeds where plot_id = any(ids));
  delete from public.deeds where plot_id = any(ids);
  delete from public.cases where plot_id = any(ids);
  delete from public.land_flags where plot_id = any(ids);
  delete from public.tax_records where plot_id = any(ids);
  delete from public.survey_records where plot_id = any(ids);

  foreach t in array array['survey_records','deeds','deed_parties','mutations','ownerships','cases','land_flags','tax_records'] loop
    select rows into snap from private.demo_snapshot where tbl = t;
    execute format('insert into public.%I overriding system value select * from jsonb_populate_recordset(null::public.%I, $1)', t, t) using coalesce(snap, '[]'::jsonb);
    get diagnostics cnt = row_count;
    total := total + cnt;
  end loop;

  select rows into snap from private.demo_snapshot where tbl = 'plots';
  update public.plots p set area_decimal = s.area_decimal, land_class = s.land_class, geom = s.geom
    from jsonb_populate_recordset(null::public.plots, snap) s where p.id = s.id;

  delete from public.plot_events where plot_id = any(ids);
  delete from public.fraud_signals where plot_id = any(ids);

  foreach t in array array['ownerships','deeds','mutations','cases','land_flags','tax_records'] loop
    execute format('alter table public.%I enable trigger trg_event', t);
  end loop;

  return jsonb_build_object('plots', array_length(ids, 1), 'rows_restored', total);
end $$;

create or replace function public.reset_demo_data() returns jsonb
language plpgsql security definer set search_path = public, private as $$
begin
  if not public.is_admin() then raise exception 'admin_only'; end if;
  return private.restore_demo();
end $$;
revoke all on function public.reset_demo_data() from public, anon;
grant execute on function public.reset_demo_data() to authenticated;

select 'ok' as status;
